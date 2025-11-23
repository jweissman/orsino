import { DamageKind, StatusEffect } from "../Ability";

export interface Combatant {
  traits: string[];
  abilities: string[];
  name: string;
  class?: string;
  race?: string;
  forename: string;
  hp: number;
  maxHp: number;
  level: number;
  ac: number;
  str: number;
  dex: number;
  int: number;
  wis: number;
  cha: number;
  con: number;
  attackRolls: number;
  damageDie: number;
  playerControlled?: boolean;
  xp?: number;
  gp?: number;
  weapon: string;

  spellSlotsUsed?: number;

  activeEffects?: StatusEffect[];
  passiveEffects?: StatusEffect[];

  type?: string; // monster type, e.g. "shaman", "brute", etc.
  abilitiesUsed?: string[]; // Track which abilities have been used in the current combat

  attacksPerTurn?: number;

  hitDie?: number; // number of sides on the hit die for this combatant

  // demographic info
  age?: any;
  gender?: any;
  background?: any;
  damageKind: DamageKind;

  currentEnvironment?: string;
}
