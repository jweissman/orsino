import Deem from "../deem";
import Combat, { CombatContext } from "./Combat";
import { GameEvent, ReactionEvent, ResurrectEvent, UpgradeEvent } from "./Events";
import Generator from "./Generator";
import { CommandHandlers } from "./rules/Commands";
import { Fighting } from "./rules/Fighting";
import Words from "./tui/Words";
import { Combatant } from "./types/Combatant";
import { GenerationTemplateType } from "./types/GenerationTemplateType";
import { Roll } from "./types/Roll";
import { Team } from "./types/Team";
import Files from "./util/Files";
import { never } from "./util/never";

type Target = "self" | "ally" | "enemy" | "allies" | "enemies" | "all" | "randomEnemies" | "deadAlly";
export type DamageKind = "bleed" | "poison" | "psychic" | "lightning" | "earth" | "fire" | "ice" | "bludgeoning" | "piercing" | "slashing" | "force" | "radiant" | "necrotic" | "acid" | "true";
export type SaveKind = "poison" | "disease" | "death" | "magic" | "insanity" | "charm" | "fear" | "stun" | "will" | "breath" | "paralyze" | "sleep";

export interface StatusEffect {
  name: string;
  description?: string;
  effect: { [key: string]: any };
  duration?: number;
  by?: Combatant;
  whileEnvironment?: string;

  onAttack?: AbilityEffect[];
  onAttackHit?: AbilityEffect[];
  onTurnEnd?: AbilityEffect[];
  // onCastSpell?: AbilityEffect[];
  // onHit?: AbilityEffect[];
  onKill?: AbilityEffect[];
  onAttacked?: AbilityEffect[];
  // onTakeDamage?: AbilityEffect[];
  // onGiveHealing?: AbilityEffect[];
  // onBuff?: AbilityEffect[];
}

export interface AbilityEffect {
  description?: string;
  kind?: DamageKind;
  type: "attack" | "damage" | "heal" | "buff" | "debuff" | "flee" | "removeItem" | "drain" | "summon" | "removeStatus" | "upgrade" | "gold" | "xp" | "resurrect";
  stat?: "str" | "dex" | "con" | "int" | "wis" | "cha";

  amount?: string; // e.g. "=1d6", "=2d8", "3"
  target?: string;  //Target[];
  duration?: number; // in turns
  statusName?: string;
  status?: StatusEffect;
  saveDC?: number;
  saveType?: SaveKind;
  succeedDC?: number;
  succeedType?: SaveKind;
  chance?: number; // 0.0-1.0
  item?: string;

  condition?: {
    trait?: string; // traits the target must have
  }

  // for summoning
  creature?: string;
  options?: {};
  // for resurrection effects
  hpPercent?: number;
}

export interface Ability {
  name: string;
  type: "spell" | "skill" | "consumable";
  alignment?: 'good' | 'neutral' | 'evil';
  description: string;
  level?: number;
  kind?: string;
  aspect: "arcane" | "physical" | "divine" | "social" | "stealth" | "nature";
  target: Target[];
  effects: AbilityEffect[];
  condition?: {
    hasInterceptWeapon?: boolean;
    status?: string;
    dead?: boolean;
  };
  cooldown?: number;

  // for room feature interaction costs
  offer?: string;

  // for consumables/inventory items
  key?: any;
  charges?: number;
}

type AbilityDictionary = { [key: string]: Ability };

export default class AbilityHandler {
  static instance: AbilityHandler = new AbilityHandler();
  abilities: AbilityDictionary = {};
  loadedAbilities: boolean = false;

  constructor() { }

  // load abilities from JSON file
  async loadAbilities() {
    if (this.loadedAbilities) {
      return;
    }

    let data = await Files.readJSON<AbilityDictionary>("./settings/fantasy/abilities.json");
    this.abilities = data;
    await this.validateAbilities();
    this.loadedAbilities = true;
  }

  async validateAbilities() {
    // check that referenced abilities in templates exist
    let tables = await Files.readJSON<{ [key: string]: any }>("./settings/fantasy/tables.json");

    let coreLists = [
      ...Object.values(tables['abilities']['groups']),
    ];
    coreLists.forEach((abilities: any) => {
      let abilityNames = abilities[0] as string[];
      abilityNames.forEach((abilityName: string) => {
        if (!this.abilities[abilityName]) {
          throw new Error(`Unknown ability in template: ${abilityName}`);
        }
      });
    });

    // they also show up in aspects
    let npcAspects = Object.values(tables['npcTypeModifier']['groups']).map((a: any) => a.abilities).flat().filter(Boolean) as string[];
    npcAspects.forEach((abilityName: string) => {
      if (!this.abilities[abilityName]) {
        throw new Error(`Unknown ability in templates: ${abilityName}`);
      }
    });
    let creatureAspects = Object.values(tables['creatureAspects']['groups']).map((a: any) => a.abilities).flat().filter(Boolean) as string[];
    creatureAspects.forEach((abilityName: string) => {
      if (!this.abilities[abilityName]) {
        throw new Error(`Unknown ability in templates: ${abilityName}`);
      }
    });
  }


  getAbility(name: string): Ability {
    let ability = this.abilities[name];
    if (!ability) {
      // throw new Error(`Ability not found: ${name} (known abilities: ${Object.keys(this.abilities).join(", ") || "none"})`);
      // is it the .name of an ability?
      ability = Object.values(this.abilities).find(ab => ab.name === name) as Ability;
      if (!ability) {
        throw new Error(`Ability not found: ${name} (known abilities: ${Object.keys(this.abilities).join(", ") || "none"})`);
      }
    }
    return ability;
  }

  get spells(): Ability[] {
    return Object.values(this.abilities).filter(ab => ab.type === 'spell');
  }

  allSpellNames(aspect: string, maxLevel = Infinity, excludeEvilSpells = true): string[] {
    return Object.entries(this.abilities)
          .filter(([_key, ab]) => ab.aspect === aspect && ab.type === 'spell' && (ab.level ?? 0) <= maxLevel && (!excludeEvilSpells || ab.alignment !== 'evil'))
          .map(([key, _ab]) => key);
  }

  static validTargets(ability: Ability, user: Combatant, allies: Combatant[], enemies: Combatant[]): (Combatant | Combatant[])[] {
    let healing = ability.effects.every(fx => fx.type === "heal") && ability.effects.length > 0;
    let targets: (Combatant | Combatant[])[] = [];
    for (const t of [...ability.target]) {
      switch (t) {
        case "self":
          if (healing) {
            if (user.hp < user.maxHp) {
              targets.push(user);
            }
          } else {
            targets.push(user);
          }
          break;
        case "ally":
          if (healing) {
            targets.push(...Combat.wounded(allies));
          } else {
            targets.push(...Combat.living(allies));
          }
          break;
        case "deadAlly": targets.push(...(allies.filter(a => a.hp <= 0))); break;
        case "enemy": targets.push(...(enemies)); break;
        case "allies":
          if (healing) {
            targets.push(Combat.wounded(allies));
          } else {
            targets.push(Combat.living(allies));
          }
          break;
        case "enemies": targets.push((enemies)); break;
        case "all": targets.push(([user, ...allies, ...enemies])); break;

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
    let isNumber = !isNaN(parseInt(amount));
    if (isNumber) {
      result = parseInt(amount);
    } else if (amount.startsWith("=")) {
      result = await Deem.evaluate(amount.slice(1), { roll, subject: user, ...user, description: name })
    }
    return result;
  }

  static async handleEffect(
    name: string,
    effect: AbilityEffect,
    user: Combatant,
    target: Combatant | Combatant[],
    context: CombatContext,
    handlers: CommandHandlers
  ): Promise<{
    success: boolean, events: Omit<GameEvent, "turn">[]
  }> {
    // normalize target and pass to handleSingleEffect
    let success = false;
    let events: Omit<GameEvent, "turn">[] = [];
    if (Array.isArray(target)) {
      for (const t of target) {
        let result = await this.handleSingleEffect(name, effect, user, t, context, handlers);
        success ||= result.success;
        events.push(...result.events);
      }
    } else {
      if (!target) {
        // throw new Error(`No target provided for effect ${effect.type} in ability ${name}`);
        return { success: false, events };
      }

      let result = await this.handleSingleEffect(name, effect, user, target, context, handlers);
      success = result.success;
      events.push(...result.events);
    }
    return { success, events };
  }

  static async handleSingleEffect(
    name: string, effect: AbilityEffect,
    user: Combatant, targetCombatant: Combatant,
    context: CombatContext,
    handlers: CommandHandlers
  ): Promise<{
    success: boolean, events: Omit<GameEvent, "turn">[]
  }> {
    let { roll, attack, hit, heal, status, removeItem, removeStatus, save, summon } = handlers;

    let success = false;
    let events: Omit<GameEvent, "turn">[] = [];

    // does the target meet all conditions?
    if (effect.condition) {
      if (effect.condition.trait && !(targetCombatant.traits||[]).includes(effect.condition.trait)) {
        console.warn(`${targetCombatant.name} does not have required trait ${effect.condition.trait} for effect ${effect.type} of ability ${name}, skipping effect.`);
        return { success, events };
      }
    }

    // check if _any_ ally of the target has a reaction effect for this ability
    for (const targetAlly of context.enemies) {
      if (targetAlly.hp <= 0) { continue; }
      let reactionEffectName = `onEnemy${Words.capitalize(name.replace(/\s+/g, ""))}`;
      let allyFx = await Fighting.gatherEffects(targetAlly);
      if (allyFx[reactionEffectName]) {
        events.push({ type: "reaction", subject: targetAlly, target: user, reactionName: `to ${name}` } as Omit<ReactionEvent, "turn">);
        let reactionEffects = allyFx[reactionEffectName] as Array<AbilityEffect>;
        for (const reactionEffect of reactionEffects) {
          let { success, events: reactionEvents } = await this.handleEffect(
            (reactionEffect.status?.name || name) + " Reaction",
            reactionEffect, targetAlly, user, context, handlers
          );
          events.push(...reactionEvents);
          if (!success) {
            break;
          }
        }
      }
    }

    if ((targetCombatant.hp <= 0 && effect.type !== "resurrect") || user.hp <= 0) {
      return { success, events };
    }

    let userFx = await Fighting.gatherEffects(user);

    // switch (effect.type) {
    if (effect.type === "attack") {
      // let success = false;

      if (userFx.onAttack) {
        for (const attackFx of userFx.onAttack as Array<AbilityEffect>) {
          let result = await this.handleEffect(name, attackFx, user, targetCombatant, context, handlers);
          events.push(...result.events);
        }
      }

      let result = await attack(user, targetCombatant, context, handlers.roll);
      success = result.success;
      events.push(...result.events);
      if (!success) {
        return { success: false, events: result.events };
      } else {
        if (userFx.onAttackHit) {
          for (const attackFx of userFx.onAttackHit as Array<AbilityEffect>) {
            // let fxTarget = attackFx.target === "self" ? user : targetCombatant;
            let fxTarget: Combatant | Combatant[] = targetCombatant;
            if (attackFx.target) {
              fxTarget = this.validTargets({ target: [attackFx.target] } as Ability, user, [], [targetCombatant])[0];
            }
            // it is possible that the target is specified in the effect, so we need to check for that
            let effectResult = await this.handleEffect(name, attackFx, user, fxTarget, context, handlers);
            events.push(...effectResult.events);
            if (!effectResult.success) {
              break;
            }
          }
        }
      }
      // return { success, events };
    } else if (effect.type === "damage") {
      let amount = await AbilityHandler.rollAmount(name, effect.amount || "1", roll, user);
      let hitEvents = await hit(user, targetCombatant, amount, false, name, true, effect.kind || "true", context, handlers.roll);
      events.push(...hitEvents);
      success = true;
    } else if (effect.type === "heal") {
      let amount = await AbilityHandler.rollAmount(name, effect.amount || "1", roll, user);
      let healEvents = await heal(user, targetCombatant, amount);
      events.push(...healEvents);
      success = true;
    } else if (effect.type === "drain") {
      let amount = await AbilityHandler.rollAmount(name, effect.amount || "1", roll, user);
      let healEvents = await heal(user, user, amount);
      let hitEvents = await hit(user, targetCombatant, amount, false, name, true, effect.kind || "true", context, handlers.roll);
      events.push(...healEvents);
      events.push(...hitEvents);
      success = true;
    } else if (effect.type === "buff") {
      if (effect.status) {
        let statusEvents = await status(user, targetCombatant, effect.status.name, { ...effect.status.effect, by: user }, effect.status.duration || 3);
        events.push(...statusEvents);
        success = true;
      } else {
        throw new Error(`Buff effect must have a status defined`);
      }
    } else if (effect.type === "debuff") {
      // same as buff with a save
      if (effect.status) {
        let { success: saved, events: saveEvents } = await save(targetCombatant, effect.saveType || "magic", effect.saveDC || 15, handlers.roll);
        events.push(...saveEvents);
        if (!saved) {
          let statusEvents = await status(user, targetCombatant, effect.status.name, { ...effect.status.effect, by: user }, effect.status.duration || 3);
          events.push(...statusEvents);
          success = true;
        }
      } else {
        throw new Error(`Debuff effect must have a status defined`);
      }
    } else if (effect.type === "flee") {
      // roll save vs fear
      let { success, events: saveEvents } = await save(targetCombatant, effect.succeedType || "will", effect.succeedDC || 15, handlers.roll);
      events.push(...saveEvents);

      let saved = success;
      if (saved) {
        console.log(`${targetCombatant.name} resists the urge to flee!`);
        return { success: false, events };
      }

      if (!saved) {
        let statusEvents = await status(user, targetCombatant, "Fleeing", { flee: true }, 2);
        events.push(...statusEvents);
        success = true;
      } else {
        console.log(`${targetCombatant.name} wanted to flee but resisted!`);
      }
      // }
    } else if (effect.type === "removeItem") {
      if (!effect.item) {
        throw new Error(`removeItem effect must specify an item`);
      }
      let itemEvents = await removeItem(targetCombatant, effect.item as keyof Team);
      events.push(...itemEvents);
      success = true;
    } else if (effect.type === "removeStatus") {
      if (!effect.statusName) {
        throw new Error(`removeStatus effect must specify a statusName`);
      }
      let statusEvents = await removeStatus(targetCombatant, effect.statusName);
      events.push(...statusEvents);
      success = true;
    } else if (effect.type === "upgrade") {
      let stat = effect.stat;
      if (!stat) {
        throw new Error(`upgrade effect must specify a stat`);
      }
      let amount = await Deem.evaluate(effect.amount || "1", { subject: user, ...user, description: name });
      // console.log(`${user.name} upgrades ${stat} by ${amount}!`);
      user[stat] = (user[stat] || 0) + amount;
      let upgradeEvent = { type: "upgrade", subject: user, stat, amount, newValue: user[stat] } as UpgradeEvent;
      events.push(upgradeEvent);
      success = true;
    }
    else if (effect.type === "gold") {
      let amount = await AbilityHandler.rollAmount(name, effect.amount || "1", roll, user);
      user.gp = (user.gp || 0) + amount;
      // console.log(`${user.name} gains ${amount} gold!`);
      events.push({ type: "gold", subject: user, amount } as any);
      success = true;
    }
    else if (effect.type === "xp") {
      let amount = await AbilityHandler.rollAmount(name, effect.amount || "1", roll, user);
      user.xp = (user.xp || 0) + amount;
      // console.log(`${user.name} gains ${amount} XP!`);
      events.push({ type: "xp", subject: user, amount } as any);
      success = true;
    } else if (effect.type === "summon") {
      let amount = await AbilityHandler.rollAmount(name, effect.amount || "1", roll, user);
      let allies = 1 + context.allies.length;
      amount = Math.min(amount, 6 - allies);
      // could add summon ability bonus here
      // if (userFx.summonAnimalBonus) {
      //   amount += (userFx.summonAnimalBonus || 0) as number;
      // }
      let summoned: Combatant[] = [];
      for (let i = 0; i < amount; i++) {
        let options: Record<string, any> = effect.options || {};
        // deem-eval option values
        for (const key of Object.keys(options)) {
          let val = options[key];
          if (typeof val === "string" && val.startsWith("=")) {
            options[key] = await Deem.evaluate(val.slice(1), { subject: user });
          }
        }
        let summon = await Generator.gen((effect.creature || "animal") as GenerationTemplateType, {
          race: user.race,
          _targetCr: Math.max(1, Math.floor((user.level || 1) / 2)),
          ...options
        });
        summoned.push(summon as Combatant);
      }
      let summonEvents = await summon(user, summoned);
      events.push(...summonEvents);
      success = amount > 0;
    }
    else if (effect.type === "resurrect") {
      let rezzed = false;
      if (targetCombatant.hp > 0) {
        console.warn(`${targetCombatant.name} is not dead and cannot be resurrected.`);
      } else {
        // let amount = await AbilityHandler.rollAmount(name, effect.amount || "1", roll, user);
        let amount = effect.hpPercent ? Math.floor((effect.hpPercent / 100) * (targetCombatant.maxHp || 10)) : 1;
        targetCombatant.hp = Math.min(1, amount);
        // todo handle applied traits + reify (and maybe update type???)
        // if (effect.applyTraits) {
        //   targetCombatant.traits = Array.from(new Set([...(targetCombatant.traits || []), ...effect.applyTraits]));
        // }
        events.push({ type: "resurrect", subject: targetCombatant, amount } as Omit<ResurrectEvent, "turn">);
        rezzed = true;
      }
      success = rezzed;
    }
    else {
      // throw new Error(`Unknown effect type: ${effect.type}`);
      return never(effect.type);
    }

    return { success, events };
  }

  static async perform(
    ability: Ability,
    user: Combatant,
    target: Combatant | Combatant[],
    context: CombatContext,
    handlers: CommandHandlers
  ): Promise<{
    success: boolean;
    events: Omit<GameEvent, "turn">[];
  }> {
    // console.log(`${user.name} is performing ${ability.name} on ${Array.isArray(target) ? target.map(t => t.name).join(", ") : target?.name}...`);
    let result = false;
    let events = [];
    for (const effect of ability.effects) {
      // console.log("performing effect of type", effect.type, "...");
      let { success, events: effectEvents } = await this.handleEffect(ability.name, effect, user, target, context, handlers);
      result = result || success;
      events.push(...effectEvents);
      if (success === false) {
        break;
      }
    }

    if (result) {
      // console.log(`${user.name} successfully uses ${ability.name} on ${Array.isArray(target) ? target.map(t => t.name).join(", ") : target.name}!`);
      let isSpell = ability.type === 'spell';
      let isOffensive = ability.target.some(t => t.includes("enemy") || t.includes("enemies") || t.includes("randomEnemies"));
      if (isSpell) {
        if (isOffensive) {
          // trigger spell attack fx
          let userFx = await Fighting.gatherEffects(user);
          if (userFx.onOffensiveCasting) {
            // console.log(`Triggering onOffensiveCasting effects for ${ability.name}...`);
            for (const spellFx of userFx.onOffensiveCasting as Array<AbilityEffect>) {
              let fxTarget: Combatant | Combatant[] = target;
              if (spellFx.target) {
                // TODO should use a simpler 'resolveTarget' kind of model here maybe?
                fxTarget = this.validTargets({ target: [spellFx.target] } as unknown as Ability, user, [], Array.isArray(target) ? target : [target])[0];
              }
              let { events: postCastEvents } = await this.handleEffect(ability.name, spellFx, user, fxTarget, context, handlers);
              events.push(...postCastEvents);
            }
          }
        }
      }
    }


    // console.log(`Performed ${ability.name} on ${Array.isArray(target) ? target.map(t => t.name).join(", ") : target.name} with result: ${result}`);
    // // console.log(`Events:`, events);
    // if (events.length > 0) {
    //   console.log(`${ability.name} generated events:`, events.map(e => ({ ...e, subject: e.subject?.name || e.subject, target: e.target?.name || e.target })));
    // }

    return { success: result, events };
  }
}