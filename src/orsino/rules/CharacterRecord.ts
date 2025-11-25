import TraitHandler, { Trait } from "../Trait";
import Presenter from "../tui/Presenter";
import User from "../tui/User";
import Words from "../tui/Words";
import { Combatant } from "../types/Combatant";
import Sample from "../util/Sample";

export default class CharacterRecord {

  static xpForLevel(level: number): number {
    return  (level * level * level * 100) + (level * level * 500) + (level * 1000) - 3800;
  }
  static crForParty(party: Combatant[]): number {
    const totalLevels = party.reduce((sum, c) => sum + c.level, 0);
    return Math.max(1, Math.round(totalLevels / 3));
  }

  static async chooseParty(
    pcGenerator: (options?: any) => Promise<Combatant>,
    partySize: number = 3
  ): Promise<Combatant[]> {
    let party: Combatant[] = [];
    // let hasExistingPcs = false;
    // if (await Files.countFiles(`${Dungeoneer.dataPath}/pcs`) > 0) {
    //   hasExistingPcs = true;
    // }
    let pc: Combatant | null = null;
    while (party.length < partySize) {
      let whichPc = '(' + (party.length + 1) + '/' + partySize + ')';
      let shouldWizard = await User.selection(
        'Would you like to customize this PC? ' + whichPc,
        ['Yes', 'No']
      );
      if (shouldWizard === 'Yes') {
        let raceSelect = await User.selection(
          'Select a race for this PC: ' + whichPc,
          ['human', 'elf', 'dwarf', 'halfling', 'orc', 'fae', 'gnome']
        );

        let occupationSelect = await User.selection(
          'Select an occupation for this PC: ' + whichPc,
          ['warrior', 'thief', 'mage', 'cleric', 'ranger', 'bard']
        );

        let spellbook: string[] = [];
        if (occupationSelect === 'mage') {
          spellbook = await User.multiSelect(
            "Select spells for this PC",
            ['missile', 'armor', 'blur', 'charm', 'shocking_grasp', 'burning_hands', 'sleep', 'ray_of_frost', 'acid_arrow']
          );
        }

        pc = await pcGenerator({ setting: 'fantasy', race: raceSelect, class: occupationSelect }) as Combatant;
        // pc.traits = [];
        // spellbook.forEach((spell: string) => pc.abilities.unshift(spell));
        if (pc.class === "mage") {
          // pc.abilities = ['melee']; // don't know why this is necessary, but it is??
          pc.abilities.unshift(...spellbook);
        }

        Presenter.printCharacterRecord(pc);
        let confirm = await User.selection(
          'Do you want to use this PC? ' + whichPc,
          ['Yes', 'No']
        );
        if (confirm === 'Yes') {
          party.push(pc);
        }
      } else {
        pc = await pcGenerator({ setting: 'fantasy' }) as Combatant;
        // pc.traits = [];
        if (pc.class === 'mage') {
          // pc.abilities = ['melee']; // don't know why this is necessary, but it is??
          const spells = Sample.count(3, 'missile', 'armor', 'blur', 'charm', 'shocking_grasp', 'burning_hands', 'sleep')
          console.log("Adding to " + pc.name + "'s spellbook: " + spells.join(", ") + " (already has " + pc.abilities.join(", ") + ")");
          pc.abilities.unshift(...spells);
        }

        if (!party.some(p => p.name === pc?.name)) {
          Presenter.printCharacterRecord(pc);
          let confirm = await User.selection(
            'Do you want to use this PC? ' + whichPc,
            ['Yes', 'No']
          );
          if (confirm === 'Yes') {
            party.push(pc);
          }
        }
      }
    };
    // assign formation bonuses + racial traits
    let traitHandler = new TraitHandler();
    await traitHandler.loadTraits();
    let partyPassives: Trait[] = traitHandler.partyTraits(party);
    if (partyPassives.length > 0) {
      console.log(`Your party forms ${Words.humanizeList(partyPassives.map((t: Trait) => Words.a_an(Words.capitalize(t.description))))}`);
      party.forEach(c => {
        // let otherPassives = traitHandler.personalTraits(c);
        partyPassives.forEach(trait => {
          // console.log("- Applying trait " + trait.name + " to " + c.name + "(already has " + c.traits.join(", ") + ")");
          c.traits.push(trait.name);
        });
      });
    }

    // setup passive effects for all traits
    party.forEach(c => {
      c.traits.forEach(traitName => {
        const trait = traitHandler.getTrait(traitName);
        if (trait) {
          c.passiveEffects ||= [];
          c.passiveEffects.push(...trait.statuses);
        }
      });
    });

    // party.forEach(c => Presenter.printCharacterRecord(c));
    // let confirm = await Interactive.selection(
    //   'Do you want to use this party?',
    //   ['Yes', 'No']
    // );
    // if (confirm !== 'Yes') {
    //   return this.chooseParty(partySize);
    // }

    return party;
  }
}