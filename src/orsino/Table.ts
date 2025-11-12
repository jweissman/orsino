export class Table {
  private groups: Record<string, any[]> = {};

  constructor(public discriminator: string) { }

  group(name: string, items: any[]): this {
    this.groups[name] = items;
    return this;
  }

  pick(groupName: string): any {
    let options = [];
    if (groupName === 'default') {
      const allItems = Object.values(this.groups).flat();
      options = allItems[Math.floor(Math.random() * allItems.length)];
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
