import Stylist from "./Style";
import { Combatant } from "../types/Combatant";
import Words from "./Words";
import { Fighting } from "../rules/Fighting";
import AbilityHandler, { Ability, AbilityEffect, Target } from "../Ability";
import TraitHandler from "../Trait";
import Combat from "../Combat";
import { StatusEffect, StatusModifications } from "../Status";
import { never } from "../util/never";

export default class Presenter {
  static colors = ['magenta', 'red', 'yellow', 'yellow', 'yellow', 'green', 'green', 'green', 'green'];

  static aggregateList = (items: string[]) => {
    let counts: { [item: string]: number } = {};
    items.forEach(item => {
      counts[item] = (counts[item] || 0) + 1;
    });
    return Object.entries(counts).map(([item, count]) => {
      return count > 1 ? `${item} x${count}` : item;
    }).join(", ");
  }

  static async printCharacterRecord(combatant: Combatant) {
    console.log("\n" + "=".repeat(40) + "\n");
    console.log(await this.characterRecord(combatant));
    console.log("\n" + "=".repeat(40) + "\n");
  }

  static async characterRecord(combatant: Combatant) {
    let record = "";
    // record += (Stylist.bold("\n\nCharacter Record\n"));
    record += (Stylist.format(`${this.combatant(combatant)}\t${(await this.statLine(combatant))}\n`, 'underline'));

    // "Human Female Warrior of Hometown (41 years old)"
    let descriptor = {
      male: "He is", female: "She is", androgynous: "They are"
    }[(combatant.gender || 'androgynous').toLowerCase()] || "They are";

    record += (
      Stylist.italic(
        `${Words.capitalize(combatant.background || 'adventurer')} ${Words.humanize(combatant.archetype || 'neutral')} from the ${combatant.hometown || 'unknown'}, ${combatant.age || 'unknown'} years old. ${descriptor} of ${combatant.body_type || 'average'} build with ${combatant.hair || 'unknown color'} hair, ${combatant.eye_color || 'dark'} eyes and ${Words.a_an(combatant.personality || 'unreadable')} disposition.`
      ) + "\n\n"
    )
    let statNames = ['str', 'dex', 'int', 'wis', 'cha', 'con'];
    let effective = await Fighting.effectiveStats(combatant);
    let statLine = statNames.map(stat => {
      const value = (effective as any)[stat];
      const mod = Fighting.statMod(value);
      const color = mod > 0 ? 'green' : (mod < 0 ? 'red' : 'white');
      const sign = mod >= 0 ? '+' : '';
      return `${Stylist.bold(stat.toUpperCase())} ${value} (${Stylist.colorize(sign + mod, color)})`;
    });
    record += statLine.join(' | ');

    record += "\nHit Points: " + Stylist.colorize(`${combatant.hp}/${combatant.maxHp} \n`, 'green');
    // record += "Armor Class: " + Stylist.colorize(`${combatant.ac} `, 'yellow');

    let basics = {
      weapon: (combatant.weapon || 'None'),
      armor: combatant.armor || 'None',
      // background: combatant.background || 'None',
      xp: combatant.xp,
      gp: combatant.gp,
    }
    record += ("\n" + Object.entries(basics).map(([key, value]) => {
      return this.padLiteralEnd(`${Stylist.bold(Words.capitalize(key))} ${Words.humanize(value.toString())}`, 25);
    }).join('   ')) + "\n";

    let bolt = Stylist.colorize('⚡', 'yellow');
    let core = {
      // "Hit Points": Stylist.colorize(`${combatant.hp}/${combatant.maxHp}`, 'green'),
      "Attack Die": Stylist.colorize(combatant.attackDie, 'red'),
      "Armor Class": Stylist.colorize(`${(effective as any).ac}`, 'yellow'),
      "Spell Slots": ["mage", "bard", "cleric"].includes(combatant.class || '') ?
        bolt.repeat(Combat.maxSpellSlotsForCombatant(combatant)) : "none"
    }
    record += (Object.entries(core).map(([key, value]) => {
      return this.padLiteralEnd(`${Stylist.bold(Words.capitalize(key))} ${Words.humanize(value)}`, 25);
    }).join('   ')) + "\n";

    // ability table
    record += Stylist.bold("\nAbilities\n");
    let abilityHandler = AbilityHandler.instance;
    for (let abilityName of combatant.abilities || []) {
      let ability = abilityHandler.getAbility(abilityName)!;
      record += `  ${Stylist.colorize(ability.name, 'magenta').padEnd(28)} ${ability.description + ' ' || ''}${this.describeAbility(ability)}\n`;
    }

    // traits
    let passiveEffectsFromAbilities: string[] = [];
    if (combatant.traits && combatant.traits.length > 0) {
      let traitHandler = TraitHandler.instance;
      record += Stylist.bold("\nTraits\n");
      for (let traitName of combatant.traits || []) {
        let trait = traitHandler.getTrait(traitName);
        if (trait) {
          record += `  ${Stylist.colorize(trait.description, 'blue')}\n`;
          trait.statuses?.forEach(status => {
            passiveEffectsFromAbilities.push(status.name);
            // record += `  ${Stylist.colorize(status.name, 'cyan')} (${status.description})\n`;
            record += `  ${this.describeStatus(status)}\n`;
          });
          record += "\n";
        }
      }
    }

    // active and passive effects
    if (combatant.activeEffects && combatant.activeEffects.length > 0) {
      record += Stylist.bold("\nActive Effects\n");
      combatant.activeEffects.forEach(status => {
        record += `  ${Stylist.colorize(status.name, 'cyan')} (${
          this.analyzeStatus(status)
        })\n`;
      });
    }
    const otherPassives = combatant.passiveEffects?.filter(effect => !passiveEffectsFromAbilities.includes(effect.name)) || [];
    if (otherPassives.length > 0) {
      record += Stylist.bold("\nPassive Effects\n");
      otherPassives.forEach(effect => {
        if (passiveEffectsFromAbilities.includes(effect.name)) {
          return; // already listed above
        }
        record += `  ${Stylist.colorize(effect.name, 'cyan')} (${effect.description})\n`;
      });
    }

    if (combatant.equipment && Object.keys(combatant.equipment).length > 0) {
      record += Stylist.bold("\nEquipped Items: \n");
      Object.entries(combatant.equipment).forEach(([slot, item]) => {
        record += `  ${Stylist.colorize(Words.capitalize(slot), 'yellow')}: ${Words.humanize(item)}\n`;
      });
    }

    if (combatant.gear && combatant.gear.length > 0) {
      record += Stylist.bold("\nGear: ") + this.aggregateList(combatant.gear.sort((a, b) => a.localeCompare(b)));
    }

    if (combatant.loot && combatant.loot.length > 0) {
      record += Stylist.bold("\nLoot: ") + this.aggregateList(combatant.loot.sort((a, b) => a.localeCompare(b)));
    }

    return record;
  }

  static minimalCombatant = (combatant: Combatant) => {
    const hpRatio = combatant.hp / combatant.maxHp;
    const hpBar = Stylist.prettyValue(combatant.hp, combatant.maxHp);
    const color = this.colors[Math.floor(hpRatio * (this.colors.length - 1))] || this.colors[0];
    let name = Stylist.format(combatant.forename, 'bold');
    let combatClass = combatant.class;
    let combatKind = (combatant as any).kind || combatant.race || '';
    let tempHp = 0;
    for (let poolAmount of Object.values(combatant.tempHpPools || {})) {
      tempHp += poolAmount;
    }
    return [
      Stylist.colorize(name, combatant.playerControlled ? 'cyan' : 'yellow'),
      combatant.hp <= 0 ? Stylist.colorize('X', 'red') : Stylist.colorize(hpBar, color),
      tempHp > 0 ? Stylist.colorize(`(+${tempHp})`, 'blue') : '',
      combatant.hp > 0 ? `${combatant.hp}/${combatant.maxHp}` : 'KO',
      combatClass ? `${Words.capitalize(combatKind ? (combatKind + ' ') : '')}${Words.capitalize(combatClass)}` : '',
    ].join(' ');
  }

  static combatant = (combatant: Combatant) => {
    const hpRatio = combatant.hp / combatant.maxHp;
    const hpBar = Stylist.prettyValue(combatant.hp, combatant.maxHp);
    const color = this.colors[Math.floor(hpRatio * (this.colors.length - 1))] || this.colors[0];

    let combatClass = combatant.class;
    let combatKind = (combatant as any).kind || combatant.race || '';
    let classInfo = combatClass ? `Lvl. ${combatant.level.toString().padEnd(2)} ${Words.capitalize(combatKind ? (combatKind + ' ') : '')}${Words.capitalize(combatClass)}` : '';
    // const effective = Fighting.effectiveStats(combatant);
    // const stats = { STR: effective.str, DEX: effective.dex, INT: effective.int, WIS: effective.wis, CHA: effective.cha, CON: effective.con };
    // const statInfo = Object.entries(stats).map(([key, value]) => `${key}: ${value}`).join(', ');
    //Presenter.statLine(combatant);

    const fxNameAndDurations = combatant.activeEffects?.map(e => ({ name: e.name, duration: e.duration || '--' })) || [];
    if (fxNameAndDurations.length > 0) {
      classInfo = classInfo.padEnd(32) + ' | ' + Words.humanizeList(fxNameAndDurations.map(fx => {
        return fx.name;  //  turns`${fx.name} (${fx.duration})`;
      }));
    }

    let friendly = ((combatant as any).friendly || false) || combatant.playerControlled;
    let lhs = `${Stylist.colorize(hpBar, color)} ${Stylist.format(
      Stylist.colorize(combatant.name, friendly ? 'cyan' : 'yellow'),
      'bold'
    ).padEnd(40)}${classInfo}`;
    // let rhs = `(${this.statLine(combatant)})`;
    // return `${lhs} ${rhs}`;
    return lhs;
  }

  static async statLine(combatant: Combatant) {
    // const str = Stylist.colorize(Stylist.prettyValue(combatant.str, 20), 'red');
    // const dex = Stylist.colorize(Stylist.prettyValue(combatant.dex, 20), 'yellow');
    // const int = Stylist.colorize(Stylist.prettyValue(combatant.int, 20), 'green');
    // const wis = Stylist.colorize(Stylist.prettyValue(combatant.wis, 20), 'blue');
    // const cha = Stylist.colorize(Stylist.prettyValue(combatant.cha, 20), 'magenta');
    // const con = Stylist.colorize(Stylist.prettyValue(combatant.con, 20), 'cyan');

    // return [str, dex, int, wis, cha, con].join('');

    const effective = await Fighting.effectiveStats(combatant);
    return [
      this.stat('str', effective.str),
      this.stat('dex', effective.dex),
      this.stat('int', effective.int),
      this.stat('wis', effective.wis),
      this.stat('cha', effective.cha),
      this.stat('con', effective.con)
    ].join('');
  }

  static statColors: { [key in keyof Combatant]?: string } = {
    str: 'red',
    dex: 'yellow',
    int: 'green',
    wis: 'blue',
    cha: 'magenta',
    con: 'cyan',
  }

  static stat = (stat: keyof Combatant, value: number) => {
    const color = this.statColors[stat] || 'white';
    return Stylist.colorize(Stylist.prettyValue(value, 20), color);
  }

  static statMod = (value: number) => {
    const mod = Fighting.statMod(value);
    const color = mod > 0 ? 'green' : (mod < 0 ? 'red' : 'white');
    const sign = mod >= 0 ? '+' : '';
    return Stylist.colorize(sign + mod, color);
  }

  static combatants = (combatants: Combatant[], minimal: boolean = false, indicate: (combatant: Combatant) => boolean) => {
    return combatants
      .filter(c => c.hp > 0)
      .map(c => ((minimal ? "" : "\n") + (indicate(c) ? " 👉 " : "  ") + (minimal ? this.minimalCombatant(c) : this.combatant(c))))
      .join(minimal ? ", " : "");
    // return combatants.map(c => this.combatant(c)).join('\n');
  }

  static padLiteralEnd = (text: string, length: number, padChar: string = ' ') => {
    let cleanLength = Stylist.cleanLength(text);
    if (cleanLength >= length) { return text; }
    let padLength = length - cleanLength;
    return text + padChar.repeat(padLength);
  }

  static padLiteralStart = (text: string, length: number, padChar: string = ' ') => {
    let cleanLength = Stylist.cleanLength(text);
    if (cleanLength >= length) { return text; }
    let padLength = length - cleanLength;
    return padChar.repeat(padLength) + text;
  }

  static parties = (parties: { name: string; combatants: Combatant[] }[]) => {
    let partyDisplay = "";
    let lines = Math.max(...parties.map(p => p.combatants.length))
    for (let i = 0; i < lines; i++) {
      // names
      let lhs = parties[0] ? parties[0].combatants[i] : null;
      let rhs = parties[1] ? parties[1].combatants[i] : null;
      let line = "";
      if (lhs) {
        line += this.padLiteralEnd(this.minimalCombatant(lhs), 40);
      } else {
        line += ' '.repeat(40);
      }
      // line += '';
      if (rhs) {
        line += this.padLiteralStart(this.minimalCombatant(rhs), 40);
      } else {
        line += ' '.repeat(40);
      }
      partyDisplay += line + '\n';

      // traits / statuses
      let ignoreStatuses = ['humanoid']
      let lhsStatuses = lhs?.activeEffects?.map(e => e.duration ? `${e.name}(${e.duration})` : e.name)
        || [];
      lhsStatuses = lhsStatuses
        .map(s => s.toLowerCase())
        .filter(s => !ignoreStatuses.includes(s.toLowerCase()));
      let rhsStatuses = rhs?.activeEffects?.map(e => e.duration ? `${e.name}(${e.duration})` : e.name)
        .concat(rhs?.traits) || [];
      rhsStatuses = rhsStatuses
        .map(s => s.toLowerCase())
        .filter(s => !ignoreStatuses.includes(s));

      let sep = // dot
          '·';
      let statusLine = "";
      if (lhsStatuses.length > 0) {
        statusLine += this.padLiteralEnd(Stylist.colorize(lhsStatuses.join(sep), 'cyan'), 40);
      } else {
        statusLine += ' '.repeat(40);
      }
      if (rhsStatuses.length > 0) {
        statusLine += this.padLiteralStart(Stylist.colorize(rhsStatuses.join(sep), 'cyan'), 40);
      } else {
        statusLine += ' '.repeat(40);
      }
      partyDisplay += statusLine + '\n';
    }
    let headers = //parties.map(p => Stylist.format(p.name, 'underline').padEnd(40)).join('   ') + '\n';
      Stylist.format(parties[0].name.padEnd(40), 'italic') +
      Stylist.format(parties[1]?.name.padStart(40) || '', 'italic') + '\n';
    return headers + partyDisplay;
  }

  static describeStatus(status: StatusEffect): string {
    return `${Stylist.colorize(status.name, 'cyan')} (${(status.description ? status.description + " " : '') + this.analyzeStatus(status)})`;
    // return this.analyzeStatus(status);
  }

  static analyzeStatus(status: StatusEffect): string {
    let parts: string[] = [];
    let effect = status.effect;

    for (let [key, value] of Object.entries(effect)) {
      if (value === undefined) continue;
      let k: keyof StatusModifications = key as keyof StatusModifications;
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
          parts.push(this.increaseDecrease(Words.statName(k), value));
          break;
        case "initiative":
          parts.push(this.increaseDecrease('initiative', value));
          break;
        case "toHit":
          parts.push(this.increaseDecrease('to hit', value));
          break;
        case "bonusDamage":
          parts.push(this.increaseDecrease('bonus damage', value));
          break;
        case "ac":
          parts.push(this.increaseDecrease('AC', -value));
          break;
        case "evasion":
          parts.push(this.increaseDecrease('evasion', value));
          break;
        case "bonusHealing":
          parts.push(this.increaseDecrease('bonus healing', value));
          break;
        case "allSaves":
          parts.push(this.increaseDecrease('all saves', value));
          break;
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
        case "resistTrue":
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
        case "saveVersusAll":
          let save = `Save versus ${Words.humanize(k.replace("saveVersus", ""))}`;
          parts.push(this.increaseDecrease(save, value));
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
          if (value) {
            parts.push(`Immunity to ${Words.humanize(k.replace("immune", ""))}`);
          }
          break;
        case "immuneDamage":
          if (value) {
            parts.push(`Immunity to all damage`);
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
        case "onAttack":
        case "onAttackHit":
        case "onTurnEnd":
        case "onKill":
        case "onAttacked":
        case "onExpire":
        case "onHeal":
        case "onLevelUp":
        case "onOffensiveCasting":
        case "onEnemyCharge":
        case "onEnemyMelee":
        case "onMissReceived":
        case "onResistPoison":
        case "onResistDisease":
        case "onResistDeath":
        case "onResistMagic":
        case "onResistInsanity":
        case "onResistCharm":
        case "onResistFear":
        case "onResistStun":
        case "onResistWill":
        case "onResistBreath":
        case "onResistParalyze":
        case "onResistSleep":
          parts.push(`${this.describeEffects(value, 'self')} ${Words.humanize(k)}`);
          break;

        case "summonAnimalBonus":
          parts.push(this.increaseDecrease('summon animal bonus', value));
          break;
        case "bonusSpellSlots":
          parts.push(this.increaseDecrease('bonus spell slots', value));
          break;
        case "bonusSpellDC":
          parts.push(this.increaseDecrease('bonus spell DC', value));
          break;
        case "statusDuration":
          parts.push(this.increaseDecrease('status duration', value));
          break;
        case "backstabMultiplier":
          parts.push(`Backstab damage multiplied by ${value}x`);
          break;
        case "resurrectable":
          if (value) {
            parts.push(`Resurrectable`);
          } else {
            parts.push(`Not resurrectable`);
          }
          break;

        case "extraAttacksPerTurn":
          parts.push(this.increaseDecrease('attacks per turn', value));
          break;

        // noncombat
        case "examineBonus":
          parts.push(this.increaseDecrease('examine bonus', value));
          break;
        case "searchBonus":
          parts.push(this.increaseDecrease('search bonus', value));
          break;
        case "pickLockBonus":
          parts.push(this.increaseDecrease('pick lock bonus', value));
          break;
        case "disarmTrapBonus":
          parts.push(this.increaseDecrease('disarm trap bonus', value));
          break;
        case "lootBonus":
          parts.push(this.increaseDecrease('loot bonus', value));
          break;

        case "xpMultiplier":
          parts.push(`XP multiplied by ${value}x`);
          break;
        case "goldMultiplier":
          parts.push(`Gold earned multiplied by ${value}x`);
          break;
        case "consumableMultiplier":
          parts.push(`Consumables effectiveness multiplied by ${value}x`);
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

        case "damageReduction":
          parts.push(`Reduce all damage by ${value}`);
          break;

        // TODO figure out where this comes from
        case "by":
          // ignore
          break;

        default:
          // @ts-ignore
          if (k.startsWith("onEnemy")) {
            parts.push(`${this.describeEffects(value, 'self')} ${Words.humanize(k)}`);
            break;
          // @ts-ignore
          } else if (k.endsWith("Multiplier")) {
            parts.push(`${Words.humanize(k)} multiplied by ${value}x`);
            break;
          }

          return never(k);
      }
    }
    return parts.join(", ");
  }

  static increaseDecrease(what: string, value: number | string): string {
    if (typeof value === 'string') {
      return `add ${value} to ${what}`;
    }
    return value >= 0 ? `increase ${what} by ${value}` : `decrease ${what} by ${Math.abs(value)}`;
  }

  static describeDuration(duration?: number): string {
    if (duration) {
      return duration > 1 ? `for ${duration} turns` : `for ${duration} turn`;
    }
    return "indefinitely";
  }

  static describeEffect(effect: AbilityEffect, targetDescription: string): string {
    let description = "";
    let amount = effect.amount ? effect.amount.toString() : "1";
    if (amount.startsWith('=')) {
      amount = amount.slice(1);
    }

    switch (effect.type) {
      case "attack":
        description = (`Attack ${targetDescription}`);
        break;
      case "damage":
        description = (`Deal ${amount} ${effect.kind || "true"} damage to ${targetDescription}`);
        break;
      case "heal": description = (`Heal ${targetDescription} ${amount} HP`); break;
      case "drain": description = (`Drain ${targetDescription} ${amount} HP`); break;
      case "buff":
        if (effect.status) {
          description = (`Grant ${targetDescription} ${this.describeStatus(effect.status)} ${this.describeDuration(effect.status.duration)}`);
        } else {
          throw new Error(`Buff effect must have a status defined`);
        }
        break;
      case "debuff":
        if (effect.status) {
          const verb = targetDescription.startsWith("all") || targetDescription.includes("enemies")
            ? "suffer"
            : "suffers";
          description = (`${Words.capitalize(targetDescription)} ${verb} ${this.describeStatus(effect.status)} ${this.describeDuration(effect.status.duration)}`);
        } else {
          throw new Error(`Debuff effect must have a status defined`);
        }
        break;
      case "summon":
        let options = "";
        if ((effect.options as any)?._class) {
          options += `${Words.capitalize((effect.options as any)._class)} `;
        }
        description = (`Summon ${options}${effect.creature || "creature"}`); break;
      case "removeStatus":
        description = (`Purge ${targetDescription} of ${effect.statusName}`); break;
      case "upgrade":
        if (effect.stat) {
          description = (`Increase ${Words.statName(effect.stat)} by ${effect.amount || "1"}`);
        } else {
          throw new Error(`Upgrade effect must specify a stat`);
        }
        break;
      case "flee":
        description = (`Force ${targetDescription} to flee`); break;
      case "resurrect":
        let hp = effect.hpPercent && effect.hpPercent < 100 ? `${effect.hpPercent}%` : "full";
        description = (`Restore ${targetDescription} to life${effect.hpPercent ? ` with ${hp} health` : ""}`); break;
      case "kill":
        description = (`Instantly kill ${targetDescription}`); break;
      case "gold":
        description = (`Gain ${amount} gold`); break;
      case "xp":
        description = (`Gain ${amount} XP`); break;
      default: return never(effect.type);
    }

    if (effect.spillover) {
      description += ` with spillover to adjacent targets`;
    }

    let cascade = effect.cascade ? ` cascading ${effect.cascade.count} times` : "";
    description += cascade;


    let condition = '';
    if (effect.condition) {
      condition += effect.condition.trait ? ` if ${effect.condition.trait}` : "";
      // condition += effect.condition.status ? ` if ${effect.condition.status}` : "";
    }
    description += condition;

    return description;
  }

  static describeEffects(effects: AbilityEffect[], targetDescription: string): string {
    let parts: string[] = [];
    if (effects.every(e => e.type === 'removeStatus')) {
      const statuses = effects.map(e => e.statusName).join(', ');
      return `Remove ${statuses} from ${targetDescription}`;
    }
    for (const effect of effects) {
      parts.push(this.describeEffect(effect, effect.target || targetDescription || ""));
    }
    return parts.join("; ");
  }

  static describeTarget(target: Target[]): string {
    let parts: string[] = [];
    for (const t of target) {
      let desc = "";
      switch (t) {
        case "self": desc = "yourself"; break;
        case "ally": desc = "an ally"; break;
        case "enemy": desc = "an enemy"; break;
        case "allies": desc = "all allies"; break;
        case "enemies": desc = "all enemies"; break;
        case "all": desc = "all combatants"; break;
        case "deadAlly": desc = "a fallen ally"; break;
        case "randomEnemies": return `${target[1]} random enemies`;
        default: return never(t);
      }
      parts.push(desc);
    }
    return parts.join(" or ");
  }

  static describeAbility(ability: Ability): string {
    // let parts: string[] = [];
    // parts.push("Narrative: " + ability.description);
    // parts.push("Mechanical: " + this.describeEffects(ability.effects, this.describeTarget(ability.target)) + ".");
    // return parts.join("\n");
    return this.describeEffects(ability.effects, this.describeTarget(ability.target)) + ".";
  }
}