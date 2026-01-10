import { DeemValue } from "../deem/stdlib";

export class Table {
  private groups: Record<string, DeemValue[]> = {};

  constructor(public name: string, public discriminator: string) { }

  group(name: string, items: DeemValue[]): this {
    this.groups[name] = items;
    return this;
  }

  gatherKeys(count: number): string[] {
    const allKeys = Object.keys(this.groups);
    if (count <= 0) {
      return allKeys;
    }

    const keys: string[] = [];
    for (let i = 0; i < count; i++) {
      const key = allKeys[Math.floor(Math.random() * allKeys.length)];
      keys.push(key);
    }
    return keys;
  }

  gatherEntries(groupName: string, count: number = -1): DeemValue[] {
    const group = this.groups[groupName];
    if (group === undefined) {
      throw new Error(`Group not found in table ${this.discriminator} (group: ${groupName})`);
      // console.warn(`Group '${groupName}' not found in table '${this.name}'`);
      return [];
    }
    if (count <= 0 || count >= group.length) {
      return group;
    }

    const entries: DeemValue[] = [];
    const groupCopy = [...group];
    for (let i = 0; i < count; i++) {
      const index = Math.floor(Math.random() * groupCopy.length);
      entries.push(groupCopy.splice(index, 1)[0]);
    }
    return entries;
  }

  pickedOptions: Set<DeemValue> = new Set();
  pick(groupName: string, globallyUnique: boolean = false): DeemValue {
    let options = [];
    if (groupName === 'default') {
      const allItems = Object.values(this.groups).flat();
      options = allItems[Math.floor(Math.random() * allItems.length)] as DeemValue[];
    }

    if (groupName === null) {
      // console.warn(`No group name provided for table ${this.discriminator}`);
      return {};
    }

    const group = this.groups[groupName];
    if (group === undefined) {
      throw new Error(`Group not found in table ${this.name} (group: ${groupName})`);
      // console.warn(`Group '${groupName}' not found in table '${this.name}'`);
      return {};
    }
    // return group[Math.floor(Math.random() * group.length)];
    options = group;

    // if not an array, return the single value
    if (!Array.isArray(options)) {
      return options;
    }

    if (globallyUnique) {
      const availableOptions = options.filter(opt => !this.pickedOptions.has(opt));
      if (availableOptions.length === 0) {
        // throw new Error(`No more unique options available in table ${this.name} for group ${groupName}`);
        // could reset options for this group here instead but good to be able to throw just to see what's missing
        console.warn(`No more unique options available in table ${this.name} for group ${groupName}, resetting picked options.`);
        this.pickedOptions.clear();
        return this.pick(groupName, globallyUnique);
      }
      const choice = availableOptions[Math.floor(Math.random() * availableOptions.length)];
      this.pickedOptions.add(choice);
      return choice;
    }

    return options[Math.floor(Math.random() * options.length)];
  }

  hasGroup(groupName: string): boolean {
    // const exists = this.groups.hasOwnProperty(groupName);
    const exists = groupName in this.groups;
    return exists;
  }

  containsValue(value: string | number | boolean | DeemValue[] | { [key: string]: DeemValue; } | null): boolean {
    const exists = Object.values(this.groups).some(group => group.includes(value));
    // console.log(`Checking if table '${this.name}' contains value:`, value, '=>', exists);
    return exists;
  }

  findGroupForValue(value: string | number | boolean | DeemValue[] | { [key: string]: DeemValue; } | null) {
    for (const [groupName, items] of Object.entries(this.groups)) {
      if (items.includes(value)) {
        return groupName;
      }
    }
    return null;
  }
}
