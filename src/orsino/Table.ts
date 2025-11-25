export class Table {
  private groups: Record<string, any[]> = {};

  constructor(public discriminator: string) { }

  group(name: string, items: any[]): this {
    this.groups[name] = items;
    return this;
  }

  gatherKeys(count: number): any[] {
    let allKeys = Object.keys(this.groups);
    let keys: any[] = [];
    for (let i = 0; i < count; i++) {
      let key = allKeys[Math.floor(Math.random() * allKeys.length)];
      keys.push(key);
    }

    return keys;
  }

  pick(groupName: string): any {
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
      throw new Error(`Group not found: ${groupName}`);
    }
    // return group[Math.floor(Math.random() * group.length)];
    options = group;

    // if not an array, return the single value
    if (!Array.isArray(options)) {
      return options;
    }

    return options[Math.floor(Math.random() * options.length)];
  }
}
