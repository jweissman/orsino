import AbilityHandler from "../Ability";
import { ChoiceSelector } from "../Combat";
import { CombatContext, pseudocontextFor } from "../types/CombatContext";
import { DungeonEvent } from "../Events";
import TraitHandler, { Trait } from "../Trait";
import Stylist from "../tui/Style";
import Words from "../tui/Words";
import { Combatant } from "../types/Combatant";
import { Roll } from "../types/Roll";
import { Team } from "../types/Team";
import { Commands } from "./Commands";
import { Fighting } from "./Fighting";
import Deem from "../../deem";
import Generator, { GeneratorOptions } from "../Generator";
import { Driver, NullDriver } from "../Driver";
import CombatantPresenter from "../presenter/CombatantPresenter";
import CharacterPresenter from "../presenter/CharacterPresenter";

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

  static get goodRaces(): PlayerCharacterRace[] {
    return Deem.evaluate("gather(racialModifier, -1, '!dig(#__it, evil)')") as PlayerCharacterRace[];
  }

  static get pcRaces(): PlayerCharacterRace[] {
    return Deem.evaluate("gather(racialModifier, -1, 'dig(#__it, pcRace)')") as PlayerCharacterRace[];
  }

  static validClassesForRace(race: PlayerCharacterRace): string[] {
    const options = Deem.evaluate("dig(lookup(racialModifier, '" + race + "'), occupationOptions)") as string[];
    if (options.includes("all")) {
      return Deem.evaluate("gather(classModifier)") as string[];
    }
    return options;
  }

  static validBackgroundsForClass(occupation: string): string[] {
    const options = Deem.evaluate(`gather(backgroundModifier, -1, '(dig(#__it, requiredClass) == ${occupation})')`) as string[];
      //"dig(lookup(classModifier, '" + occupation + "'), backgroundOptions)") as string[];

    return options;
  }

  static async pickSpell(
    spellLevel: number,
    aspect: 'arcane' | 'divine',
    alreadyKnown: string[] = [],
    // selectionMethod: Select<Answers>, // = User.selection.bind(User),
    driver: Driver = new NullDriver(),
    schoolOrDomainRestriction: string = 'all'
  ): Promise<string | boolean> {
    const abilityHandler = AbilityHandler.instance;
    await abilityHandler.loadAbilities();
    let spellChoices = abilityHandler.spellKeysByLevel(aspect, spellLevel, false);
    spellChoices = spellChoices.filter(spell => alreadyKnown.indexOf(spell) === -1);
    const spellChoicesDetailed = spellChoices.map(spellName => {
      const spell = abilityHandler.getAbility(spellName);
      const matchesRestriction = (spell.school === schoolOrDomainRestriction || spell.domain === schoolOrDomainRestriction || schoolOrDomainRestriction === 'all');
      return {
        name: Words.capitalize(spell.name.padEnd(20)) + ' | ' +
          Stylist.colorize(spell.description, 'gray'),
        value: spellName,
        short: spell.name,
        disabled: !matchesRestriction
      };
    });
    const available = spellChoicesDetailed.filter(s => !s.disabled);
    if (available.length === 0) {
      console.warn(`No available level ${spellLevel} ${aspect} spells to choose from for restriction: ${schoolOrDomainRestriction}`);
      return false;
    }
    const chosenSpell = await driver.select(
      `Select a level ${spellLevel} ${aspect} spell:`,
      spellChoicesDetailed
    );
    return chosenSpell;
  }

  static async chargen(
    prompt: string,
    pcGenerator: (options?: GeneratorOptions) => Combatant = (options) => Generator.gen("pc", options) as unknown as Combatant,
    driver: Driver,
    // selectionMethod: Select<Answers> = User.selection.bind(User),
    // confirmMethod: (message: string) => Promise<boolean> = User.confirmation.bind(User)
  ): Promise<Combatant> {
    let pc: Combatant = pcGenerator({ setting: 'fantasy' });
    let accepted = false;
    while (!accepted) {
      const doWizard = await driver.confirm(`Customize PC ${prompt}?`);
      if (doWizard) {
        const raceSelect: PlayerCharacterRace = await driver.select(
          'Select a race for this PC: ' + prompt,
          this.pcRaces
        );
        const occupationSelect: string = await driver.select(
          'Select an occupation for this PC: ' + prompt,
          this.validClassesForRace(raceSelect)
        );
        const backgroundSelect: string = await driver.select(
          'Select a background for this PC: ' + prompt,
          this.validBackgroundsForClass(occupationSelect)
        );
        pc = pcGenerator({ setting: 'fantasy', race: raceSelect, class: occupationSelect, background: backgroundSelect });
        await this.chooseTraits(pc, driver); // selectionMethod);
        await CharacterPresenter.printCharacterRecord(pc, []);
        accepted = await driver.confirm('Use this PC? ' + prompt);
      } else {
        pc = await this.autogen(this.pcRaces, pcGenerator);
        await CharacterPresenter.printCharacterRecord(pc, []);
        accepted = await driver.confirm('Use this PC? ' + prompt);
      }
    }
    return pc;
  }

  static async autogen(
    racePool: PlayerCharacterRace[] = this.pcRaces,
    pcGenerator: (options?: GeneratorOptions) => Combatant = (options) => Generator.gen("pc", options) as unknown as Combatant,
  ) {
    const race = racePool[Math.floor(Math.random() * racePool.length)];
    const validClasses = this.validClassesForRace(race);
    const occupation = validClasses[Math.floor(Math.random() * validClasses.length)];
    const validBackgrounds = this.validBackgroundsForClass(occupation);
    const background = validBackgrounds[Math.floor(Math.random() * validBackgrounds.length)];
    const pc = pcGenerator({
      setting: 'fantasy',
      race,
      class: occupation,
      background
    });
    await this.chooseTraits(pc, new NullDriver());
      //Automatic.randomSelect.bind(Automatic));
    return pc;
  }

  static async chooseTraits(
    pc: Combatant,
    // selectionMethod: Select<Answers> = User.selection.bind(User)
    driver: Driver = new NullDriver()
  ) {
    if (pc.traitChoices && pc.traitChoices.length > 0) {
      const traitHandler = TraitHandler.instance;
      await traitHandler.loadTraits();

      const choices = pc.traitChoices.filter(traitName => !pc.forbiddenTraits?.includes(traitName))

      const selectedTrait = await driver.select("Select a trait for " + pc.name + ":",
        choices.map(traitName => {
          const trait = traitHandler.getTrait(traitName);
          return {
            name: Words.capitalize(trait.name) + ': ' + trait.description,
            value: trait,
            short: trait.name,
            disabled: false
          };
        }
        ));
      console.warn(`${pc.forename} chose the trait: ${(selectedTrait).name}.`);
      pc.traits.push((selectedTrait).name);
      pc.passiveEffects ||= [];
      const trait = traitHandler.getTrait((selectedTrait).name);
      if (trait.statuses) {
        pc.passiveEffects.push(...trait.statuses);
      }
      if (trait.abilities) {
        pc.abilities.push(...trait.abilities);
      }
      if (trait.spellbooks) {
        await this.pickInitialSpells(pc, trait.spellbooks, trait.school || trait.domain || 'all', driver);
      }
      if (trait.school) {
        pc.school = trait.school;
      }
      if (trait.domain) {
        pc.domain = trait.domain;
      }
      delete pc.traitChoices;
    }
  }

  static async pickInitialSpells(
    pc: Combatant,
    spellbooks: string[],
    schoolOrDomain: string = 'all',
    // selectionMethod: Select<Answers> = User.selection.bind(User)
    driver: Driver = new NullDriver()
  ) {
    const pcSpells: string[] = [];

    const cantrips = [];
    for (const spellbook of spellbooks) {
      cantrips.push(...AbilityHandler.instance.allSpellKeys(spellbook as 'arcane' | 'divine', 0, false, (spell) => spell.school === schoolOrDomain || spell.domain === schoolOrDomain || schoolOrDomain === 'all'));
    }
    pcSpells.push(...cantrips);

    const spellLevelsToPick: { [level: number]: number; } = { 1: 3, 2: 2, 3: 1 };
    for (const spellbook of spellbooks) {
      for (const levelStr of Object.keys(spellLevelsToPick)) {
        const level = parseInt(levelStr, 10);
        // console.warn(`Picking ${spellLevelsToPick[level]} level ${level} spells for ${pc.name} from ${spellbook} with restriction: ${schoolOrDomain}`);

        // first spell must match restriction
        const firstSpell = await this.pickSpell(level, spellbook as 'arcane' | 'divine', pcSpells, driver, schoolOrDomain);
        if (typeof firstSpell === 'string') {
          pcSpells.push(firstSpell);
        } else {
          throw new Error(`No level ${level} ${spellbook} spells available to choose for ${pc.name} matching restriction: ${schoolOrDomain}`);
        }

        for (let i = 1; i < spellLevelsToPick[level]; i++) {
          const spell = await this.pickSpell(level, spellbook as 'arcane' | 'divine', pcSpells, driver);
          if (typeof spell === 'string') {
            pcSpells.push(spell);
          } else {
            console.warn(`No more level ${level} ${spellbook} spells available to choose for ${pc.name}!`);
          }
        }
      }
    }

    // console.log(`${pc.forename} learned the following spells: ${pcSpells.map(s => Stylist.bold(AbilityHandler.instance.getAbility(s).name)).join(", ")}.`);
    pc.abilities.push(...pcSpells);
  }

  static async chooseParty(
    pcGenerator: (options?: GeneratorOptions) => Combatant,
    partySize: number,
    driver: Driver = new NullDriver(),
    // select: Select<Answers> = User.selection.bind(User),
    // confirm: (message: string) => Promise<boolean> = User.confirmation.bind(User)
  ): Promise<Combatant[]> {
    const abilityHandler = AbilityHandler.instance;
    await abilityHandler.loadAbilities();
    await TraitHandler.instance.loadTraits();

    const doChoose = await driver.confirm("Customize PCs using the wizard?");
    console.warn(`Party creation wizard: ${doChoose}`);
    if (!doChoose) {
      return this.chooseParty(
        pcGenerator, partySize,
        new NullDriver()
        // Automatic.randomSelect.bind(Automatic),
        // () => Promise.resolve(true)
      );
    }

    const party: Combatant[] = [];

    let pc: Combatant | null = null;
    while (party.length < partySize) {
      const whichPc = '(' + (party.length + 1) + '/' + partySize + ')';
      pc = await this.chargen(whichPc, pcGenerator, driver);  //select, confirm);

      if (pc) {
        if (party.some(p => p.name === pc?.name)) {
          continue;
        }
        await CharacterPresenter.printCharacterRecord(pc, []);
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

    while (pc.xp >= nextLevelXp) {
      pc.level++;
      nextLevelXp = CharacterRecord.xpForLevel(pc.level + 1);
      let hitPointIncrease = (roller(pc, "hit point growth", pc.hitDie || 4)).amount;
      hitPointIncrease += Fighting.statMod(pc.con || 10);
      hitPointIncrease = Math.max(1, hitPointIncrease);
      pc.maximumHitPoints += hitPointIncrease;
      pc.hp = pc.maximumHitPoints;
      events.push({ type: "upgrade", stat: "level", subject: pc, amount: 1, newValue: pc.level });
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

      const statistic = stat;
      // @ts-expect-error -- TS doesn't like dynamic access here (can't work out what type pc[statistic] is)

      pc[statistic] = ((pc[statistic] as number || 0) + 1);
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

      // should try to check for domain/school here instead?
      // if (pc.class === "mage") {
      if (pc.school !== undefined) {
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
          const chosenSpellKey: string = await select(`Select a new spell for ${pc.name}:`, spellChoices) as string;
          const chosenSpell = abilityHandler.getAbility(chosenSpellKey);
          console.warn(`${(pc.forename)} learned the spell: ${chosenSpell.name}`);
          pc.abilities.push(chosenSpellKey);
        } else {
          console.warn(`${(pc.forename)} has learned all available spells for their level.`);
        }
      }
      // if (pc.class === "cleric") {
      if (pc.domain !== undefined) {
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
            console.warn(`${pc.name} has learned all available spells for their domain (${pc.domain}) at this time (level ${pc.level}).`);
          } else {
            const chosenSpellKey: string = await select(`Select a new spell for ${pc.name}:`, spellChoices) as string;
            // console.log(chosenSpellKey);
            // const chosenSpell = abilityHandler.getAbility(chosenSpellKey);
            // console.log(`${(pc.forename)} learned the spell: ${chosenSpell.name}`);
            pc.abilities.push(chosenSpellKey);
          }
        }
      }

      if (pc.level >= 20) {
        // epic feats...?
      } else if (pc.level % 5 === 0) {
        // feat selection
        const traitHandler = TraitHandler.instance;
        await traitHandler.loadTraits();
        const availableFeats = traitHandler.featsForCombatant(pc);
        if (availableFeats.length === 0) {
          console.warn(`There are no available feats for ${CombatantPresenter.minimalCombatant(pc)} at this time.`);
          continue;
        }

        const chosenFeat: Trait = await select(`Select a feat for ${pc.name}:`, availableFeats.map(trait => ({
          name: Words.capitalize(trait.name) + ': ' + trait.description,
          value: trait,
          short: trait.name,
          disabled: false
        }))) as Trait;
        pc.traits.push(chosenFeat.name);
        // apply any passive effects from the feat
        pc.passiveEffects ||= [];
        if (chosenFeat.statuses) {
          pc.passiveEffects.push(...chosenFeat.statuses);
        }
        console.warn(`${CombatantPresenter.minimalCombatant(pc)} gained the feat: ${Words.capitalize(chosenFeat.name)}.`);
      }
    }

    return events;
  }

  static introduce(pc: Combatant) {
    const greetings = ["Hello", "Greetings", "Salutations", "Well met", "Good day", "Hi there", "How do you do"];
    const greeting = greetings[Math.floor(Math.random() * greetings.length)];
    let introduction = `${greeting}, I am ${pc.name}, called the ${pc.personalNameMeaning}.`;
    if (pc.translatedHometownName && pc.class) {
      introduction += ` I hail from ${pc.translatedHometownName}`;
    // }
    // if (pc.class) {
      introduction += ` and trained as a ${Words.humanize(pc.class)}`;
    }
    introduction += `.`;
    return introduction;
  }

  static describe(combatant: Combatant): string {
    const descriptor = {
      male: "He is", female: "She is", androgynous: "They are"
    }[(combatant.gender || 'androgynous').toLowerCase()] || "They are";

    const what = `${Words.humanize(combatant.archetype || 'neutral')} ${(Words.humanize(combatant.background || 'adventurer'))}`;

    return `${Words.capitalize(combatant.referenceName || combatant.forename)} is ${Words.a_an(what)} from the ${combatant.hometown || 'unknown'}. ${descriptor} ${this.approximateAge(combatant) || 'unknown'} years old with ${Words.a_an(combatant.body_type || 'average')} build, ${combatant.hair || 'unknown color'} hair, ${combatant.eye_color || 'dark'} eyes and ${Words.a_an(combatant.personality || 'unreadable')} disposition.`
  }

  // round to nearest 5
  static approximateAge(combatant: Combatant): number {
    return Math.round((combatant.age || 0) / 5) * 5;
  }

}