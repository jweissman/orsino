import AbilityHandler, { AbilityEffect, DamageKind, SaveKind } from "../Ability";
import { RollResult } from "../types/RollResult";
import { GameEvent, FallenEvent, HealEvent, HitEvent, MissEvent, StatusEffectEvent, StatusExpireEvent, SummonEvent } from "../Events";
import Stylist from "../tui/Style";
import Words from "../tui/Words";
import { Combatant } from "../types/Combatant";
import { Roll } from "../types/Roll";
import { Team } from "../types/Team";
import { Fighting } from "./Fighting";
import Presenter from "../tui/Presenter";

type TimelessEvent = Omit<GameEvent, "turn">;

export type CommandHandlers = {
  roll: Roll;
  attack: (combatant: Combatant, target: Combatant, roller: Roll) => Promise<{ success: boolean; target: Combatant, events: TimelessEvent[] }>;
  hit: (attacker: Combatant, defender: Combatant, damage: number, critical: boolean, by: string, success: boolean, damageKind: DamageKind, roll: Roll) => Promise<TimelessEvent[]>;
  heal: (healer: Combatant, target: Combatant, amount: number) => Promise<TimelessEvent[]>;
  status: (user: Combatant, target: Combatant, name: string, effect: { [key: string]: any }, duration: number) => Promise<TimelessEvent[]>;
  removeStatus: (target: Combatant, name: string) => Promise<TimelessEvent[]>;
  removeItem: (user: Combatant, item: keyof Team) => Promise<TimelessEvent[]>;
  save: (target: Combatant, saveType: SaveKind, dc: number, roll: Roll) => Promise<boolean>;
  summon: (user: Combatant, summoned: Combatant[]) => Promise<TimelessEvent[]>;
}

export class Commands {
  static handlers(roll = this.promisesRoll, team: Team): CommandHandlers {
    return {
      roll,
      save: this.handleSave,
      attack: this.handleAttack,
      hit: this.handleHit,
      heal: this.handleHeal,
      status: this.handleStatusEffect,
      removeStatus: this.handleRemoveStatusEffect,
      removeItem: async (user: Combatant, item: keyof Team) => {
        if (team) {
          // @ts-ignore
          team[item] = Math.max(0, (team[item] as number || 0) - 1);
          console.warn(`${user.forename} consumed ${Words.a_an(item)}. ${team.name} now has ${team[item]} ${item}.`);
          // TODO item consume event...
        }
        return [];
      },
      summon: async (user: Combatant, summoned: Combatant[]) => {
        console.log(`${user.name} summons ${summoned.map(s => s.name).join(", ")}!`);
        // team.combatants.push(...summoned);
        for (let s of summoned) {
          if (team.combatants.length < 6) {
            team.combatants.push(s);
          }
        }
        return [{ type: "summon", subject: user, summoned } as Omit<SummonEvent, "turn">];
      }
    }
  }

  // async wrapper around autoroll flow
  static async promisesRoll(subject: Combatant, description: string, sides: number): Promise<RollResult> {
    return Commands.roll(subject, description, sides);
  }

  static roll(subject: Combatant, description: string, sides: number): RollResult {
    let result = Math.floor(Math.random() * sides) + 1;
    let prettyResult = Stylist.colorize(result.toString(), result === sides ? 'green' : result === 1 ? 'red' : 'yellow');
    let rollDescription = Stylist.italic(`${subject.name} rolled d${sides} ${description} and got a ${prettyResult}.`);

    let effectStack = Fighting.gatherEffects(subject);
    if (effectStack.rerollNaturalOnes && result === 1) {
      rollDescription += ` ${subject.name} has an effect that allows re-rolling natural 1s, so they get to re-roll!`;
      let { amount: newAmount, description: newDescription } = Commands.roll(subject, description + " (re-roll)", sides);
      result = newAmount;
      rollDescription += " " + newDescription;
    }

    if (effectStack.allRolls) {
      result += effectStack.allRolls as number;
      rollDescription += ` ${subject.name} adds ${effectStack.allRolls} to all rolls, so the total is now ${result}.`;
    }

    return { amount: result, description: rollDescription };
  }

  static async handleHeal(healer: Combatant, target: Combatant, amount: number): Promise<TimelessEvent[]> {
    target.hp = Math.min(target.maxHp, target.hp + amount);
    const effective = Fighting.effectiveStats(healer);
    const wisBonus = Math.max(0, Fighting.statMod(effective.wis));
    if (wisBonus > 0) {
      target.hp = Math.min(target.maxHp, target.hp + wisBonus);
      amount += wisBonus;
      console.log(`Healing increased by ${wisBonus} for WIS ${healer.wis}`);
    }
    return [{ type: "heal", subject: healer, target, amount } as Omit<HealEvent, "turn">];
  }

  static async handleSave(target: Combatant, saveType: SaveKind, dc: number = 15, roll: Roll): Promise<boolean> {
    let targetFx = Fighting.gatherEffects(target);
    let isImmune = targetFx[`immune${saveType.charAt(0).toUpperCase() + saveType.slice(1)}`] as boolean;
    if (isImmune) {
      console.warn(`${Presenter.combatant(target)} has immunity to ${saveType}! Save automatically succeeds.`);
      // immune event?
      return true;
    }

    let saveVersusType = `saveVersus${saveType.charAt(0).toUpperCase() + saveType.slice(1)}`;
    const saveVersus = dc - (targetFx[saveVersusType] as number || 0) - target.level;
    let saved = false;
    if (saveVersus <= 20) {
      const saveRoll = await roll(target, `for Save vs ${saveType} (must roll ${saveVersus} or higher)`, 20);
      if (saveRoll.amount >= saveVersus) {
        // TODO save events?
        console.warn(`${Presenter.combatant(target)} succeeds on their Save vs ${saveType}!`);
        // this.note(`${Presenter.combatant(target)} succeeds on their Save vs ${saveType}!`);
        saved = true;
      } else {
        console.warn(`${Presenter.combatant(target)} fails their Save vs ${saveType}!`);
        // this.note(`${Presenter.combatant(target)} fails their Save vs ${saveType}!`);
      }
    }

    return saved;
  }

  static async handleHit(
    attacker: Combatant,
    defender: Combatant,
    damage: number,
    critical: boolean,
    by: string,
    success: boolean,
    damageKind: DamageKind,
    roll: Roll
  ): Promise<TimelessEvent[]> {
    if (!success) {
      return [{ type: "miss", subject: attacker, target: defender } as Omit<MissEvent, "turn">];
    }

    if (defender.hp <= 0) {
      // this.note(`${Presenter.combatant(defender)} is already defeated. No damage applied.`);
      return [];
    }

    // this.note(Stylist.bold(`${Presenter.combatant(defender)} defending against ${damage} ${damageKind} damage...`));

    let defenderEffects = Fighting.gatherEffects(defender);
    let attackerEffects = Fighting.gatherEffects(attacker);

    if (defenderEffects.evasion) {
      let evasionBonus = defenderEffects.evasion as number || 0;
      let whatNumberEvades = 15 - evasionBonus;
      const evasionRoll = await roll(defender, `for evasion (must roll ${whatNumberEvades} or higher)`, 20);
      if (evasionRoll.amount + evasionBonus >= 15) {
        // this.note(`${Presenter.combatant(defender)} evades the attack!`);
        // this.emit({ type: "miss", subject: attacker, target: defender } as Omit<MissEvent, "turn">);
        return [{ type: "miss", subject: attacker, target: defender } as Omit<MissEvent, "turn">];
      }
    }

    if (attackerEffects.bonusDamage) {
      let bonusDamage = attackerEffects.bonusDamage as number || 0;
      damage += bonusDamage;
      // this.note(`${Presenter.combatant(attacker)} has a bonus damage effect, adding ${bonusDamage} damage!`);
      console.warn(`${Presenter.combatant(attacker)} has a bonus damage effect, adding ${bonusDamage} damage!`);
    }

    if (attackerEffects[`${by}Multiplier`]) {
      let multiplier = attackerEffects[`${by}Multiplier`] as number || 1;
      damage = Math.floor(damage * multiplier);
      // this.note(`${Presenter.combatant(attacker)} has a ${by} damage multiplier effect, multiplying damage by ${multiplier}!`);
      console.warn(`${Presenter.combatant(attacker)} has a ${by} damage multiplier effect, multiplying damage by ${multiplier}!`);
    }

    // Apply resistances FIRST
    if (damageKind) {
      const defEffects = Fighting.gatherEffects(defender);
      let resistanceName = `resist${damageKind.charAt(0).toUpperCase() + damageKind.slice(1)}`;
      // const resistance = defenderEffects.resistances?.[damageKind] ?? 1.0;
      const resistance: number = (defEffects[resistanceName] as number) ?? 0.0;

      if (resistance !== 0) {
        const originalDamage = damage;
        if (resistance > 0) {
          damage = Math.floor(originalDamage * (1 - resistance));
        } else if (resistance <= 0) {
          // this is a vulnerability, so we increase damage by the percentage below zero?
          damage = originalDamage + Math.floor(originalDamage * (1 - resistance));
        }
        // this.note(`${Presenter.combatant(defender)} has ${resistance > 0 ? "resistance" : resistance < 0 ? "vulnerability" : "no resistance"} to ${damageKind}, modifying damage from ${originalDamage} to ${damage}.`);
        console.warn(`${Presenter.combatant(defender)} has ${resistance > 0 ? "resistance" : resistance < 0 ? "vulnerability" : "no resistance"} to ${damageKind}, modifying damage from ${originalDamage} to ${damage}.`);
      }
    }

    if (defenderEffects.damageReduction) {
      let reduction = defenderEffects.damageReduction as number || 0;
      damage = Math.max(0, damage - reduction);
      // this.note(`${Presenter.combatant(defender)} has a damage reduction effect, reducing damage by ${reduction}!`);
    }

    // apply damage
    defender.hp -= damage;

    if (defender.hp <= 0) {
      let saved = await Commands.handleSave(defender, "death", 25, roll);
      if (saved) {
        defender.hp = 1;
        // this.note(`${Presenter.combatant(defender)} drops to 1 HP instead of 0!`);
        console.warn(`${Presenter.combatant(defender)} drops to 1 HP instead of 0!`);
      }
    }

    let events: TimelessEvent[] = [{
      type: "hit",
      subject: attacker,
      target: defender,
      damage,
      success: true,
      critical,
      by
    } as Omit<HitEvent, "turn">];
    // this.emit({ type: "hit", subject: attacker, target: defender, damage, success: true, critical, by } as Omit<HitEvent, "turn">);
    if (defender.hp <= 0) {
      // this.emit({ type: "fall", subject: defender } as Omit<FallenEvent, "turn">);
      events.push({ type: "fall", subject: defender } as Omit<FallenEvent, "turn">);
      // trigger on kill fx
      // need to find attacker team...
      let onKillFx = Fighting.gatherEffects(attacker).onKill as AbilityEffect[] || [];
      for (let fx of onKillFx) {
        await AbilityHandler.handleEffect("onKill", fx, attacker, defender, Commands.handlers(roll, null as unknown as Team));
      }
    }
    return events;
  }

  static async handleAttack(combatant: Combatant, target: Combatant, roller: Roll): Promise<{
    success: boolean;
    target: Combatant;
    events: TimelessEvent[];
  }> {
    const { damage, critical, success } = await Fighting.attack(roller, combatant, target);
    let events = await Commands.handleHit(
      combatant, target, damage, critical, `${combatant.forename}'s ${combatant.weapon}`, success, combatant.damageKind || "true", roller
    );
    return { success, target, events };
  }

  static async handleStatusEffect(
    user: Combatant, target: Combatant, name: string, effect: { [key: string]: any }, duration: number
  ): Promise<TimelessEvent[]> {
    // console.log(`${Presenter.combatant(user)} applies status effect ${name} to ${Presenter.combatant(target)} for ${duration} turns!`);
    // if they already have the effect, remove it and reapply it with the new duration
    if (target.activeEffects) {
      let existingEffectIndex = target.activeEffects.findIndex(e => e.name === name);
      if (existingEffectIndex !== -1) {
        target.activeEffects.splice(existingEffectIndex, 1);
      }
    }

    const userFx = Fighting.gatherEffects(user);
    // Apply status duration bonus
    if (userFx.statusDuration) {
      duration += (userFx.statusDuration as number);
      console.log(`Status duration increased by ${userFx.statusDuration}!`);
    }
  

    target.activeEffects = target.activeEffects || [];
    target.activeEffects.push({ name, effect, duration });
    // this.emit({
    //   type: "statusEffect", subject: target, effectName: name, effect, duration
    // } as Omit<StatusEffectEvent, "turn">);

    return [{
      type: "statusEffect", subject: target, effectName: name, effect, duration
    } as Omit<StatusEffectEvent, "turn">];
  }

  static async handleRemoveStatusEffect(target: Combatant, name: string): Promise<TimelessEvent[]> {
    if (target.activeEffects) {
      let existingEffectIndex = target.activeEffects.findIndex(e => e.name === name);
      if (existingEffectIndex !== -1) {
        target.activeEffects.splice(existingEffectIndex, 1);
        // this.emit({
        return [{
          type: "statusExpire", subject: target, effectName: name
        } as Omit<StatusExpireEvent, "turn">];
      }
    }
    return [];
  }
}