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
    console.log(Stylist.bold("\n\nCharacter Record"));
    console.log(Stylist.format(`${this.combatant(combatant)}`, 'underline'));

    // "Human Female Warrior of Hometown (41 years old)"
    let descriptor = {
      male: "He is", female: "She is", androgynous: "They are"
    }[(combatant.gender || 'androgynous').toLowerCase()] || "They are";

    console.log(
      Stylist.italic(
        `${Words.capitalize(combatant.background || 'adventurer')} ${Words.humanize(combatant.archetype || 'neutral')} from the ${combatant.hometown || 'unknown'}, ${combatant.age || 'unknown'} years old. ${descriptor} of ${combatant.body_type || 'average'} build with ${combatant.hair || 'unknown color'} hair, ${combatant.eye_color || 'dark'} eyes and ${Words.a_an(combatant.personality || 'unreadable')} disposition.`
      )
    )

    // console.log(

    // let demographics = {
    //   age: combatant.age || 'Unknown',
    //   // alignment: Words.humanize(combatant.alignment || 'neutral'),
    // }

    // console.log(Object.entries(demographics).map(([key, value]) => {
    //   return this.padLiteralEnd(`${Stylist.bold(Words.capitalize(key))} ${Words.humanize(value)}`, 25);
    // }).join('   '));

    let statNames = ['str', 'dex', 'int', 'wis', 'cha', 'con'];
    let statLine = statNames.map(stat => {
      const value = (combatant as any)[stat];
      const mod = Fighting.statMod(value);
      const color = mod > 0 ? 'green' : (mod < 0 ? 'red' : 'white');
      const sign = mod >= 0 ? '+' : '';
      return `${Stylist.bold(stat.toUpperCase())} ${value} (${Stylist.colorize(sign + mod, color)})`;
    });
    console.log(statLine.join(' | '));

    // console.log("\nHit Points: " + Stylist.colorize(`${combatant.hp}/${combatant.maxHp} `, 'green'));
    // console.log("Armor Class: " + Stylist.colorize(`${combatant.ac} `, 'yellow'));

    let basics = {
      weapon: (combatant.weapon || 'None'),
      armor: combatant.armor || 'None',
      // background: combatant.background || 'None',
      xp: combatant.xp,
      gp: combatant.gp,
    }
    console.log("\n" + Object.entries(basics).map(([key, value]) => {
      return this.padLiteralEnd(`${Stylist.bold(Words.capitalize(key))} ${Words.humanize(value.toString())}`, 25);
    }).join('   '));

    let bolt = Stylist.colorize('⚡', 'yellow');
    let core = {
      // "Hit Points": Stylist.colorize(`${combatant.hp}/${combatant.maxHp}`, 'green'),
      "Attack Die": Stylist.colorize(combatant.attackDie, 'red'),
      "Armor Class": Stylist.colorize(`${combatant.ac}`, 'yellow'),
      "Spell Slots": ["mage", "bard", "cleric"].includes(combatant.class || '') ?
          bolt.repeat(Combat.maxSpellSlotsForCombatant(combatant)) : "none"
    }
    console.log(Object.entries(core).map(([key, value]) => {
      return this.padLiteralEnd(`${Stylist.bold(Words.capitalize(key))} ${Words.humanize(value)}`, 25);
    }).join('   '));

    // ability table
    console.log(Stylist.bold("\nAbilities"));
    let abilityHandler = AbilityHandler.instance;
    for (let abilityName of combatant.abilities || []) {
      let ability = abilityHandler.getAbility(abilityName);
      console.log(`  ${Stylist.colorize(ability.name, 'magenta').padEnd(28)} ${ability ? ability.description : 'No description available'}`);
    }

    // traits
    if (combatant.traits && combatant.traits.length > 0) {
      let traitHandler = TraitHandler.instance;
      console.log(Stylist.bold("\nTraits"));
      for (let traitName of combatant.traits || []) {
        let trait = traitHandler.getTrait(traitName);
        if (trait) {
          console.log(`  ${Stylist.colorize(trait.description, 'blue')}`);
          trait.statuses?.forEach(status => {
            console.log(`  ${Stylist.colorize(status.name, 'cyan')} (${status.description})`);
          });
        }
        console.log();
      }
    }

    if (combatant.gear && combatant.gear.length > 0) {
      console.log(Stylist.bold("\nGear: ") + this.aggregateList(combatant.gear.sort((a, b) => a.localeCompare(b))));
    }

    if (combatant.loot && combatant.loot.length > 0) {
      console.log(Stylist.bold("\nLoot: ") + this.aggregateList(combatant.loot.sort((a, b) => a.localeCompare(b))));
    }

    console.log("\n" + "=".repeat(40) + "\n");
  }

  static minimalCombatant = (combatant: Combatant) => {
    const hpRatio = combatant.hp / combatant.maxHp;
    const hpBar = Stylist.prettyValue(combatant.hp, combatant.maxHp);
    const color = this.colors[Math.floor(hpRatio * (this.colors.length - 1))] || this.colors[0];
    let name = Stylist.format(combatant.forename, 'bold');
    let combatClass = combatant.class;
    let combatKind = (combatant as any).kind || combatant.race || '';
    return [
      Stylist.colorize(name, combatant.playerControlled ? 'cyan' : 'yellow'),
      combatant.hp <= 0 ? Stylist.colorize('X', 'red') : Stylist.colorize(hpBar, color),
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

    const activeEffectNames = combatant.activeEffects?.map(e => e.name) || [];
    if (activeEffectNames.length > 0) {
      classInfo = classInfo.padEnd(32) + ' | ' + Words.humanizeList(activeEffectNames);
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

  static statLine = (combatant: Combatant) => {
    // const str = Stylist.colorize(Stylist.prettyValue(combatant.str, 20), 'red');
    // const dex = Stylist.colorize(Stylist.prettyValue(combatant.dex, 20), 'yellow');
    // const int = Stylist.colorize(Stylist.prettyValue(combatant.int, 20), 'green');
    // const wis = Stylist.colorize(Stylist.prettyValue(combatant.wis, 20), 'blue');
    // const cha = Stylist.colorize(Stylist.prettyValue(combatant.cha, 20), 'magenta');
    // const con = Stylist.colorize(Stylist.prettyValue(combatant.con, 20), 'cyan');

    // return [str, dex, int, wis, cha, con].join('');

    const effective = Fighting.effectiveStats(combatant);
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
    }
    let headers = //parties.map(p => Stylist.format(p.name, 'underline').padEnd(40)).join('   ') + '\n';
      Stylist.format(parties[0].name.padEnd(40), 'italic') +
      Stylist.format(parties[1]?.name.padStart(40) || '', 'italic') + '\n';
    return headers + partyDisplay;
  }
}