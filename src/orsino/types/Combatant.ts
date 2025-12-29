import { DamageKind } from "./DamageKind";
import { StatusEffect } from "../Status";
import { SaveKind } from "./SaveKind";

// const EQUIPMENT_SLOTS: string[] = [
//   'ring1',
//   'ring2',
//   'amulet',
//   'cloak',
//   'boots',
//   'helm',
//   'gloves',
//   'belt',
//   // 'left_hand',
//   'weapon',
//   'body',
// ];

export type EquipmentSlot
  = 'ring1'
  | 'ring2'
  | 'amulet'
  | 'cloak'
  | 'boots'
  | 'helm'
  | 'gloves'
  | 'belt'
  // | 'left_hand'
  | 'weapon'
  | 'body';

// export type EquipmentSlot = typeof EQUIPMENT_SLOTS[number];

export interface Gem {
  type: string;
  name: string;
  value: number;
}

export interface Combatant {
  dead?: boolean;

  id: string;
  description?: string;
  kind?: string;
  armorProficiencies?: {
    all?: boolean;
    kind?: string[];
    weight?: string[];
  };
  itemProficiencies?: {
    all?: boolean;
    kind?: string[];
    withoutAspect?: string;
  };
  weaponProficiencies?: {
    all?: boolean;
    kind?: string[];
    weight?: string[];
  }
  referenceName?: string;
  npc_type?: string;
  archetype?: string;
  personality?: string;
  hair?: string;
  eye_color?: string;
  body_type?: string;
  
  alignment: 'good' | 'neutral' | 'evil';
  traits: string[];
  abilities: string[];
  name: string;
  class?: string;
  race?: string;
  hometown?: string;
  forename: string;

  hp: number;
  maximumHitPoints: number;

  tempHpPools?: { [source: string]: number };

  level: number;
  // ac: number;
  str: number;
  dex: number;
  int: number;
  wis: number;
  cha: number;
  con: number;
  // attackRolls: number;
  // damageDie: number;
  playerControlled?: boolean;
  xp: number;
  gp: number;
  armor?: string;

  spellSlotsUsed?: number;

  activeEffects?: StatusEffect[];
  passiveEffects?: StatusEffect[];

  type?: string; // monster type, e.g. "shaman", "brute", etc.
  // Track which abilities have been used in the current combat
  abilitiesUsed?: string[];
  abilityCooldowns?: { [abilityName: string]: number };

  attacksPerTurn?: number;

  hitDie?: number; // number of sides on the hit die for this combatant

  // demographic info
  age?: number;
  gender?: 'male' | 'female' | 'androgynous';
  background?: string;

  // weapon: string;
  // attackDie: string;
  // damageKind: DamageKind;
  // hasMissileWeapon?: boolean;
  // hasInterceptWeapon?: boolean;

  currentEnvironment?: string;

  startingGear?: string[];
  // gems?: Gem[];

  // todo count saves and prevent more than 3 saves from death
  savedTimes?: { [key in SaveKind]?: number };

  equipment?: { [slot in EquipmentSlot]?: string };

  // temporary flag to indicate if the combatant saved versus the last spell cast on them
  _savedVersusSpell?: boolean;

  // for clerics/paladins
  domain?: string;

  activeSummonings?: Combatant[];
}
