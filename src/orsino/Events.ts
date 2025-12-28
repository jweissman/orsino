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
export type TurnStartEvent = BaseEvent & { type: "turnStart", combatants: Combatant[] };

export type HitEvent = BaseEvent & { type: "hit"; damage: number; success: boolean; critical: boolean; by: string; damageKind: DamageKind };
export type DamageBonus = BaseEvent & { type: "damageBonus"; amount: number; damageKind: DamageKind; reason: string };
export type DamageReduction = BaseEvent & { type: "damageReduction"; amount: number; damageKind: DamageKind; reason: string };
export type DamageAbsorb = BaseEvent & { type: "tempHpAbsorb"; amount: number; source: string };
export type CritEvent = BaseEvent & { type: "crit"; damage: number; by: string; damageKind: DamageKind };
export type MissEvent = BaseEvent & { type: "miss"; };
export type KillEvent = BaseEvent & { type: "kill"; };
export type FallenEvent = BaseEvent & { type: "fall" };
export type FleeEvent = BaseEvent & { type: "flee" };

export type ActedRandomly = BaseEvent & { type: "actedRandomly" };
export type HealEvent = BaseEvent & { type: "heal"; amount: number };
export type DefendEvent = BaseEvent & { type: "defend"; bonusAc: number };
export type QuaffEvent = BaseEvent & { type: "quaff" };
export type SummonEvent = BaseEvent & { type: "summon" };
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

export type StatusEffectEvent = BaseEvent & { type: "statusEffect"; effectName: string; effect: StatusModifications; duration: number };
export type StatusExpireEvent = BaseEvent & { type: "statusExpire"; effectName: string };
export type StatusExpiryPreventedEvent = BaseEvent & { type: "statusExpiryPrevented"; reason: string };

export type ActionEvent = BaseEvent & { type: "action"; actionName: string };

export type CombatEvent =
  | ActionEvent
  | ActedRandomly
  | HitEvent
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
  | QuaffEvent
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
export type ItemFoundEvent = BaseDungeonEvent & { type: "itemFound"; itemName: string; quantity: number; where: string; };
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
  townName: string; race: string; size: string; population: number; adjective: string; season: "spring" | "summer" | "autumn" | "winter";
};
export type ShopEnteredEvent = BaseModuleEvent & { type: "shopEntered"; shopName: string; };
export type GoldStatusEvent = BaseModuleEvent & { type: "goldStatus"; amount: number; };
export type PurchaseEvent = BaseModuleEvent & { type: "purchase"; itemName: string; cost: number; buyer: Combatant; };
export type SaleEvent = BaseModuleEvent & { type: "sale"; itemName: string; revenue: number; seller: Combatant; };
export type EquipmentEvent = BaseModuleEvent & { type: "equip"; itemName: string; slot: EquipmentSlot; wearerId: string; wearerName: string };
export type AcquireItemEvent = BaseModuleEvent & { type: "acquire"; itemName: string; quantity: number; acquirer: Combatant; };
export type WieldEvent = BaseModuleEvent & { type: "wield"; weaponName: string; wielderId: string; wielderName: string; };

export type RumorHeardEvent = BaseModuleEvent & { type: "rumorHeard"; rumor: string; };
export type TempleVisitedEvent = BaseModuleEvent & { type: "templeVisited"; templeName: string; blessingsGranted: string[]; itemsRecharged: string[]; };
export type CampaignStopEvent = BaseModuleEvent & { type: "campaignStop"; reason: string; at: Timestamp; };
export type PartyOverviewEvent = BaseModuleEvent & { type: "partyOverview"; pcs: Combatant[]; inventory: ItemInstance[] } //itemQuantities: { [itemName: string]: number }; };
export type HirelingOfferedEvent = BaseModuleEvent & { type: "hirelingOffered"; hireling: Combatant; cost: number; };
export type HirelingHiredEvent = BaseModuleEvent & { type: "hirelingHired"; hireling: Combatant; cost: number; };

export type ModuleEvent =
  | ModuleStartEvent
  | CampaignStartEvent
  | TownVisitedEvent
  | ShopEnteredEvent
  | GoldStatusEvent
  | PurchaseEvent
  | SaleEvent
  | EquipmentEvent
  | WieldEvent
  | AcquireItemEvent
  | RumorHeardEvent
  | TempleVisitedEvent
  | PartyOverviewEvent
  | HirelingOfferedEvent
  | HirelingHiredEvent
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

    switch (event.type) {
      case "engage":
        return '';
      case "enterDungeon":
        return `
        ${"=".repeat(80)}
        ${event.dungeonIcon}  ${Stylist.colorize(event.dungeonName.toUpperCase(), 'yellow')} (${event.depth} rooms)

          Your Goal: ${event.goal || "Unknown"}!
        ${"=".repeat(80)}
        `;
      case "leaveDungeon":
        return `You leave the dungeon.`;
      case "enterRoom":
        return Stylist.italic(event.roomDescription);

      case "roomCleared":
        if (event.combat) {
          return `The ${Words.humanize(event.room.room_type)} is pacified after combat. You have defeated ${Words.humanizeList(event.combat.enemyCombatants.map(c => c.referenceName || c.name))}.`;
        }
        return `The ${Words.humanize(event.room.room_type)} is pacified.`;
      case "investigate":
        return `${subjectName} examines ${event.clue} and discovers ${event.discovery}`;
      case "itemFound":
        if (event.quantity > 1) {
          return `Found ${event.quantity} x ${Words.a_an(event.itemName)} ${event.where}.`;
        }
        return `Found ${Words.a_an(event.itemName)} ${event.where}.`;
      case "equipmentWorn":
        return `${subjectName} is now wearing ${Words.a_an(event.itemName)} as their ${event.slot}.`;
      case "rest":
        if (event.stabilizedCombatants.length > 0) {
          return `Your party rests (${Words.humanizeList(event.stabilizedCombatants)} stabilized).`;
        }
        return `Your party rests.`;
      case "dungeonCleared":
        if (event.macguffin) {
          return `🎉 Victory! You have cleared the dungeon and secured ${Stylist.bold(event.macguffin)}!`;
        }
        return `Victory! You have cleared the dungeon!`;

      case "dungeonFailed":
        return `You have failed to cleanse ${event.dungeonName} of evil. ${event.reason}`;

      case "heal":
        if (subjectName === targetName) {
          return `${subjectName} heals themselves for ${event.amount} HP.`;
        } else {
          return `${subjectName} heals ${targetName} for ${event.amount} HP.`;
        }
      case "miss": return `${subjectName} attacks ${targetName} but misses.`;
      case "defend": return `${subjectName} takes a defensive stance, preparing to block incoming attacks.`;
      case "quaff": return `${subjectName} quaffs a healing potion.`;
      case "fall": return '';  //`${subjectName} falls.`;
      case "flee": return `${subjectName} flees from combat.`;
      case "statusEffect":
        return `${subjectName} is ${event.effectName} (${Presenter.describeModifications(event.effect)}).`
      case "statusExpire":
        return `${subjectName} is no longer ${event.effectName}.`;
      case "statusExpiryPrevented":
        return `${subjectName}'s status effects do not expire (${event.reason}).`;
      case "initiate":
        return '';
      case "roundStart":
        const roundLabel = ("Round " + event.turn.toString()).padEnd(20) + Stylist.colorize(event.environment?.padStart(60) || "Unknown Location", 'cyan');
        const parties = Presenter.parties(event.parties || []);
        const hr = "=".repeat(80);
        const auras = event.auras?.length > 0 ? "\n\nAuras:\n" + event.auras.map(aura => `- ${Stylist.colorize(aura.name, 'magenta')} (${Presenter.analyzeStatus(aura)})`).join("\n") : ""; 
        return `${hr}\n${roundLabel}\n${hr}\n${parties}${auras}`;
      case "turnStart":
        return '';
      case "combatEnd": return '';

      case "upgrade":
        return `${subjectName} upgrades ${event.stat} by ${event.amount} (now ${event.newValue}).`;

      case "learnAbility":
        return `${subjectName} learns the ability ${Words.a_an(event.abilityName)}.`;
      case "gainTrait":
        return `${subjectName} gains the trait ${Words.a_an(event.traitName)}.`;

      case "hit":
        let message = `${targetName} takes ${event.damage.toString()} ${event.damageKind} damage from ${event.by}.`;
        if (event.critical) { message += " Critical hit!"; }
        if (event.target?.playerControlled) {
          message = Stylist.colorize(message, 'red');
        } else if (event.subject?.playerControlled) {
          message = Stylist.colorize(message, 'green');
        }
        return message;

      case "damageBonus":
        return `${targetName} takes an additional ${event.amount} damage from ${subjectName} due to ${event.reason}.`;

      case "damageReduction":
        return `${subjectName} reduces damage taken by ${event.amount} due to ${event.reason}.`;

      case "tempHpAbsorb":
        return `${subjectName}'s ${event.source} absorbs ${event.amount} damage.`;

      case "reaction":
        return `${subjectName} reacts ${(event.reactionName)} from ${event.target?.forename}.`;
      case "summon":
        return `${subjectName} summons ${event.target?.referenceName || event.target?.forename}.`;
      case "unsummon":
        return `${subjectName} unsummons ${event.target?.referenceName || event.target?.forename}.`;
      case "save":
        if (event.immune) {
          return `${subjectName} is immune to ${event.versus}.`; // and automatically succeeds on their Save vs ${event.versus} (DC ${event.dc}).`;
        } else if (event.success) {
          // return '';  //`${subjectName} succeeds on their Save vs ${event.versus} (DC ${event.dc}).`;
          return `${subjectName} resists the ${event.versus} effect.`;
        } else {
          // return `${subjectName} fails their Save vs ${event.versus} (DC ${event.dc}).`;
          return '';
        }

      case "resurrect":
        return `${subjectName} is resurrected with ${event.amount} HP.`;

      case "gold":
        if (event.amount === 0) {
          return '';
        } else {
          if (event.amount === 1) {
            return `${subjectName} acquires 1 gold piece.`;
          }
          return `${subjectName} acquires ${event.amount} gold pieces.`;
        }

      case "xp":
        if (event.amount === 0) {
          return '';
        }
        return `${subjectName} gains ${event.amount} experience points.`;
      case "kill":
        if (subjectName === targetName || !targetName) {
          return `${subjectName} has been defeated!`;
        }
        return `${subjectName} has defeated ${targetName}!`;
      case "crit":
        return "";

      case "spellTurned":
        return `${subjectName} turns the spell ${event.spellName} cast by ${targetName}.`;

      case "untargetable":
        return `${subjectName} is untargetable by ${targetName}'s ${event.abilityName}.`;

      case "resist":
        return `${subjectName} resists, taking ${event.finalDamage} ${event.damageKind} damage (originally ${event.originalDamage}) due to ${event.sources.join(", ")}.`;

      case "vulnerable":
        return `${subjectName} is vulnerable and takes ${event.finalDamage} ${event.damageKind} damage (originally ${event.originalDamage}) due to ${event.sources.join(", ")}.`;
      case "wait":
        return `${subjectName} waits and watches.`;
      case "inactive":
        return `${subjectName} is ${event.statusName} and skips their turn! (${event.duration !== undefined ? event.duration + " turns left" : "duration unknown"})`;
      case "allegianceChange":
        return `${subjectName} is under the effect of ${event.statusName} and has switched sides.`;
      case "itemUsed":
        if (event.chargesLeft !== undefined) {
          return `${subjectName} uses ${Words.a_an(event.itemName)}. (${event.chargesLeft} charges left)`;
        } else if (event.countLeft !== undefined) {
          return `${subjectName} uses ${Words.a_an(event.itemName)}. (${event.countLeft} remaining)`;
        } else {
          return `${subjectName} uses ${Words.a_an(event.itemName)}.`;
        }
      case "action":
        return Stylist.bold(`\n${subjectName} ${event.actionName}.`);

      case "actedRandomly":
        return `${subjectName} is acting erratically.`;

      case "riddlePosed":
        return `${subjectName} is posed the riddle: "${event.challenge}".`;

      case "riddleSolved":
        return `${subjectName} has solved the riddle: "${event.challenge}" (answer: ${event.solution}) and receives ${Words.a_an(event.reward.name)}.`;

      case "trapDetected":
        return `${subjectName} detects ${Words.a_an(event.trapDescription)}.`;

      case "trapTriggered":
        return `${subjectName} accidentally triggers ${Words.a_an(Words.humanize(event.trigger))}! ${event.punishmentDescription}.`;
        
      case "trapDisarmed":
        if (event.success) {
          return `${subjectName} successfully disarms ${Words.a_an(Words.humanize(event.trigger))}.`;
        } else {
          return `${subjectName} fails to disarm ${Words.a_an(Words.humanize(event.trigger))}.`;
        }

      case "campaignStart":
        return Stylist.bold(`You embark on a new campaign!\nParty Members: ${event.pcs.map(pc => Presenter.combatant(pc)).join("\n")
          }`);
      case "moduleStart":
        return Stylist.bold(`You embark on the module '${event.moduleName}' with ${Words.humanizeList(event.pcs.map(pc => pc.forename))
          }`);
      case "shopEntered":
        return Stylist.bold(`Entered ${event.shopName}'s shop.`);
      case "goldStatus":
        return `Current gold: ${Words.humanizeNumber(event.amount)} gp.`;
      case "townVisited":
        return (`It is the ${Words.ordinal(1 + (event.day % 90))} day of ${event.season} in the ${event.adjective} ${Words.capitalize(event.race)} ${event.size} of ${Stylist.bold(event.townName)} on the plane of ${Words.capitalize(event.plane)} (Population: ${Words.humanizeNumber(event.population)}). The weather is currently ${event.weather}.`);
      case "purchase":
        return `${event.buyer.forename} purchased ${Words.a_an(event.itemName)} for ${event.cost} gold.`;
      case "sale":
        return `${event.seller.forename} sold ${Words.a_an(event.itemName)} for ${event.revenue} gold.`;
      case "equip":
        return `${event.wearerName} equips ${Words.a_an(event.itemName)} as their ${event.slot}.`;
      case "wield": 
        return `${event.wielderName} wields ${Words.a_an(event.weaponName)}!`;
      case "acquire":
        if (event.quantity === 1) {
          return `${event.acquirer.forename} acquires ${Words.a_an(event.itemName)}.`;
        } else {
          return `${event.acquirer.forename} acquires ${event.quantity} x ${Words.a_an(event.itemName)}.`;
        }
      case "rumorHeard":
        return `The tavern buzzes with news: "${event.rumor}"`;
      case "templeVisited":
        if (event.blessingsGranted.length === 0 && event.itemsRecharged.length === 0) {
          return `You pray at ${event.templeName}, but receive no blessings or item recharges.`;
        }
        let templeMessage = "You pray at " + event.templeName + ". ";
        if (event.blessingsGranted.length > 0) {
          templeMessage += `Blessings granted: ${event.blessingsGranted.join(", ")}. `;
        }
        if (event.itemsRecharged.length > 0) {
          templeMessage += `Items recharged: ${event.itemsRecharged.join(", ")}.`;
        }
        return templeMessage;
      case "partyOverview":
        const records = [];
        for (const pc of event.pcs) {
          records.push(await Presenter.characterRecord(pc, Inventory.propertyOf(pc, event.inventory) || []));
        }
        let overview = Stylist.bold(`Party Overview:\n${records.join("\n\n")}\n\n`);
        const sharedItems = Inventory.sharedItems(event.inventory);
        if (sharedItems.length > 0) {
          overview += Stylist.bold("Shared Inventory: ") + Presenter.aggregateList(sharedItems.sort((a, b) => a.name.localeCompare(b.name)).map(i => i.name)) + "\n";
        }
        // if (event.itemQuantities && Object.keys(event.itemQuantities).length > 0) {
          // overview += `Inventory:\n${Object.entries(event.itemQuantities).map(([itemName, qty]) => `- ${qty} x ${Words.humanize(itemName)}`).join("\n")
            // }`
        // }
        return overview;
      case "hirelingOffered":

        return `A hireling is available: ${await Presenter.characterRecord(event.hireling, [])} for ${event.cost} gold per month.`;
      case "hirelingHired":
        return `${event.hireling.forename} has joined your party as a hireling for ${event.cost} gold per month.`;
      case "campaignStop":
        return Stylist.bold(`Campaign ended: ${event.reason || `at ${event.at}`}`);

      case "teleport":
        return `${subjectName} is teleported to ${event.location}.`;

      case "planeshift":
        return `${subjectName} plane shifts to ${event.plane}.`;

      default:
        return never(event);
    }
  }

  static async appendToLogfile(event: GameEvent) {
    let logFilename = `log/game-${new Date().toISOString().split('T')[0]}.txt`;
    if (Orsino.environment === 'test') {
      logFilename = `log/game-${new Date().toISOString().split('T')[0]}.test.txt`;
    }
    let logMessage = await Events.present(event);
    // strip ANSI codes
    logMessage = logMessage.replace(/[\u001b\u009b][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]/g, '');
    if (!logMessage || logMessage.trim() === '') {
      return;
    }

    await Files.append(logFilename, logMessage + '\n');
  }
}