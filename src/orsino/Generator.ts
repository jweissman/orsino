import Deem from "../deem";
import { loadSetting } from "./loader";
import { Table } from "./Table";
import { Template } from "./Template";
import { GenerationTemplateType } from "./types/GenerationTemplateType";
import deepCopy from "./util/deepCopy";

export default class Generator {
  static setting: Record<GenerationTemplateType, Template | Table>;

  static async genList(
    type: GenerationTemplateType,
    options: Record<string, any> = {},
    count: number = 1,
    condition?: string,
  ): Promise<Record<string, any>[]> {
    if (count === 0) {
      return [];
    }
    // accumulate items gradually and put them in __items so that conditions can refer to them
    const items: Record<string, any>[] = [];
    let attempts = 0;
    while (items.length < count && attempts++ < count * 10) {
      const i = items.length;
      // console.log(`Generating ${type} ${i + 1}/${count}...`);
      const item = await this.gen(type, deepCopy({ ...options, _index: i }));
      items.push(item);
      if (!condition) { continue }
      Deem.magicVars = { __items: [...items] };
      const conditionResult = await Template.evaluatePropertyExpression(condition, deepCopy({ ...options }));
      if (!conditionResult) {
        items.pop();
        // console.warn(`Item ${i} did not meet condition: ${condition}`);
        // process.stdout.write(`.`);
        // are we 1-2 away from the count?
        if (count - items.length <= 2) {
          break;
        }
      }
    }
    if (items.length === 0) {
      // console.warn(`No items generated for type ${type} meeting condition: ${condition}, generating one anyway`);
      // generate one anyway
      items.push(await this.gen(type, options));
      // process.stdout.write(`!`);
    }

    return items;
  }

  static async gen(
    type: GenerationTemplateType,
    options: Record<string, any> = {}
  ): Promise<Record<string, any>> {
    Generator.setting = Generator.setting || (options.setting ? loadSetting(options.setting) : Generator.defaultSetting);
    // console.log(`Gen ${Stylist.format(type, 'bold')} with options`);
    // let nonNestedOptions: Record<string, any> = {};
    // Object.entries(options).forEach(([key, value]) => {
    //   if (typeof value !== 'object' || value === null) {
    //     nonNestedOptions[key] = value;
    //   }
    // });
    // // print options as nice table
    // console.table(nonNestedOptions);

    const templ = Generator.generationSource(type);
    if (!templ) {
      throw new Error('No template found for type: ' + type);
    }

    if (options.__count && options.__count > 1) {
      return await this.genList(type, { ...options, __count: undefined }, options.__count);
    } else if (options.count && options.count > 1) {
      return await this.genList(type, { ...options, count: undefined }, options.count);
    }

    if (templ instanceof Template) {
      let assembled = await templ.assembleProperties(options); //, this);
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

  public static lookupInTable(tableName: GenerationTemplateType, groupName: string, globallyUnique: boolean = false): any {
    const table = Generator.generationSource(tableName);
    if (!table || !(table instanceof Table)) {
      throw new Error(`Table not found: ${tableName}`);
    }
    const ret = table.pick(groupName, globallyUnique);
    return ret;
  }

  public static async gatherKeysFromTable(tableName: GenerationTemplateType, count: number, condition?: string): Promise<any[]> {
    const table = Generator.generationSource(tableName);
    if (!table || !(table instanceof Table)) {
      throw new Error(`Table not found: ${tableName}`);
    }
    const ret = table.gatherKeys(count);

    if (condition) {
      for (let key of ret.slice()) {
        const conditionResult = await Deem.evaluate(condition, { __it: this.lookupInTable(tableName, key) });
        if (conditionResult) {
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
        name: new Table('gender', 'sex')
          .group('male', ['John', 'Michael', 'David', 'James', 'Robert'])
          .group('female', ['Jane', 'Emily', 'Sarah', 'Jessica', 'Lisa'])
          .group('neutral', ['Alex', 'Taylor', 'Jordan', 'Morgan', 'Casey']),
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