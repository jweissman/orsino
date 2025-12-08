export class Table {
  private groups: Record<string, any[]> = {};

  constructor(public name: string, public discriminator: string) { }

  group(name: string, items: any[]): this {
    this.groups[name] = items;
    return this;
  }

  gatherKeys(count: number): any[] {
    let allKeys = Object.keys(this.groups);
    if (count <= 0) {
      return allKeys;
    }

    let keys: any[] = [];
    for (let i = 0; i < count; i++) {
      let key = allKeys[Math.floor(Math.random() * allKeys.length)];
      keys.push(key);
    }
    return keys;
  }

  pickedOptions: Set<any> = new Set();
  pick(groupName: string, globallyUnique: boolean = false): any {
    let options = [];
    if (groupName === 'default') {
      const allItems = Object.values(this.groups).flat();
      options = allItems[Math.floor(Math.random() * allItems.length)];
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

  hasGroup(groupName: string): any {
    let exists = this.groups.hasOwnProperty(groupName);
    // console.log(`Checking existence of group '${groupName}' in table '${this.name}': ${exists}`);
    return exists;
  }
}
