import Presenter from "../tui/Presenter";
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
    if (combatant.activeEffects) {
      combatant.activeEffects.forEach(it => {
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
    }
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
  static gatherEffects(combatant: Combatant): { [key: string]: number } {
    let effectList = [
      ...(combatant.passiveEffects || []),
      ...(combatant.activeEffects || [])
    ];
    let resultingEffects: { [key: string]: number } = {
      // could gather effective resistances/saves here too if the combatant has them specified in their record?
    };
    // effectList.forEach(it => {
    for (let it of effectList) {
      if (it.whileEnvironment) { //} && combatant.environment === it.effect.environment) {
        if (combatant.currentEnvironment === it.whileEnvironment) {
          console.log(`Applying environment effect ${it.name} for ${combatant.name} in ${combatant.currentEnvironment}`);
        } else {
          continue;
        }
      }

      if (it.effect) {
        Object.entries(it.effect).forEach(([key, value]) => {
          if (typeof value === "number") {
            resultingEffects[key] = (resultingEffects[key] || 0) + value;
          } else {
            resultingEffects[key] = value;
          }
        });
      }
    }
    // console.log("Gathered effect stack for", combatant.name, ":", resultingEffects);
    return resultingEffects;
  }

  static async attack(
    roll: Roll,
    attacker: Combatant,
    defender: Combatant,
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
    const toHitBonus = dexMod  // DEX affects accuracy
      + toHitTurnBonus; // Any temporary bonuses to hits
    const strengthDamageBonus = Math.max(0, strMod);  // STR affects damage (min 0)

    const thac0 = this.thac0(attacker.level);
    const effectiveDefender = this.effectiveStats(defender);
    const ac = effectiveDefender.ac;
    const whatNumberHits = thac0 - ac - toHitBonus;

    // let bonusMessage = "";
    // if (toHitBonus > 0) {
    //   bonusMessage += ` (+${toHitBonus} to hit; DEX ${effectiveAttacker.dex} gives +${dexMod} and turn bonuses give +${toHitTurnBonus})`;
    // }

    // console.log(`${Presenter.combatant(attacker, true)} (THAC0: ${thac0}${bonusMessage}) attacks ${Presenter.combatant(defender, true)} (AC: ${ac})... `);
    // console.log(`Attacker THAC0: ${thac0}${bonusMessage}, Defender AC: ${ac}`); // What number hits: ${whatNumberHits} `);
    const attackRoll = await roll(attacker, `to attack (must roll ${whatNumberHits} or higher to hit)`, 20);
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

      const attackRolls = [];
      for (let i = 0; i < attacker.attackRolls; i++) {
        let message = `for damage`;
        if (attacker.attackRolls > 1) {
          message = `for damage (attack ${i + 1}/${attacker.attackRolls})`;
        }
        attackRolls.push(await roll(attacker, message, attacker.damageDie));
      }

      description += attackRolls.map(r => r.description).join(" ");
      damage = attackRolls
        .map(r => r.amount)
        .reduce((sum: number, dmg: number) => sum + dmg, 0);

      if (critical) {
        criticalDamage = Math.max(1, Math.round(damage * 0.2 * Math.max(1, Math.floor(attacker.level / 5))));
        if (criticalDamage > 0) {
          console.log(`Damage increased by ${criticalDamage} for critical hit!`);
        }
      }

      // if (criticalDamage > 0) {
      //   note(`Adding ${criticalDamage} damage for critical hit.`);
      // }
      // if (strengthDamageBonus > 0) {
      //   note("Adding " + strengthDamageBonus + ` damage (from STR ${attacker.str})`);
      // }
      if (strengthDamageBonus > 0) {
        console.log("Damage increased by " + strengthDamageBonus + ` for STR ${attacker.str}`);
      }
      damage = damage + criticalDamage + strengthDamageBonus;
      // if (criticalDamage > 0) {
      //   note("Damage increased by " + criticalDamage + " to " + damage + " for critical hit!");
      //   description += ` Damage increased by ${criticalDamage} for critical hit!`;
      // }
      // defender.hp -= damage;
      // note(
      //   Stylist.colorize(
      //     `${attacker.name} hits ${defender.name} with ${attacker.weapon} for ${damage} damage (now at ${defender.hp}).`,
      //     attacker.playerControlled ? 'green' : 'red'
      //   )
      // );
      // description += `\n*${attacker.name} hits ${defender.name} for ${damage} damage* (now at ${defender.hp}).`;
    } else {
      // note(`${attacker.name} misses ${defender.name}.`);
      // description += `\n*${attacker.name} misses ${defender.name}.*`;
    }

    return {
      success,
      damage,
      description,
      critical
    };
  }
}
