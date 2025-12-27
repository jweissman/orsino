import Deem from "../../deem";
import { AbilityEffect } from "../Ability";
import { Weapon } from "../Inventory";
import { StatusModifications } from "../Status";

export interface ItemInstance {
  id?: string; // unique identifier for this specific item instance
  key: string;
  name: string;
  value: number;
  description?: string;
  charges?: number;
  maxCharges?: number;
  itemClass: 'weapon' | 'armor' | 'gear' | 'consumable' | 'equipment' | 'misc';
  effects?: AbilityEffect[];

  effect?: StatusModifications; // shorthand single status mod for equipment/weapons/etc

  // consumable type
  kind?: string;
  aspect?: string;

  // ownership
  ownerId?: string;
  ownerSlot?: string; // optional semantic hint about where item is stored (e.g. "left hand", "backpack", etc)
  shared?: boolean; // indicates if item is shared among team members
}

export const materializeItem = (itemName: string, inventory: ItemInstance[]): ItemInstance => {
  const ref = itemName;
  const byId = inventory.find(i => i.id === ref);
  if (byId) return byId;
  
  const byKey = inventory.find(i => i.key === ref);
  if (byKey) return byKey;

  const hasMasterWeaponEntry = Deem.evaluate(`hasEntry(masterWeapon, "${itemName}")`) as boolean;
  if (hasMasterWeaponEntry) {
    const masterWeapon = Deem.evaluate(`lookup(masterWeapon, "${itemName}")`) as unknown as Weapon;
    if (!masterWeapon) {
      throw new Error(`Could not find itemName ${itemName} in effectiveWeapon`);
    }
    // note: straight lookup from master will actually be missing a bunch of true ItemInstance fields like id etc
    return {
      itemClass: 'weapon',
      name: itemName,
      ...masterWeapon,
      key: itemName
    };
  }

  const hasMasterEquipmentEntry = Deem.evaluate(`hasEntry(masterEquipment, "${itemName}")`) as boolean;
  if (hasMasterEquipmentEntry) {
    const masterEquipment = Deem.evaluate(`lookup(masterEquipment, "${itemName}")`) as unknown as Weapon;
    if (!masterEquipment) {
      throw new Error(`Could not find equipment ${itemName} in effectiveWeapon`);
    }

    return {
      itemClass: 'equipment',
      name: itemName,
      ...masterEquipment,
      key: itemName
    };
  }

  throw new Error(`Could not materialize item ${itemName}`);
}