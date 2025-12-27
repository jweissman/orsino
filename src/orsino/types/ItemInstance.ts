import { AbilityEffect } from "../Ability";

export interface ItemInstance {
  key: string;
  name: string;
  value: number;
  description?: string;
  charges?: number;
  maxCharges?: number;
  itemClass: 'weapon' | 'armor' | 'gear' | 'consumable' | 'misc';
  effects?: AbilityEffect[];

  // consumable type
  kind?: string;
  aspect?: string;

  // ownership
  ownerId?: string;
  ownerSlot?: string; // optional semantic hint about where item is stored (e.g. "left hand", "backpack", etc)
  shared?: boolean; // indicates if item is shared among team members
}

