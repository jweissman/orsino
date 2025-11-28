import Deem from "../../deem";
import Presenter from "../tui/Presenter";
import Words from "../tui/Words";
import { AttackResult } from "../types/AttackResult";
import { Combatant } from "../types/Combatant";
import { Roll } from "../types/Roll";

export class Fighting {
  static thac0(level: number): number {
    return 20 - Math.floor(level / 2);
  }

  static statMod(stat: number): number {
    // return Math.floor((stat - 10) / 2);
    if (stat >= 15) {
      return 1 + Math.round((stat - 15) / 2);
    } else if (stat <= 5) {
      return (-1) + Math.round((stat - 5) / 2);
    } else {
      return 0;
    }
  }

  static turnBonus(combatant: Combatant, keys: (string)[] = []): { [key: string]: number } {
    let bonuses: { [key: string]: number } = {};
    let fx = [ 
      ...(combatant.passiveEffects || []),
      ...(combatant.activeEffects || [])
    ]
    // if (combatant.activeEffects) {
      fx.forEach(it => {
        // console.log("Considering turn bonus effect:", it);
        if (it.effect) {
          Object.entries(it.effect).forEach(([key, value]) => {
            if (key === 'by') {
              return;
            }
            if (typeof value === "number") {
              if (keys.length === 0 || keys.includes(key)) {
                bonuses[key] = (bonuses[key] || 0) + value;
              }
            }
          });
        }
      });
    // }
    // delete bonuses.by;
    return bonuses;
  }

  static effectiveStats(combatant: Combatant): { [key: string]: number } {
    let stats: { [key: string]: number } = {
      str: combatant.str,
      dex: combatant.dex,
      int: combatant.int,
      wis: combatant.wis,
      cha: combatant.cha,
      con: combatant.con,
      ac: combatant.ac,
    };
    if (combatant.activeEffects) {
      combatant.activeEffects.forEach(it => {
        if (it.effect) {
          Object.entries(it.effect).forEach(([key, value]) => {
            if (key in stats && typeof value === "number") {
              stats[key] = (stats[key] || 0) + value;
            }
          });
        }
      });
    }
    return stats;
  }

  // gather all current passive + active effects and try to calculate any cumulative bonuses
  static gatherEffects(combatant: Combatant): { [key: string]: number | string | boolean | Array<any> } {
    let effectList = [
      ...(combatant.passiveEffects || []),
      ...(combatant.activeEffects || [])
    ];
    let resultingEffects: { [key: string]: number | string | Array<any> } = {
      // could gather effective resistances/saves here too if the combatant has them specified in their record?
    };
    // effectList.forEach(it => {
    for (let it of effectList) {
      if (it.whileEnvironment) { //} && combatant.environment === it.effect.environment) {
        if (combatant.currentEnvironment === it.whileEnvironment) {
          // console.log(`Applying environment effect ${it.name} for ${combatant.name} in ${combatant.currentEnvironment}`);
        } else {
          continue;
        }
      }

      if (it.effect) {
        Object.entries(it.effect).forEach(([key, value]) => {
          if (key === 'by') {
            return;
          }

          if (typeof value === "number" && typeof resultingEffects[key] === "number") {
            resultingEffects[key] = (resultingEffects[key] || 0) + value;
          } else if (Array.isArray(value) && Array.isArray(resultingEffects[key])) {
            resultingEffects[key] = (resultingEffects[key] || []).concat(value);
          } else {
            // console.warn(`Overriding effect ${key} with value ${value} (was ${resultingEffects[key]})`);
            resultingEffects[key] = value;
          }
        });
      }
    }
    // delete resultingEffects.by;
    // if (Object.keys(resultingEffects).length > 0) {
    //   console.log("Gathered effect stack for", combatant.name, ":", resultingEffects);
    // }
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
    isMissile: boolean
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

    let toHitTurnBonus = this.turnBonus(attacker, ["toHit"]).toHit || 0;
    const toHitBonus = (isMissile ? dexMod : strMod)  // DEX affects accuracy for missiles
                    + toHitTurnBonus;                 // Any temporary bonuses to hits
    const damageBonus = isMissile ? Math.max(0, dexMod) : Math.max(0, strMod);

    const thac0 = this.thac0(attacker.level);
    const effectiveDefender = this.effectiveStats(defender);
    const defenderAcBonus = this.statMod(effectiveDefender.dex || 10);
    const ac = effectiveDefender.ac - defenderAcBonus;
    const whatNumberHits = thac0 - ac - toHitBonus;

    const attackRoll = await roll(attacker, `to attack ${defender.forename} (must roll ${whatNumberHits} or higher to hit)`, 20);
    description += attackRoll.description;
    let success = attackRoll.amount >= whatNumberHits;
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

      if (!attacker.attackDie) {
        throw new Error(`Attacker ${attacker.name} does not have an attackDie defined.`);
      }

      let weaponVerb =
        attacker.hasMissileWeapon ? "shoot" : (this.weaponDamageKindVerbs[attacker.damageKind || "slashing"] || "strike");
        // attacker.damageKind.replace(/ing$/, ''); // crude way to get verb from damage kind
      damage = await Deem.evaluate(attacker.attackDie, {
        roll, subject: attacker,
        description: `to ${weaponVerb} ${defender.forename} with ${Words.humanize(attacker.weapon)}`
      });

      if (damageBonus > 0) {
        console.log(`Damage increased by ${isMissile ? "DEX" : "STR"} modifier of ${damageBonus}.`);
      }

      if (critical) {
        criticalDamage = Math.max(1, Math.round(damage * 0.2 * Math.max(1, Math.floor(attacker.level / 5))));
        console.log(`Critical attack adds ${criticalDamage} extra damage.`);
      }

      damage = damage + criticalDamage + damageBonus;
    }

    return {
      success,
      damage,
      description,
      critical
    };
  }
}
