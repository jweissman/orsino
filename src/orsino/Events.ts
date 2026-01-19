import { DamageKind } from "./types/DamageKind";
import { never } from "./util/never";
import Presenter from "./tui/Presenter";
import Stylist from "./tui/Style";
import { Combatant, EquipmentSlot } from "./types/Combatant";
import { Team } from "./types/Team";
import Orsino from "../orsino";
import Files from "./util/Files";
import Words from "./tui/Words";
import { BossRoom, Room } from "./Dungeoneer";
import Combat from "./Combat";
import { StatusEffect, StatusModifications } from "./Status";
import { ItemInstance } from "./types/ItemInstance";
import { Inventory } from "./Inventory";
import { Fighting } from "./rules/Fighting";

type BaseEvent = {
  turn: number;
  subject?: Combatant;
  target?: Combatant;
};

export type InitiateCombatEvent = BaseEvent & { type: "initiate", order: { combatant: Combatant; initiative: number }[] };
export type CombatantEngagedEvent = BaseEvent & { type: "engage" };

export type CombatEndEvent = BaseEvent & { type: "combatEnd"; winner: string };

export type RoundStartEvent = BaseEvent & { type: "roundStart", combatants: Combatant[], parties: Team[]; environment?: string, auras: StatusEffect[] };
export type TurnStartEvent = BaseEvent & { type: "turnStart", combatants: Combatant[], parties: Team[]; environment?: string, auras: StatusEffect[] };

export type HitEvent = BaseEvent & { type: "hit"; damage: number; success: boolean; critical: boolean; by: string; damageKind: DamageKind };
export type DamageBonus = BaseEvent & { type: "damageBonus"; amount: number; damageKind: DamageKind; reason: string };
export type DamageReduction = BaseEvent & { type: "damageReduction"; amount: number; damageKind: DamageKind; reason: string };
export type DamageAbsorb = BaseEvent & { type: "tempHpAbsorb"; amount: number; source: string };
export type CritEvent = BaseEvent & { type: "crit"; damage: number; by: string; damageKind: DamageKind };
export type MissEvent = BaseEvent & { type: "miss"; };
export type KillEvent = BaseEvent & { type: "kill"; };
export type FallenEvent = BaseEvent & { type: "fall" };
export type FleeEvent = BaseEvent & { type: "flee" };

export type CastEvent = BaseEvent & { type: "cast"; spellName: string; source?: string };

export type ActedRandomly = BaseEvent & { type: "actedRandomly" };
export type HealEvent = BaseEvent & { type: "heal"; amount: number };
export type DefendEvent = BaseEvent & { type: "defend"; bonusAc: number };
export type SummonEvent = BaseEvent & { type: "summon", source?: string };
export type UnsummonEvent = BaseEvent & { type: "unsummon" };
export type SaveEvent = BaseEvent & { type: "save"; success: boolean; dc: number; immune: boolean; reason: string; versus: string; };
export type ReactionEvent = BaseEvent & { type: "reaction"; reactionName: string; success: boolean };
export type ResurrectEvent = BaseEvent & { type: "resurrect"; amount: number; };

export type WaitEvent = BaseEvent & { type: "wait" };
export type NoActionsForCombatant = BaseEvent & { type: "inactive"; statusName: string; duration?: number; };
export type AllegianceChangeEvent = BaseEvent & { type: "allegianceChange"; statusName: string };
export type ItemUsedEvent = BaseEvent & { type: "itemUsed"; itemName: string; chargesLeft?: number; countLeft?: number; };

export type SpellTurnedEvent = BaseEvent & { type: "spellTurned"; spellName: string };
export type UntargetableEvent = BaseEvent & { type: "untargetable"; abilityName: string };

export type ResistantEvent = BaseEvent & { type: "resist"; damageKind: DamageKind; originalDamage: number; finalDamage: number; sources: string[] };
export type VulnerableEvent = BaseEvent & { type: "vulnerable"; damageKind: DamageKind; originalDamage: number; finalDamage: number; sources: string[] };

export type StatusEffectEvent = BaseEvent & { type: "statusEffect"; effectName: string; effect: StatusModifications; duration: number; source: string };
export type StatusExpireEvent = BaseEvent & { type: "statusExpire"; effectName: string };
export type StatusExpiryPreventedEvent = BaseEvent & { type: "statusExpiryPrevented"; reason: string };

export type ActionEvent = BaseEvent & { type: "action"; actionName: string };

export type CombatEvent =
  | ActionEvent
  | ActedRandomly
  | HitEvent
  | CastEvent
  | DamageBonus
  | DamageReduction
  | DamageAbsorb
  | CombatantEngagedEvent
  | KillEvent
  | CritEvent
  | WaitEvent
  | SpellTurnedEvent
  | UntargetableEvent
  | NoActionsForCombatant
  | AllegianceChangeEvent
  | ItemUsedEvent
  | MissEvent
  | HealEvent
  | DefendEvent
  | InitiateCombatEvent
  | FallenEvent
  | FleeEvent
  | StatusEffectEvent
  | StatusExpireEvent
  | StatusExpiryPreventedEvent
  | SummonEvent
  | UnsummonEvent
  | SaveEvent
  | ReactionEvent
  | ResurrectEvent
  | ResistantEvent
  | VulnerableEvent
  | CombatEndEvent
  | RoundStartEvent
  | TurnStartEvent;

type BaseDungeonEvent = Omit<BaseEvent, "turn">;
export type EnterDungeon = BaseDungeonEvent & { type: "enterDungeon"; dungeonName: string; dungeonIcon: string; dungeonType: string, depth: number, goal: string };
export type LeaveDungeon = BaseDungeonEvent & { type: "leaveDungeon"; };
export type EnterRoom = BaseDungeonEvent & { type: "enterRoom"; roomDescription: string; };
export type RoomCleared = BaseDungeonEvent & { type: "roomCleared"; room: Room | BossRoom; combat?: Combat };
export type DungeonCleared = BaseDungeonEvent & { type: "dungeonCleared"; macguffin?: string; };
export type DungeonFailed = BaseDungeonEvent & { type: "dungeonFailed"; dungeonName: string; reason: string; };
export type ItemFoundEvent = BaseDungeonEvent & { type: "itemFound"; itemName: string; itemDescription: string; quantity: number; where: string; };
export type EquipmentWornEvent = BaseDungeonEvent & { type: "equipmentWorn"; itemName: string; slot: EquipmentSlot; };
export type RestEvent = BaseDungeonEvent & { type: "rest"; stabilizedCombatants: string[]; };
export type GoldEvent = BaseDungeonEvent & { type: "gold"; amount: number };
export type ExperienceEvent = BaseDungeonEvent & { type: "xp"; amount: number };
export type InvestigateEvent = BaseDungeonEvent & { type: "investigate"; clue: string; discovery: string; };

export type RiddlePosedEvent = BaseDungeonEvent & { type: "riddlePosed"; challenge: string; };
export type RiddleSolvedEvent = BaseDungeonEvent & { type: "riddleSolved"; challenge: string; solution: string; reward: ItemInstance; };

export type TrapDetectedEvent = BaseDungeonEvent & { type: "trapDetected"; trapDescription: string; };
export type TrapTriggeredEvent = BaseDungeonEvent & { type: "trapTriggered"; trigger: string; trapDescription: string; punishmentDescription: string; };
export type TrapDisarmedEvent = BaseDungeonEvent & { type: "trapDisarmed"; trapDescription: string; success: boolean; trigger: string };

export type UpgradeEvent = BaseDungeonEvent & { type: "upgrade"; stat: keyof Combatant; amount: number, newValue: number };
export type LearnedAbilityEvent = BaseDungeonEvent & { type: "learnAbility"; abilityName: string; };
export type GainedTraitEvent = BaseDungeonEvent & { type: "gainTrait"; traitName: string; };

export type TeleportEvent = BaseDungeonEvent & { type: "teleport"; location: string; };
export type PlaneshiftEvent = BaseDungeonEvent & { type: "planeshift"; plane: string; };

export type DungeonEvent =
  | EnterDungeon
  | EnterRoom
  | RoomCleared
  | LeaveDungeon
  | DungeonCleared
  | DungeonFailed
  | ItemFoundEvent
  | RestEvent
  | EquipmentWornEvent
  | InvestigateEvent
  | RiddlePosedEvent
  | RiddleSolvedEvent
  | TrapDetectedEvent
  | TrapTriggeredEvent
  | TrapDisarmedEvent
  | GoldEvent
  | ExperienceEvent
  | UpgradeEvent
  | LearnedAbilityEvent
  | TeleportEvent
  | PlaneshiftEvent
  | GainedTraitEvent;

type Timestamp = string;

type BaseModuleEvent = Omit<BaseEvent, "turn"> & { day: number; };

export type CampaignStartEvent = BaseModuleEvent & { type: "campaignStart"; pcs: Combatant[]; at: Timestamp };
export type ModuleStartEvent = BaseModuleEvent & { type: "moduleStart"; moduleName: string; pcs: Combatant[]; at: Timestamp };
export type TownVisitedEvent = BaseModuleEvent & {
  type: "townVisited";
  plane: string;
  weather: string;
  townName: string;
  race: string; size: string; population: number; adjective: string;
  season: "spring" | "summer" | "autumn" | "winter";
  translatedTownName: string;
};

export type GoldStatusEvent = BaseModuleEvent & { type: "goldStatus"; amount: number; };

export type TempleEnteredEvent = BaseModuleEvent & { type: "templeEntered"; templeName: string; };
export type DonationEvent = BaseModuleEvent & { type: "donation"; amount: number; deityName: string; description: string; };
export type RezServiceEvent = BaseModuleEvent & { type: "resurrectionService"; cost: number; };
export type BlessServiceEvent = BaseModuleEvent & { type: "blessingGranted"; blessing: StatusEffect; };
export type ItemRechargedEvent = BaseModuleEvent & { type: "itemRecharged"; itemName: string; itemId: string; chargesBefore: number; chargesAfter: number };

export type ShopEnteredEvent = BaseModuleEvent & { type: "shopEntered"; shopName: string; };
export type PurchaseEvent = BaseModuleEvent & { type: "purchase"; itemName: string; cost: number; }; // buyer: Combatant; };
export type SaleEvent = BaseModuleEvent & { type: "sale"; itemName: string; revenue: number; seller: Combatant; };
export type EquipmentEvent = BaseModuleEvent & { type: "equip"; itemName: string; itemKey: string; slot: EquipmentSlot; wearerId: string; wearerName: string };
export type AcquireItemEvent = BaseModuleEvent & { type: "acquire"; itemName: string; itemKey: string; quantity: number }; //; acquirer: Combatant; };
export type WieldEvent = BaseModuleEvent & { type: "wield"; weaponName: string; weaponKey: string; wielderId: string; wielderName: string; };

export type EnhanceWeaponEvent = BaseModuleEvent & { type: "enhanceWeapon"; weaponName: string; weaponKey: string;  weaponId?: string; wielderId: string; wielderName: string; enhancement: string; cost: number; oldDamage: string; newDamage: string; };

// export type TempleVisitedEvent = BaseModuleEvent & { type: "templeVisited"; templeName: string; };
export type CampaignStopEvent = BaseModuleEvent & { type: "campaignStop"; reason: string; at: Timestamp; };
export type PartyOverviewEvent = BaseModuleEvent & { type: "partyOverview"; pcs: Combatant[]; inventory: ItemInstance[] } //itemQuantities: { [itemName: string]: number }; };
export type CharacterOverviewEvent = BaseModuleEvent & { type: "characterOverview"; pc: Combatant; inventory: ItemInstance[] } //itemQuantities: { [itemName: string]: number }; };

export type DrinkEvent = BaseModuleEvent & { type: "drink"; amount: number; beverage?: string; };
export type AllRumorsHeardEvent = BaseModuleEvent & { type: "allRumorsHeard"; };
export type RumorHeardEvent = BaseModuleEvent & { type: "rumorHeard"; rumor: string; dungeonIndex: number };
export type HirelingOfferedEvent = BaseModuleEvent & { type: "hirelingOffered"; hireling: Combatant; cost: number; };
export type HirelingHiredEvent = BaseModuleEvent & { type: "hirelingHired"; hireling: Combatant; cost: number; };

export type ModuleEvent =
  | ModuleStartEvent
  | CampaignStartEvent
  | TownVisitedEvent
  | ShopEnteredEvent
  | TempleEnteredEvent
  | DonationEvent
  | RezServiceEvent
  | BlessServiceEvent
  | ItemRechargedEvent

  | GoldStatusEvent
  | PurchaseEvent
  | SaleEvent
  | EquipmentEvent
  | WieldEvent

  | EnhanceWeaponEvent
  | AcquireItemEvent
  | DrinkEvent
  | RumorHeardEvent
  | AllRumorsHeardEvent
  | HirelingOfferedEvent
  | HirelingHiredEvent

  | PartyOverviewEvent
  | CharacterOverviewEvent
  | CampaignStopEvent

export type GameEvent = CombatEvent | DungeonEvent | ModuleEvent

export default class Events {
  static async present(event: GameEvent): Promise<string> {
    let subjectName = event.subject ? event.subject.forename : null;
    if (event.subject) {
      const subjectEffects = Fighting.gatherEffects(event.subject);
      if (subjectEffects.displayName) {
        subjectName = subjectEffects.displayName;
      }
    }
    let targetName = event.target ? event.target.forename : null;
    if (event.target) {
      const targetEffects = Fighting.gatherEffects(event.target);
      if (targetEffects.displayName) {
        targetName = targetEffects.displayName;
      }
    }

    let message: string;

    switch (event.type) {
      case "engage":
        message = '';
        break;

      case "enterDungeon":
        message = `
        ${"=".repeat(80)}
        ${event.dungeonIcon}  ${Stylist.colorize(event.dungeonName.toUpperCase(), 'yellow')} (${event.depth} rooms)

          Your Goal: ${event.goal || "Unknown"}!
        ${"=".repeat(80)}
        `;
        break;

      case "leaveDungeon":
        message = `You leave the dungeon.`;
        break;

      case "enterRoom":
        message = Stylist.italic(event.roomDescription);
        break;

      case "roomCleared":
        if (event.combat) {
          message = `The ${Words.humanize(event.room.room_type)} is pacified after combat. You have defeated ${Words.humanizeList(event.combat.enemyCombatants.map(c => c.referenceName || c.name))}.`;
        } else {
          message = `The ${Words.humanize(event.room.room_type)} is pacified.`;
        }
        break;

      case "investigate":
        message = `${subjectName} examines ${event.clue} and discovers ${event.discovery}`;
        break;

        // i think we still need this?
      case "itemFound":
        if (event.quantity > 1) {
          message = `${subjectName} found ${event.quantity} x ${Words.a_an(event.itemName)} ${event.where}.`;
        } else {
          message = `${subjectName} found ${event.itemName.toLocaleLowerCase()} ${event.where}.`;
        }
        break;

      case "acquire":
        if (event.quantity === 1) {
          message = `${subjectName} receives ${Words.a_an(event.itemName)}.`;
        } else {
          message = `${subjectName} receives ${event.quantity} x ${Words.a_an(event.itemName)}.`;
        }
        break;

      case "equipmentWorn":
        message = `${subjectName} is now wearing ${Words.a_an(event.itemName)} as their ${event.slot}.`;
        break;

      case "rest":
        if (event.stabilizedCombatants.length > 0) {
          message = `Your party rests (${Words.humanizeList(event.stabilizedCombatants)} stabilized).`;
        } else {
          message = `Your party rests.`;
        }
        break;

      case "dungeonCleared":
        if (event.macguffin) {
          message = `🎉 Victory! You have cleared the dungeon and secured ${Stylist.bold(event.macguffin)}!`;
        } else {
          message = `Victory! You have cleared the dungeon!`;
        }
        break;

      case "dungeonFailed":
        message = `You have failed to cleanse ${event.dungeonName} of evil. ${event.reason}`;
        break;

      case "heal":
        if (subjectName === targetName) {
          message = `${subjectName} heals themselves for ${event.amount} HP.`;
        } else {
          message = `${subjectName} heals ${targetName} for ${event.amount} HP.`;
        }
        break;

      case "miss": message = `${subjectName} attacks ${targetName} but misses.`; break;
      case "defend": message = `${subjectName} takes a defensive stance, preparing to block incoming attacks.`; break;
      case "fall": message = `${subjectName} is defeated.`; break;
      case "flee": message = `${subjectName} flees from combat.`; break;

      case "statusEffect":
        message = `${subjectName} is ${event.effectName} (${Presenter.describeModifications(event.effect)}) by ${event.source}.`
        break;

      case "statusExpire":
        message = `${subjectName} no longer has ${event.effectName}.`;
        break;

      case "statusExpiryPrevented":
        message = `${subjectName}'s status effects do not expire (${event.reason}).`;
        break;

      case "initiate":
        message = '';
        break;

      case "roundStart":
        message = ''; // Events.presentRound(event);
        break;

      case "turnStart":
        message = Events.presentTurn(event);
        break;

      case "combatEnd": message = ''; break;

      case "upgrade":
        message = `${subjectName} upgrades ${event.stat} by ${event.amount} (now ${event.newValue}).`;
        break;

      case "learnAbility":
        message = `${subjectName} learns the ability ${Words.a_an(event.abilityName)}.`;
        break;

      case "gainTrait":
        message = `${subjectName} gains the trait ${Words.a_an(event.traitName)}.`;
        break;

      case "hit":
        message = `${targetName} takes ${event.damage.toString()} ${event.damageKind} damage from ${event.by}.`;
        if (event.critical) { message += " Critical hit!"; }
        if (event.target?.playerControlled) {
          message = Stylist.colorize(message, 'red');
        } else if (event.subject?.playerControlled) {
          message = Stylist.colorize(message, 'green');
        }
        break;

      case "cast":
        message = `${subjectName} casts ${event.spellName} ${event.source ? `from ${event.source}` : ""}.`;
        break;

      case "damageBonus":
        message = `${targetName} takes an additional ${event.amount} damage from ${subjectName} due to ${event.reason}.`;
        break;

      case "damageReduction":
        message = `${subjectName} reduces damage taken by ${event.amount} due to ${event.reason}.`;
        break;

      case "tempHpAbsorb":
        message = `${subjectName}'s ${event.source} absorbs ${event.amount} damage.`;
        break;

      case "reaction":
        message = `${subjectName} reacts ${(event.reactionName)} from ${event.target?.forename}.`;
        break;

      case "summon":
        message = `${subjectName} summons ${event.target?.referenceName || event.target?.forename} ${event.source ? `from ${event.source}` : ""}.`;
        break;

      case "unsummon":
        message = `${subjectName} unsummons ${event.target?.referenceName || event.target?.forename}.`;
        break;

      case "save":
        if (event.immune) {
          message = `${subjectName} is immune to ${event.versus}.`;
        } else if (event.success) {
          message = `${subjectName} resists the ${event.versus} effect.`;
        } else {
          message = '';
        }
        break;

      case "resurrect":
        message = `${subjectName} is resurrected with ${event.amount} HP.`;
        break;

      case "gold":
        if (event.amount === 0) {
          message = '';
        } else {
          if (event.amount === 1) {
            message = `${subjectName} acquires 1 gold piece.`;
          } else {
            message = `${subjectName} acquires ${event.amount} gold pieces.`;
          }
        }
        break;

      case "xp":
        if (event.amount === 0) {
          message = '';
        } else {
          message = `${subjectName} gains ${event.amount} experience points.`;
        }
        break;

      case "kill":
        if (subjectName === targetName || !targetName) {
          message = `${subjectName} has been defeated!`;
        } else {
          message = `${subjectName} has defeated ${targetName}!`;
        }
        break;

      case "crit":
        message = "";
        break;

      case "spellTurned":
        message = `${subjectName} turns the spell ${event.spellName} cast by ${targetName}.`;
        break;

      case "untargetable":
        message = `${subjectName} is untargetable by ${targetName}'s ${event.abilityName}.`;
        break;

      case "resist":
        message = `${subjectName} resists, taking ${event.finalDamage} ${event.damageKind} damage (originally ${event.originalDamage}) due to ${event.sources.join(", ")}.`;
        break;

      case "vulnerable":
        message = `${subjectName} is vulnerable and takes ${event.finalDamage} ${event.damageKind} damage (originally ${event.originalDamage}) due to ${event.sources.join(", ")}.`;
        break;

      case "wait":
        message = `${subjectName} waits and watches.`;
        break;

      case "inactive":
        message = `${subjectName} is ${event.statusName} and skips their turn! (${event.duration !== undefined ? event.duration + " turns left" : "duration unknown"})`;
        break;

      case "allegianceChange":
        message = `${subjectName} is under the effect of ${event.statusName} and has switched sides.`;
        break;
      case "itemUsed":
        if (event.chargesLeft !== undefined) {
          message = `${subjectName} uses ${Words.a_an(event.itemName)}. (${event.chargesLeft} charges left)`;
        } else if (event.countLeft !== undefined) {
          message = `${subjectName} uses ${Words.a_an(event.itemName)}. (${event.countLeft} remaining)`;
        } else {
          message = `${subjectName} uses ${Words.a_an(event.itemName)}.`;
        }
        break;

      case "action":
        message = Stylist.bold(`\n${subjectName} ${event.actionName}.`);
        break;

      case "actedRandomly":
        message = `${subjectName} is acting erratically.`;
        break;

      case "riddlePosed":
        message = `${subjectName} is posed the riddle: "${event.challenge}".`;
        break;

      case "riddleSolved":
        message = `${subjectName} has solved the riddle: "${event.challenge}" (answer: ${event.solution}) and receives ${Words.a_an(event.reward.name)}.`;
        break;

      case "trapDetected":
        message = `${subjectName} detects ${Words.a_an(event.trapDescription)}.`;
        break;

      case "trapTriggered":
        message = `${subjectName} accidentally triggers ${Words.a_an(Words.humanize(event.trigger))}! ${event.punishmentDescription}.`;
        break;

      case "trapDisarmed":
        if (event.success) {
          message = `${subjectName} successfully disarms ${Words.a_an(Words.humanize(event.trigger))}.`;
        } else {
          message = `${subjectName} fails to disarm ${Words.a_an(Words.humanize(event.trigger))}.`;
        }
        break;

      case "campaignStart":
        message = Stylist.bold(`You embark on a new campaign!\nParty Members: ${event.pcs.map(pc => Presenter.combatant(pc)).join("\n")
          }`);
        break;

      case "moduleStart":
        message = Stylist.bold(`You embark on the module '${event.moduleName}' with ${Words.humanizeList(event.pcs.map(pc => pc.forename))
          }`);
        break;
      case "shopEntered":
        message = Stylist.bold(`Entered ${event.shopName}'s shop.`);
        break;

      case "templeEntered":
        message = Stylist.bold(`Entered the temple of ${event.templeName}.`);
        break;

      case "donation":
        message = `${subjectName} donates ${event.amount} gold to ${event.deityName} (${event.description}).`;
        break;

      case "resurrectionService":
        message = `${subjectName} uses a resurrection service for ${event.cost} gold.`;
        break;

      case "blessingGranted":
        message = `${subjectName} is granted the blessing: ${event.blessing.name}.`;
        break;

      case "itemRecharged":
        message = `${subjectName}'s ${event.itemName} is recharged from ${event.chargesBefore} to ${event.chargesAfter} charges.`;
        break;

      case "goldStatus":
        message = `Current gold: ${Words.humanizeNumber(event.amount)} gp.`;
        break;

      case "townVisited":
        message = (`It is the ${Words.ordinal(1 + (event.day % 90))} day of ${event.season} in the ${event.adjective} ${Words.capitalize(event.race)} ${event.size} of ${Stylist.bold(event.townName)}, which is ${event.translatedTownName}, on the plane of ${Words.capitalize(event.plane)} (Population: ${Words.humanizeNumber(event.population)}). The weather is currently ${event.weather}.`);
        break;

      case "purchase":
        // message = `${subjectName} purchased ${Words.a_an(event.itemName)} for ${event.cost} gold.`;
        message = `${subjectName} spent ${event.cost} gold on ${Words.a_an(event.itemName)}.`;
        break;

      case "sale":
        message = `${event.seller.forename} sold ${Words.a_an(event.itemName)} for ${event.revenue} gold.`;
        break;

      case "equip":
        message = `${event.wearerName} equips ${Words.a_an(event.itemName)} as their ${event.slot}.`;
        break;

      case "wield":
        message = `${event.wielderName} wields ${Words.a_an(event.weaponName)}!`;
        break;
      
      case "enhanceWeapon":
        message = `${event.wielderName} ${event.enhancement}s their ${Words.a_an(event.weaponName)}! Damage changed from ${event.oldDamage} to ${event.newDamage}).`;
        break;

      case "rumorHeard":
        message = `The tavern buzzes with news: "${event.rumor}"`;
        break;

      case "allRumorsHeard":
        message = `${subjectName} has heard all the rumors available in this town.`;
        break;

      case "drink":
        if (event.beverage) {
          message = `${subjectName} drinks ${event.amount} ${event.beverage}.`;
        } else {
          message = `${subjectName} drinks.`;
        }
        break;
      
      case "characterOverview":
        message = await Presenter.characterRecord(event.pc, event.inventory);
        break;

      case "partyOverview":
        message = await Events.presentOverview(event);
        break;

      case "hirelingOffered":
        message = '';
        break;

      case "hirelingHired":
        message = `${event.hireling.forename} has joined your party as a hireling for ${event.cost} gold per month.`;
        message += await Presenter.characterRecord(event.hireling, []);
        break;

      case "campaignStop":
        message = Stylist.bold(`Campaign ended: ${event.reason || `at ${event.at}`}`);
        break;

      case "teleport":
        message = `${subjectName} is teleported to ${event.location}.`;
        break;

      case "planeshift":
        message = `${subjectName} plane shifts to ${event.plane}.`;
        break;

      default:
        return never(event);
    }

    return message || '';
  }

  static async appendToLogfile(event: GameEvent) {
    let logFilename = `log/game-${new Date().toISOString().split('T')[0]}.txt`;
    if (Orsino.environment === 'test') {
      logFilename = `log/game-${new Date().toISOString().split('T')[0]}.test.txt`;
    }
    let logMessage = await Events.present(event);
    // strip ANSI codes
    logMessage = logMessage.replace(/[\\u001b\\u009b][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]/g, '');
    if (!logMessage || logMessage.trim() === '') {
      return;
    }

    await Files.append(logFilename, logMessage + '\n');
  }

  private static presentTurn(event: TurnStartEvent): string {
    const roundLabel = ("Round " + event.turn.toString()).padEnd(20) + Stylist.colorize(event.environment?.padStart(60) || "Unknown Location", 'cyan');
    const parties = Presenter.parties(event.parties || []);
    const hr = "=".repeat(80);
    const auras = event.auras?.length > 0 ? "\n\nAuras:\n" + event.auras.map(aura => `- ${Stylist.colorize(aura.name, 'magenta')} (${Presenter.analyzeStatus(aura)})`).join("\n") : "";
    return `${hr}\n${roundLabel}\n${hr}\n${parties}${auras}\n\n${Stylist.bold(`It's ${event.subject?.forename}'s turn!`)}`;
  }

  private static async presentOverview(event: PartyOverviewEvent): Promise<string> {
    const records = [];
    for (const pc of event.pcs) {
      records.push(await Presenter.characterRecord(pc, Inventory.propertyOf(pc, event.inventory) || []));
    }
    let message = Stylist.bold(`Party Overview:\n${records.join("\n\n")}\n\n`);
    const sharedItems = Inventory.sharedItems(event.inventory);
    if (sharedItems.length > 0) {
      message += Stylist.bold("Shared Inventory: ") + Presenter.aggregateList(sharedItems.sort((a, b) => a.name.localeCompare(b.name)).map(i => i.name)) + "\n";
    }
    return message;
  }
}