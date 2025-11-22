import { AbilityEffect } from "../Ability";

type Trait = "lucky" | "resilient";

type StatusEffect = {
  name: string;
  effect: { [key: string]: any };
  duration: number;

  by?: Combatant;
  onAttack?: AbilityEffect[];
  onTurnEnd?: AbilityEffect[];
}

export interface Combatant {
  traits: Trait[];
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
  // xpValue?: number;
  // goldDrop?: string;
  weapon: string;

  // spellSlots?: number;
  spellSlotsUsed?: number;

  activeEffects?: StatusEffect[];

  // turnBonus?: { [key: string]: number };
  type?: string; // monster type, e.g. "shaman", "brute", etc.

  abilitiesUsed?: string[]; // Track which abilities have been used in the current combat

  // number of sides on the hit die for this combatant
  hitDie?: number;

  // demographic info
  age?: any;
  gender?: any;
  background?: any;

  attacksPerTurn?: number;
}
