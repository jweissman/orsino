import Deem from "../../deem";
import { CombatContext } from "../Combat";
import { Armor, Weapon } from "../Inventory";
import { StatusEffect, StatusModifications } from "../Status";
import Words from "../tui/Words";
import { AttackResult } from "../types/AttackResult";
import { Combatant } from "../types/Combatant";
import { ItemInstance, materializeItem } from "../types/ItemInstance";
import { Roll } from "../types/Roll";

type StatLine = {
  str: number;
  dex: number;
  int: number;
  wis: number;
  cha: number;
  con: number;
  // ac: number;
  maxHp: number;
  // attackDie: string;
}
export class Fighting {
  static thac0(level: number): number {
    return 20 - Math.floor(level / 2);
  }

  static statMod(stat: number): number {
    return Math.round((stat - 10) / 3);
  }

  static effectList(combatant: Combatant): StatusEffect[] {
    if (!combatant) {
      throw new Error("No combatant provided to Fighting.effectList");
    }

    const effectList = [
      ...(combatant.passiveEffects || []),
      ...(combatant.activeEffects || []),
    ];

    return effectList;
  }

  static effectivelyPlayerControlled(combatant: Combatant): boolean {
    const allegianceEffect = combatant.activeEffects?.find(e => e.effect.changeAllegiance);
    const controlEffect = combatant.activeEffects?.find(e => e.effect.controlledActions);
    let playerControlled = combatant.playerControlled && !allegianceEffect;

    // if (allegianceEffect) {
    //   playerControlled = !playerControlled;
    // }
    if (controlEffect) {
      playerControlled = !playerControlled;
    }

    return playerControlled || false;
  }

  static turnBonus(combatant: Combatant, keys: (string)[] = []): Partial<StatusModifications> {
    const bonuses: Partial<StatusModifications> = {};
    const fx = this.effectList(combatant);

    fx.forEach(it => {
      if (it.effect) {
        Object.entries(it.effect).forEach(([key, value]) => {
          if (key === 'by') {
            return;
          }
          if (typeof value === "number") {
            const theKey = key as keyof StatusModifications;
            if (keys.length === 0 || keys.includes(key)) {
              if (typeof bonuses[theKey] === "number") {
                // @ts-ignore
                bonuses[theKey] = ((bonuses[theKey] || 0) + value);
              }
            }
          }
        });
      }
    });
    return bonuses;
  }

  static effectiveArmorClass(
    combatant: Combatant,
    inventory: ItemInstance[]
  ): number {
    let ac = 10; // default AC

    const effectiveArmor = this.effectiveArmor(combatant, inventory || []);
    if (effectiveArmor && effectiveArmor.ac !== undefined) {
      ac -= effectiveArmor.ac; // || ac;
    }

    const effectList = this.effectList(combatant);
    effectList.forEach(it => {
      if (it.effect) {
        if (it.effect.ac) {
          ac += it.effect.ac;
        }
      }
    });

    return ac;
  }

  static effectiveStats(
    combatant: Combatant,
  ): StatLine {
    let stats: StatLine = {
      str: combatant.str,
      dex: combatant.dex,
      int: combatant.int,
      wis: combatant.wis,
      cha: combatant.cha,
      con: combatant.con,
      maxHp: combatant.maximumHitPoints,
    };

    const effectList = this.effectList(combatant);
    effectList.forEach(it => {
      if (it.effect) {
        Object.entries(it.effect).forEach(([key, value]) => {
          if (key in stats && typeof value === "number") {
            const k = key as keyof typeof stats;
            stats[k] = (stats[k] || 0) + value;
          }
        });

        if (it.effect.effectiveStats) {
          stats = { ...stats, ...it.effect.effectiveStats };
        }
      }
    });
    return stats;
  }

  static effectiveAttackDie(combatant: Combatant, inventory: ItemInstance[]): string {
    let weapon = this.effectiveWeapon(combatant, inventory || []);
    let baseAttackDie = weapon.damage || "1d2";
    const effectList = this.effectList(combatant);
    effectList.forEach(it => {
      if (it.effect) {
        if (it.effect.attackDie) {
          baseAttackDie = it.effect.attackDie;
        }
      }
    });
    return baseAttackDie;
  }

  static effectiveWeapon(
    combatant: Combatant,
    inventory: ItemInstance[]
  ): (Weapon & ItemInstance) {
    const weapon = combatant.equipment?.weapon || 'fist'; //weapon;
    const materializedWeapon = materializeItem(weapon, inventory);
    if (materializedWeapon && materializedWeapon.itemClass === 'weapon') {
      return materializedWeapon as unknown as (Weapon & ItemInstance);
    }
    throw new Error(`Could not resolve effective weapon for combatant ${combatant.name} with weapon ${weapon}`);
  }

  static effectiveArmor(
    combatant: Combatant,
    inventory: ItemInstance[]
  ): (Armor & ItemInstance) | null {
    const armor = combatant.equipment?.body;
    if (!armor) {
      return null;
    }
    const materializedArmor = materializeItem(armor, inventory);
    if (materializedArmor && materializedArmor.itemClass === 'armor') {
      return materializedArmor as unknown as (Armor & ItemInstance);
    }

    console.warn(`Materialized armor: ${JSON.stringify(materializedArmor)}`);
    throw new Error(`Could not resolve effective armor for combatant ${combatant.name} with armor ${armor}`);
  }

  // gather all current passive + active effects and try to calculate any cumulative bonuses
  static gatherEffects(combatant: Combatant): Partial<StatusModifications> {
    const effectList = this.effectList(combatant);
    const resultingEffects: Partial<StatusModifications> = {
    };
    for (const it of effectList) {
      if (it.effect) {
        for (const [key, value] of Object.entries(it.effect)) {
          if (key === 'by') {
            continue;
          }

          const theKey = key as keyof StatusModifications;

          if (typeof value === "number" && typeof resultingEffects[theKey] === "number") {
            // @ts-ignore
            resultingEffects[theKey] = ((resultingEffects[theKey] || 0) + value);
          } else if (Array.isArray(value) && Array.isArray(resultingEffects[theKey])) {
            // why do we need to handle array? -- for effect triggers like onEnemyMelee, onResistPoison, etc
            // @ts-ignore
            resultingEffects[theKey] = (resultingEffects[theKey] || []).concat(value);
          } else {
            // console.warn(`Overriding effect ${key} with value ${value} (was ${resultingEffects[theKey]})`);
            resultingEffects[theKey] = value;
          }
        }
      }
    }

    return resultingEffects;
  }

  static gatherEffectsWithNames(combatant: Combatant): { [key: string]: { value: number | string | boolean | Array<any>, sources: string[] } } {
    const resultingEffects: { [key: string]: { value: number | string | boolean | Array<any>, sources: string[] } } = {};
    const effectList = this.effectList(combatant);

    for (const it of effectList) {
      if (it.effect) {
        Object.entries(it.effect).forEach(([key, value]) => {
          if (key === 'by') {
            return;
          }

          if (!(key in resultingEffects)) {
            resultingEffects[key] = { value: 0, sources: [] };
          }

          if (typeof value === "number" && typeof resultingEffects[key].value === "number") {
            resultingEffects[key].value = (resultingEffects[key].value || 0) + value;
            resultingEffects[key].sources.push(it.name || "unknown");
          } else if (Array.isArray(value) && Array.isArray(resultingEffects[key].value)) {
            resultingEffects[key].value = (resultingEffects[key].value || []).concat(value);
            resultingEffects[key].sources.push(it.name || "unknown");
          } else {
            resultingEffects[key].value = value;
            resultingEffects[key].sources = [it.name || "unknown"];
          }
        });
      }
    }

    return resultingEffects;
  }

  static weaponDamageKindVerbs: { [key: string]: string } = {
    slashing: "slash",
    piercing: "stab",
    bludgeoning: "bludgeon",
  };

  static async attack(
    roll: Roll,
    attacker: Combatant,
    defender: Combatant,
    attackerContext: CombatContext
  ): Promise<AttackResult> {
    if (defender.hp <= 0) {
      return {
        success: false,
        damage: 0,
        description: `${defender.name} is already defeated.`,
        critical: false
      };
    }
    const effectiveAttacker = this.effectiveStats(attacker);
    let description = `${attacker.name} attacks ${defender.name}... `;

    const strMod = this.statMod(effectiveAttacker.str || 10);
    const dexMod = this.statMod(effectiveAttacker.dex || 10);

    const toHitTurnBonus = (this.turnBonus(attacker, ["toHit"])).toHit || 0;
    const attackerWeapon = this.effectiveWeapon(attacker, attackerContext.inventory || []);
    const isMissile = attackerWeapon.missile === true;
    const toHitBonus = (isMissile ? dexMod : strMod)  // DEX affects accuracy for missiles
      + toHitTurnBonus;                 // Any temporary bonuses to hits
    const damageBonus = isMissile ? Math.max(0, dexMod) : Math.max(0, strMod);

    const thac0 = this.thac0(attacker.level);
    const effectiveDefender = this.effectiveStats(defender);
    const defenderAcBonus = this.statMod(effectiveDefender.dex || 10);
    const effectiveAc = this.effectiveArmorClass(defender, attackerContext.enemyInventory || []);
    const ac = effectiveAc - defenderAcBonus;
    const whatNumberHits = thac0 - ac - toHitBonus;

    const attackRoll = roll(attacker, `to attack ${defender.forename} (must roll ${whatNumberHits} or higher to hit)`, 20);
    description += attackRoll.description;
    const success = attackRoll.amount >= whatNumberHits;
    let critical = false;
    if (attackRoll.amount <= 1) {
      description += ` ${attacker.name} rolled a natural 1 and misses!`;
      return {
        success: false,
        damage: 0,
        description,
        critical: true
      };
    }

    if (attackRoll.amount >= 20) {
      critical = true;
      description += " Critical hit! ";
    } else {
      description += " Attack hits! ";
    }

    let damage = 0;
    if (success) {
      let criticalDamage = 0;

      // if (!attacker.attackDie) {
      //   throw new Error(`Attacker ${attacker.name} does not have an attackDie defined.`);
      // }

      const attackDie = this.effectiveAttackDie(attacker, attackerContext.inventory);

      const weaponVerb =
        // attacker.hasMissileWeapon ? "shoot" : (this.weaponDamageKindVerbs[attacker.damageKind || "slashing"] || "strike");
        attackerWeapon.missile ? "shoot" : (
          attackerWeapon.kind ? (this.weaponDamageKindVerbs[attackerWeapon.kind] || "strike") : "strike");
      damage = Deem.evaluate(attackDie, {
        roll, subject: attacker,
        description: `to ${weaponVerb} ${defender.forename} with ${Words.humanize(attackerWeapon.name || 'weapon')}`
      }) as number;

      if (critical) {
        criticalDamage = Math.max(1, Math.round(damage * 0.2 * Math.max(1, Math.floor(attacker.level / 5))));
      }

      damage = damage + criticalDamage + damageBonus;
      const defenderEffects = Fighting.gatherEffects(defender);

      if (defenderEffects.evasion) {
        const evasionBonus = defenderEffects.evasion || 0;
        const whatNumberEvades = 20 - evasionBonus;
        const evasionRoll = roll(defender, `for evasion (must roll ${whatNumberEvades} or higher)`, 20);
        if (evasionRoll.amount >= whatNumberEvades) {
          description += ` ${defender.name} evades the attack!`;
          return {
            success: false,
            damage: 0,
            description,
            critical: false
          };
        }
      }
    }

    return {
      success,
      damage,
      description,
      critical
    };
  }
}
