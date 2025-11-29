import Choice from "inquirer/lib/objects/choice";
import AbilityHandler, { AbilityEffect } from "../Ability";
import Combat, { ChoiceSelector } from "../Combat";
import { DungeonEvent } from "../Events";
import TraitHandler, { Trait } from "../Trait";
import Presenter from "../tui/Presenter";
import Stylist from "../tui/Style";
import User from "../tui/User";
import Words from "../tui/Words";
import { Combatant } from "../types/Combatant";
import { Roll } from "../types/Roll";
import { Team } from "../types/Team";
import Sample from "../util/Sample";
import { Commands } from "./Commands";
import { Fighting } from "./Fighting";

export default class CharacterRecord {

  static xpForLevel(level: number): number {
    // return (level * level * level * 100) + (level * level * 500) + (level * 1000) - 3800;
    return (level * level * level * 50) + (level * level * 150) + (level * 300) - 600;
  }

  static crForParty(party: Combatant[]): number {
    const totalLevels = party.reduce((sum, c) => sum + c.level, 0);
    return Math.max(1, Math.round(totalLevels / 3));
  }

  static async chooseParty(
    pcGenerator: (options?: any) => Promise<Combatant>,
    partySize: number = 3,
    selectionMethod: (prompt: string, options: string[]) => Promise<string> = User.selection
  ): Promise<Combatant[]> {
    await AbilityHandler.instance.loadAbilities();
    await TraitHandler.instance.loadTraits();

    let doChoose = await selectionMethod(
      `Would you like to customize PCs using the wizard?`,
      ['Yes', 'No']
    );
    if (doChoose === 'No') {
      return this.chooseParty(pcGenerator, partySize, async (_prompt: string, options: string[]) => {
        return options[
          Math.floor(Math.random() * options.length)
        ];
      });
    }

    let party: Combatant[] = [];
    // let hasExistingPcs = false;
    // if (await Files.countFiles(`${Dungeoneer.dataPath}/pcs`) > 0) {
    //   hasExistingPcs = true;
    // }
    let pc: Combatant | null = null;
    while (party.length < partySize) {
      let whichPc = '(' + (party.length + 1) + '/' + partySize + ')';
      let shouldWizard = await selectionMethod(
        'Would you like to customize this PC? ' + whichPc,
        ['Yes', 'No']
      );
      if (shouldWizard === 'Yes') {
        let raceSelect = await selectionMethod(
          'Select a race for this PC: ' + whichPc,
          ['human', 'elf', 'dwarf', 'halfling', 'orc', 'fae', 'gnome']
        );

        let occupationSelect = await selectionMethod(
          'Select an occupation for this PC: ' + whichPc,
          ['warrior', 'thief', 'mage', 'cleric', 'ranger', 'bard']
        );

        let spellbook: string[] = [];
        if (occupationSelect === 'mage') {
          // spellbook = await User.multiSelect(
          //   "Select spells for this PC",
          //   ['missile', 'armor', 'blur', 'charm', 'shocking_grasp', 'burning_hands', 'sleep', 'ray_of_frost', 'acid_arrow']
          // );
          let availableSpells = ['missile', 'armor', 'blur', 'charm', 'shocking_grasp', 'burning_hands', 'sleep', 'ray_of_frost', 'acid_arrow'];
          for (let i = 0; i < 3; i++) {
            let spell = await selectionMethod(
              `Select spell ${i + 1} for this PC: ` + whichPc,
              availableSpells
            );
            spellbook.push(spell);
            availableSpells = availableSpells.filter(s => s !== spell);
          }
        }

        pc = await pcGenerator({ setting: 'fantasy', race: raceSelect, class: occupationSelect }) as Combatant;
        // pc.traits = [];
        // spellbook.forEach((spell: string) => pc.abilities.unshift(spell));
        if (pc.class === "mage") {
          // pc.abilities = ['melee']; // don't know why this is necessary, but it is??
          pc.abilities.push(...spellbook);
        }

        Presenter.printCharacterRecord(pc);
        let confirm = await selectionMethod(
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
          pc.abilities.push(...spells);
        }

        if (!party.some(p => p.name === pc?.name)) {
          Presenter.printCharacterRecord(pc);
          let confirm = await selectionMethod(
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
    let traitHandler = TraitHandler.instance;
    await traitHandler.loadTraits();
    let partyPassives: Trait[] = traitHandler.partyTraits(party);
    if (partyPassives.length > 0) {
      console.log(`Your party forms ${Words.humanizeList(partyPassives.map((t: Trait) => (
        Stylist.bold(
          Words.a_an(Words.capitalize(t.description))
        )
      )))}.`);
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

  static async levelUp(pc: Combatant, team: Team, roller: Roll, select: ChoiceSelector<any>): Promise<DungeonEvent[]> {
    let events: DungeonEvent[] = [];
    let nextLevelXp = CharacterRecord.xpForLevel(pc.level + 1);

    if (pc.xp < nextLevelXp) {
      console.warn(`${pc.name} needs to gain ${nextLevelXp - pc.xp} more experience for level ${pc.level + 1} (currently at ${pc.xp}/${nextLevelXp}).`);
    }
    while (pc.xp >= nextLevelXp) {
      pc.level++;
      nextLevelXp = CharacterRecord.xpForLevel(pc.level + 1);
      let hitPointIncrease = (await roller(pc, "hit point growth", pc.hitDie || 4)).amount;
      hitPointIncrease += Fighting.statMod(pc.con || 10);
      hitPointIncrease = Math.max(1, hitPointIncrease);
      pc.maxHp += hitPointIncrease;
      pc.hp = pc.maxHp;
      console.log(`${Presenter.combatant(pc)} leveled up to level ${pc.level}!`);
      console.log(`Hit points increased by ${hitPointIncrease} to ${pc.maxHp}.`);
      const stat = await select(`Choose a stat to increase:`, [
        { disabled: pc.level <= 20 && pc.str >= 18, name: `Strength (${pc.str})`, value: 'str', short: 'Strength' },
        { disabled: pc.level <= 20 && pc.dex >= 18, name: `Dexterity (${pc.dex})`, value: 'dex', short: 'Dexterity' },
        { disabled: pc.level <= 20 && pc.int >= 18, name: `Intelligence (${pc.int})`, value: 'int', short: 'Intelligence' },
        { disabled: pc.level <= 20 && pc.wis >= 18, name: `Wisdom (${pc.wis})`, value: 'wis', short: 'Wisdom' },
        { disabled: pc.level <= 20 && pc.cha >= 18, name: `Charisma (${pc.cha})`, value: 'cha', short: 'Charisma' },
        { disabled: pc.level <= 20 && pc.con >= 18, name: `Constitution (${pc.con})`, value: 'con', short: 'Constitution' },
        // just in case they're 18 across!
        { disabled: false, name: `Max HP (${pc.maxHp})`, value: 'maxHp', short: 'HP' },
      ]);
      // @ts-ignore
      pc[stat] += 1;
      // this.note(`${c.name}'s ${stat.toUpperCase()} increased to ${c[stat as keyof Combatant]}!`);

      let fx = Fighting.gatherEffects(pc);
      if (fx.onLevelUp) {
        for (const effect of fx.onLevelUp as AbilityEffect[]) {
          // execute the effect
          console.log(`Applying level-up effect to ${pc.name}...`);
          let pseudocontext = { subject: pc, allies: team.combatants.filter(c => c !== pc), enemies: [] };
          let { events: levelUpEvents } = await AbilityHandler.handleEffect(
            'onLevelUp', effect, pc, pc, pseudocontext, Commands.handlers(roller, team) // this.roller, this.playerTeam)
          );
          // events.forEach(e => this.emit({ ...e, turn: 0 } as DungeonEvent));
          events.push(...levelUpEvents as DungeonEvent[]);
        }
      }

      if (pc.class === "mage") {
        // gain spells
        let abilityHandler = AbilityHandler.instance;
        await abilityHandler.loadAbilities();
        let allSpellKeys = Object.entries(abilityHandler.abilities)
          .filter(([_key, ab]) => ab.aspect === 'arcane')
          .map(([key, _ab]) => key);

        let newSpellKeys = allSpellKeys.filter(spellKey => {
          let spell = abilityHandler.getAbility(spellKey);
          return spell.level !== undefined
            && spell.level <= Math.ceil(pc.level / 2)
            && !pc.abilities.includes(spellKey);
        });

        // let allSpells = abilityHandler.spells.filter(ab => ab.aspect === 'arcane');
        // let newSpells = allSpells.filter(spell => spell.level !== undefined && spell.level <= Math.ceil(pc.level / 2))
                                //  .filter(spell => !pc.abilities.includes(spell.name));

        if (newSpellKeys.length > 0) {
          let spellChoices = newSpellKeys.map(spellKey => {
            let spell = abilityHandler.getAbility(spellKey);
            return {
              name: Words.capitalize(spell.name) + ': ' + spell.description,
              value: spellKey,
              short: spell.name,
              disabled: false
            };
        });
          let chosenSpellKey = await select(`Select a new spell for ${pc.name}:`, spellChoices);
          let chosenSpell = abilityHandler.getAbility(chosenSpellKey);
          console.log(`${Presenter.combatant(pc)} learned the spell: ${JSON.stringify(chosenSpell)}`);
          pc.abilities.push(chosenSpellKey);
        } else {
          console.log(`${Presenter.combatant(pc)} has learned all available spells for their level.`);
        }
      }

      if (pc.level >= 20) {
        // epic feats...
      } else if (pc.level % 5 === 0) {
        // feat selection
        console.log(`${Presenter.combatant(pc)} can select a new feat!`);
        let traitHandler = TraitHandler.instance;
        await traitHandler.loadTraits();
        let availableFeats = traitHandler.featsForCombatant(pc);
        if (availableFeats.length === 0) {
          console.log(`But there are no available feats for ${Presenter.combatant(pc)} at this time.`);
          continue;
        }

        let chosenFeat = await select(`Select a feat for ${pc.name}:`, availableFeats.map(trait => ({
          name: Words.capitalize(trait.name) + ': ' + trait.description,
          value: trait,
          short: trait.name,
          disabled: false
        })));
        console.log(`${Presenter.combatant(pc)} selected the feat: ${JSON.stringify(chosenFeat)}`);
        pc.traits.push(chosenFeat.name);
        // apply any passive effects from the feat
        pc.passiveEffects ||= [];
        pc.passiveEffects.push(...chosenFeat.statuses);
        console.log(`${Presenter.combatant(pc)} gained the feat: ${Words.capitalize(chosenFeat.name)}.`);
      }
    }

    return events;
  }
}