import { AbilityEffect } from "../Ability";
import StatusHandler, { StatusEffect, StatusModifications } from "../Status";
import Presenter from "../tui/Presenter";
import Words from "../tui/Words";
import { Combatant } from "../types/Combatant";
import { never } from "../util/never";
import AbilityPresenter from "./AbilityPresenter";

export default class StatusPresenter extends Presenter {

  static describeStatusWithName(status: StatusEffect | string): string {
    const statusEffect = StatusHandler.instance.dereference(status);
    if (!statusEffect) {
      throw new Error(`Buff effect has unknown status: ${JSON.stringify(status)}`);
    }

    // let concreteStatus: StatusEffect;
    // if (typeof status === 'string') {
    //   const fetchedStatus = StatusHandler.instance.getStatus(status);
    //   if (!fetchedStatus) {
    //     throw new Error(`Status ${status} not found`);
    //   }
    //   concreteStatus = fetchedStatus;
    // } else {
    //   concreteStatus = status;
    // }
    return `${statusEffect.name} (${this.describeStatus(statusEffect)})`;
    // return this.analyzeStatus(status);
  }

  static describeStatus(status: StatusEffect | string): string {
    const statusEffect = StatusHandler.instance.dereference(status);
    if (!statusEffect) {
      throw new Error(`Buff effect has unknown status: ${JSON.stringify(status)}`);
    }


    //(status.description ? status.description + " " : '') +
    return Words.capitalize(this.analyzeStatus(statusEffect));
  }

  static analyzeStatus(status: StatusEffect): string {
    const parts: string[] = [];
    const effect = status.effect;

    if (status.whileEnvironment) {
      parts.push(`While in ${Words.a_an(status.whileEnvironment)} environment`);
    }
    if (status.condition) {
      if (status.condition.weapon) {
        if (status.condition.weapon.weight) {
          parts.push(`When wielding a ${Words.humanize(status.condition.weapon.weight)} weapon`);
        }
      }
    }
    parts.push(this.describeModifications(effect, status.name));

    if (status.duration !== undefined) {
      parts.push(this.describeDuration(status.duration));
    }
    return parts.join(' ');
  }

  static describeModifications(effect: StatusModifications, modName?: string): string {
    const parts: string[] = [];

    if (effect === undefined || Object.keys(effect).length === 0) {
      // throw new Error("Cannot describe empty effect modifications for mod " + (modName || 'unknown'))
      return "No enchantment";
    }

    // console.log("Describing modifications:", JSON.stringify(effect));
    // if all effect entries are saves or immunities, summarize differently
    const allSameValue = Object.values(effect).every(value => value === Object.values(effect)[0]);
    const allSavesOrImmunities = Object.keys(effect).every(key => {
      return key.startsWith("saveVersus") || key.startsWith("immune");
    });
    if (allSavesOrImmunities && allSameValue) {
      const saves: string[] = [];
      const immunities: string[] = [];
      for (const [key, value] of Object.entries(effect)) {
        if (value === undefined) { continue; }
        const k: keyof StatusModifications = key as keyof StatusModifications;
        if (key.startsWith("saveVersus") && (value as number) > 0) {
          saves.push(Words.humanize(k.replace("saveVersus", "")));
        } else if (key.startsWith("immune") && (value as boolean)) {
          immunities.push(Words.humanize(k.replace("immune", "")));
        }
      }
      if (saves.length > 0) {
        parts.push(`+${Object.values(effect)[0]} to saves versus ${saves.join(', ')}`);
      }
      if (immunities.length > 0) {
        parts.push(`Immunity to ${immunities.join(', ')}`);
      }
      return parts.join('; ');
    }

    const allStatMods = ['str', 'dex', 'con', 'int', 'wis', 'cha'].every(stat => {
      return effect[stat as keyof StatusModifications] !== undefined;
    })
    if (allStatMods && allSameValue) {
      parts.push(this.increaseDecrease('all stats', effect.str as number));
      return parts.join('; ');
    }


    for (const [key, value] of Object.entries(effect)) {
      if (value === undefined) { continue; }
      const k: keyof StatusModifications = key as keyof StatusModifications;
      switch (k) {
        case "allRolls":
          parts.push(this.increaseDecrease('all rolls', value as number));
          break;
        case "rerollNaturalOnes":
          if (value) {
            parts.push(`Reroll natural ones`);
          }
          break;
        case "str":
        case "dex":
        case "con":
        case "int":
        case "wis":
        case "cha":
          parts.push(this.increaseDecrease(Words.statName(k), value as number));
          break;
        case "initiative":
          parts.push(this.increaseDecrease('initiative', value as number));
          break;
        case "toHit":
          parts.push(this.increaseDecrease('to hit', value as number));
          break;
        case "bonusDamage":
          parts.push(this.increaseDecrease('bonus damage', value as number));
          break;
        case "bonusMeleeDamage":
          parts.push(this.increaseDecrease('bonus melee damage', value as number));
          break;
        case "bonusPoisonDamage":
          parts.push(this.increaseDecrease('bonus poison damage', value as number));
          break;
        case "criticalRangeIncrease":
          parts.push(this.increaseDecrease('critical range', value as number));
          break;
        case "ac":
          parts.push(this.increaseDecrease('AC', -value));
          break;
        case "evasion":
          parts.push(this.increaseDecrease('evasion', value as number));
          break;
        case "bonusHealing":
          parts.push(this.increaseDecrease('bonus healing', value as number));
          break;
        // case "allSaves":
        //   parts.push(this.increaseDecrease('all saves', value));
        //   break;
        case "resistBleed":
        case "resistPoison":
        case "resistPsychic":
        case "resistLightning":
        case "resistFire":
        case "resistCold":
        case "resistBludgeoning":
        case "resistPiercing":
        case "resistSlashing":
        case "resistForce":
        case "resistRadiant":
        case "resistNecrotic":
        case "resistAcid":
        case "resistSonic":
        case "resistTrue":
        case "resistAll":
          if (value as number > 0) {
            parts.push(`${Math.round((value as number) * 100)}% resistance to ${Words.humanize(k.replace("resist", ""))}`);
          } else {
            parts.push(`${Math.round(Math.abs((value as number)) * 100)}% vulnerability to ${Words.humanize(k.replace("resist", ""))}`);
          }
          break;
        case "saveVersusPoison":
        case "saveVersusDisease":
        case "saveVersusDeath":
        case "saveVersusMagic":
        case "saveVersusInsanity":
        case "saveVersusCharm":
        case "saveVersusFear":
        case "saveVersusStun":
        case "saveVersusWill":
        case "saveVersusBreath":
        case "saveVersusParalyze":
        case "saveVersusSleep":
        case "saveVersusBleed":
        case "saveVersusReflex":
        case "saveVersusFortitude":
          parts.push(this.increaseDecrease(`Save versus ${Words.humanize(k.replace("saveVersus", ""))}`, value as number));
          break;
        case "saveVersusAll":
          parts.push(this.increaseDecrease('all saves', value as number));
          break;

        case "immunePoison":
        case "immuneDisease":
        case "immuneDeath":
        case "immuneMagic":
        case "immuneInsanity":
        case "immuneCharm":
        case "immuneFear":
        case "immuneStun":
        case "immuneWill":
        case "immuneBreath":
        case "immuneParalyze":
        case "immuneSleep":
        case "immuneBleed":
        case "immuneReflex":
        case "immuneFortitude":
          if (value) {
            parts.push(`Immunity to ${Words.humanize(k.replace("immune", ""))}`);
          }
          break;

        case "noActions":
          if (value) {
            parts.push(`Cannot take actions`);
          }
          break;
        case "randomActions":
          if (value) {
            parts.push(`Actions are random`);
          }
          break;
        case "noSpellcasting":
          if (value) {
            parts.push(`Cannot cast spells`);
          }
          break;
        case "noStatusExpiry":
          if (value) {
            parts.push(`Status effects do not expire`);
          }
          break;
        case "flee":
          if (value) {
            parts.push(`Fleeing`);
          }
          break;

        case "onCombatStart":
        case "onAttack":
        case "onAttackHit":
        case "onTurnEnd":
        case "onKill":
        case "onAttacked":
        case "onExpire":
        case "onHeal":
        case "onLevelUp":
        case "onOffensiveCasting":

        // @eslint-disable-next-line no-fallthrough
        case "onEnemyCharge":
        case "onEnemyMelee":
        case "onEnemyAttack":
        case "onEnemyDamage":
        case "onEnemyHeal":
        case "onEnemyBuff":
        case "onEnemyDebuff":
        case "onEnemySummon":
        case "onEnemyCasting":
        case "onEnemyOffensiveCasting":

        // @eslint-disable-next-line no-fallthrough
        case "onMissReceived":
        case "onSaveVersusPoison":
        case "onSaveVersusDisease":
        case "onSaveVersusDeath":
        case "onSaveVersusMagic":
        case "onSaveVersusInsanity":
        case "onSaveVersusCharm":
        case "onSaveVersusFear":
        case "onSaveVersusStun":
        case "onSaveVersusWill":
        case "onSaveVersusBreath":
        case "onSaveVersusParalyze":
        case "onSaveVersusBleed":
        case "onSaveVersusSleep":
        case "onSaveVersusReflex":
        case "onSaveVersusFortitude":
          parts.push(`${Words.capitalize(Words.humanize(k).toLocaleLowerCase())}, ${AbilityPresenter.describeEffects(value as AbilityEffect[], 'self')}`);
          break;

        case "summonAnimalBonus":
          parts.push(this.increaseDecrease('summon animal bonus', value as number));
          break;
        case "bonusSpellSlots":
          parts.push(this.increaseDecrease('bonus spell slots', value as number));
          break;
        case "bonusSpellDC":
          parts.push(this.increaseDecrease('bonus spell DC', value as number));
          break;
        case "spellDurationBonus":
          parts.push(this.increaseDecrease('status duration', value as number));
          break;
        case "spellDurationMultiplier":
          parts.push(this.multipliedBy('status duration', value as number));
          break;
        case "backstabMultiplier":
          // parts.push(`Backstab damage multiplied by ${value}x`);

          parts.push(this.multipliedBy('backstab damage', value as number));
          break;
        case "resurrectable":
          if (value) {
            parts.push(`Resurrectable`);
          } else {
            parts.push(`Not resurrectable`);
          }
          break;

        case "extraAttacksPerTurn":
          parts.push(this.increaseDecrease('attacks per turn', value as number));
          break;

        // noncombat
        case "examineBonus":
          parts.push(this.increaseDecrease('examine bonus', value as number));
          break;
        case "searchBonus":
          parts.push(this.increaseDecrease('search bonus', value as number));
          break;
        case "gatherInformationBonus":
          parts.push(this.increaseDecrease('gather information bonus', value as number));
          break;
        case "pickLockBonus":
          parts.push(this.increaseDecrease('pick lock bonus', value as number));
          break;
        case "disarmTrapBonus":
          parts.push(this.increaseDecrease('disarm trap bonus', value as number));
          break;
        case "lootBonus":
          parts.push(this.increaseDecrease('loot bonus', value as number));
          break;

        case "xpMultiplier":
          parts.push(this.multipliedBy('XP gain', value as number));
          break;
        case "goldMultiplier":
          parts.push(this.multipliedBy('Gold earned', value as number));
          break;
        case "consumableMultiplier":
          // parts.push(`Consumables effectiveness multiplied by ${value}x`);
          parts.push(this.multipliedBy('consumable effectiveness', value as number));
          break;
        case "changeAllegiance":
          if (value) {
            parts.push(`Allegiance changed`);
          }
          break;

        case "compelNextMove":
          if (value) {
            parts.push(`Next move compelled to be ${value}`);
          }
          break;

        case "forceTarget":
          if (value) {
            parts.push(`Next target forced to be ${value}`);
          }
          break;

        case "tempHp":
          parts.push(`Gain ${value} temporary HP`);
          break;

        // case "maxHp":
        //   parts.push(this.increaseDecrease('max HP', value));
        //   break;

        case "damageReduction":
          parts.push(`Reduce all damage by ${value}`);
          break;

        case "reflectDamagePercent":
          parts.push(this.increaseDecrease('damage reflection percent', value * 100 + '%'));
          break;

        case "reflectSpellChance":
          parts.push(this.increaseDecrease('spell reflection chance', value * 100 + '%'));
          break;

        case "untargetable":
          if (value) {
            parts.push(`Untargetable`);
          }
          break;

        case "invisible":
          if (value) {
            parts.push(`Invisible`);
          }
          break;

        case "seeInvisible":
          if (value) {
            parts.push(`Can perceive invisible entities`);
          }
          break;

        case "extraTurns":
          parts.push(this.increaseDecrease('extra turns', value as number));
          break;

        case "triggerReactions":
          if (!value) {
            parts.push(`Does not trigger reactions`);
          }
          break;

        case "displayName":
          if (value) {
            parts.push(`Displayed name changed to "${value}"`);
          }
          break;

        case "displayClass":
          if (value) {
            parts.push(`Displayed class changed to "${value}"`);
          }
          break;

        case "effectiveStats":
          if (value) {
            const stats = value as Partial<Combatant>;
            for (const [statKey, statValue] of Object.entries(stats)) {
              parts.push(`${statKey.toUpperCase()} set to ${statValue as number}`);
            }
          }
          break;

        case "effectiveWeapon":
          if (value) {
            parts.push(`Weapon set to ${value}`);
          }
          break;

        case "effectiveArmor":
          if (value) {
            parts.push(`Armor set to ${value}`);
          }
          break;

        case "effectiveSize":
          if (value) {
            parts.push(`Size set to ${Words.humanize(value as string)}`);
          }
          break;

        case "effectiveAbilities":
          if (value) {
            const abilities = value as string[];
            parts.push(`Abilities set to: ${abilities.map(a => Words.humanize(a)).join(', ')}`);
          }
          break;


        // case "maxHp":
        //   parts.push("max HP set to " + value);
        //   break;

        case "attackDie":
          parts.push("attack die set to " + value);
          break;

        case "controlledActions":
          if (value) {
            parts.push(`Actions are controlled`);
          }
          break;

        case "mayUseItems":
          if (value) {
            parts.push(`May use items`);
          } else {
            parts.push(`May not use items`);
          }
          break;

        case "mayBeHealed":
          if (value) {
            parts.push(`May be healed`);
          } else {
            parts.push(`May not be healed`);
          }
          break;

        case "hasPrimaryAttack":
          if (value) {
            parts.push(`Has primary attack`);
          } else {
            parts.push(`No primary attack`);
          }
          break;

        case "readThoughts":
          if (value) {
            parts.push(`Can read surface thoughts of others`);
          }
          break;

        default:
          if ((k as string).startsWith("onEnemy")) {
            parts.push(`${AbilityPresenter.describeEffects(value as AbilityEffect[], 'self')} ${Words.humanize(k)}`);
            break;
          } else if ((k as string).endsWith("Multiplier")) {
            // get just first part
            const what = (k as string).replace("Multiplier", "");
            parts.push(this.multipliedBy(Words.humanize(what), value as number));
            break;
          }

          return never(k);
      }
    }
    return parts.join(", ");
  }
}