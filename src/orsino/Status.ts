import { AbilityEffect } from "./Ability";
import { Combatant } from "./types/Combatant";
import { SaveKind } from "./types/SaveKind";
import Files from "./util/Files";

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
  resistSonic?: number;
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
  saveVersusBleed?: number;
  saveVersusSleep?: number;
  saveVersusReflex?: number;
  saveVersusFortitude?: number;

  // allSaves?: number; -- use saveVersusAll instead
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
  immuneBleed?: boolean;
  immuneSleep?: boolean;
  immuneReflex?: boolean;
  immuneFortitude?: boolean;


  // maybe too powerful also??
  // immuneDamage?: boolean;
  // immunePhysical?: boolean;

  noActions?: boolean;
  randomActions?: boolean;
  noSpellcasting?: boolean;

  noStatusExpiry?: boolean;

  onCombatStart?: AbilityEffect[];
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
  onEnemyAttack?: AbilityEffect[]; // enemy makes an attack
  onEnemyDamage?: AbilityEffect[]; // enemy deals direct damage
  onEnemyHeal?: AbilityEffect[];   // enemy heals
  onEnemyBuff?: AbilityEffect[];   // enemy gains a status
  onEnemyDebuff?: AbilityEffect[]; // enemy gains a negative status
  onEnemySummon?: AbilityEffect[]; // enemy summons creature(s)

  onEnemyCasting?: AbilityEffect[];
  onEnemyOffensiveCasting?: AbilityEffect[];

  // these feel _so_ narrow?
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
  onSaveVersusBleed?: AbilityEffect[];
  onSaveVersusSleep?: AbilityEffect[];
  onSaveVersusReflex?: AbilityEffect[];
  onSaveVersusFortitude?: AbilityEffect[];

  flee?: boolean;

  bonusSpellSlots?: number;
  bonusSpellDC?: number;
  summonAnimalBonus?: number;

  spellDurationBonus?: number;
  spellDurationMultiplier?: number;

  backstabMultiplier?: number;
  // [key: `${string}Multiplier`]: number | undefined;

  extraAttacksPerTurn?: number;

  resurrectable?: boolean;

  tempHp?: number;
  damageReduction?: number;
  reflectDamagePercent?: number;
  reflectSpellChance?: number;

  invisible?: boolean;
  seeInvisible?: boolean;
  // todo recognizeIllusions?: boolean;
  extraTurns?: number;

  untargetable?: boolean;
  triggerReactions?: boolean;

  // polymorph
  displayName?: string;
  displayClass?: string;
  effectiveStats?: {
    str?: number;
    dex?: number;
    con?: number;
    int?: number;
    wis?: number;
    cha?: number;
    ac?: number;
    // damage?: string;
    // attackDie?: number;
    maxHp?: number;
  };
  effectiveAbilities?: string[];
  mayUseItems?: boolean;

  // noncombat
  examineBonus?: number;
  searchBonus?: number;
  pickLockBonus?: number;
  disarmTrapBonus?: number;
  lootBonus?: number;

  xpMultiplier?: number;
  goldMultiplier?: number;
  consumableMultiplier?: number;

  controlledActions?: boolean;

  // do we actually use this anywhere??? we need it for poly now though
  // maxHp?: number;
  attackDie?: string;

  hasPrimaryAttack?: boolean;
}

export interface StatusEffect {
  name: string;
  description?: string;
  effect: StatusModifications;  //{ [key: string]: any };
  duration?: number;
  by?: Combatant;
  whileEnvironment?: string;
  aura?: boolean;
  planar?: boolean;
  equipment?: boolean;

  condition?: {
    weapon?: { weight?: 'light' | 'medium' | 'heavy' };
  }

  trigger?: {
    damage?: string;
  }

  saveKind?: SaveKind;

  sourceKey?: string; // where this status came from (e.g. equipment slot, ability name, etc)
}

type StatusDictionary = { [key: string]: StatusEffect };
export default class StatusHandler {
  statusDictionary: StatusDictionary = {}
  loaded: boolean = false;

  static instance: StatusHandler = new StatusHandler();

  async loadStatuses() {
    if (this.loaded) {return;}
    const statuses: StatusDictionary = await Files.readJSON<StatusDictionary>("./settings/fantasy/statuses.json");
    this.statusDictionary = statuses;
    this.loaded = true;
  }

  triggersForDamageType(damageType: string): string[] {
    const triggers: string[] = [];
    for (const [statusName, status] of Object.entries(this.statusDictionary)) {
      if (status.trigger && status.trigger.damage === damageType) {
        triggers.push(statusName);
      }
    }
    return triggers;
  }

  getStatus(statusName: string): StatusEffect | undefined {
    return this.statusDictionary[statusName];
  }

  get statusList(): StatusEffect[] {
    return Object.values(this.statusDictionary);
  }

  dereference(statusNameOrObject: string | StatusEffect): StatusEffect | null {
    if (typeof statusNameOrObject === "string") {

      const status = this.getStatus(statusNameOrObject);
      if (!status) {
        console.warn(`Status "${statusNameOrObject}" not found in status dictionary.`);
        return null;
      }
      return status;
    } else {
      return statusNameOrObject;
    }
  }
}