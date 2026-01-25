import { AbilityEffect } from "../Ability";
import { Inventory } from "../Inventory";
import { StatusModifications } from "../Status";

export interface ItemInstance {
  id?: string; // unique identifier for this specific item instance
  key: string;
  name: string;
  value: number;
  description?: string;
  charges?: number;
  maxCharges?: number;
  itemClass: 'weapon' | 'armor' | 'gear' | 'consumable' | 'equipment' | 'junk';
  effects?: AbilityEffect[];

  effect?: StatusModifications; // shorthand single status mod for equipment/weapons/etc

  // consumable type
  kind?: string;
  aspect?: string;

  // ownership
  ownerId?: string;
  ownerSlot?: string; // optional semantic hint about where item is stored (e.g. "left hand", "backpack", etc)
  shared?: boolean; // indicates if item is shared among team members


  rarity?: string;
  natural?: boolean;
  type?: string;
}


export const materializeItem = (itemKey: string, inventory: ItemInstance[]): ItemInstance => {
  return Inventory.materialize(itemKey, inventory);
}