import { DamageKind, SaveKind, StatusEffect } from "../Ability";

export interface Combatant {
  traits: string[];
  abilities: string[];
  name: string;
  class?: string;
  race?: string;
  hometown?: string;
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
  // attackRolls: number;
  // damageDie: number;
  playerControlled?: boolean;
  xp: number;
  gp: number;
  weapon: string;
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
  age?: any;
  gender?: any;
  background?: any;

  attackDie: string;
  damageKind: DamageKind;

  currentEnvironment?: string;

  gear?: string[];

  // todo count saves and prevent more than 3 saves from death
  savedTimes?: { [key in SaveKind]?: number };

  hasMissileWeapon?: boolean;
  hasInterceptWeapon?: boolean;
}
