import Deem from "./deem";
import { GenerationTemplateType } from "./orsino/types/GenerationTemplateType";
import { Template } from "./orsino/Template";
import { Table } from "./orsino/Table";
import { loadSetting } from "./orsino/loader";
import Combat, { Gauntlet, RollResult } from "./orsino/Combat";
import { Combatant } from "./orsino/types/Combatant";
import Spinner from "./orsino/tui/Spinner";
import { select, Separator } from '@inquirer/prompts';
import deepCopy from "./orsino/util/deepCopy";
import Dungeoneer from "./orsino/Dungeon";
import Stylist from "./orsino/tui/Style";

type PlaygroundType = "combat" | "dungeon" | "world";
export default class Orsino {
  setting: Record<GenerationTemplateType, Template | Table>;

  constructor(public settingName?: string) {
    this.setting = settingName ? loadSetting(settingName) : this.defaultSetting;
  }

  async play(
    type: PlaygroundType,
    options: Record<string, any> = {}
  ) {
    if (type === "combat") {
      let gauntlet = (new Gauntlet({
        ...options,
        roller: Orsino.interactiveRoll,
        select: Orsino.interactiveSelect,
        outputSink: console.log,
      }))

      const partySize = options.partySize || Math.max(1, Math.floor(Math.random() * 3) + 1);
      await gauntlet.run({
        pcs: this.genList("pc", { setting: 'fantasy', ...options }, partySize),
        encounterGen: (targetCr: number) => this.gen("encounter", { setting: 'fantasy', ...options, targetCr }),
      });
    }
    else if (type === "dungeon") {
      const partySize = options.partySize || 2;
      const pcs = this.genList("pc", { setting: 'fantasy', ...options }, partySize);
      const dungeoneer = new Dungeoneer({
        roller: Orsino.interactiveRoll,
        select: Orsino.interactiveSelect,
        outputSink: console.log,
        dungeonGen: () => this.gen("dungeon", { setting: 'fantasy', ...options, _targetCr: Math.round(partySize / 2) }),
        playerTeam: {
          name: "Heroes",
          combatants: pcs.map(pc => ({ ...pc, playerControlled: true }))
        }
      });

      await dungeoneer.run();

    }
    else {
      throw new Error('Unsupported playground type: ' + type);
    }
  }

  private static async interactiveSelect(
    prompt: string,
    options: (
      readonly (string | Separator)[]
    )
  ): Promise<any> {
    const config = { message: prompt, choices: options }
    return await select(config)
  }

  private static async interactiveRoll(subject: Combatant, description: string, sides: number, dice: number): Promise<RollResult> {
    if (!subject.playerControlled) {
      const result = Combat.rollDie(subject, description, sides, dice);
      await Spinner.run(`${subject.name} is rolling`, 400 + Math.random() * 200, result.description);
      return result;
    }

    await new Promise(resolve => setTimeout(resolve, 650));

    await Spinner.waitForInputAndRun(
      `\n>>> ${subject.name} to roll ${dice}d${sides} ${description}... <<<`,
      `Rolling ${dice}d${sides} ${description}`
    );

    // Then do the actual roll
    let result = Combat.rollDie(subject, description, sides, dice);
    console.log(result.description);
    return result;
  }

  genList(
    type: GenerationTemplateType,
    options: Record<string, any> = {},
    count: number = 1,
    condition?: string
  ): Record<string, any>[] {
    // accumulate items gradually and put them in __items so that conditions can refer to them
    const items: Record<string, any>[] = [];
    let attempts = 0;
    while (items.length < count && attempts++ < count * 10) {
      const i = items.length;
      const item = this.gen(type, deepCopy({ ...options, _index: i }));
      items.push(item);
      if (!condition) { continue }
      Deem.magicVars = { __items: [...items] };
      const conditionResult = Template.evaluatePropertyExpression(condition, deepCopy(options));
      if (!conditionResult) {
        items.pop();
        // console.warn(`Item ${i} did not meet condition: ${condition}`);
        break;
      }
    }
    if (items.length === 0) {
      // generate one anyway
      items.push(this.gen(type, options));
    }
    return items;
  }

  gen(
    type: GenerationTemplateType,
    options: Record<string, any> = {}
  ): Record<string, any> {
    this.setting = this.setting || (options.setting ? loadSetting(options.setting) : this.defaultSetting);
    // console.log(`Gen ${Stylist.format(type, 'bold')} with options`);
    let nonNestedOptions: Record<string, any> = {};
    Object.entries(options).forEach(([key, value]) => {
      if (typeof value !== 'object' || value === null) {
        nonNestedOptions[key] = value;
      }
    });
    // print options as nice table
    // console.table(nonNestedOptions);

    const templ = this.generationSource(type);
    if (!templ) {
      throw new Error('No template found for type: ' + type);
    }

    if (options.__count && options.__count > 1) {
      return this.genList(type, { ...options, __count: undefined }, options.__count);
    }

    if (templ instanceof Template) {
      let assembled = templ.assembleProperties(options, this);
      return assembled;
    } else if (templ instanceof Table) {
      let group = options.group || 'default';
      if (options[templ.discriminator]) {
        group = options[templ.discriminator];
      }
      return templ.pick(group);
    } else {
      throw new Error('Invalid template type for generation: ' + type);
    }
  }

  private lookupInTable(tableName: GenerationTemplateType, groupName: string): any {
    const table = this.generationSource(tableName);
    if (!table || !(table instanceof Table)) {
      throw new Error(`Table not found: ${tableName}`);
    }
    const ret = table.pick(groupName);
    return ret;
  }

  private generationSource(type: GenerationTemplateType): Template | Table | null {
    return this.setting[type] || null;
  }

  defaultSetting: Record<GenerationTemplateType, Template | Table> = {
    dungeon: new Template('dungeon', {
      name: '=oneOf("The Cursed Crypt", "The Forgotten Keep", "The Shadowed Caverns", "The Lost Temple", "The Haunted Catacombs")',
      description: '=oneOf("A dark and eerie place filled with traps and monsters.", "An ancient ruin with hidden secrets.", "A labyrinthine cave system teeming with danger.", "A forgotten temple guarded by undead.", "A sprawling catacomb haunted by restless spirits.")',
      difficulty: '=oneOf("Easy", "Medium", "Hard", "Deadly")',
      size: '=oneOf("Small", "Medium", "Large")',
      theme: '=oneOf("Undead", "Beasts", "Traps", "Magic", "Mixed")'
    }),
    monster: new Template('monster', {
      name: '=oneOf("Goblin", "Orc", "Troll", "Bandit", "Skeleton")',
      cr: '=oneOf(0.25, 0.5, 1, 2, 3)',
      hp: '=lookup(name, cr) * 10 + rand(1, 10)',
      ac: '=10 + floor(cr * 2)',
      str: '=floor(cr * 2) + rand(1, 6)',
      dex: '=floor(cr * 2) + rand(1, 6)',
      con: '=floor(cr * 2) + rand(1, 6)',
      int: '=floor(cr * 2) + rand(1, 6)',
      wis: '=floor(cr * 2) + rand(1, 6)',
      cha: '=floor(cr * 2) + rand(1, 6)',
    }),
    treasure: new Table('treasure')
      .group('negligible', ['a rusty sword', 'a small pouch of coins', 'a healing potion', 'an old map', 'a silver ring'])
      .group('normal', ['a finely crafted dagger', 'a bag of gold coins', 'a potion of strength', 'a mysterious amulet', 'a rare gemstone'])
      .group('minor', ['a powerful potion', 'a bag of gems', 'a magical scroll', 'a rare artifact', 'a golden amulet'])
      .group('major', ['a magical staff', 'a chest of gold', 'an ultra-rare gem', 'an enchanted armor', 'a powerful artifact'])
      .group('legendary', ['a legendary sword', 'a chest of ancient treasures', 'the crown of a lost king', 'a mythical artifact', 'a powerful arcane relic']),
    name: new Table('gender')
      .group('male', ['John', 'Michael', 'David', 'James', 'Robert'])
      .group('female', ['Jane', 'Emily', 'Sarah', 'Jessica', 'Lisa'])
      .group('neutral', ['Alex', 'Taylor', 'Jordan', 'Morgan', 'Casey']),
    surname: new Table('occupation')
      .group('Artist', ['Fletcher', 'Shoesmith', 'Baker', 'Tailor', 'Mason', 'Smith', 'Carpenter'])
      .group('Engineer', ['Leach', 'Wright', 'Turner'])
      .group('Merchant', ['Porter', 'Hawker', 'Cheeseman', 'Nutter'])
      .group('Adventurer', ['Forester', 'Hunter', 'Latimer', 'Taverner']),
    pc: new Template('pc', {
      gender: '=oneOf(male, female, neutral)',
      _firstName: '=lookup(name, #gender)',
      age: '=4d10+16',
      occupation: '=oneOf(Artist, Engineer, Merchant, Adventurer)',
      _lastName: '=lookup(surname, #occupation)',
      name: '=#_firstName + " " + #_lastName',
      str: '=3d6 + 2',
      dex: '=3d6',
      con: '=3d6',
      int: '=3d6',
      wis: '=3d6',
      cha: '=3d6',
      hp: '=10 + #con',
    }),
    npc: new Template('npc', {
      gender: '=oneOf(male, female, neutral)',
      _firstName: '=lookup(name, #gender)',
      _lastName: '=oneOf(Ford, Smith, Johnson, Brown, Davis, Miller)',
      name: '=#_firstName + " " + #_lastName',
      age: '=4d10+16',
      role: '=oneOf(Shopkeeper, Guard, Villager)'
    }),
    room: new Template('room', {
      // _kind: '=oneOf(tavern, marketplace, library, alleyway, hall)',
      narrative: '=oneOf("A dimly lit tavern", "A bustling marketplace", "A quiet library", "A shadowy alleyway", "A grand hall")',
      size: '=oneOf(small, medium, large)',
      _encounterChance: '=oneOf(0.2, 0.4, 0.6)',
      _hasTreasure: '=oneOf(true, false)',
      treasure: '=if(#_hasTreasure, lookup(treasure, minor), nihil)',
      encounter: '=if(rand() < #_encounterChance, gen("encounter"), nihil)'
    }),
    encounter: new Template('encounter', {
      name: '=oneOf("Goblin Ambush", "Bandit Raid", "Wild Animal Attack", "Mysterious Stranger", "Lost Traveler")',
      difficulty: '=oneOf("Easy", "Medium", "Hard", "Deadly")',
      // description: '=oneOf("A group of goblins jumps out from the bushes.", "Bandits block your path, demanding your valuables.", "A wild animal lunges at you from the shadows.", "A mysterious stranger offers you a quest.", "You encounter a lost traveler seeking help.")'
    })
  };
}

