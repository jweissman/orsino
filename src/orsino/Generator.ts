import Deem from "../deem";
import { DeemValue } from "../deem/stdlib";
import { loadSetting } from "./loader";
import { Table } from "./Table";
import { Template } from "./Template";
import { GenerationTemplateType } from "./types/GenerationTemplateType";
import deepCopy from "./util/deepCopy";

export type GeneratorOptions = {
  _index?: number;

  setting?: string;
  background?: string;

  key?: string;
  _key?: string;

  name?: string;
  _name?: string;

  forename?: string;

  race?: string;

  count?: number;
  __count?: number;

  group?: string;

  class?: string;
  gender?: string;
  targetCr?: number;
  _targetCr?: number;
  _moduleLevel?: number;

  // playerControlled?: boolean;
  animal_type?: string;
  animal_aspect?: string;

  monster_type?: string;
  monster_aspect?: string;
  age_category?: string;
  color?: string;
  element?: string;
  rank?: string;

  _loot_rank?: string;
  _plane_name?: string;
}
export type GeneratedValue = Record<string, DeemValue>;

export default class Generator {
  static setting: Record<GenerationTemplateType, Template | Table>;

  static genList(
    type: GenerationTemplateType,
    options: GeneratorOptions = {},
    count: number = 1
  ): GeneratedValue[] {
    if (count === 0) {
      return [];
    }
    const items: GeneratedValue[] = [];
    while (items.length < count) {
      const i = items.length;
      const item: GeneratedValue = this.gen(type, deepCopy({ ...options, _index: i }) as GeneratorOptions) as GeneratedValue;
      items.push(item);
    }

    return items;
  }

  static gen(
    type: GenerationTemplateType,
    options: GeneratorOptions = {}
  ): GeneratedValue | GeneratedValue[] {
    Generator.setting = Generator.setting || (options.setting ? loadSetting(options.setting) : Generator.defaultSetting);

    const templ = Generator.generationSource(type);
    if (!templ) {
      throw new Error('No template found for type: ' + type);
    }

    if (options.__count && options.__count > 1) {
      return this.genList(type, { ...options, __count: undefined }, options.__count);
    } else if (options.count && options.count > 1) {
      return this.genList(type, { ...options, count: undefined }, options.count);
    }

    if (templ instanceof Template) {
      const assembled = templ.assembleProperties(options); //, this);
      return assembled;
    } else if (templ instanceof Table) {
      let group = options.group || 'default';
      if (options[templ.discriminator as keyof GeneratorOptions]) {
        group = options[templ.discriminator as keyof GeneratorOptions] as string;
      }
      return templ.pick(group) as GeneratedValue;
    } else {
      throw new Error('Invalid template type for generation: ' + type);
    }
  }

  public static lookupInTable(tableName: GenerationTemplateType, groupName: string, globallyUnique: boolean = false, condition?: string, context: Record<string, DeemValue> = {}): DeemValue {
    const table = Generator.generationSource(tableName);
    if (!table || !(table instanceof Table)) {
      throw new Error(`Table not found: ${tableName}`);
    }
    if (condition) {
      const options = table.optionsForPick(groupName);
      if (!options) {
        throw new Error(`No options found for group ${groupName} in table ${tableName}`);
      }
      // console.log(`lookupInTable: table=${tableName}, group=${groupName}, options=${options.length}, condition=${condition}`);
      const filteredOptions = options.filter(option => {
        // console.log(` Evaluating condition for option=${JSON.stringify(option)}`);
        const conditionResult = Deem.evaluate(condition, {
          __it: option,
          ...context
        });
        // console.log(`  option=${JSON.stringify(option)} => conditionResult=${!!conditionResult}`);
        return conditionResult;
      });
      if (filteredOptions.length === 0) {
        // throw new Error(`No options in group ${groupName} of table ${tableName} satisfy condition: ${condition}`);
        console.warn(`No options in group ${groupName} of table ${tableName} satisfy condition: ${condition} -- returning first available option.`);
        return options[0];
      }
      let choice: DeemValue;
      if (globallyUnique) {
        const uniqueOptions = filteredOptions.filter(option => !table.pickedOptions.has(option));
        if (uniqueOptions.length === 0) {
          throw new Error(`No globally unique options left in group ${groupName} of table ${tableName} satisfying condition: ${condition}`);
        }
        choice = uniqueOptions[Math.floor(Math.random() * uniqueOptions.length)];
        table.pickedOptions.add(choice);
      } else {
        choice = filteredOptions[Math.floor(Math.random() * filteredOptions.length)];
      }
      return choice;
    } else {
      const ret = table.pick(groupName, globallyUnique);
      return ret;
    }
  }

  public static gatherKeysFromTable(tableName: GenerationTemplateType, count: number, condition?: string): DeemValue[] {
    Generator.setting = Generator.setting || loadSetting('fantasy');
    const table = Generator.generationSource(tableName);
    if (!table || !(table instanceof Table)) {
      throw new Error(`Table not found: ${tableName}`);
    }
    const ret = table.gatherKeys(count);

    if (condition) {
      for (const key of ret.slice()) {
        const conditionResult = Deem.evaluate(condition, {
          __it: this.lookupInTable(tableName, key)
        });
        if (!conditionResult) {
          ret.splice(ret.indexOf(key), 1);
        }
      }
    }

    return ret;
  }

  static generationSource(type: GenerationTemplateType): Template | Table | null {
    return this.setting[type] || null;
  }

  private static _defaultSetting: Record<GenerationTemplateType, Template | Table> | null = null;

  // Change from static property to static getter
  static get defaultSetting(): Record<GenerationTemplateType, Template | Table> {
    if (!this._defaultSetting) {
      this._defaultSetting = {
        module: new Template('module', {}),
        loot: new Template('loot', {}),
        animal: new Template('animal', {
          name: '=oneOf("Wolf", "Bear", "Giant Spider", "Giant Snake", "Giant Giant")',
          cr: '=oneOf(0.25, 0.5, 1, 2, 3)',
          hp: 25,
          ac: '=10 + floor(cr * 2)',
          str: '=floor(cr * 2) + rand(1, 6)',
          dex: '=floor(cr * 2) + rand(1, 6)',
          con: '=floor(cr * 2) + rand(1, 6)',
          int: '=floor(cr * 2) + rand(1, 6)',
          wis: '=floor(cr * 2) + rand(1, 6)',
          cha: '=floor(cr * 2) + rand(1, 6)',
        }),
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
          hp: 50, //'=lookup(name, cr) * 10 + rand(1, 10)',
          ac: '=10 + floor(cr * 2)',
          str: '=floor(cr * 2) + rand(1, 6)',
          dex: '=floor(cr * 2) + rand(1, 6)',
          con: '=floor(cr * 2) + rand(1, 6)',
          int: '=floor(cr * 2) + rand(1, 6)',
          wis: '=floor(cr * 2) + rand(1, 6)',
          cha: '=floor(cr * 2) + rand(1, 6)',
        }),
        treasure: new Table('treasure', 'type')
          .group('negligible', ['a rusty sword', 'a small pouch of coins', 'a healing potion', 'an old map', 'a silver ring'])
          .group('normal', ['a finely crafted dagger', 'a bag of gold coins', 'a potion of strength', 'a mysterious amulet', 'a rare gemstone'])
          .group('minor', ['a powerful potion', 'a bag of gems', 'a magical scroll', 'a rare artifact', 'a golden amulet'])
          .group('major', ['a magical staff', 'a chest of gold', 'an ultra-rare gem', 'an enchanted armor', 'a powerful artifact'])
          .group('legendary', ['a legendary sword', 'a chest of ancient treasures', 'the crown of a lost king', 'a mythical artifact', 'a powerful arcane relic']),
        maleName: new Table('maleName', 'race')
          .group('human', ['John', 'Michael', 'David', 'James', 'Robert'])
          .group('elf', ['Eldarion', 'Faelar', 'Theren', 'Aelar', 'Caladrel'])
          .group('dwarf', ['Thorin', 'Balin', 'Dwalin', 'Gimli', 'Durin']),
        femaleName: new Table('femaleName', 'race')
          .group('human', ['Jane', 'Emily', 'Sarah', 'Jessica', 'Lisa'])
          .group('elf', ['Aelene', 'Lia', 'Sylvara', 'Fayeth', 'Mythra'])
          .group('dwarf', ['Dis', 'Hilda', 'Gerta', 'Sigrid', 'Astrid']),
        androgynousName: new Table('androgynousName', 'race')
          .group('human', ['Alex', 'Taylor', 'Jordan', 'Morgan', 'Casey'])
          .group('elf', ['Rynn', 'Sage', 'Quinn', 'Aeris', 'Lior'])
          .group('dwarf', ['Kari', 'Runa', 'Tora', 'Vala', 'Eira']),
        // name: new Table('gender', 'sex')
        //   .group('male', ['John', 'Michael', 'David', 'James', 'Robert'])
        //   .group('female', ['Jane', 'Emily', 'Sarah', 'Jessica', 'Lisa'])
        //   .group('neutral', ['Alex', 'Taylor', 'Jordan', 'Morgan', 'Casey']),
        surname: new Table('occupation', 'category')
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
      }
    }
    
    return this._defaultSetting;
  }
}