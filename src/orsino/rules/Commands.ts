import AbilityHandler, { AbilityEffect } from "../Ability";
import { DamageKind } from "../types/DamageKind";
import { RollResult } from "../types/RollResult";
import { GameEvent, FallenEvent, HealEvent, HitEvent, MissEvent, StatusEffectEvent, StatusExpireEvent, SummonEvent, SaveEvent, DamageBonus, DamageReduction, DamageAbsorb, UnsummonEvent } from "../Events";
import Stylist from "../tui/Style";
import Words from "../tui/Words";
import { Combatant } from "../types/Combatant";
import { Roll } from "../types/Roll";
import { Fighting } from "./Fighting";
import Combat, { CombatContext } from "../Combat";
import Presenter from "../tui/Presenter";
import Deem from "../../deem";
import StatusHandler, { StatusModifications } from "../Status";
import { SAVE_KINDS, SaveKind } from "../types/SaveKind";

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
  status: (user: Combatant, target: Combatant, name: string, effect: StatusModifications, duration?: number, source?: string) => Promise<TimelessEvent[]>;
  removeStatus: (target: Combatant, name: string) => Promise<TimelessEvent[]>;
  // removeItem: (user: Combatant, item: keyof Team) => Promise<TimelessEvent[]>;
  save: (target: Combatant, saveKind: SaveKind, dc: number, roll: Roll) => Promise<{
    success: boolean;
    events: TimelessEvent[];
  }>;
  summon: (user: Combatant, summoned: Combatant[], source?: string) => Promise<TimelessEvent[]>;
}

export class Commands {
  static handlers(roll = this.roll.bind(this)): CommandHandlers {
    return {
      roll,
      save: this.handleSave.bind(this),
      attack: this.handleAttack.bind(this),
      hit: this.handleHit.bind(this),
      heal: this.handleHeal.bind(this),
      status: this.handleStatusEffect.bind(this),
      removeStatus: this.handleRemoveStatusEffect.bind(this),
      summon: this.handleSummon.bind(this),
    }
  }

  static roll(subject: Combatant, description: string, sides: number): RollResult {
    let result = Math.floor(Math.random() * sides) + 1;
    const prettyResult = Stylist.colorize(result.toString(), result === sides ? 'green' : result === 1 ? 'red' : 'yellow');
    let rollDescription = Stylist.italic(`${subject.name} rolled d${sides} ${description} and got a ${prettyResult}.`);

    const effectStack = Fighting.gatherEffects(subject);
    if (effectStack.rerollNaturalOnes && result === 1) {
      rollDescription += ` ${subject.name} has an effect that allows re-rolling natural 1s, so they get to re-roll!`;
      const { amount: newAmount, description: newDescription } = Commands.roll(subject, description + " (re-roll)", sides);
      result = newAmount;
      rollDescription += " " + newDescription;
    }

    if (effectStack.allRolls) {
      result += effectStack.allRolls;
      result = Math.max(1, result);
      rollDescription += ` ${subject.name} adds ${effectStack.allRolls} to all rolls, so the total is now ${result}.`;
    }
    // console.warn(rollDescription);
    return { amount: result, description: rollDescription };
  }

  static async handleHeal(
    healer: Combatant, target: Combatant, amount: number, combatContext: CombatContext
  ): Promise<TimelessEvent[]> {
    const healerFx = Fighting.gatherEffects(healer);
    if (healerFx.bonusHealing) {
      amount += Deem.evaluate(healerFx.bonusHealing.toString()) as number || 0;
    }

    amount = Math.max(1, amount);
    const effectiveTarget = Fighting.effectiveStats(target);
    amount = Math.min(amount, effectiveTarget.maxHp - target.hp);
    target.hp = Math.min(effectiveTarget.maxHp, target.hp + amount);

    // check for onHeal effects
    const events: TimelessEvent[] = [{ type: "heal", subject: healer, target, amount } as Omit<HealEvent, "turn">];
    events.push(...await AbilityHandler.performHooks("onHeal", healer, combatContext, Commands.handlers(Commands.roll.bind(Commands)), "healing effect"));

    return events;
  }

  static async handleSave(target: Combatant, saveKind: SaveKind, dc: number = 15, roll: Roll): Promise<{ success: boolean, events: TimelessEvent[] }> {
    const targetFx = Fighting.gatherEffects(target);
    const saveKindName = saveKind.charAt(0).toUpperCase() + saveKind.slice(1);

    if (SAVE_KINDS.indexOf(saveKind) === -1) {
      throw new Error(`Unknown save kind "${saveKind}" requested in handleSave.`);
    }

    const isImmune = (targetFx[`immune${saveKindName}` as keyof StatusModifications] as boolean);
    if (isImmune) {
      return { success: true, events: [{ type: "save", subject: target, success: true, dc, immune: true, reason: "immunity", versus: saveKind } as Omit<SaveEvent, "turn">] };
    }

    const saveVersusType: keyof StatusModifications = `saveVersus${saveKindName}` as keyof StatusModifications;
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
      "bleed": Fighting.statMod(target.con),
      "reflex": Fighting.statMod(target.dex),
      "fortitude": Fighting.statMod(target.con),
    }[saveKind] || 0;

    const saveValue = (targetFx[saveVersusType] as number || 0) + (targetFx.saveVersusAll as number || 0) + saveBonus;
    const saveVersus = dc - saveValue - target.level;
    target.savedTimes = target.savedTimes || {};
    const saveCount = target.savedTimes[saveKind] || 0;
    if (saveCount >= 3) {
      return { success: false, events: [{ type: "save", subject: target, success: false, dc, immune: false, reason: "max saves reached", versus: saveKind } as Omit<SaveEvent, "turn">] };
    }

    // we should roll anyway; they could have an allRolls bonus etc even if the DC is very high
    const saveRoll = roll(target, `for Save vs ${saveKind} (must roll ${saveVersus} or higher)`, 20);
    const success = saveRoll.amount >= saveVersus;
    if (success) {
      target.savedTimes[saveKind] = (target.savedTimes[saveKind] || 0) + 1;
      // check for onResistX effects
      const onSaveFx = targetFx[`onSaveVersus${saveKind}` as keyof StatusModifications] as AbilityEffect[] || [];
      const resistEvents: TimelessEvent[] = [];
      for (const fx of onSaveFx) {

        const { events: resistFxEvents } = await AbilityHandler.handleEffect(
          fx.description || "an effect", fx, target, target, null as unknown as CombatContext, Commands.handlers(roll)
        );
        resistEvents.push(...resistFxEvents);
      }
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
    const events: TimelessEvent[] = [];

    const defenderEffects = Fighting.gatherEffects(defender);
    const defenderFxWithNames = Fighting.gatherEffectsWithNames(defender);
    const attackerEffects = Fighting.gatherEffects(attacker);
    const attackerFxWithNames = Fighting.gatherEffectsWithNames(attacker);

    if (!success) {
      events.push(...await AbilityHandler.performHooks(
        "onMissReceived", defender, combatContext, Commands.handlers(roll), "miss received"
      ));
      return [{ type: "miss", subject: attacker, target: defender } as Omit<MissEvent, "turn">, ...events];
    }

    if (defender.hp <= 0) {
      return [];
    }

    if (attackerEffects.bonusDamage && attacker !== defender) {
      const sources = attackerFxWithNames.bonusDamage?.sources || [];
      const bonusDamage = Deem.evaluate(attackerEffects.bonusDamage.toString()) as number || 0;
      damage = Math.max(0, damage + bonusDamage);
      if (bonusDamage !== 0) {
        events.push({ type: "damageBonus", subject: attacker, target: defender, amount: bonusDamage, damageKind, reason: Words.humanizeList(sources) } as Omit<DamageBonus, "turn">);
      }
    }

    const multiplierKey = `${by}Multiplier` as keyof StatusModifications;
    if (attackerEffects[multiplierKey]) {
      const multiplier = attackerEffects[multiplierKey] as number || 1;
      const extra = Math.max(0, Math.floor(damage * (multiplier - 1)));
      damage = Math.max(0, damage + extra);
      // let delta = damage - Math.floor(damage / multiplier);
      const sources = attackerFxWithNames[multiplierKey]?.sources || [];
      events.push({ type: "damageBonus", subject: attacker, target: defender, amount: extra, damageKind, reason: `a ${multiplier}x multiplier from ${Words.humanizeList(sources)}` } as Omit<DamageBonus, "turn">);
    }

    // what if they're immune to this damage kind? isn't that different from resistance?

    // Apply resistances FIRST
    if (damageKind) {
      const defEffects = Fighting.gatherEffectsWithNames(defender);
      const resistanceName = `resist${damageKind.charAt(0).toUpperCase() + damageKind.slice(1)}`;
      const resistance: number = (((defEffects.resistAll?.value) ?? 0) as number)
        + ((defEffects[resistanceName]?.value as number) ?? 0 as number);

      if (resistance !== 0) {
        const originalDamage = damage;
        const sources = [
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
          events.push({ type: "vulnerable", subject: defender, target: defender, damageKind, originalDamage, finalDamage: damage, sources } as Omit<GameEvent, "turn">);
        }
      }
    }

    if (defenderEffects.damageReduction) {
      const reduction = defenderEffects.damageReduction || 0;
      damage = Math.max(0, damage - reduction);
      if (reduction !== 0) {
        const sources = defenderFxWithNames.damageReduction?.sources || [];
        events.push({ type: "damageReduction", subject: defender, target: defender, amount: reduction, damageKind, reason: Words.humanizeList(sources) } as Omit<DamageReduction, "turn">);
      }
    }

    if (defenderEffects.reflectDamagePercent && attacker !== defender) {
      const reflectPercent = defenderEffects.reflectDamagePercent || 0;
      const reflectedDamage = Math.floor(damage * reflectPercent);
      if (reflectedDamage > 0) {
        // console.log(`${Presenter.minimalCombatant(defender)} reflects ${reflectedDamage} ${damageKind} damage back to ${Presenter.minimalCombatant(attacker)}!`);
        const reflectEvents = await Commands.handleHit(
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

    const originalHp = defender.hp;
    for (let [source, pool] of Object.entries(defender.tempHpPools || {})) {
      const originalTempHp = pool;
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
      const { events: saveEvents, success: saved } = await Commands.handleSave(defender, "death", 25, roll);

      events.push(...saveEvents);
      if (saved) {
        defender.hp = 1;
        // this.note(`${Presenter.combatant(defender)} drops to 1 HP instead of 0!`);
        // console.warn(`${Presenter.minimalCombatant(defender)} drops to 1 HP instead of 0!`);
      }
    } //else

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
        count = Deem.evaluate(count, { ...attacker } as any) as number;
      }
      if (count > 0 && damage > 0) {
        const otherTargets = combatContext.enemies.filter(c => c !== defender && c.hp > 0);
        if (otherTargets.length > 0) {
          // console.log(`Cascade damage of ${damage} triggered from ${Presenter.minimalCombatant(defender)} (${count} jumps remaining).`);
          const newTarget = otherTargets[Math.floor(Math.random() * otherTargets.length)];
          const cascadeDamage = Math.max(1, Math.floor(damage * cascade.damageRatio));
          // console.log(`${Presenter.minimalCombatant(defender)} cascades ${cascadeDamage} ${damageKind} damage to ${Presenter.minimalCombatant(newTarget)}!`);
          const cascadeEvents = await Commands.handleHit(
            attacker, newTarget, cascadeDamage, false, `cascade via ${defender.forename}`, true, damageKind,
            { count: count - 1, damageRatio: cascade.damageRatio }, combatContext, roll
          );
          events.push(...cascadeEvents);
        }
      }
    }

    if (defender.hp <= 0) {
      events.push({ type: "fall", subject: defender } as Omit<FallenEvent, "turn">);
      if (attacker !== defender) {
        events.push({ type: "kill", subject: attacker, target: defender } as Omit<GameEvent, "turn">);
        // trigger on kill fx
        // need to find attacker team...
        const onKillFx = attackerEffects.onKill as AbilityEffect[] || [];
        for (const fx of onKillFx) {
          const { events: onKillEvents } = await AbilityHandler.handleEffect(fx.description || "an effect", fx, attacker, attacker, combatContext, Commands.handlers(roll));
          events.push(...onKillEvents);
        }
      }
    } else {
      const triggers = StatusHandler.instance.triggersForDamageType(damageKind || "true");
      for (const statusName of triggers) {
        const statusEffect = StatusHandler.instance.getStatus(statusName);

        if (statusEffect) {
          const { success: saved, events: saveEvents } = await Commands.handleSave(defender, statusEffect.saveKind || "magic", 15, roll);
          events.push(...saveEvents);
          if (!saved) {
            const statusEvents = await Commands.handleStatusEffect(
              attacker, defender,
              statusEffect.name, { ...statusEffect.effect },
              statusEffect.duration || 3,
              attacker.forename
            );
            events.push(...statusEvents);
          }
        }
      }

      // does defender have onAttacked effects? (and attacker is not themselves...)
      if (attacker !== defender) {
        const onAttackedFx = defenderEffects.onAttacked as AbilityEffect[] || [];
        // is there some reason we can't process with hooks?
        // console.log(`Defender ${defender.forename} has ${onAttackedFx.length} onAttacked effects to process.`);
        for (const fx of onAttackedFx) {
          // console.log(`Processing onAttacked effect: ${fx.description}`);
          let target = defender;
          if (fx.target === "attacker") {
            target = attacker;
          }
          const { events: onAttackedEvents } = await AbilityHandler.handleEffect(fx.description || "an effect", fx, defender, target, combatContext, Commands.handlers(roll));
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
    const events = [];
    let { damage, critical, success } = await Fighting.attack(roller, combatant, target, context);
    const targetOriginalHp = target.hp;
    const weapon = Fighting.effectiveWeapon(combatant, context); //.inventory);
    const bonusMeleeDamage = Fighting.gatherEffects(combatant).bonusMeleeDamage || 0;
    if (bonusMeleeDamage > 0 && Fighting.isMeleeWeapon(weapon)) {
      damage += bonusMeleeDamage;
      events.push({ type: "damageBonus", subject: combatant, target, amount: bonusMeleeDamage, damageKind: weapon.type || "true", reason: `bonus melee damage` } as Omit<DamageBonus, "turn">);
    }
    const hitEvents = await Commands.handleHit(
      combatant, target, damage, critical, `${combatant.forename}'s ${Words.humanize(weapon.name)}`, success, weapon.type || "true",
      null, // no cascade for normal attacks
      context, roller
    );
    events.push(...hitEvents);
    success = success && hitEvents.some(e => e.type === "hit");

    const lethal = target.hp <= 0;

    if (success && lethal && spillover) {
      // if lethal and spillover damage, apply to another target
      if (damage > targetOriginalHp) {
        let spillover = damage - (targetOriginalHp);
        let otherTargets = context.enemies.filter(c => c !== target && c.hp > 0);
        while (otherTargets.length > 0) {
          const newTarget = otherTargets[Math.floor(Math.random() * otherTargets.length)];
          const newTargetOriginalHp = newTarget.hp;
          // const weapon = Fighting.effectiveWeapon(combatant, context.inventory);
          const spilloverEvents = await Commands.handleHit(
            combatant, newTarget, spillover, false, `${combatant.forename}'s ${Words.humanize(weapon.name)} (spillover, ${spillover} damage remaining)`, true, weapon.type || "true",
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
    user: Combatant, target: Combatant, name: string, effect: StatusModifications, duration?: number, source?: string
  ): Promise<TimelessEvent[]> {
    if (target.activeEffects) {
      const existingEffectIndex = target.activeEffects.findIndex(e => e.name === name);
      if (existingEffectIndex !== -1) {
        target.activeEffects.splice(existingEffectIndex, 1);
      }
    }

    const userFx = Fighting.gatherEffects(user);
    // Apply status duration bonus
    if (duration && userFx.spellDurationBonus) {
      duration += (userFx.spellDurationBonus);
    }

    target.activeEffects = target.activeEffects || [];
    target.activeEffects.push({ name, effect, duration, by: user });
    if (effect.tempHp) {
      const pool = Deem.evaluate(effect.tempHp.toString(), { ...user } as any) as number || 0;
      target.tempHpPools = target.tempHpPools || {};

      target.tempHpPools[name] = pool;
    }

    return [
      {
        type: "statusEffect",
        subject: target,
        effectName: name,
        effect,
        duration,
        source: source || user.forename
      } as Omit<StatusEffectEvent, "turn">
    ];
  }

  static async handleRemoveStatusEffect(target: Combatant, name: string): Promise<TimelessEvent[]> {
    const events = [];
    let existingEffectIndex = -1;
    while (target.activeEffects && (existingEffectIndex = target.activeEffects.findIndex(
      e => e.name.match(new RegExp(`^${name}$`, 'i'))
    )) !== -1) {
      // let existingEffectIndex = target.activeEffects.findIndex(
      //   e => e.name.match(new RegExp(`^${name}$`, 'i'))
      // );
      const effect = target.activeEffects[existingEffectIndex]?.effect;
      if (effect?.tempHp) {
        // console.warn(`${Presenter.combatant(target)} loses ${effect.tempHp} temporary HP from removal of status effect ${name}.`);
        // target.tempHp = Math.max(0, (target.tempHp || 0) - effect.tempHp);
        target.tempHpPools = target.tempHpPools || {};
        delete target.tempHpPools[name];
      }
      if (existingEffectIndex !== -1) {
        target.activeEffects.splice(existingEffectIndex, 1);
        // this.emit({
        let effectName = name;
        if (effectName == '.*') {
          effectName = 'any active status effect';
        }
        events.push({ type: "statusExpire", subject: target, effectName, } as Omit<StatusExpireEvent, "turn">);
      }
    }
    // else {
    //   console.warn(`Tried to remove status effect ${name} from ${target.forename} but they have no active effects.`);
    // }
    return Promise.resolve(events);
  }

  static async handleSummon(user: Combatant, summoned: Combatant[], source?: string): Promise<TimelessEvent[]> {
    const summoningEvents: TimelessEvent[] = [];
    user.activeSummonings = user.activeSummonings || [];
    if (summoned.length + (user.activeSummonings?.length || 0) > Combat.maxSummoningsForCombatant(user)) {
      // un-summon extras
      const unsummoned = [];
      while (summoned.length + (user.activeSummonings?.length || 0) > Combat.maxSummoningsForCombatant(user)) {
        const s = user.activeSummonings.pop();
        if (s) {
          unsummoned.push(s);
        }
      }

      unsummoned.forEach(s => {
        summoningEvents.push({ type: "unsummon", subject: user, target: s } as Omit<UnsummonEvent, "turn">);
      })
    }

    for (const s of summoned) {
      user.activeSummonings.push(s);
      summoningEvents.push({ type: "summon", subject: user, target: s, source } as Omit<SummonEvent, "turn">);
    }
    // return summoningEvents;

    return Promise.resolve(summoningEvents);
  }

}