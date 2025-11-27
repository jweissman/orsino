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
export type CombatEndEvent = BaseEvent & { type: "combatEnd"; winner: string };

export type RoundStartEvent = BaseEvent & { type: "roundStart", combatants: Combatant[] };
export type TurnStartEvent = BaseEvent & { type: "turnStart", combatants: Combatant[] };

export type HitEvent = BaseEvent & { type: "hit"; damage: number; success: boolean; critical: boolean; by: string };
export type MissEvent = BaseEvent & { type: "miss"; };
export type HealEvent = BaseEvent & { type: "heal"; amount: number };
export type DefendEvent = BaseEvent & { type: "defend"; bonusAc: number };
export type QuaffEvent = BaseEvent & { type: "quaff" };
export type FallenEvent = BaseEvent & { type: "fall" };
export type FleeEvent   = BaseEvent & { type: "flee" };
export type SummonEvent = BaseEvent & { type: "summon"; summoned: Combatant[] };

export type StatusEffectEvent = BaseEvent & { type: "statusEffect"; effectName: string; effect: { [key: string]: any }; duration: number };
export type StatusExpireEvent = BaseEvent & { type: "statusExpire"; effectName: string };

export type CombatEvent = HitEvent
  | MissEvent
  | HealEvent
  | DefendEvent
  | InitiateCombatEvent
  | QuaffEvent
  | FallenEvent
  | FleeEvent
  | StatusEffectEvent
  | StatusExpireEvent
  | SummonEvent
  | CombatEndEvent
  | RoundStartEvent
  | TurnStartEvent;

type BaseDungeonEvent = Omit<BaseEvent, "turn">;
export type EnterDungeon = BaseDungeonEvent & { type: "enterDungeon"; dungeonName: string; dungeonIcon: string; dungeonType: string, depth: number };
export type RoomCleared  = BaseDungeonEvent & { type: "roomCleared"; };
export type UpgradeEvent = BaseEvent & { type: "upgrade"; stat: keyof Combatant; amount: number, newValue: number };

export type DungeonEvent = EnterDungeon
  | RoomCleared
  | UpgradeEvent;

export type GameEvent = CombatEvent | DungeonEvent;

export default class Events {
  static iconForEvent(event: GameEvent): string {
    switch (event.type) {
      case "enterDungeon": return event.dungeonIcon;
      case "roomCleared": return "🗝️";
      case "miss": return "❌";
      case "heal": return "💖";
      case "defend": return "🛡️";
      case "quaff": return "🧪";
      case "fall": return "💤";
      case "flee": return "🏃‍♂️";
      case "statusEffect": return "✨";
      case "statusExpire": return "⏳";
      case "initiate": return "⚔️";
      case "roundStart": return "🔄";
      case "turnStart": return "➡️";
      case "combatEnd": return "🏁";
      case "upgrade": return "⬆️";
      case "hit": return event.critical ? "💥" : "⚔️";
      case "summon": return "😽";
      default: return never(event);
    }
  }

  static present(event: GameEvent): string {
    let subjectName = event.subject ? event.subject.forename : null;
    let targetName = event.target ? event.target.forename : null;
    switch (event.type) {
      case "enterDungeon":
        return `${"=====".repeat(8)}\n${event.dungeonIcon} ${event.dungeonName.toUpperCase()}\n\n  * ${event.depth}-room ${event.dungeonType}\n${"=====".repeat(8)}`;
      case "roomCleared": return `The room is pacified.`;

      case "heal":
        if (subjectName === targetName) {
          return `${subjectName} heals themselves for ${event.amount} HP.`;
        } else {
          return `${subjectName} heals ${targetName} for ${event.amount} HP.`;
        }
      case "miss": return `${subjectName} attacks ${targetName} but misses.`;
      case "defend": return `${subjectName} takes a defensive stance, preparing to block incoming attacks.`;
      case "quaff": return `${subjectName} quaffs a healing potion.`;
      case "fall": return `${subjectName} falls unconscious.`;
      case "flee": return `${subjectName} flees from combat.`;
      case "statusEffect":
        if (event.effect.by && event.effect.by.forename !== subjectName) {
          return `${subjectName} is ${event.effectName} by ${event.effect.by.forename}.`
        }
        return `${subjectName} is ${event.effectName}.`
      case "statusExpire":
        if (event.effectName === "Poisoned Blade") {
          return `${subjectName}'s blade is no longer coated in poison.`;
        }
        return `${subjectName} is no longer ${event.effectName}.`;
      case "initiate":
        return `Turn order: ${event.order.map((o, i) => `${i + 1}. ${o.combatant.forename}`).join(" | ")}`;
      case "roundStart":
        // let heading = `\n=== Round ${event.turn} ===`;
        // let combatants = event.combatants.map(c => `\n- ${Presenter.combatant(c)}`).join("");
        // return `${heading}${combatants}`;
        // return `\n=== Round ${event.turn} ===\n${Presenter.combatants(event.combatants)}`;
        return `It is round ${event.turn}.`;
      case "turnStart":
        // let heading = `It's ${subject}'s turn!`;
        // let combatants = event.combatants.map(c => `\n- ${Presenter.combatant(c)}`).join("");
        // return `${heading}${combatants}`;
        return event.subject?.playerControlled ?
          `${subjectName}'s turn\n${Presenter.combatants(event.combatants, true)}` : `It's ${Presenter.combatant(event.subject!)}'s turn!`;
      case "combatEnd": return `Combat ends! ${event.winner} victorious.`;

      case "upgrade":
        return `${subjectName} upgrades ${event.stat} by ${event.amount} (now ${event.newValue})!`;

      case "hit":
        let message = `${targetName} takes ${event.damage} damage from ${event.by}.`;
        if (event.critical) {
          message += " Critical hit!";
        }
        if (event.target?.playerControlled) {
          message = Stylist.colorize(message, 'red');
        } else if (event.subject?.playerControlled) {
          message = Stylist.colorize(message, 'green');
        }
        return message;

      case "summon":
        return `${subjectName} summons ${event.summoned.map(s => s.name).join(", ")}!`;
      default:
        return never(event);
    }
  }
}