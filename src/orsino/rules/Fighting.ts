import Presenter from "../tui/Presenter";
import Stylist from "../tui/Style";
import { AttackResult } from "../types/AttackResult";
import { Combatant } from "../types/Combatant";
import { Roll } from "../types/Roll";

export class Fighting {
  static thac0(level: number): number {
    return 20 - Math.floor(level / 2);
  }

  static statMod(stat: number): number {
    return Math.floor((stat - 10) / 2);
  }

  static turnBonus(combatant: Combatant): { [key: string]: number } {
    let bonuses: { [key: string]: number } = {};
    if (combatant.activeEffects) {
      combatant.activeEffects.forEach(it => {
        Object.entries(it.effect).forEach(([key, value]) => {
          bonuses[key] = (bonuses[key] || 0) + value;
        });
      });
    }
    return bonuses;
  }


  static async attack(
    roll: Roll,
    attacker: Combatant,
    defender: Combatant,
    note: (message: string) => void = () => { }
  ): Promise<AttackResult> {
    if (defender.hp <= 0) {
      return {
        success: false,
        damage: 0,
        description: `${defender.name} is already defeated.`
      };
    }
    let description = `${attacker.name} attacks ${defender.name}... `;
    const strMod = this.statMod(attacker.str || 10);
    const dexMod = this.statMod(attacker.dex || 10);
    let toHitTurnBonus = this.turnBonus(attacker).toHit || 0;
    const toHitBonus = dexMod  // DEX affects accuracy
      + toHitTurnBonus; // Any temporary bonuses to hits
    const strengthDamageBonus = Math.max(0, strMod);  // STR affects damage (min 0)

    const thac0 = this.thac0(attacker.level);
    const ac = defender.ac - (this.turnBonus(defender).ac || 0);
    const whatNumberHits = thac0 - ac - toHitBonus;

    let bonusMessage = "";
    if (toHitBonus > 0) {
      bonusMessage += ` (+${toHitBonus} to hit)`;
    }
    note(`${Presenter.combatant(attacker, true)} (THAC0: ${thac0}${bonusMessage}) attacks ${Presenter.combatant(defender, true)} (AC: ${ac})... `);
    // note(`Attacker THAC0: ${thac0}${bonusMessage}, Defender AC: ${ac}`); // What number hits: ${whatNumberHits} `);
    const attackRoll = await roll(attacker, `to attack (must roll ${whatNumberHits} or higher to hit)`, 20, 1);
    description += attackRoll.description;
    let success = attackRoll.amount >= whatNumberHits;
    let critical = false;
    if (attackRoll.amount === 0) {
      description += ` ${attacker.name} rolled a natural 1 and misses!`;
      note(`${attacker.name} rolled a natural 1 and misses!`);
      return {
        success: false,
        damage: 0,
        description
      };
    }
    if (attackRoll.amount >= 19) {
      critical = true;
      description += " Critical hit! ";
      note(Stylist.colorize("Critical hit!", 'yellow'));
    } else {
      description += " Attack hits! ";
      // note("Attack hits!");
    }

    let damage = 0;
    if (success) {
      let criticalDamage = 0;

      const attackRolls = await Promise.all(new Array(attacker.attackRolls).fill(0).map(() => roll(attacker, "for damage", attacker.damageDie, 1)));

      description += attackRolls.map(r => r.description).join(" ");
      damage = attackRolls
        .map(r => r.amount)
        .reduce((sum: number, dmg: number) => sum + dmg, 0);

      if (critical) {
        criticalDamage = Math.max(1, Math.round(damage * 0.2 * Math.max(1, Math.floor(attacker.level / 5))));
      }

      if (criticalDamage > 0) {
        note(`Adding ${criticalDamage} damage for critical hit.`);
      }
      if (strengthDamageBonus > 0) {
        note("Adding " + strengthDamageBonus + ` damage (from STR ${attacker.str})`);
      }
      damage = damage + criticalDamage + strengthDamageBonus;
      if (criticalDamage > 0) {
        note("Damage increased by " + criticalDamage + " to " + damage + " for critical hit!");
        description += ` Damage increased by ${criticalDamage} for critical hit!`;
      }
      defender.hp -= damage;
      note(
        Stylist.colorize(
          `${attacker.name} hits ${defender.name} with ${attacker.weapon} for ${damage} damage (now at ${defender.hp}).`,
          'green')
      );
      description += `\n*${attacker.name} hits ${defender.name} for ${damage} damage* (now at ${defender.hp}).`;
    } else {
      note(Stylist.colorize(`${attacker.name} misses ${defender.name}.`, 'red'));
      description += `\n*${attacker.name} misses ${defender.name}.*`;
    }

    return {
      success,
      damage,
      description
    };
  }
}
