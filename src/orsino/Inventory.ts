import Deem from "../deem";
import Generator from "./Generator";
import { Combatant, EquipmentSlot } from "./types/Combatant";
import { DamageKind } from "./types/DamageKind";
import { ItemInstance, materializeItem } from "./types/ItemInstance";

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
  itemClass: 'weapon';
}

export interface Armor {
  name: string;
  ac: number;
  weight: string;
  description: string;
  value: number;
  kind: string; // slot
  type: string; // cloth, leather, metal, etc.
  itemClass: 'armor';
}


export interface Equipment {
  key: string;
  description: string;
  value: number;
  kind: EquipmentSlot;
  itemClass?: 'equipment';
}

type ItemRef = { key: string; kind: "key" } | { id: string; kind: "id" } | null

export class Inventory {
  static isArmorProficient(item: Armor, armorProficiencies: {
    weight?: string[]; all?: boolean; kind?: string[];
  }) {
    if (armorProficiencies.all) {
      return true;
    }
    if (armorProficiencies.kind && !armorProficiencies.kind.includes(item.type)) {
      return false;
    }
    if (armorProficiencies.weight && !armorProficiencies.weight.includes(item.weight)) {
      return false;
    }
    return true;
  }

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

  static isItemProficient(
    // kind: string, aspect: string,
    item: ItemInstance,
    itemProficiencies: { all?: boolean; kind?: string[]; withoutAspect?: string }
  ): boolean {
    let kind = '';
    let aspect = '';
    if (item.itemClass === 'consumable') {
      kind = item.kind || '';
      aspect = item.aspect || '';
    }
    if (itemProficiencies.all) {
      return true;
    }

    const itemInfo = { kind, aspects: [aspect] };
    if (itemProficiencies.kind) {
      if (itemInfo && itemInfo.kind && !itemProficiencies.kind.includes(itemInfo.kind)) {
        return false;
      }
    }
    if (itemProficiencies.withoutAspect) {
      if (itemInfo && itemInfo.aspects) {
        if (itemInfo.aspects.includes(itemProficiencies.withoutAspect)) {
          return false;
        }
      }
    }

    return true;
  }

  private static genId = (prefix: string): string => {
    return prefix + ':' + Math.random().toString(36).substring(2, 9);
  }

  static reifyFromKey(itemKey: string): ItemInstance {
    const hasMasterWeaponEntry = Deem.evaluate(`hasEntry(masterWeapon, "${itemKey}")`) as boolean;
    if (hasMasterWeaponEntry) {
      const masterWeapon = Deem.evaluate(`lookup(masterWeapon, "${itemKey}")`) as unknown as Weapon;
      if (!masterWeapon) {
        throw new Error(`Could not find itemName ${itemKey} in masterWeapon table`);
      }
      // note: straight lookup from master will actually be missing a bunch of true ItemInstance fields like id etc
      return {
        id: this.genId('weapon'),
        name: itemKey,
        ...masterWeapon,
        key: itemKey,
        itemClass: 'weapon',
      };
    }

    const hasMasterEquipmentEntry = Deem.evaluate(`hasEntry(masterEquipment, "${itemKey}")`) as boolean;
    if (hasMasterEquipmentEntry) {
      const masterEquipment = Deem.evaluate(`lookup(masterEquipment, "${itemKey}")`) as unknown as Equipment;
      if (!masterEquipment) {
        throw new Error(`Could not find equipment ${itemKey} in masterEquipment table`);
      }

      return {
        id: this.genId('equipment'),
        name: itemKey,
        itemClass: 'equipment',
        ...masterEquipment,
        key: itemKey
      };
    }

    const hasMasterArmorEntry = Deem.evaluate(`hasEntry(masterArmor, "${itemKey}")`) as boolean;
    if (hasMasterArmorEntry) {
      const masterArmor = Deem.evaluate(`lookup(masterArmor, "${itemKey}")`) as unknown as Armor;
      if (!masterArmor) {
        throw new Error(`Could not find armor ${itemKey} in masterArmor table`);
      }

      return {
        id: this.genId('armor'),
        ...masterArmor,
        key: itemKey,
        itemClass: 'armor'
      };
    }

    const hasConsumableEntry = Deem.evaluate(`hasEntry(consumables, "${itemKey}")`) as boolean;
    if (hasConsumableEntry) {
      const consumable = Deem.evaluate(`lookup(consumables, "${itemKey}")`) as unknown as ItemInstance;
      if (!consumable) {
        throw new Error(`Could not find consumable ${itemKey} in consumables table`);
      }

      return {
        id: this.genId('consumable'),
        ...consumable,
        key: itemKey,
        itemClass: 'consumable'
      };
    }

    throw new Error(`Could not materialize item ${itemKey}`);
  }

  static materialize = (itemKey: string, inventory: ItemInstance[]): ItemInstance => {
    const ref = itemKey;
    const byId = inventory.find(i => i.id === ref);
    if (byId) return byId;

    const byKey = inventory.find(i => i.key === ref);
    if (byKey) return byKey;

    // If it looks like an id, don't try to treat it like a key
    if (ref.includes(":")) {
      if (inventory.length === 0) {
        console.trace(`materialize called with id=${ref} but empty inventory; caller is wrong`);
      }
      throw new Error(
        `Missing item instance ${ref} in provided inventory (len=${inventory.length}). ` +
        `This ref looks like an id, not a key.`
      );
    }

    return Inventory.reifyFromKey(itemKey);
  }

  static genLoot(name: string): ItemInstance {
    const it = Generator.gen("loot", { _name: name }) as unknown as ItemInstance;
    if (it.charges) {
      console.warn(`Setting maxCharges for item ${it.name} to ${it.charges}.`);
      it.maxCharges = Math.max(1, it.charges);
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
  static slotForItem(it: ItemInstance): EquipmentSlot {
    if (it.itemClass === "weapon") return "weapon";
    if (it.itemClass === "armor") {
      // if you’re using kind=body/helm/shield etc, map here
      return (it.kind as EquipmentSlot) || "body";
    }
    // equipment: ring/amulet/cloak/orbital/etc
    return (it.kind as EquipmentSlot);
  }

  static equipmentSlotAndExistingItem(it: ItemInstance, wielder: Combatant, inventory: ItemInstance[]): { oldItemRef: ItemRef, slot: EquipmentSlot } {
    if (!wielder.equipment) {
      wielder.equipment = {};
    }

    let slot = Inventory.slotForItem(it);
    if (slot === 'ring' as EquipmentSlot) {
      if (!wielder.equipment['ring1']) {
        slot = 'ring1';
      } else if (!wielder.equipment['ring2']) {
        slot = 'ring2';
      } else {
        slot = 'ring1';
      }
    }

    const oldItemSlotValue = wielder.equipment?.[slot] ?? null;

    let oldItemRef: ItemRef = null;
    if (oldItemSlotValue) {
      const byId = inventory.some(i => i.id === oldItemSlotValue);
      oldItemRef = byId
        ? { kind: "id", id: oldItemSlotValue }
        : { kind: "key", key: oldItemSlotValue };
    }
    return { oldItemRef, slot };
  }

  static propertyOf(subject: Combatant, inventory: ItemInstance[]): ItemInstance[] {
    return inventory.filter(item => item.ownerId === subject.id);
  }

  static sharedItems(inventory: ItemInstance[]): ItemInstance[] {
    return inventory.filter(item => !item.ownerId);
  }
}
