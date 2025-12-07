import Deem from "../deem";
import { ItemInstance } from "./types/ItemInstance";

interface Weapon {
  damage: string;
  type: string;
  intercept?: boolean;
  missile?: boolean;
  value: number;
  kind: string;
  weight: string;
}

export class Inventory {
  static isWeaponProficient(item: Weapon, weaponProficiencies: { all?: boolean; kind?: string[]; weight?: string[]; }) {
    if (weaponProficiencies.all) {
      return true;
    }
    if (weaponProficiencies.kind && !weaponProficiencies.kind.includes(item.kind)) {
      return false;
    }
    if (weaponProficiencies.weight && !weaponProficiencies.weight.includes(item.weight)) {
      return false;
    }
    return true;
  }

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
