import { Fighting } from "./rules/Fighting";
import { Combatant } from "./types/Combatant";
import { Roll } from "./types/Roll";
import Files from "./util/Files";

type Target = "self" | "ally" | "enemy" | "allies" | "enemies" | "all" | "randomEnemies";

export interface AbilityEffect {
  type: "attack" | "damage" | "heal" | "buff" | "debuff" | "flee";
  stat?: "str" | "dex" | "con" | "int" | "wis" | "cha";
  amount?: string; // e.g. "=1d6", "=2d8", "3"
  duration?: number; // in turns
  status?: {
    name: string;
    effect: { [key: string]: any };
    duration: number;
  }
  saveDC?: number;
  saveType?: keyof Combatant;
  succeedDC?: number;
  succeedType?: keyof Combatant;
  chance?: number; // 0.0-1.0
}

export interface Ability {
  name: string;
  type: "spell" | "skill";
  description: string;
  aspect: "arcane" | "physical" | "divine" | "social";
  target: Target[];
  effects: AbilityEffect[];
}

type AbilityDictionary = {
  [key: string]: Ability
};

export default class AbilityHandler {
  abilities: AbilityDictionary = {};

  constructor() { }

  // load abilities from JSON file
  async loadAbilities() {
    let data = await Files.readJSON<AbilityDictionary>("./settings/fantasy/abilities.json");
      console.log("Loaded", Object.keys(data).length, "abilities!");
      this.abilities = data;
  }

  getAbility(name: string): Ability {
    let ability = this.abilities[name];
    if (!ability) {
      throw new Error(`Ability not found: ${name} (known abilities: ${Object.keys(this.abilities).join(", ") || "none"})`);
    }
    return ability;
  }

  validTargets(ability: Ability, user: Combatant, allies: Combatant[], enemies: Combatant[]): (Combatant | Combatant[])[] {
    let targets: (Combatant | Combatant[])[] = [];
    for (const t of [...ability.target]) {
      switch (t) {
        case "self":    targets.push(user); break;
        case "ally":    targets.push(...allies); break;
        case "enemy":   targets.push(...enemies); break;
        case "allies":  targets.push(allies); break;
        case "enemies": targets.push(enemies); break;
        case "all":     targets.push([user, ...allies, ...enemies]); break;

        // we need to special case randomEnemies since we need to select them ourselves
        case "randomEnemies": break;

        // default:
          // throw new Error(`Unknown target type: ${t}`);
      }
    }
    return targets;
  }

  static async rollAmount(name: string, amount: string, roll: Roll, user: Combatant): Promise<number> {
    let result = 0;
    if (amount.startsWith("=")) {
      const [num, sides] = amount.slice(1).split("d").map(Number);
      for (let i = 0; i < num; i++) {
        let theRoll = await roll(user, `for ${name}`, sides);
        result += theRoll.amount;
      }
    } else {
      result = parseInt(amount);
    }
    return result;
  }

  // Check if target can save
  static async resist(saveType: keyof Combatant, saveDC: number, roll: Roll, target: Combatant, name: string): Promise<boolean> {
    if (saveType && saveDC) {
      const saveRoll = await roll(target, `to resist ${name}`, 20);
      const effective = Fighting.effectiveStats(target);
      const saveMod = Fighting.statMod(effective[saveType] as number);
      const saveTotal = saveRoll.amount + saveMod;

      if (saveTotal >= saveDC) {
        // console.log(`${target.name} resists ${name}!`);
        return true; // Effect resisted, continue to next effect
      }
    }
    return false; // Effect applies
  }

  static async handleEffect(
    name: string,
    effect: AbilityEffect, user: Combatant, target: Combatant | Combatant[],
    { roll, attack, hit, heal, status }: {
      roll: Roll;
      attack: (
        combatant: Combatant,
        target: Combatant,
        // roller: Roll
      ) => Promise<{ success: boolean, target: Combatant }>;
      hit: (
        attacker: Combatant,
        defender: Combatant,
        damage: number,
        critical: boolean,
        by: string,
        success: boolean
      ) => Promise<void>;
      heal: (
        healer: Combatant,
        target: Combatant,
        amount: number
      ) => Promise<void>;
      status: (
        user: Combatant,
        target: Combatant,
        name: string,
        effect: { [key: string]: any },
        duration: number
      ) => Promise<void>;
    }
  ) {
    if (Array.isArray(target)) {
      // if all are dead, skip
      if (target.every(t => t.hp <= 0)) {
        return;
      }
    } else {
      if (target.hp <= 0) {
        return;
      }
    }

    if (effect.type === "attack") {
      let success = false;
      if (Array.isArray(target)) {
        for (const t of target) {
          let result = await attack(user, t);
          success ||= result.success;
        }
      } else {
        let result = await attack(user, target);
        success = result.success;
      }
      if (!success) {
        // console.log(`${user.name}'s ${name} missed!`);
        return false;
      } else {
        // if all targets are dead, skip
        if (Array.isArray(target)) {
          if (target.every(t => t.hp <= 0)) {
            return true;
          }
        } else {
          if (target.hp <= 0) {
            return true;
          }
        }
        // if we have an onAttack effect... we could handle here
        // console.log("Checking for onAttack effects...", user.activeEffects);
        if (user.activeEffects?.some(e => e.effect['onAttackHit'])) {
          // handle onAttack effects with this/these enemies as targets
          for (const e of user.activeEffects) {
            if (e.effect['onAttackHit']) {
              // console.log(`Triggering onAttack effect: ${e.name}`);
              e.effect['onAttackHit'].forEach(async (attackFx: AbilityEffect) => {
                await this.handleEffect(e.name, attackFx, user, target, { roll, attack, hit, heal, status });
              })
            }
          }
        } else {
          // console.log("No onAttack effects to trigger.");
        }
      }
      return true;
    }

    if (effect.type === "damage") {
      if (Array.isArray(target)) {
        for (const t of target) {
          let amount = await AbilityHandler.rollAmount(name, effect.amount || "1", roll, user);
          await hit(
            user,
            t,
            amount,
            false, // critical
            `${user.forename}'s ${name}`,
            true // success
          );
        }
      } else {
        let amount = await AbilityHandler.rollAmount(name, effect.amount || "1", roll, user);
        await hit(user, target, amount, false, `${user.forename}'s ${name}`, true);
      }
    } else if (effect.type === "heal") {
      if (Array.isArray(target)) {
        for (const t of target) {
        let amount = await AbilityHandler.rollAmount(name, effect.amount || "1", roll, user);
          await heal(user, t, amount);
        }
      } else {
        let amount = await AbilityHandler.rollAmount(name, effect.amount || "1", roll, user);
        await heal(user, target, amount);
      }
    } else if (effect.type === "buff") { //} || effect.type === "debuff") {
      if (effect.status) {
        if (Array.isArray(target)) {
          for (const t of target) {
              await status(user, t, effect.status.name, { ...effect.status.effect, by: user }, effect.status.duration);
          }
        } else {
            await status(user, target, effect.status.name, { ...effect.status.effect, by: user }, effect.status.duration);
        }
      } else {
        throw new Error(`Buff effect must have a status defined`);
      }
    } else if (effect.type === "debuff") {
      // same as buff with a save
      if (effect.status) {
        if (Array.isArray(target)) {
          for (const t of target) {
            let resisted = await this.resist((effect.saveType || 'con'), effect.saveDC || 0, roll, t, effect.status.name);
            if (resisted) {
              console.log(`${t.name} resists ${effect.status.name}!`);
            } else {
              await status(user, t, effect.status.name, { ...effect.status.effect, by: user }, effect.status.duration);
            }
          }
        } else {
          // if (effect.type === "debuff" && !this.resist((effect.saveType || 'con'), effect.saveDC || 0, roll, target, effect.status.name)) {
          let resisted = await this.resist((effect.saveType || 'con'), effect.saveDC || 0, roll, target, effect.status.name);
          if (resisted) {
            console.log(`${target.name} resists ${effect.status.name}!`);
          } else {
            await status(user, target, effect.status.name, { ...effect.status.effect, by: user }, effect.status.duration);
          }
        }
      } else {
        throw new Error(`Debuff effect must have a status defined`);
      }
    } else if (effect.type === "flee") {
      const successful = async (combatant: Combatant) => {
        let effective = Fighting.effectiveStats(combatant);
        const stat = effective[(effect.succeedType || 'dex') as keyof Combatant] || 10;
        let rolls = await roll(user, `to flee`, 20);
        let total = rolls.amount + Fighting.statMod(stat);
        return total >= (effect.succeedDC || 15); // default -- DC 15 to flee
      }
      if (Array.isArray(target)) {
        for (const t of target) {
          // if (chance === undefined || Math.random() < chance) {
          if (await successful(t)) {
            await status(user, t, "Fleeing", { flee: true }, 1);
          } else {
            console.log(`${t.name} tried to flee but failed!`);
          }
        }
      } else {
        // if (chance === undefined || Math.random() < chance) {
        if (await successful(target)) {
          await status(user, target, "Fleeing", { flee: true }, 1);
        } else {
          console.log(`${target.name} tried to flee but failed!`);
        }
      }
    }
    
    else {
      throw new Error(`Unknown effect type: ${effect.type}`);
    }

    return true;
  }

  static async perform(
    ability: Ability, user: Combatant, target: Combatant | Combatant[],
    { roll, attack, hit, heal, status }: {
      roll: Roll;
      attack: (
        combatant: Combatant,
        target: Combatant,
      ) => Promise<{ success: boolean, target: Combatant }>;
      hit: (
        attacker: Combatant,
        defender: Combatant,
        damage: number,
        critical: boolean,
        by: string,
        success: boolean
      ) => Promise<void>;
      heal: (
        healer: Combatant,
        target: Combatant,
        amount: number
      ) => Promise<void>;
      status: (
        user: Combatant,
        target: Combatant,
        name: string,
        effect: { [key: string]: any },
        duration: number
      ) => Promise<void>;
    }
  ) {
    for (const effect of ability.effects) {
      let result = await this.handleEffect(ability.name, effect, user, target, { roll, attack, hit, heal, status });
      if (result === false) {
        break;
      }
    }
  }
}