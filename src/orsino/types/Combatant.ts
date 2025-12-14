import { DamageKind, SaveKind } from "../Ability";
import { StatusEffect } from "../Status";

export type EquipmentSlot = 'ring1' | 'ring2' | 'amulet' | 'cloak' | 'boots' | 'helm' | 'gloves' | 'belt';
export interface Combatant {
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
  gender?: 'male' | 'female' | 'androgynous';
  background?: any;

  attackDie: string;
  damageKind: DamageKind;

  currentEnvironment?: string;

  gear?: string[];
  loot?: string[];

  // todo count saves and prevent more than 3 saves from death
  savedTimes?: { [key in SaveKind]?: number };

  hasMissileWeapon?: boolean;
  hasInterceptWeapon?: boolean;

  equipment?: { [slot in EquipmentSlot]?: string };
  // {
  //   ring1?: string;
  //   ring2?: string;
  //   amulet?: string;
  //   cloak?: string;
  //   boots?: string;
  //   // gloves?: string;
  //   // belt?: string;
  //   // helmet?: string;
  //   // wrist?: string;
  //   // ankle?: string;
  //   // orbital?: string;

  //   // note: these are tracked separately for now just on the combatant for simplicity
  //   // weapon?: string;
  //   // armor?: string;
  // }

  // temporary flag to indicate if the combatant saved versus the last spell cast on them
  _savedVersusSpell?: boolean;

  // for clerics/paladins
  domain?: string;
}
