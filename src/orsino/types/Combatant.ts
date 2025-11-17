
export interface Combatant {
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

  activeEffects?: {
    name: string;
    effect: { [key: string]: any };
    duration: number;
  }[];

  // turnBonus?: { [key: string]: number };
  type?: string; // monster type, e.g. "shaman", "brute", etc.

  abilitiesUsed?: string[]; // Track which abilities have been used in the current combat
}
