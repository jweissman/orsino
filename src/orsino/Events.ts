import Presenter from "./tui/Presenter";
import Stylist from "./tui/Style";
import { Combatant } from "./types/Combatant";

const never = <T>(_: never): T => {
  throw new Error("Unexpected value: " + _);
};

type BaseEvent = {
  turn: number;
  subject?: Combatant;
  target?: Combatant;
};

export type InitiateCombatEvent = BaseEvent & { type: "initiate", order: { combatant: Combatant; initiative: number }[] };
export type RoundStartEvent = BaseEvent & { type: "roundStart", combatants: Combatant[] };
export type CombatEndEvent = BaseEvent & { type: "combatEnd"; winner: string };
export type HitEvent = BaseEvent & { type: "hit"; damage: number; success: boolean; critical: boolean; by: string };
export type MissEvent = BaseEvent & { type: "miss"; };
export type HealEvent = BaseEvent & { type: "heal"; amount: number };
export type DefendEvent = BaseEvent & { type: "defend"; bonusAc: number };
export type QuaffEvent = BaseEvent & { type: "quaff" };
export type InspireEvent = BaseEvent & { type: "inspire"; target: Combatant; toHitBonus: number };
export type FallenEvent = BaseEvent & { type: "fall" };
export type FleeEvent = BaseEvent & { type: "flee" };
export type FearEvent = BaseEvent & { type: "fear" };
export type StumbleEvent = BaseEvent & { type: "stumble"; };
export type PoisonedBladeEvent = BaseEvent & { type: "poisoned_blade" };
export type PoisonCloudEvent = BaseEvent & { type: "poison_cloud" };
export type PoisoningEvent = BaseEvent & { type: "poisoned" };
export type PoisonDamageEvent = BaseEvent & { type: "poison" };
export type ScreamEvent = BaseEvent & { type: "scream" };

export type StatusExpireEvent = BaseEvent & { type: "statusExpire"; effectName: string };

export type CombatEvent = HitEvent
  | MissEvent
  | HealEvent
  | DefendEvent
  | InitiateCombatEvent
  | QuaffEvent
  | InspireEvent
  | FallenEvent
  | FleeEvent
  | FearEvent
  | StumbleEvent
  | StatusExpireEvent
  | PoisonedBladeEvent
  | PoisoningEvent
  | PoisonDamageEvent
  | PoisonCloudEvent
  | ScreamEvent
  | CombatEndEvent
  | RoundStartEvent;

type BaseDungeonEvent = Omit<BaseEvent, "turn">;
export type EnterDungeon = BaseDungeonEvent & { type: "enterDungeon"; dungeonName: string; dungeonIcon: string; dungeonType: string, depth: number };
export type RoomCleared  = BaseDungeonEvent & { type: "roomCleared"; };

export type DungeonEvent = EnterDungeon
  | RoomCleared;

type GameEvent = CombatEvent | DungeonEvent;

export default class Events {
  static present(event: GameEvent): string {
    let subject = event.subject ? event.subject.forename : null;
    let target = event.target ? event.target.forename : null;
    switch (event.type) {
      case "enterDungeon":
        return `${"=====".repeat(8)}\n${event.dungeonIcon} ${event.dungeonName.toUpperCase()}\n\n  * ${event.depth}-room ${event.dungeonType}\n${"=====".repeat(8)}`;
      case "roomCleared": return `The room is pacified.`;

      case "heal":
        if (subject === target) {
          return `${subject} heals themselves for ${event.amount} HP.`;
        } else {
          return `${subject} heals ${target} for ${event.amount} HP.`;
        }
      case "miss": return `${subject} attacks ${target} but misses.`;
      case "defend": return `${subject} takes a defensive stance, preparing to block incoming attacks.`;
      case "quaff": return `${subject} quaffs a healing potion.`;
      case "inspire": return `${subject} inspires ${target}, granting +${event.toHitBonus} to hit.`;
      case "fall": return `${subject} falls unconscious.`;
      case "flee": return `${subject} flees from combat.`;
      case "scream": return `${subject} lets out a terrifying scream!`;
      case "poison_cloud": return `${subject} shatters a capsule releasing a toxic cloud!`;
      case "fear": return `${subject} is frightened!`;
      case "stumble": return `${subject} stumbles and loses their footing!`;
      case "poisoned_blade": return `${subject} coats their blade with poison.`;
      case "poisoned": return `${subject} is poisoned!`;
      case "poison": return `${subject} suffers poison damage.`;
      case "statusExpire":
        if (event.effectName === "Poisoned Blade") {
          return `${subject}'s blade is no longer coated in poison.`;
        }
        return `${subject} is no longer ${event.effectName}.`;
      case "combatEnd": return `Combat ends! ${event.winner} victorious.`;
      case "initiate":
        return `Turn order: ${event.order.map((o, i) => `\n ${i + 1}. ${Presenter.combatant(o.combatant, true)} (init: ${o.initiative})`).join(", ")}`;
      case "roundStart":
        let heading = `\n=== Round ${event.turn} ===`;
        let combatants = event.combatants.map(c => `\n- ${Presenter.combatant(c, false)}`).join("");
        return `${heading}${combatants}`;
      case "hit":
        let message = `${target} takes ${event.damage} damage from ${event.by}.`;
        if (event.critical) {
          message += " Critical hit!";
        }
        if (event.target?.playerControlled) {
          message = Stylist.colorize(message, 'red');
        } else if (event.subject?.playerControlled) {
          message = Stylist.colorize(message, 'green');
        }
        return message;

      default:
        return never(event);
    }
  }
}