import Choice from "inquirer/lib/objects/choice";
import AbilityHandler from "../Ability";
import { ChoiceSelector } from "../Combat";
import { CombatContext, pseudocontextFor } from "../types/CombatContext";
import { DungeonEvent } from "../Events";
import TraitHandler, { Trait } from "../Trait";
import Presenter from "../tui/Presenter";
import Stylist from "../tui/Style";
import User from "../tui/User";
import Words from "../tui/Words";
import { Combatant } from "../types/Combatant";
import { Roll } from "../types/Roll";
import { Team } from "../types/Team";
import { Commands } from "./Commands";
import { Fighting } from "./Fighting";
import Automatic from "../tui/Automatic";
import { Select } from "../types/Select";
import { Answers } from "inquirer";
import Deem from "../../deem";

type PlayerCharacterRace = string; // "human" | "elf" | "dwarf" | "halfling" | "orc" | "fae" | "gnome";

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
    return Deem.evaluate("gather(racialModifier)") as PlayerCharacterRace[];
  }

  static validClassesForRace(race: PlayerCharacterRace): string[] {
    let options = Deem.evaluate("dig(lookup(racialModifier, '" + race + "'), occupationOptions)") as string[];
    if (options.includes("all")) {
      return Deem.evaluate("gather(classModifier)") as string[];
    }
    return options;
  }

  static async pickSpell(
    spellLevel: number,
    aspect: 'arcane' | 'divine',
    alreadyKnown: string[] = [],
    selectionMethod: Select<Answers> = User.selection.bind(User),
    schoolOrDomainRestriction: string = 'all'
  ): Promise<string | boolean> {

    const abilityHandler = AbilityHandler.instance;
    await abilityHandler.loadAbilities();
    let spellChoices = abilityHandler.spellKeysByLevel(aspect, spellLevel, false);
    spellChoices = spellChoices.filter(spell => alreadyKnown.indexOf(spell) === -1);
    const spellChoicesDetailed = spellChoices.map(spellName => {
      const spell = abilityHandler.getAbility(spellName);
      return {
        name: Words.capitalize(spell.name.padEnd(20)) + ' | ' +
          Stylist.colorize(spell.description, 'brightBlack'),
        value: spellName,
        short: spell.name,
        disabled: !!(schoolOrDomainRestriction && schoolOrDomainRestriction !== 'all' && (
          (aspect === 'arcane' && spell.school !== schoolOrDomainRestriction) ||
          (aspect === 'divine' && spell.domain !== schoolOrDomainRestriction)
        ))
      };

    });
    const available = spellChoicesDetailed.filter(s => !s.disabled);
    console.warn(`Picking level ${spellLevel} ${aspect} spell (already known: ${alreadyKnown.join(", ")}) with restriction: ${schoolOrDomainRestriction} -- available: ${available.map(s => s.value).join(", ")}`);
    if (available.length === 0) {
      console.warn(`No available level ${spellLevel} ${aspect} spells to choose from for restriction: ${schoolOrDomainRestriction}`);
      return false;
    }
    const chosenSpell: Choice<Answers> = await selectionMethod(
      `Select a level ${spellLevel} ${aspect} spell:`,
      spellChoicesDetailed
    ) as Choice<Answers>;
    return chosenSpell as any as string;
  }

  static async chargen(
    prompt: string,
    pcGenerator: (options?: any) => Combatant,
    selectionMethod: Select<Answers> = User.selection.bind(User)
  ): Promise<Combatant> {

    let pc: Combatant = pcGenerator({ setting: 'fantasy' });
    let accepted = false;
    while (!accepted) {
      const shouldWizard = await selectionMethod(
        'Would you like to customize this PC? ' + prompt,
        ['Yes', 'No']
      );
      if (shouldWizard === 'Yes') {
        const raceSelect = await selectionMethod(
          'Select a race for this PC: ' + prompt,
          this.pcRaces
        ) as PlayerCharacterRace;

        const occupationSelect = await selectionMethod(
          'Select an occupation for this PC: ' + prompt,
          this.validClassesForRace(raceSelect)
        );

        pc = pcGenerator({ setting: 'fantasy', race: raceSelect, class: occupationSelect });
        await this.chooseTraits(pc, selectionMethod);
        // await this.pickInitialSpells(pc, selectionMethod);

        await Presenter.printCharacterRecord(pc, []);
        const confirm = await selectionMethod(
          'Do you want to use this PC? ' + prompt,
          ['Yes', 'No']
        );
        accepted = confirm === 'Yes';
      } else {
        const race = this.pcRaces[Math.floor(Math.random() * this.pcRaces.length)];
        const validClasses = this.validClassesForRace(race);
        const occupation = validClasses[Math.floor(Math.random() * validClasses.length)];
        pc = pcGenerator({
          setting: 'fantasy',
          race,
          class: occupation

        });
        await this.chooseTraits(pc, Automatic.randomSelect.bind(Automatic));
        // await this.pickInitialSpells(pc, Automatic.randomSelect.bind(Automatic));

        await Presenter.printCharacterRecord(pc, []);
        accepted = await selectionMethod(
          'Do you want to use this PC? ' + prompt,
          ['Yes', 'No']
        ) === 'Yes';

      }
    }
    return pc;
  }

  static async chooseTraits(
    pc: Combatant,
    selectionMethod: Select<Answers> = User.selection.bind(User)
  ) {
    if (pc.traitChoices && pc.traitChoices.length > 0) {
      const traitHandler = TraitHandler.instance;
      await traitHandler.loadTraits();

      const selectedTrait = await selectionMethod("Select a trait for " + pc.name + ":",
        pc.traitChoices.map(traitName => {
          const trait = traitHandler.getTrait(traitName);
          return {
            name: Words.capitalize(trait.name) + ': ' + trait.description,
            value: trait,
            short: trait.name,
            disabled: false
          };
        }
        ));
      pc.traits.push((selectedTrait as Trait).name);
      pc.passiveEffects ||= [];
      const trait = traitHandler.getTrait((selectedTrait as Trait).name);
      if (trait.statuses) {
        pc.passiveEffects.push(...trait.statuses);
      }
      if (trait.abilities) {
        pc.abilities.push(...trait.abilities);
      }
      if (trait.spellbooks) {
        await this.pickInitialSpells(pc, trait.spellbooks, trait.school || trait.domain || 'all',
          selectionMethod);
      }
      console.log(`${Presenter.minimalCombatant(pc)} gained the trait: ${Words.capitalize((selectedTrait as Trait).name)}.`);
      
      delete pc.traitChoices;
    }
  }

  static async pickInitialSpells(
    pc: Combatant,
    spellbooks: string[],
    schoolOrDomain: string = 'all',
    selectionMethod: Select<Answers> = User.selection.bind(User)
  ) {
    const pcSpells: string[] = [];

    const cantrips = [];
    for (const spellbook of spellbooks) {
      cantrips.push(...AbilityHandler.instance.allSpellKeys(spellbook as 'arcane' | 'divine', 0, false));
    }
    pcSpells.push(...cantrips);

    const spellLevelsToPick: { [level: number]: number; } = { 1: 3, 2: 2, 3: 1 };
    for (const spellbook of spellbooks) {
      for (const levelStr of Object.keys(spellLevelsToPick)) {
        const level = parseInt(levelStr, 10);
        console.warn(`Picking ${spellLevelsToPick[level]} level ${level} spells for ${pc.name} from ${spellbook} with restriction: ${schoolOrDomain}`);
        for (let i = 0; i < spellLevelsToPick[level]; i++) {
            const spell = await this.pickSpell(level, spellbook as 'arcane' | 'divine', pcSpells, selectionMethod, schoolOrDomain);
          if (typeof spell === 'string') {
            pcSpells.push(spell);
          }
        }
      }
    }

    pc.abilities.push(...pcSpells);
  }

  static async chooseParty(
    pcGenerator: (options?: any) => Combatant,
    partySize: number,
    selectionMethod: Select<Answers> = User.selection.bind(User)
  ): Promise<Combatant[]> {
    const abilityHandler = AbilityHandler.instance;
    await abilityHandler.loadAbilities();
    await TraitHandler.instance.loadTraits();

    const doChoose = await selectionMethod(
      `Would you like to customize PCs using the wizard?`,
      ['Yes', 'No']
    );
    if (doChoose === 'No') {
      return this.chooseParty(pcGenerator, partySize, Automatic.randomSelect.bind(Automatic));
    }

    const party: Combatant[] = [];

    let pc: Combatant | null = null;
    while (party.length < partySize) {
      const whichPc = '(' + (party.length + 1) + '/' + partySize + ')';
      pc = await this.chargen(whichPc, pcGenerator, selectionMethod);
      // }

      if (pc) {
        if (party.some(p => p.name === pc?.name)) {
          // console.warn(Stylist.bold(`A PC named ${(pc.name)} is already in the party. Please choose a different name.`));
          continue;
        }
        await Presenter.printCharacterRecord(pc, []);
        party.push(pc);
      }
    };
    // assign formation bonuses + racial traits
    await this.assignPartyPassives(party);

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
          if (trait.statuses) {
            c.passiveEffects.push(...trait.statuses);
          }
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
      let hitPointIncrease = (roller(pc, "hit point growth", pc.hitDie || 4)).amount;
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
      ]) as keyof Combatant;

      const statistic = stat as keyof Combatant;
      // @ts-expect-error -- TS doesn't like dynamic access here (can't work out what type pc[statistic] is)
      // maybe better to have a 'stats' model that's only numbers?
      pc[statistic] = (pc[statistic] as number || 0) + 1;
      // this.note(`${c.name}'s ${stat.toUpperCase()} increased to ${c[stat as keyof Combatant]}!`);

      // let fx = await Fighting.gatherEffects(pc);
      // if (fx.onLevelUp) {
      const pseudocontext: CombatContext = pseudocontextFor(pc, team.inventory);
      //   subject: pc, allies: team.combatants.filter(c => c !== pc), enemies: [],
      //   inventory: team.inventory, enemyInventory: []
      // };
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
        const allSpellKeys = abilityHandler.allSpellKeys('arcane', Math.ceil(pc.level / 2));

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
        const allSpellKeys = abilityHandler.allSpellKeys('divine', Math.ceil(pc.level / 2));

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