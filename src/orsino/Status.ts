import { AbilityEffect } from "./Ability";
import { Combatant } from "./types/Combatant";

export interface StatusModifications {
  changeAllegiance?: boolean;
  compelNextMove?: boolean;
  
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
  onEnemyCharge?: AbilityEffect[];
  onEnemyMelee?: AbilityEffect[];

  flee?: boolean;

  bonusSpellSlots?: number;
  bonusSpellDC?: number;
  summonAnimalBonus?: number;
  statusDuration?: number;
  backstabMultiplier?: number;

  extraAttacksPerTurn?: number;

  resurrectable?: boolean;

  // noncombat
  examineBonus?: number;
  searchBonus?: number;
  pickLockBonus?: number;
  disarmTrapBonus?: number;
  lootBonus?: number;

  xpMultiplier?: number;
  goldMultiplier?: number;
  consumableMultiplier?: number;
}

export interface StatusEffect {
  name: string;
  description?: string;
  effect: StatusModifications;  //{ [key: string]: any };
  duration?: number;
  by?: Combatant;
  whileEnvironment?: string;
  aura?: boolean;
}

export default class StatusHandler {
  // todo - load statuses from big statuses JSON (to be extracted from abilities...) for indirection/consistency
}