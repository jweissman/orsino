import Deem from "../deem";
import Generator from "./Generator";
import { Combatant, EquipmentSlot } from "./types/Combatant";
import { DamageKind } from "./types/DamageKind";
import { ItemInstance } from "./types/ItemInstance";

export interface Weapon {
  key?: string;
  description: string;
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
    const it = Generator.gen("loot", { _name: name }) as unknown as ItemInstance;
    if (it.charges) {
      console.warn(`Setting maxCharges for item ${it.name} to ${it.charges}.`);
      it.maxCharges = Math.max(1,it.charges);
    }
    return it;
  }

  static quantities(items: ItemInstance[]): { [itemName: string]: number; } {
    const inventoryCounts: { [itemName: string]: number; } = {};
    for (const itemInstance of items) {
      inventoryCounts[itemInstance.key] = (inventoryCounts[itemInstance.key] || 0) + 1;
    }
    return inventoryCounts;
  }

  static equipmentSlotAndExistingItem(equipmentKey: string, wielder: Combatant): {oldItemKey: string | null, slot: EquipmentSlot} {
    if (!wielder.equipment) {
      wielder.equipment = {};
    }

    const equipment = Deem.evaluate(`lookup(masterEquipment, "${equipmentKey}")`) as unknown as Equipment;
    let slot = equipment.kind;
    if (slot === 'ring' as EquipmentSlot) {
      if (!wielder.equipment['ring1']) {
        slot = 'ring1';
      } else if (!wielder.equipment['ring2']) {
        slot = 'ring2';
      } else {
        slot = 'ring1';
      }
    }

    const oldItemKey = wielder.equipment ? wielder.equipment[slot] : null;
    return { oldItemKey: oldItemKey || null, slot };
  }

  static propertyOf(subject: Combatant, inventory: ItemInstance[]): ItemInstance[] | null {
    return inventory.filter(item => item.ownerId === subject.id);
  }

  static sharedItems(inventory: ItemInstance[]): ItemInstance[] {
    return inventory.filter(item => !item.ownerId);
  }
}
