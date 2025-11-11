import Deem from "./deem";
import { GenerationTemplateType } from "./orsino/types/GenerationTemplateType";
import { Template } from "./orsino/Template";
import { Table } from "./orsino/Table";
import { loadSetting } from "./orsino/loader";
import Combat, { PlaygroundType } from "./orsino/Combat";

export default class Orsino {
  setting: Record<GenerationTemplateType, Template | Table>;

  constructor(public settingName?: string) {
    this.setting = settingName ? loadSetting(settingName) : this.defaultSetting;
  }

  play(
    type: PlaygroundType,
    options: Record<string, any> = {}
  ) {
    if (type === "combat") {
      return new Combat(options);
    } else {
      throw new Error('Unsupported playground type: ' + type);
    }
  }

  genList(
    type: GenerationTemplateType,
    options: Record<string, any> = {},
    count: number = 1
  ): Record<string, any>[] {
    return Array.from({ length: count }, () => this.gen(type, options));
  }

  gen(
    type: GenerationTemplateType,
    options: Record<string, any> = {}
  ): Record<string, any> {
    const templ = this.generationSource(type);
    if (!templ) {
      throw new Error('No template found for type: ' + type);
    }

    if (options.__count && options.__count > 1) {
      return this.genList(type, { ...options, __count: undefined }, options.__count);
    }

    Deem.stdlib.lookup = (tableName: GenerationTemplateType, groupName: string) => this.lookupInTable(tableName, groupName);
    Deem.stdlib.gen = (type: GenerationTemplateType, options: Record<string, any> = {}) => this.gen(type, options);

    if (templ instanceof Template) {
      return templ.assembleProperties(options)
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

