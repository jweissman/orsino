import AbilityHandler, { AbilityEffect } from "../Ability";
import { ChoiceSelector } from "../Combat";
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
    partySize: number = 1,
    selectionMethod: (prompt: string, options: string[]) => Promise<string> = User.selection
  ): Promise<Combatant[]> {
        let abilityHandler = AbilityHandler.instance;
        await abilityHandler.loadAbilities();
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
          // ['ranger']
        );

        

        pc = await pcGenerator({ setting: 'fantasy', race: raceSelect, class: occupationSelect }) as Combatant;
        let spellbook: string[] = [];
        if (occupationSelect === 'mage') {
          let availableSpells = abilityHandler.allSpellNames('arcane', 1);
          for (let i = 0; i < 3; i++) {
            let spell = await selectionMethod(
              `Select spell ${i + 1} for this PC: ` + whichPc,
              availableSpells.sort()

            );
            spellbook.push(spell);
            availableSpells = availableSpells.filter(s => s !== spell);
          }
        } else if (occupationSelect === 'cleric') {
          // clerics select a 'domain' (life, death, war, knowledge, etc.) which influences their spell selection
          let domainSelect = await selectionMethod(
            'Select a divine domain for this PC: ' + whichPc,
            [ 'life', 'law' ]
          );

          pc.domain = domainSelect;

          let domainSpells = abilityHandler.allSpellNames('divine', 1).filter(spellName => {
            let spell = abilityHandler.getAbility(spellName);
            return spell.domain === domainSelect;
          });

          // give all domain spells for now
          spellbook.push(...domainSpells);

          // then select additional spells
          let availableSpells = abilityHandler.allSpellNames('divine', 1).filter(spellName => {
            let spell = abilityHandler.getAbility(spellName);
            return spell.domain !== domainSelect;
          });

          for (let i = 0; i < 2; i++) {
            let spell = await selectionMethod(
              `Select additional spell ${i + 1} for this PC: ` + whichPc,
              availableSpells.sort()
            );
            spellbook.push(spell);
            availableSpells = availableSpells.filter(s => s !== spell);
          }
        }
        // if (pc.class === "mage" || pc.class === "cleric") {
          pc.abilities.push(...spellbook);
        // }

        await Presenter.printCharacterRecord(pc);
        let confirm = await selectionMethod(
          'Do you want to use this PC? ' + whichPc,
          ['Yes', 'No']
        );
        if (confirm === 'Yes') {
          party.push(pc);
        }
      } else {
        pc = await pcGenerator({ setting: 'fantasy' }) as Combatant;
        if (pc.class === 'mage') {
          const spells = Sample.count(3, ...abilityHandler.allSpellNames('arcane', 1))
          console.log("Adding to " + pc.name + "'s spellbook: " + spells.join(", ") + " (already has " + pc.abilities.join(", ") + ")");
          pc.abilities.push(...spells);
        } else if (pc.class === 'cleric') {
          const domainSpells = abilityHandler.allSpellNames('divine', 1).filter(spellName => {
            let spell = abilityHandler.getAbility(spellName);
            return spell.domain === 'life'; // default to life domain for random clerics
          });
          pc.abilities.push(...domainSpells);
          const additionalSpells = Sample.count(2, ...abilityHandler.allSpellNames('divine', 1).filter(spellName => {
            let spell = abilityHandler.getAbility(spellName);
            return spell.domain !== 'life';
          }));
          console.log("Adding to " + pc.name + "'s spellbook: " + additionalSpells.join(", ") + " (already has " + pc.abilities.join(", ") + ")");
          pc.abilities.push(...additionalSpells);
        }

        if (!party.some(p => p.name === pc?.name)) {
          await Presenter.printCharacterRecord(pc);
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
        partyPassives.forEach(trait => {
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
      // console.log(`${Presenter.minimalCombatant(pc)} leveled up to level ${pc.level}!`);
      events.push({ type: "upgrade", stat: "level", subject: pc, amount: 1, newValue: pc.level } );
      // console.log(`Hit points increased by ${hitPointIncrease} to ${pc.maxHp}.`);
      events.push({ type: "upgrade", stat: "maxHp", subject: pc, amount: hitPointIncrease, newValue: pc.maxHp });
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

      let fx = await Fighting.gatherEffects(pc);
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
        let allSpellKeys = abilityHandler.allSpellNames('arcane', Math.ceil(pc.level / 2));

        let newSpellKeys = allSpellKeys.filter(spellKey => {
          return !pc.abilities.includes(spellKey);
        });

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
          console.log(`${(pc.forename)} learned the spell: ${chosenSpell.name}`);
          pc.abilities.push(chosenSpellKey);
        } else {
          console.log(`${(pc.forename)} has learned all available spells for their level.`);
        }
      } else if (pc.class === "cleric") {
        // gain spells
        let abilityHandler = AbilityHandler.instance;
        await abilityHandler.loadAbilities();
        let allSpellKeys = abilityHandler.allSpellNames('divine', Math.ceil(pc.level / 2));

        let newSpellKeys = allSpellKeys.filter(spellKey => {
          return !pc.abilities.includes(spellKey);
        });

        if (newSpellKeys.length > 0) {
          let spellChoices = newSpellKeys.map(spellKey => {
            let spell = abilityHandler.getAbility(spellKey);
            return {
              name: Words.capitalize(spell.name) + ': ' + spell.description,
              value: spellKey,
              short: spell.name,
              disabled: (spell.domain !== pc.domain)
            };
          });
          if (spellChoices.every(choice => choice.disabled)) {
            console.log(`${pc.name} has learned all available spells for their domain at this time.`);
          } else {
            let chosenSpellKey = await select(`Select a new spell for ${pc.name}:`, spellChoices);
            console.log(chosenSpellKey);
            let chosenSpell = abilityHandler.getAbility(chosenSpellKey);
            console.log(`${(pc.forename)} learned the spell: ${chosenSpell.name}`);
            pc.abilities.push(chosenSpellKey);
          }
        }
      }

      if (pc.level >= 20) {
        // epic feats...
      } else if (pc.level % 5 === 0) {
        // feat selection
        console.log(`${Presenter.minimalCombatant(pc)} can select a new feat!`);
        let traitHandler = TraitHandler.instance;
        await traitHandler.loadTraits();
        let availableFeats = traitHandler.featsForCombatant(pc);
        if (availableFeats.length === 0) {
          console.log(`But there are no available feats for ${Presenter.minimalCombatant(pc)} at this time.`);
          continue;
        }

        let chosenFeat = await select(`Select a feat for ${pc.name}:`, availableFeats.map(trait => ({
          name: Words.capitalize(trait.name) + ': ' + trait.description,
          value: trait,
          short: trait.name,
          disabled: false
        })));
        console.log(`${Presenter.minimalCombatant(pc)} selected the feat: ${JSON.stringify(chosenFeat)}`);
        pc.traits.push(chosenFeat.name);
        // apply any passive effects from the feat
        pc.passiveEffects ||= [];
        if (chosenFeat.statuses) {
          pc.passiveEffects.push(...chosenFeat.statuses);
        }
        console.log(`${Presenter.minimalCombatant(pc)} gained the feat: ${Words.capitalize(chosenFeat.name)}.`);
      }
    }

    return events;
  }
}