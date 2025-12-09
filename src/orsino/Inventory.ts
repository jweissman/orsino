import Deem from "../deem";
import Words from "./tui/Words";
import { Combatant, EquipmentSlot } from "./types/Combatant";
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

  static isItemProficient(kind: string, aspect: string, itemProficiencies: { all?: boolean; kind?: string[]; withoutAspect?: string }): boolean {
    if (itemProficiencies.all) {
      return true;
    }
    // let itemInfo = Deem.evaluate(`lookup(consumables, "${itemKey}")`) as any;
    let itemInfo = { kind, aspects: [aspect] }; // mock item info for checking proficiencies
    if (itemProficiencies.kind) {
      if (itemInfo && itemInfo.kind && !itemProficiencies.kind.includes(itemInfo.kind)) {
        return false;
      }
    }
    if (itemProficiencies.withoutAspect) {
      if (itemInfo && itemInfo.aspects) {
        // for (let aspect of itemProficiencies.withoutAspect) {
          if (itemInfo.aspects.includes(itemProficiencies.withoutAspect)) {
            return false;
          }
        // }
      }
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

  static async equip(equipmentKey: string, wielder: Combatant): Promise<{oldItemKey: string | null, slot: EquipmentSlot}> {
    if (!wielder.equipment) {
      wielder.equipment = {};
    }

    let equipment = await Deem.evaluate(`lookup(equipment, "${equipmentKey}")`);
    let slot = equipment.kind as EquipmentSlot;
    if (slot === 'ring' as EquipmentSlot) {
      if (!wielder.equipment['ring1']) {
        slot = 'ring1';
      } else if (!wielder.equipment['ring2']) {
        slot = 'ring2';
      } else {
        // both ring slots taken, replace ring1
        slot = 'ring1';
      }
    }

    let oldItemKey = wielder.equipment ? wielder.equipment[slot] : null;
    let oldItem = null;
    if (oldItemKey) {
      oldItem = await Deem.evaluate(`lookup(equipment, "${oldItemKey}")`);
      // console.log(`Discard equipped ${Words.humanize(oldItemKey)} from ${wielder.name} in favor of ${Words.humanize(equipmentKey)}.`);
      // wielder.gp += oldItem.value || 0;
      // this.state.sharedGold += oldItem.value || 0;
      // this.outputSink(`🔄 Replacing ${Words.humanize(oldItemKey)} equipped to ${wielder.name} (sold old item for ${oldItem.value}g).`)
    };
    wielder.equipment = wielder.equipment || {};
    wielder.equipment[slot] = equipmentKey;

    return { oldItemKey: oldItemKey || null, slot };
  }
}
