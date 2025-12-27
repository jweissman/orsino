import Deem from "../deem";
import Generator from "./Generator";
import { Combatant, EquipmentSlot } from "./types/Combatant";
import { DamageKind } from "./types/DamageKind";
import { ItemInstance } from "./types/ItemInstance";

export interface Weapon {
  key?: string;
  damage: string;
  type: DamageKind;
  intercept?: boolean;
  missile?: boolean;
  value: number;
  kind: string;
  weight: string;
}


export interface Equipment {
  key: string;
  description: string;
  value: number;
  kind: EquipmentSlot;
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
    const itemInfo = { kind, aspects: [aspect] }; // mock item info for checking proficiencies
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

  static item(name: string): ItemInstance {
    // console.trace(`Creating item instance for: ${name}`);
    return Generator.gen("loot", { _name: name }) as unknown as ItemInstance;
    // const isConsumable = Deem.evaluate(`hasEntry(consumables, '${name}')`);
    // if (isConsumable) {
    //   const itemInfo = Deem.evaluate(`lookup(consumables, '${name}')`) as { charges?: number; };
    //   if (itemInfo.charges) {
    //     return {
    //       name,
    //       maxCharges: itemInfo.charges,
    //       charges: Math.max(1, Math.floor(Math.random() * itemInfo.charges))
    //     };
    //   } else {
    //     return { name };
    //   }
    // } else {
    //   // console.trace("Error: trying to add non-consumable item as instance:", name);
    //   throw new Error(`Cannot add non-consumable item '${name}' as an instance to inventory.`);
    // }
  }

  static quantities(items: ItemInstance[]): { [itemName: string]: number; } {
    const inventoryCounts: { [itemName: string]: number; } = {};
    for (const itemInstance of items) {
      inventoryCounts[itemInstance.key] = (inventoryCounts[itemInstance.name] || 0) + 1;
    }
    return inventoryCounts;
  }

  static equipmentSlotAndExistingItem(equipmentKey: string, wielder: Combatant): {oldItemKey: string | null, slot: EquipmentSlot} {
    if (!wielder.equipment) {
      wielder.equipment = {};
    }

    const equipment = Deem.evaluate(`lookup(equipment, "${equipmentKey}")`) as unknown as Equipment;
    let slot = equipment.kind;
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

    const oldItemKey = wielder.equipment ? wielder.equipment[slot] : null;
    // let oldItem = null;
    // if (oldItemKey) {
    //   oldItem = Deem.evaluate(`lookup(equipment, "${oldItemKey}")`) as unknown as Equipment;
    //   // console.log(`Discard equipped ${Words.humanize(oldItemKey)} from ${wielder.name} in favor of ${Words.humanize(equipmentKey)}.`);
    //   // wielder.gp += oldItem.value || 0;
    //   // this.state.sharedGold += oldItem.value || 0;
    //   // this.outputSink(`🔄 Replacing ${Words.humanize(oldItemKey)} equipped to ${wielder.name} (sold old item for ${oldItem.value}g).`)
    // };
    // wielder.equipment = wielder.equipment || {};
    // wielder.equipment[slot] = equipmentKey;

    // console.log(`🛡️ Equipped ${equipmentKey} to ${wielder.name} in slot ${slot}.`);

    return { oldItemKey: oldItemKey || null, slot };
  }
}
