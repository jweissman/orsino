import AbilityHandler, { AbilityEffect, DamageKind, SaveKind } from "../Ability";
import { RollResult } from "../types/RollResult";
import { GameEvent, FallenEvent, HealEvent, HitEvent, MissEvent, StatusEffectEvent, StatusExpireEvent, SummonEvent, SaveEvent, DamageBonus, DamageReduction, DamageAbsorb } from "../Events";
import Stylist from "../tui/Style";
import Words from "../tui/Words";
import { Combatant } from "../types/Combatant";
import { Roll } from "../types/Roll";
import { Team } from "../types/Team";
import { Fighting } from "./Fighting";
import { CombatContext } from "../Combat";
import Presenter from "../tui/Presenter";
import Deem from "../../deem";
import { StatusModifications } from "../Status";

type TimelessEvent = Omit<GameEvent, "turn">;

export type CommandHandlers = {
  roll: Roll;
  attack: (combatant: Combatant, target: Combatant, combatContext: CombatContext, spillover: boolean, roller: Roll) => Promise<{ success: boolean; target: Combatant, events: TimelessEvent[] }>;
  hit: (
    attacker: Combatant, defender: Combatant, damage: number, critical: boolean, by: string, success: boolean, damageKind: DamageKind,
      cascade: { count: number, damageRatio: number } | null,
    combatContext: CombatContext, roll: Roll) => Promise<TimelessEvent[]>;
  heal: (
    healer: Combatant, target: Combatant, amount: number,
    combatContext: CombatContext
  ) => Promise<TimelessEvent[]>;
  status: (user: Combatant, target: Combatant, name: string, effect: { [key: string]: any }, duration?: number) => Promise<TimelessEvent[]>;
  removeStatus: (target: Combatant, name: string) => Promise<TimelessEvent[]>;
  // removeItem: (user: Combatant, item: keyof Team) => Promise<TimelessEvent[]>;
  save: (target: Combatant, saveType: SaveKind, dc: number, roll: Roll) => Promise<{
    success: boolean;
    events: TimelessEvent[];
  }>;
  summon: (user: Combatant, summoned: Combatant[]) => Promise<TimelessEvent[]>;
}

export class Commands {
  static handlers(roll = this.roll, team: Team): CommandHandlers {
    return {
      roll,
      save: this.handleSave,
      attack: this.handleAttack,
      hit: this.handleHit,
      heal: this.handleHeal,
      status: this.handleStatusEffect,
      removeStatus: this.handleRemoveStatusEffect,
      // removeItem: async (user: Combatant, item: keyof Team) => {
      //   if (team) {
      //     // @ts-ignore
      //     team[item] = Math.max(0, (team[item] as number || 0) - 1);
      //     console.warn(`${user.forename} consumed ${Words.a_an(item)}. ${team.name} now has ${team[item]} ${item}.`);
      //     // TODO item consume event...
      //   }
      //   return [];
      // },
      summon: async (user: Combatant, summoned: Combatant[]) => {
        // console.log(`${user.name} summons ${summoned.map(s => s.name).join(", ")}!`);
        // team.combatants.push(...summoned);
        let summoningEvents: TimelessEvent[] = [];
        for (let s of summoned) {
          if (team.combatants.length < 6) {
            team.combatants.push(s);
            summoningEvents.push({ type: "summon", subject: user, target: s } as Omit<SummonEvent, "turn">);
          }
        }
        return summoningEvents;
        // return [{ type: "summon", subject: user, summoned } as Omit<SummonEvent, "turn">];
      }
    }
  }

  // async wrapper around autoroll flow
  // static async promisesRoll(subject: Combatant, description: string, sides: number): Promise<RollResult> {
  //   return Commands.roll(subject, description, sides);
  // }

  static async roll(subject: Combatant, description: string, sides: number): Promise<RollResult> {
    let result = Math.floor(Math.random() * sides) + 1;
    let prettyResult = Stylist.colorize(result.toString(), result === sides ? 'green' : result === 1 ? 'red' : 'yellow');
    let rollDescription = Stylist.italic(`${subject.name} rolled d${sides} ${description} and got a ${prettyResult}.`);

    let effectStack = await Fighting.gatherEffects(subject);
    if (effectStack.rerollNaturalOnes && result === 1) {
      rollDescription += ` ${subject.name} has an effect that allows re-rolling natural 1s, so they get to re-roll!`;
      let { amount: newAmount, description: newDescription } = await Commands.roll(subject, description + " (re-roll)", sides);
      result = newAmount;
      rollDescription += " " + newDescription;
    }

    if (effectStack.allRolls) {
      result += effectStack.allRolls as number;
      rollDescription += ` ${subject.name} adds ${effectStack.allRolls} to all rolls, so the total is now ${result}.`;
    }

    // console.log(rollDescription);
    return { amount: result, description: rollDescription };
  }

  static async handleHeal(
    healer: Combatant, target: Combatant, amount: number, combatContext: CombatContext
  ): Promise<TimelessEvent[]> {
    const effective = await Fighting.effectiveStats(healer);
    const wisBonus = Math.max(0, Fighting.statMod(effective.wis));
    if (wisBonus > 0) {
      amount += wisBonus;
      // console.log(`Healing increased by ${wisBonus} for WIS ${healer.wis}`);
    }
    let healerFx = await Fighting.gatherEffects(healer);
    if (healerFx.bonusHealing) {
      amount += await Deem.evaluate(healerFx.bonusHealing.toString()) as number || 0;
      // console.log(`Healing increased by ${healerFx.bonusHealing} due to effects on ${healer.name}`);
    }

    amount = Math.max(1, amount);
    amount = Math.min(amount, target.maxHp - target.hp);
    target.hp = Math.min(target.maxHp, target.hp + amount);

    // check for onHeal effects
    let events: TimelessEvent[] = [{ type: "heal", subject: healer, target, amount } as Omit<HealEvent, "turn">];
    const targetFx = await Fighting.gatherEffects(target);
    let onHealFx = targetFx.onHeal as AbilityEffect[] || [];
    // let combatContext: CombatContext = {
    //   subject: healer,
    //   allies: [],
    //   enemies: []
    // } as CombatContext;
    for (let fx of onHealFx) {
      let { events: healFxEvents } = await AbilityHandler.handleEffect(
        fx.description || "healing effect", fx, healer, target, combatContext, Commands.handlers(Commands.roll, null as unknown as Team)
      );
      events.push(...healFxEvents);
    }

    return events;
  }

  static async handleSave(target: Combatant, saveType: SaveKind, dc: number = 15, roll: Roll): Promise<{ success: boolean, events: TimelessEvent[] }> {
    let targetFx = await Fighting.gatherEffects(target);
    let saveKind = saveType.charAt(0).toUpperCase() + saveType.slice(1);
    let isImmune = (targetFx[`immune${saveKind}` as keyof StatusModifications] as boolean);
      // || (targetFx.immuneAll as boolean);
    if (isImmune) {
      return { success: true, events: [{ type: "save", subject: target, success: true, dc, immune: true, reason: "immunity", versus: saveKind } as Omit<SaveEvent, "turn">] };
    }

    let saveVersusType: keyof StatusModifications = `saveVersus${saveKind}` as keyof StatusModifications;
    const saveBonus: number = {
      "death": Fighting.statMod(target.con),
      "poison": Fighting.statMod(target.con),
      "magic": Fighting.statMod(target.wis),
      "will": Fighting.statMod(target.wis),
      "paralyze": Fighting.statMod(target.str),
      "fear": Fighting.statMod(target.wis),
      "charm": Fighting.statMod(target.wis),
      "disease": Fighting.statMod(target.con),
      "breath": Fighting.statMod(target.con),
      "sleep": Fighting.statMod(target.wis),
      "stun": Fighting.statMod(target.con),
      "insanity": Fighting.statMod(target.int),
    }[saveType] || 0;

    const saveValue = (targetFx[saveVersusType] as number || 0) + (targetFx.saveVersusAll as number || 0) + saveBonus;
    const saveVersus = dc - saveValue - target.level;
    // const saveVersus = dc - (targetFx[saveVersusType] as number || 0) - target.level;
    // let saved = false;
    target.savedTimes = target.savedTimes || {};
    let saveCount = target.savedTimes[saveType] || 0;
    if (saveCount >= 3) {
      return { success: false, events: [{ type: "save", subject: target, success: false, dc, immune: false, reason: "max saves reached", versus: saveKind } as Omit<SaveEvent, "turn">] };
    }

    // we should roll anyway; they could have an allRolls bonus etc even if the DC is very high
    const saveRoll = await roll(target, `for Save vs ${saveKind} (must roll ${saveVersus} or higher)`, 20);
    const success = saveRoll.amount >= saveVersus;
    if (success) {
      // saved = true;

      target.savedTimes[saveType] = (target.savedTimes[saveType] || 0) + 1;
      // return { success: true, events: [{ type: "save", versus: saveKind, subject: target, success: true, dc, immune: false, reason: "successful roll" } as Omit<SaveEvent, "turn">] };

      // check for onResistX effects
      let onSaveFx = targetFx[`onSaveVersus${saveKind}` as keyof StatusModifications] as AbilityEffect[] || [];
      let resistEvents: TimelessEvent[] = [];
      for (let fx of onSaveFx) {

        let { events: resistFxEvents } = await AbilityHandler.handleEffect(
          fx.description || "an effect", fx, target, target, null as unknown as CombatContext, Commands.handlers(roll, null as unknown as Team)
        );
        resistEvents.push(...resistFxEvents);
      }
    } else {
      // return { success: false, events: [{ type: "save", versus: saveKind, subject: target, success: false, dc, immune: false, reason: "failed roll" } as Omit<SaveEvent, "turn">] };
    }

    return { success, events: [{ type: "save", subject: target, success, dc, immune: false, reason: success ? "successful roll" : "failed roll", versus: saveKind } as Omit<SaveEvent, "turn">] };
  }

  static async handleHit(
    attacker: Combatant,
    defender: Combatant,
    damage: number,
    critical: boolean,
    by: string,
    success: boolean,
    damageKind: DamageKind,
    cascade: { count: number, damageRatio: number } | null,
    combatContext: CombatContext,
    roll: Roll
  ): Promise<TimelessEvent[]> {
    let events: TimelessEvent[] = [];

    let defenderEffects = await Fighting.gatherEffects(defender);
    let defenderFxWithNames = await Fighting.gatherEffectsWithNames(defender);
    let attackerEffects = await Fighting.gatherEffects(attacker);
    let attackerFxWithNames = await Fighting.gatherEffectsWithNames(attacker);

    if (!success) {
      // are there onMissReceived effects to process?
      let onMissReceivedFx = defenderEffects.onMissReceived as AbilityEffect[] || [];
      for (let fx of onMissReceivedFx) {
        let target = defender;
        if (fx.target === "attacker") {
          target = attacker;
        }
        let { events: onMissReceivedEvents } = await AbilityHandler.handleEffect(fx.description || "an effect", fx, defender, target, combatContext, Commands.handlers(roll, null as unknown as Team));
        events.push(...onMissReceivedEvents);
      }
      return [{ type: "miss", subject: attacker, target: defender } as Omit<MissEvent, "turn">, ...events];
    }

    if (defender.hp <= 0) {
      return [];
    }
    
    if (defenderEffects.immuneDamage) {
      // could emit immune event?
      events.push({ type: "resist", subject: defender, target: defender, damageKind, originalDamage: damage, finalDamage: 0, sources: defenderFxWithNames.immuneDamage?.sources || [] } as Omit<GameEvent, "turn">);
      return [];
    }

    if (attackerEffects.bonusDamage && attacker != defender) {
      let sources = attackerFxWithNames.bonusDamage?.sources || [];
      let bonusDamage = await Deem.evaluate(attackerEffects.bonusDamage.toString()) as number || 0;
      damage += bonusDamage;
      if (bonusDamage != 0) {
        events.push({ type: "damageBonus", subject: attacker, target: defender, amount: bonusDamage, damageKind, reason: Words.humanizeList(sources) } as Omit<DamageBonus, "turn">);
      }
    }

    let multiplierKey = `${by}Multiplier` as keyof StatusModifications;
    if (attackerEffects[multiplierKey]) {
      let multiplier = attackerEffects[multiplierKey] as number || 1;
      damage = Math.floor(damage * multiplier);
      let delta = damage - Math.floor(damage / multiplier);
      let sources = attackerFxWithNames[multiplierKey]?.sources || [];
      events.push({ type: "damageBonus", subject: attacker, target: defender, amount: delta, damageKind, reason: `a ${multiplier}x multiplier from ${Words.humanizeList(sources)}` } as Omit<DamageBonus, "turn">);
    }

    // what if they're immune to this damage kind? isn't that different from resistance?

    // Apply resistances FIRST
    if (damageKind) {
      const defEffects = await Fighting.gatherEffectsWithNames(defender);
      let resistanceName = `resist${damageKind.charAt(0).toUpperCase() + damageKind.slice(1)}`;
      const resistance: number = (((defEffects.resistAll?.value) ?? 0) as number)
        + ((defEffects[resistanceName]?.value as number) ?? 0 as number);

      if (resistance !== 0) {
        const originalDamage = damage;
        let sources = [
          ...(defEffects.resistAll?.sources || []),
          ...(defEffects[resistanceName]?.sources || []),
        ]
        if (resistance > 0) {
          damage = Math.floor(originalDamage * (1 - resistance));
          // emit a resistant event
          events.push({ type: "resist", subject: defender, target: defender, damageKind, originalDamage, finalDamage: damage, sources } as Omit<GameEvent, "turn">);
        } else if (resistance < 0) {
          // this is a vulnerability, so we increase damage by the percentage below zero
          damage = Math.floor(originalDamage * (1 + Math.abs(resistance)))
          // emit a vulnerable event
          events.push({ type: "vulnerable", subject: defender, target: defender, damageKind, originalDamage, finalDamage: damage, sources} as Omit<GameEvent, "turn">);
        }
      }
    }

    if (defenderEffects.damageReduction) {
      let reduction = defenderEffects.damageReduction as number || 0;
      damage = Math.max(0, damage - reduction);
      if (reduction != 0) {
        let sources = defenderFxWithNames.damageReduction?.sources || [];
        events.push({ type: "damageReduction", subject: defender, target: defender, amount: reduction, damageKind, reason: Words.humanizeList(sources) } as Omit<DamageReduction, "turn">);
      }
    }

    if (defenderEffects.reflectDamagePercent && attacker != defender) {
      let reflectPercent = defenderEffects.reflectDamagePercent as number || 0;
      let reflectedDamage = Math.floor(damage * reflectPercent);
      if (reflectedDamage > 0) {
        console.log(`${Presenter.minimalCombatant(defender)} reflects ${reflectedDamage} ${damageKind} damage back to ${Presenter.minimalCombatant(attacker)}!`);
        let reflectEvents = await Commands.handleHit(
          defender, attacker, reflectedDamage, false, `reflect from ${defender.forename}`, true, damageKind,
          null, combatContext, roll
        );
        events.push(...reflectEvents);
      }
      damage = Math.floor(damage * (1 - reflectPercent));
    }

    // apply damage
    if (damage < 0) { damage = 0; }
    // if damage is NaN throw error
    if (isNaN(damage)) {
      throw new Error(`Damage calculated as NaN for ${Presenter.minimalCombatant(attacker)} attacking ${Presenter.minimalCombatant(defender)}.`);
    }

    let originalHp = defender.hp;
    for (let [source, pool] of Object.entries(defender.tempHpPools || {})) {
      let originalTempHp = pool;
      if (isNaN(originalTempHp)) {
        throw new Error(`Temporary HP pool '${source}' is NaN for ${Presenter.minimalCombatant(defender)}.`);
      }
      // let originalTempHp = defender.tempHp || 0;
      if (originalTempHp > 0) {
        if (damage >= originalTempHp) {
          damage -= originalTempHp;
          events.push({ type: "tempHpAbsorb", subject: defender, target: defender, amount: originalTempHp, source } as Omit<DamageAbsorb, "turn">);
          pool = 0;
        } else {
          pool = originalTempHp - damage;
          events.push({ type: "tempHpAbsorb", subject: defender, target: defender, amount: damage, source } as Omit<DamageAbsorb, "turn">);
          damage = 0;
        }
        defender.tempHpPools = defender.tempHpPools || {};
        defender.tempHpPools[source] = pool;
        if (damage <= 0) {
          break;
        }
      }
    }
    defender.hp -= damage;

    if (defender.hp <= 0) {
      let { events: saveEvents, success: saved } = await Commands.handleSave(defender, "death", 25, roll);

      events.push(...saveEvents);
      if (saved) {
        defender.hp = 1;
        // this.note(`${Presenter.combatant(defender)} drops to 1 HP instead of 0!`);
        // console.warn(`${Presenter.minimalCombatant(defender)} drops to 1 HP instead of 0!`);
      }
    }

    

    // let events: TimelessEvent[] = [{
    events.push({
      type: "hit",
      subject: attacker,
      target: defender,
      damage: Math.min(damage, originalHp),
      success: true,
      critical,
      by,
      damageKind
    } as Omit<HitEvent, "turn">);

    if (critical) {
      events.push({ type: "crit", subject: attacker, target: defender, damage, by, damageKind } as Omit<GameEvent, "turn">);
    }

    // if cascade, jump to another target
    if (cascade) {
      let count = cascade.count;
      if (typeof count === "string") {
        count = await Deem.evaluate(count, { ...attacker }) as number;
      }
      if (count > 0 && damage > 0) {
        let otherTargets = combatContext.enemies.filter(c => c !== defender && c.hp > 0);
        if (otherTargets.length > 0) {
          console.log(`Cascade damage of ${damage} triggered from ${Presenter.minimalCombatant(defender)} (${count} jumps remaining).`);
          let newTarget = otherTargets[Math.floor(Math.random() * otherTargets.length)];
          let cascadeDamage = Math.max(1, Math.floor(damage * cascade.damageRatio));
          console.log(`${Presenter.minimalCombatant(defender)} cascades ${cascadeDamage} ${damageKind} damage to ${Presenter.minimalCombatant(newTarget)}!`);
          let cascadeEvents = await Commands.handleHit(
            attacker, newTarget, cascadeDamage, false, `cascade from ${defender.forename}`, true, damageKind,
            { count: count - 1, damageRatio: cascade.damageRatio }, combatContext, roll
          );
          events.push(...cascadeEvents);
        }
      }
    }

    if (defender.hp <= 0) {
      events.push({ type: "fall", subject: defender } as Omit<FallenEvent, "turn">);
      events.push({ type: "kill", subject: attacker, target: defender } as Omit<GameEvent, "turn">);
      // trigger on kill fx
      // need to find attacker team...
      let onKillFx = attackerEffects.onKill as AbilityEffect[] || [];
      for (let fx of onKillFx) {
        let { events: onKillEvents } = await AbilityHandler.handleEffect(fx.description || "an effect", fx, attacker, attacker, combatContext, Commands.handlers(roll, null as unknown as Team));
        events.push(...onKillEvents);
      }
    } else {
      // does defender have onAttacked effects? (and attacker is not themselves...)
      if (attacker !== defender) {
        let onAttackedFx = defenderEffects.onAttacked as AbilityEffect[] || [];
        // console.log(`Defender ${defender.forename} has ${onAttackedFx.length} onAttacked effects to process.`);
        for (let fx of onAttackedFx) {
          // console.log(`Processing onAttacked effect: ${fx.description}`);
          let target = defender;
          if (fx.target === "attacker") {
            target = attacker;
          }
          let { events: onAttackedEvents } = await AbilityHandler.handleEffect(fx.description || "an effect", fx, defender, target, combatContext, Commands.handlers(roll, null as unknown as Team));
          events.push(...onAttackedEvents);
        }
      }

    }

    return events;
  }

  static async handleAttack(combatant: Combatant, target: Combatant, context: CombatContext, spillover: boolean, roller: Roll): Promise<{
    success: boolean;
    target: Combatant;
    events: TimelessEvent[];
  }> {
    let { damage, critical, success } = await Fighting.attack(roller, combatant, target, combatant.hasMissileWeapon || false);
    let targetOriginalHp = target.hp;
    let events = await Commands.handleHit(
      combatant, target, damage, critical, `${combatant.forename}'s ${Words.humanize(combatant.weapon)}`, success, combatant.damageKind || "true",
      null, // no cascade for normal attacks
      context, roller
    );
    success = success && events.some(e => e.type === "hit");

    let lethal = target.hp <= 0;

    if (success && lethal && spillover) {
      // if lethal and spillover damage, apply to another target
      if (damage > targetOriginalHp) { //} + damage) {
        let spillover = damage - (targetOriginalHp);
        let otherTargets = context.enemies.filter(c => c !== target && c.hp > 0);
        while (otherTargets.length > 0) {
          let newTarget = otherTargets[Math.floor(Math.random() * otherTargets.length)];
          // console.log(`${Presenter.combatant(target)} spilled over ${spillover} damage to ${Presenter.combatant(newTarget)}!`);
          let newTargetOriginalHp = newTarget.hp;
          let spilloverEvents = await Commands.handleHit(
            combatant, newTarget, spillover, false, `${combatant.forename}'s ${Words.humanize(combatant.weapon)} (spillover, ${spillover} damage remaining)`, true, combatant.damageKind || "true",
            null, // no cascade for normal attacks
            context, roller
          );
          events.push(...spilloverEvents);

          if (newTarget.hp > 0 || spillover <= newTargetOriginalHp) {
            break;
          } else {
            spillover = spillover - newTargetOriginalHp;
            otherTargets = otherTargets.filter(c => c !== newTarget);
          }
        }
      }
    }

    return { success, target, events };
  }

  static async handleStatusEffect(
    user: Combatant, target: Combatant, name: string, effect: StatusModifications, duration?: number 
  ): Promise<TimelessEvent[]> {
    if (target.activeEffects) {
      let existingEffectIndex = target.activeEffects.findIndex(e => e.name === name);
      if (existingEffectIndex !== -1) {
        target.activeEffects.splice(existingEffectIndex, 1);
      }
    }

    const userFx = await Fighting.gatherEffects(user);
    // Apply status duration bonus
    if (duration && userFx.statusDuration) {
      duration += (userFx.statusDuration as number);
    }

    target.activeEffects = target.activeEffects || [];
    target.activeEffects.push({ name, effect, duration, by: user });
    if (effect.tempHp) {
      let pool = await Deem.evaluate(effect.tempHp.toString(), { ...user }) as number || 0;
      // console.warn(`${Presenter.combatant(target)} gains ${pool} temporary HP from status effect ${name}.`);
      // target.tempHp = (target.tempHp || 0) + effect.tempHp;
      target.tempHpPools = target.tempHpPools || {};

      target.tempHpPools[name] = pool;
    }

    return [{
      type: "statusEffect", subject: target, effectName: name, effect, duration
    } as Omit<StatusEffectEvent, "turn">];
  }

  static async handleRemoveStatusEffect(target: Combatant, name: string): Promise<TimelessEvent[]> {
    if (target.activeEffects) {
      let existingEffectIndex = target.activeEffects.findIndex(e => e.name === name);
      let effect = target.activeEffects[existingEffectIndex]?.effect;
      if (effect?.tempHp) {
        // console.warn(`${Presenter.combatant(target)} loses ${effect.tempHp} temporary HP from removal of status effect ${name}.`);
        // target.tempHp = Math.max(0, (target.tempHp || 0) - effect.tempHp);
        target.tempHpPools = target.tempHpPools || {};
        delete target.tempHpPools[name];
      }
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