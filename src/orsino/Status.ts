import { AbilityEffect } from "./Ability";
import { Combatant } from "./types/Combatant";

export interface StatusModifications {
  changeAllegiance?: boolean;
  compelNextMove?: string;
  forceTarget?: boolean;
  
  allRolls?: number;
  rerollNaturalOnes?: boolean;

  str?: number;
  dex?: number;
  con?: number;
  int?: number;
  wis?: number;
  cha?: number;

  initiative?: number;
  toHit?: number;
  bonusDamage?: number;
  ac?: number;
  evasion?: number;

  bonusHealing?: number;

  allSaves?: number;

  resistBleed?: number;
  resistPoison?: number;
  resistPsychic?: number;
  resistLightning?: number;
  resistFire?: number;
  resistCold?: number;
  resistBludgeoning?: number;
  resistPiercing?: number;
  resistSlashing?: number;
  resistForce?: number;
  resistRadiant?: number;
  resistNecrotic?: number;
  resistAcid?: number;
  resistTrue?: number;
  resistAll?: number

  saveVersusPoison?: number;
  saveVersusDisease?: number;
  saveVersusDeath?: number;
  saveVersusMagic?: number;
  saveVersusInsanity?: number;
  saveVersusCharm?: number;
  saveVersusFear?: number;
  saveVersusStun?: number;
  saveVersusWill?: number;
  saveVersusBreath?: number;
  saveVersusParalyze?: number;
  saveVersusSleep?: number;
  saveVersusAll?: number;

  immunePoison?: boolean;
  immuneDisease?: boolean;
  immuneDeath?: boolean;
  immuneMagic?: boolean;
  immuneInsanity?: boolean;
  immuneCharm?: boolean;
  immuneFear?: boolean;
  immuneStun?: boolean;
  immuneWill?: boolean;
  immuneBreath?: boolean;
  immuneParalyze?: boolean;
  immuneSleep?: boolean;

  immuneDamage?: boolean;

  noActions?: boolean;
  randomActions?: boolean;
  noSpellcasting?: boolean;

  noStatusExpiry?: boolean;

  onAttack?: AbilityEffect[];
  onAttackHit?: AbilityEffect[];
  onTurnEnd?: AbilityEffect[];
  onKill?: AbilityEffect[];
  onAttacked?: AbilityEffect[];
  onExpire?: AbilityEffect[];
  onLevelUp?: AbilityEffect[];
  onMissReceived?: AbilityEffect[];
  onHeal?: AbilityEffect[];
  onOffensiveCasting?: AbilityEffect[];

  onEnemyCharge?: AbilityEffect[];
  onEnemyMelee?: AbilityEffect[];
  // [key: `onEnemy${string}`]: AbilityEffect[] | undefined;

  onResistPoison?: AbilityEffect[];
  onResistDisease?: AbilityEffect[];
  onResistDeath?: AbilityEffect[];
  onResistMagic?: AbilityEffect[];
  onResistInsanity?: AbilityEffect[];
  onResistCharm?: AbilityEffect[];
  onResistFear?: AbilityEffect[];
  onResistStun?: AbilityEffect[];
  onResistWill?: AbilityEffect[];
  onResistBreath?: AbilityEffect[];
  onResistParalyze?: AbilityEffect[];
  onResistSleep?: AbilityEffect[];
  // onResistAll?: AbilityEffect[];

  onSaveVersusPoison?: AbilityEffect[];
  onSaveVersusDisease?: AbilityEffect[];
  onSaveVersusDeath?: AbilityEffect[];
  onSaveVersusMagic?: AbilityEffect[];
  onSaveVersusInsanity?: AbilityEffect[];
  onSaveVersusCharm?: AbilityEffect[];
  onSaveVersusFear?: AbilityEffect[];
  onSaveVersusStun?: AbilityEffect[];
  onSaveVersusWill?: AbilityEffect[];
  onSaveVersusBreath?: AbilityEffect[];
  onSaveVersusParalyze?: AbilityEffect[];
  onSaveVersusSleep?: AbilityEffect[];
  // onSaveVersusAll?: AbilityEffect[];

  flee?: boolean;

  bonusSpellSlots?: number;
  bonusSpellDC?: number;
  summonAnimalBonus?: number;
  statusDuration?: number;
  backstabMultiplier?: number;
  // [key: `${string}Multiplier`]: number | undefined;

  extraAttacksPerTurn?: number;

  resurrectable?: boolean;

  tempHp?: number;
  damageReduction?: number;

  // noncombat
  examineBonus?: number;
  searchBonus?: number;
  pickLockBonus?: number;
  disarmTrapBonus?: number;
  lootBonus?: number;

  xpMultiplier?: number;
  goldMultiplier?: number;
  consumableMultiplier?: number;

  maxHp?: number;
}

export interface StatusEffect {
  name: string;
  description?: string;
  effect: StatusModifications;  //{ [key: string]: any };
  duration?: number;
  by?: Combatant;
  whileEnvironment?: string;
  aura?: boolean;

  condition?: {
    weapon?: { weight?: 'light' | 'medium' | 'heavy' };
  }
}

export default class StatusHandler {
  // todo - load statuses from big statuses JSON (to be extracted from abilities...) for indirection/consistency
}