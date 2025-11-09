export class Table {
  private groups: Record<string, any[]> = {};

  constructor(public discriminator: string) { }

  group(name: string, items: any[]): this {
    this.groups[name] = items;
    return this;
  }

  pick(groupName: string): any {
    if (groupName === 'default') {
      const allItems = Object.values(this.groups).flat();
      return allItems[Math.floor(Math.random() * allItems.length)];
    }

    const group = this.groups[groupName];
    if (!group) {
      throw new Error(`Group not found: ${groupName}`);
    }
    return group[Math.floor(Math.random() * group.length)];
  }
}
