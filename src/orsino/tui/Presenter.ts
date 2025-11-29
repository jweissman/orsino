import Stylist from "./Style";
import { Combatant } from "../types/Combatant";
import Words from "./Words";
import { Fighting } from "../rules/Fighting";
import AbilityHandler from "../Ability";
import TraitHandler from "../Trait";

export default class Presenter {
  static colors = ['magenta', 'red', 'yellow', 'yellow', 'yellow', 'green', 'green', 'green', 'green'];

  static printCharacterRecord = (combatant: Combatant) => {
    // let record = ({
    //   ...combatant,
    //   effects: [
    //     ...(combatant.activeEffects || []),
    //     ...(combatant.passiveEffects || [])
    //   ].map(e => e.name).join(", ") || "None",
    //   abilities: (combatant.abilities||[]).join(", "),
    //   traits: (combatant.traits || []).join(", "),
    //   gear: (combatant.gear || []).join(", "),
    //   // saves: combatant.savedTimes ? Object.entries(combatant.savedTimes).map(([key, value]) => `${key}: ${value}`).join(", ") : "None",
    // });

    // // delete active/passives
    // delete record.activeEffects;
    // delete record.passiveEffects;
    // delete record.abilityCooldowns;
    // delete record.abilitiesUsed;
    // delete record.savedTimes;

    // console.table(record);

    // console.table(record);

    console.log(Stylist.bold("\n\nCharacter Record"));
    console.log(Stylist.format(`${this.combatant(combatant)}`, 'underline'));

    // "Human Female Warrior of Hometown (41 years old)"
    console.log(
      Stylist.italic(
        `${Words.capitalize(combatant.gender || 'unknown')} ${Words.capitalize(combatant.background || 'adventurer')} from the ${combatant.hometown || 'unknown'} (${combatant.age || 'unknown age'} years old)`
      )
    )

    


    let statNames = ['str', 'dex', 'int', 'wis', 'cha', 'con'];
    let statLine = statNames.map(stat => {
      const value = (combatant as any)[stat];
      const mod = Fighting.statMod(value);
      const color = mod > 0 ? 'green' : (mod < 0 ? 'red' : 'white');
      const sign = mod >= 0 ? '+' : '';
      return `${Stylist.bold(stat.toUpperCase())} ${value} (${Stylist.colorize(sign + mod, color)})`;
    });
    console.log(statLine.join(' | '));

    let basics = {
      weapon: (combatant.weapon || 'None'),
      armor: combatant.armor || 'None',
      background: combatant.background || 'None',
      xp: combatant.xp,
      gp: combatant.gp,
    }
    console.log("\n" + Object.entries(basics).map(([key, value]) => {
      return `${Stylist.bold(Words.capitalize(key))} ${Words.humanize(value)}`;
    }).join('   '));

    if (combatant.gear && combatant.gear.length > 0) {
      console.log(Stylist.bold("\nGear: ") + combatant.gear.join(", "));
    }

    // ability table
    console.log(Stylist.bold("\nAbilities"));
    let abilityHandler = AbilityHandler.instance;
    for (let abilityName of combatant.abilities || []) {
      let ability = abilityHandler.getAbility(abilityName);
      console.log(`  ${Stylist.colorize(ability.name, 'magenta')} (${ability ? ability.description : 'No description available'})`);
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
  }

  static minimalCombatant = (combatant: Combatant) => {
    const hpRatio = combatant.hp / combatant.maxHp;
    const hpBar = Stylist.prettyValue(combatant.hp, combatant.maxHp);
    const color = this.colors[Math.floor(hpRatio * (this.colors.length - 1))] || this.colors[0];
    let name = Stylist.format(combatant.forename, 'bold');
    return [
      Stylist.colorize(name, combatant.playerControlled ? 'cyan' : 'yellow'),
      Stylist.colorize(hpBar, color),
      `(${combatant.hp}/${combatant.maxHp})`
    ].join(' ');
    //  `; // (${this.statLine(combatant)})`;
  }

  static combatant = (combatant: Combatant) => {
    const hpRatio = combatant.hp / combatant.maxHp;
    const hpBar = Stylist.prettyValue(combatant.hp, combatant.maxHp);
    const color = this.colors[Math.floor(hpRatio * (this.colors.length - 1))] || this.colors[0];

    let combatClass = combatant.class || combatant.type;
    let classInfo = combatClass ? `, ${Words.capitalize(combatant.race || '')} ${Words.capitalize(combatClass)} ` : '';
    const effective = Fighting.effectiveStats(combatant);
    // const stats = { STR: effective.str, DEX: effective.dex, INT: effective.int, WIS: effective.wis, CHA: effective.cha, CON: effective.con };
    // const statInfo = Object.entries(stats).map(([key, value]) => `${key}: ${value}`).join(', ');
    //Presenter.statLine(combatant);

    const activeEffectNames = combatant.activeEffects?.map(e => e.name) || [];
    if (activeEffectNames.length > 0) {
      classInfo += ` [${activeEffectNames.join(', ')}]`;
    }

    let friendly = ((combatant as any).friendly || false) || combatant.playerControlled;
    let lhs = `${Stylist.format(
      Stylist.colorize(combatant.name, friendly ? 'cyan' : 'yellow'),
      'bold'
    )}${classInfo}`;
    let rhs = `(${this.statLine(combatant)}, HP: ${Stylist.colorize(hpBar, color)} ${combatant.hp}/${combatant.maxHp}, AC: ${effective.ac}, Level: ${combatant.level})`;
    return `${lhs} ${rhs}`;
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
}