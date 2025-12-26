import Choice from "inquirer/lib/objects/choice";
import AbilityHandler from "../Ability";
import { ChoiceSelector } from "../Combat";
import { DungeonEvent } from "../Events";
import TraitHandler, { Trait } from "../Trait";
import Presenter from "../tui/Presenter";
import Stylist from "../tui/Style";
import User, { SelectionMethod } from "../tui/User";
import Words from "../tui/Words";
import { Combatant } from "../types/Combatant";
import { Roll } from "../types/Roll";
import { Team } from "../types/Team";
import { never } from "../util/never";
import { Commands } from "./Commands";
import { Fighting } from "./Fighting";
import Automatic from "../tui/Automatic";

type PlayerCharacterRace = "human" | "elf" | "dwarf" | "halfling" | "orc" | "fae" | "gnome";

export default class CharacterRecord {

  static xpForLevel(level: number): number {
    // return (level * level * level * 100) + (level * level * 500) + (level * 1000) - 3800;
    return (level * level * level * 50) + (level * level * 150) + (level * 300) - 600;
  }

  static crForParty(party: Combatant[]): number {
    const totalLevels = party.reduce((sum, c) => sum + c.level, 0);
    return Math.max(1, Math.round(totalLevels / 3));
  }

  static get pcRaces(): PlayerCharacterRace[] {
    return ["human", "elf", "dwarf", "halfling", "orc", "fae", "gnome"];
  }

  static validClassesForRace(race: PlayerCharacterRace): string[] {
    let occupationOptions: string[] = [];
    switch (race) {
      case "human":
        occupationOptions = ["warrior", "thief", "mage", "cleric", "ranger", "bard"];
        break;
      case "elf":
        occupationOptions = ["warrior", "thief", "mage", "ranger", "bard"];
        break;
      case "dwarf":
        occupationOptions = ["warrior", "thief", "cleric"];
        break;
      case "halfling":
        occupationOptions = ["warrior", "thief", "bard"];
        break;
      case "orc":
        occupationOptions = ["warrior", "thief", "ranger"];
        break;
      case "fae":
        occupationOptions = ["mage", "cleric", "bard"];
        break;
      case "gnome":
        occupationOptions = ["thief", "mage", "bard"];
        break;
      default: never(race);
    }
    return occupationOptions;
  }

  static async pickSpell(
    spellLevel: number, school: 'arcane' | 'divine',
    alreadyKnown: string[] = [],
    selectionMethod: SelectionMethod = User.selection
  ): Promise<string> {
    const abilityHandler = AbilityHandler.instance;
    await abilityHandler.loadAbilities();
    let spellChoices = abilityHandler.allSpellNames(school, spellLevel);
    spellChoices = spellChoices.filter(spellName => alreadyKnown.indexOf(spellName) === -1);
    const spellChoicesDetailed = spellChoices.map(spellName => {
      const spell = abilityHandler.getAbility(spellName);
      return {
        name: Words.capitalize(spell.name.padEnd(20)) + ' | ' +
          Stylist.colorize(spell.description, 'brightBlack'),
        value: spellName,
        short: spell.name,
        disabled: false
      };
    });
    const chosenSpell: Choice<any> = await selectionMethod(
      `Select a level ${spellLevel} ${school} spell:`,
      spellChoicesDetailed
    ) as Choice<any>;
    return chosenSpell as any as string;
  }

  static async chargen(
    prompt: string,
    pcGenerator: (options?: any) => Promise<Combatant>,
    selectionMethod: SelectionMethod = User.selection
  ): Promise<Combatant> {

    let pc: Combatant = await pcGenerator({ setting: 'fantasy' });
    let accepted = false;
    while (!accepted) {
      const shouldWizard = await selectionMethod(
        'Would you like to customize this PC? ' + prompt,
        ['Yes', 'No']
      );
      if (shouldWizard === 'Yes') {
        const raceSelect = await selectionMethod(
          'Select a race for this PC: ' + prompt,
          ['human', 'elf', 'dwarf', 'halfling', 'orc', 'fae', 'gnome']
        );

        const occupationSelect = await selectionMethod(
          'Select an occupation for this PC: ' + prompt,
          this.validClassesForRace(raceSelect as PlayerCharacterRace)
        );

        pc = await pcGenerator({ setting: 'fantasy', race: raceSelect, class: occupationSelect });
        await this.pickInitialSpells(pc, selectionMethod);

        await Presenter.printCharacterRecord(pc);
        const confirm = await selectionMethod(
          'Do you want to use this PC? ' + prompt,
          ['Yes', 'No']
        );
        accepted = confirm === 'Yes';
      } else {
        const race = this.pcRaces[Math.floor(Math.random() * this.pcRaces.length)];
        const validClasses = this.validClassesForRace(race);
        const occupation = validClasses[Math.floor(Math.random() * validClasses.length)];
        pc = await pcGenerator({
          setting: 'fantasy',
          race,
          class: occupation

        });
        await this.pickInitialSpells(pc, Automatic.randomSelect.bind(Automatic));

        await Presenter.printCharacterRecord(pc);
        accepted = await selectionMethod(
          'Do you want to use this PC? ' + prompt,
          ['Yes', 'No']
        ) === 'Yes';

      }
    }
    return pc;
  }

  static async pickInitialSpells(
    pc: Combatant,
    selectionMethod: SelectionMethod = User.selection.bind(User)
  ) {
    const job = pc.class;
    const spellbook: string[] = [];
    if (job === 'mage') {
      const cantrips = AbilityHandler.instance.allSpellNames('arcane', 0);
      // give all cantrips
      spellbook.push(...cantrips);

      // let availableSpells = AbilityHandler.instance.allSpellNames('arcane', 1).filter(spellName => cantrips.indexOf(spellName) === -1);
      for (let i = 0; i < 3; i++) {
        const spell = await this.pickSpell(1, 'arcane', spellbook, selectionMethod);
        // console.log(`Adding to ${pc.name}'s spellbook: ${spell} (already has ${spellbook.join(", ")})`);
        spellbook.push(spell);
        // availableSpells = availableSpells.filter(s => s !== spell);
      }
    } else if (job === 'cleric') {
      // give all cantrips
      const cantrips = AbilityHandler.instance.allSpellNames('divine', 0);
      spellbook.push(...cantrips);

      // clerics select a 'domain' (life, death, war, knowledge, etc.) which influences their spell selection
      const domainSelect = await selectionMethod(
        'Select a divine domain for this PC: ' + pc.forename,
        ['life', 'law']
      ) as string;

      pc.domain = domainSelect;

      const domainSpells = AbilityHandler.instance.allSpellNames('divine', 1).filter(spellName => {
        const spell = AbilityHandler.instance.getAbility(spellName);
        return spell.domain === domainSelect && cantrips.indexOf(spellName) === -1;
      });

      // give all domain spells for now
      spellbook.push(...domainSpells);

      // then select additional spells
      // let availableSpells = AbilityHandler.instance.allSpellNames('divine', 1).filter(spellName => {
      //   let spell = AbilityHandler.instance.getAbility(spellName);
      //   return spell.domain !== domainSelect;
      // });

      for (let i = 0; i < 2; i++) {
        const spell = await this.pickSpell(1, 'divine', spellbook, selectionMethod);
        // console.log(`Adding to ${pc.name}'s spellbook: ${spell} (already has ${spellbook.join(", ")})`);
        spellbook.push(spell);
        // availableSpells = availableSpells.filter(s => s !== spell);
      }
    }
    pc.abilities.push(...spellbook);
  }

  static async chooseParty(
    pcGenerator: (options?: any) => Promise<Combatant>,
    partySize: number,
    selectionMethod: SelectionMethod = User.selection
  ): Promise<Combatant[]> {
    const abilityHandler = AbilityHandler.instance;
    await abilityHandler.loadAbilities();
    await TraitHandler.instance.loadTraits();

    const doChoose = await selectionMethod(
      `Would you like to customize PCs using the wizard?`,
      ['Yes', 'No']
    );
    if (doChoose === 'No') {
      return this.chooseParty(pcGenerator, partySize, Automatic.randomSelect);
    }

    const party: Combatant[] = [];

    let pc: Combatant | null = null;
    while (party.length < partySize) {
      const whichPc = '(' + (party.length + 1) + '/' + partySize + ')';
      pc = await this.chargen(whichPc, pcGenerator, selectionMethod);
      // }

      if (pc) {
        if (party.some(p => p.name === pc?.name)) {
          console.log(Stylist.bold(`A PC named ${(pc.name)} is already in the party. Please choose a different name.`));
          continue;
        }
        await Presenter.printCharacterRecord(pc);
        party.push(pc);
      }
    };
    // assign formation bonuses + racial traits
    this.assignPartyPassives(party);

    return party;
  }

  static async assignPartyPassives(party: Combatant[]) {
    const traitHandler = TraitHandler.instance;
    await traitHandler.loadTraits();
    const partyPassives: Trait[] = traitHandler.partyTraits(party);
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
  }

  static async levelUp(pc: Combatant, team: Team, roller: Roll, select: ChoiceSelector<any>): Promise<DungeonEvent[]> {
    const events: DungeonEvent[] = [];
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
      pc.maximumHitPoints += hitPointIncrease;
      pc.hp = pc.maximumHitPoints;
      // console.log(`${Presenter.minimalCombatant(pc)} leveled up to level ${pc.level}!`);
      events.push({ type: "upgrade", stat: "level", subject: pc, amount: 1, newValue: pc.level });
      // console.log(`Hit points increased by ${hitPointIncrease} to ${pc.maxHp}.`);
      events.push({ type: "upgrade", stat: "maximumHitPoints", subject: pc, amount: hitPointIncrease, newValue: pc.maximumHitPoints });
      const stat = await select(`Choose a stat to increase:`, [
        { disabled: pc.level <= 20 && pc.str >= 18, name: `Strength (${pc.str})`, value: 'str', short: 'Strength' },
        { disabled: pc.level <= 20 && pc.dex >= 18, name: `Dexterity (${pc.dex})`, value: 'dex', short: 'Dexterity' },
        { disabled: pc.level <= 20 && pc.int >= 18, name: `Intelligence (${pc.int})`, value: 'int', short: 'Intelligence' },
        { disabled: pc.level <= 20 && pc.wis >= 18, name: `Wisdom (${pc.wis})`, value: 'wis', short: 'Wisdom' },
        { disabled: pc.level <= 20 && pc.cha >= 18, name: `Charisma (${pc.cha})`, value: 'cha', short: 'Charisma' },
        { disabled: pc.level <= 20 && pc.con >= 18, name: `Constitution (${pc.con})`, value: 'con', short: 'Constitution' },
        // just in case they're 18 across!
        { disabled: false, name: `Max HP (${pc.maximumHitPoints})`, value: 'maximumHitPoints', short: 'HP' },
      ]);
      // @ts-ignore
      pc[stat] += 1;
      // this.note(`${c.name}'s ${stat.toUpperCase()} increased to ${c[stat as keyof Combatant]}!`);

      // let fx = await Fighting.gatherEffects(pc);
      // if (fx.onLevelUp) {
      const pseudocontext = { subject: pc, allies: team.combatants.filter(c => c !== pc), enemies: [] };
      events.push(...(await AbilityHandler.performHooks(
        'onLevelUp',
        pc,
        pseudocontext,
        Commands.handlers(roller),
        "level up",
      )) as DungeonEvent[]);
      //   for (const effect of fx.onLevelUp as AbilityEffect[]) {
      //     // execute the effect
      //     console.log(`Applying level-up effect to ${pc.name}...`);
      //     let { events: levelUpEvents } = await AbilityHandler.handleEffect(
      //       'onLevelUp', effect, pc, pc, pseudocontext, Commands.handlers(roller) // this.roller, this.playerTeam)
      //     );
      //     // events.forEach(e => this.emit({ ...e, turn: 0 } as DungeonEvent));
      //     events.push(...levelUpEvents as DungeonEvent[]);
      //   }

      // }

      if (pc.class === "mage") {
        // gain spells
        const abilityHandler = AbilityHandler.instance;
        await abilityHandler.loadAbilities();
        const allSpellKeys = abilityHandler.allSpellNames('arcane', Math.ceil(pc.level / 2));

        const newSpellKeys = allSpellKeys.filter(spellKey => {
          return !pc.abilities.includes(spellKey);
        });

        if (newSpellKeys.length > 0) {
          const spellChoices = newSpellKeys.map(spellKey => {
            const spell = abilityHandler.getAbility(spellKey);
            return {
              name: Words.capitalize(spell.name) + ': ' + spell.description,
              value: spellKey,
              short: spell.name,
              disabled: false
            };
          });
          const chosenSpellKey = await select(`Select a new spell for ${pc.name}:`, spellChoices);
          const chosenSpell = abilityHandler.getAbility(chosenSpellKey);
          console.log(`${(pc.forename)} learned the spell: ${chosenSpell.name}`);
          pc.abilities.push(chosenSpellKey);
        } else {
          console.log(`${(pc.forename)} has learned all available spells for their level.`);
        }
      } else if (pc.class === "cleric") {
        // gain spells
        const abilityHandler = AbilityHandler.instance;
        await abilityHandler.loadAbilities();
        const allSpellKeys = abilityHandler.allSpellNames('divine', Math.ceil(pc.level / 2));

        const newSpellKeys = allSpellKeys.filter(spellKey => {
          return !pc.abilities.includes(spellKey);
        });

        if (newSpellKeys.length > 0) {
          const spellChoices = newSpellKeys.map(spellKey => {
            const spell = abilityHandler.getAbility(spellKey);
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
            const chosenSpellKey = await select(`Select a new spell for ${pc.name}:`, spellChoices);
            console.log(chosenSpellKey);
            const chosenSpell = abilityHandler.getAbility(chosenSpellKey);
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
        const traitHandler = TraitHandler.instance;
        await traitHandler.loadTraits();
        const availableFeats = traitHandler.featsForCombatant(pc);
        if (availableFeats.length === 0) {
          console.log(`But there are no available feats for ${Presenter.minimalCombatant(pc)} at this time.`);
          continue;
        }

        const chosenFeat = await select(`Select a feat for ${pc.name}:`, availableFeats.map(trait => ({
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