import Deem from "../deem";
import { ItemInstance } from "./types/ItemInstance";

export class Inventory {
  static async item(name: string): Promise<ItemInstance> {
    let isConsumable = await Deem.evaluate(`hasEntry(consumables, '${name}')`);
    if (isConsumable) {
      let itemInfo = await Deem.evaluate(`lookup(consumables, '${name}')`);
      if (itemInfo.charges) {
        return {
          name,
          maxCharges: itemInfo.charges,
          charges: Math.max(1, Math.floor(Math.random() * itemInfo.charges))
        };
      } else {
        return { name };
      }
    } else {
      console.trace("Error: trying to add non-consumable item as instance:", name);
      throw new Error(`Cannot add non-consumable item '${name}' as an instance to inventory.`);
    }
  }

  static quantities(items: ItemInstance[]): { [itemName: string]: number; } {
    let inventoryCounts: { [itemName: string]: number; } = {};
    for (let itemInstance of items) {
      inventoryCounts[itemInstance.name] = (inventoryCounts[itemInstance.name] || 0) + 1;
    }
    return inventoryCounts;
  }
}
