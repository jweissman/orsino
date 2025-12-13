import Stylist from "./Style";
import { Combatant } from "../types/Combatant";
import Words from "./Words";
import { Fighting } from "../rules/Fighting";
import AbilityHandler from "../Ability";
import TraitHandler from "../Trait";
import Combat from "../Combat";

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

  static printCharacterRecord = (combatant: Combatant) => {
    console.log("\n" + "=".repeat(40) + "\n");
    console.log(this.characterRecord(combatant));
    console.log("\n" + "=".repeat(40) + "\n");
  }

  static characterRecord = (combatant: Combatant) => {
    let record = "";
    record += (Stylist.bold("\n\nCharacter Record\n"));
    record += (Stylist.format(`${this.combatant(combatant)}\n`, 'underline'));

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
    let statLine = statNames.map(stat => {
      const value = (combatant as any)[stat];
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
      "Armor Class": Stylist.colorize(`${combatant.ac}`, 'yellow'),
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
      let ability = abilityHandler.getAbility(abilityName);
      record += `  ${Stylist.colorize(ability.name, 'magenta').padEnd(28)} ${ability ? ability.description : 'No description available'}\n`;
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
            record += `  ${Stylist.colorize(status.name, 'cyan')} (${status.description})\n`;
          });
          record += "\n";
        }
      }
    }

    // active and passive effects
    if (combatant.activeEffects && combatant.activeEffects.length > 0) {
      record += Stylist.bold("\nActive Effects\n");
      combatant.activeEffects.forEach(effect => {
        record += `  ${Stylist.colorize(effect.name, 'cyan')} (${effect.description})\n`;
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
    return [
      // this.padLiteralEnd(Stylist.colorize(name, combatant.playerControlled ? 'cyan' : 'yellow'), 7),
      Stylist.colorize(name, combatant.playerControlled ? 'cyan' : 'yellow'),
      combatant.hp <= 0 ? Stylist.colorize('X', 'red') : Stylist.colorize(hpBar, color),
      combatant.hp > 0 ? `${combatant.hp}/${combatant.maxHp}` : 'DEAD',
      // this.padLiteralStart(combatClass ? `${Words.capitalize(combatKind ? (combatKind + ' ') : '')}${Words.capitalize(combatClass)}` : '', 14),
      combatClass ? `${Words.capitalize(combatKind ? (combatKind + ' ') : '')}${Words.capitalize(combatClass)}` : '',
      // `(${combatant.hp}/${combatant.maxHp})`
    ].join(' ');
    //  `; // (${this.statLine(combatant)})`;
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
      let lhsStatuses = lhs?.activeEffects?.map(e => e.duration ? `${e.name} (${e.duration})` : e.name)
        || [];
      lhsStatuses = lhsStatuses
          .map(s => s.toLowerCase())
          .filter(s => !ignoreStatuses.includes(s.toLowerCase()));
      let rhsStatuses = rhs?.activeEffects?.map(e => e.duration ? `${e.name} (${e.duration})` : e.name)
        .concat(rhs?.traits) || [];
      rhsStatuses = rhsStatuses
          .map(s => s.toLowerCase())
          .filter(s => !ignoreStatuses.includes(s));

      let statusLine = "";
      if (lhsStatuses.length > 0) {
        statusLine += this.padLiteralEnd(Stylist.colorize(lhsStatuses.join(' * '), 'cyan'), 40);
      } else {
        statusLine += ' '.repeat(40);
      }
      if (rhsStatuses.length > 0) {
        statusLine += this.padLiteralStart(Stylist.colorize(rhsStatuses.join(' * '), 'cyan'), 40);
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
}