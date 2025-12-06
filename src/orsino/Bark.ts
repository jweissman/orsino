import Deem from "../deem";
import { GameEvent } from "./Events";

export default class Bark {
  static lastBark: string = "";
  static async lookup(event: Omit<GameEvent, "turn">): Promise<string> {
    let bark = await this.lookupPlayerBark(event)
            || await this.lookupNpcBark(event)
            || await this.lookupHumanoidBark(event);
    if (bark === this.lastBark) {
      // avoid repeating the same bark
      bark = "";
    }
    if (bark !== "") {
      this.lastBark = bark;
    }
    return bark;
  }

  static async lookupHumanoidBark(event: Omit<GameEvent, "turn">): Promise<string> {
    let bark = "";
    let onHookName = `on${event.type.charAt(0).toUpperCase()}${event.type.slice(1)}`;
    let onHookTargetName = `${onHookName}Received`;

    if (event.subject && event.subject.traits?.includes("humanoid")) {
      let hasEntry = await Deem.evaluate(`hasEntry(genericBarks, '${onHookName}')`);
      if (hasEntry) {
        bark = await Deem.evaluate(`lookup(genericBarks, '${onHookName}')`);
        bark = bark.replace(/{(.*?)}/g, (_, key) => {
          return event.subject ? (event.subject as any)[key] || `{${key}}` : `{${key}}`;
        });
      }
    } else if (event.target && event.target.traits?.includes("humanoid")) {
      let hasEntry = await Deem.evaluate(`hasEntry(genericBarks, '${onHookTargetName}')`);
      if (hasEntry) {
        bark = await Deem.evaluate(`lookup(genericBarks, '${onHookTargetName}')`);
        bark = bark.replace(/{(.*?)}/g, (_, key) => {
          return event.target ? (event.target as any)[key] || `{${key}}` : `{${key}}`;
        });
      }
    }

    return bark;
  }

  static async lookupPlayerBark(event: Omit<GameEvent, "turn">): Promise<string> {
    let bark = "";
    let onHookName = `on${event.type.charAt(0).toUpperCase()}${event.type.slice(1)}`;
    let onHookTargetName = `${onHookName}Received`;

    if (event.subject && event.subject.personality) {
      let hasEntry = await Deem.evaluate(`hasEntry(pcPersonalityBarks, '${event.subject.personality}')`);
      if (hasEntry) {
        let barks = await Deem.evaluate(`lookup(pcPersonalityBarks, '${event.subject.personality}')`);
        if (barks && barks[onHookName]) {
          let availableBarks = barks[onHookName];
          if (availableBarks.length > 1 && this.lastBark) {
            availableBarks = availableBarks.filter((b: string) => b !== this.lastBark);
          }
          bark = availableBarks[Math.floor(Math.random() * availableBarks.length)];

          // interpolate {keys} if present
          bark = bark.replace(/{(.*?)}/g, (_, key) => {
            return event.subject ? (event.subject as any)[key] || `{${key}}` : `{${key}}`;
          });
        }
      }
    } else if (event.target && event.target.personality) {
      let hasEntry = await Deem.evaluate(`hasEntry(pcPersonalityBarks, '${event.target.personality}')`);
      if (hasEntry) {
        let barks = await Deem.evaluate(`lookup(pcPersonalityBarks, '${event.target.personality}')`);
        if (barks && barks[onHookTargetName]) {
          let availableBarks = barks[onHookTargetName];
          if (availableBarks.length > 1 && this.lastBark) {
            availableBarks = availableBarks.filter((b: string) => b !== this.lastBark);
          }
          bark = availableBarks[Math.floor(Math.random() * availableBarks.length)];

          // bark = barks[onHookTargetName][Math.floor(Math.random() * barks[onHookTargetName].length)];

          // interpolate {keys} if present
          bark = bark.replace(/{(.*?)}/g, (_, key) => {
            return event.target ? (event.target as any)[key] || `{${key}}` : `{${key}}`;
          });
        }
      }
    }
    return bark;
  }


  static async lookupNpcBark(event: Omit<GameEvent, "turn">, avoidLast = true): Promise<string> {
    let onHookName = `on${event.type.charAt(0).toUpperCase()}${event.type.slice(1)}`;
    let onHookTargetName = `${onHookName}Received`;
    let npcBark = "";
    if (event.subject && event.subject.npc_type) {
      let hasEntry = await Deem.evaluate(`hasEntry(npcBarks, '${event.subject.npc_type}')`);
      if (hasEntry) {
        let barks = await Deem.evaluate(`lookup(npcBarks, '${event.subject.npc_type}')`);
        if (barks && barks[onHookName]) {
          let availableBarks = barks[onHookName];
          if (avoidLast && this.lastBark) {
            availableBarks = availableBarks.filter((b: string) => b !== this.lastBark);
          }
          // npcBark = barks[onHookName][Math.floor(Math.random() * barks[onHookName].length)];
          npcBark = availableBarks[Math.floor(Math.random() * availableBarks.length)];

          // interpolate {keys} if present
          npcBark = npcBark.replace(/{(.*?)}/g, (_, key) => {
            return event.subject ? (event.subject as any)[key] || `{${key}}` : `{${key}}`;
          });
        }
      }
    } else if (event.target && event.target.npc_type) {
      let hasEntry = await Deem.evaluate(`hasEntry(npcBarks, '${event.target.npc_type}')`);
      if (hasEntry) {
        let barks = await Deem.evaluate(`lookup(npcBarks, '${event.target.npc_type}')`);
        if (barks && barks[onHookTargetName]) {
          let availableBarks = barks[onHookTargetName];
          if (avoidLast && this.lastBark) {
            availableBarks = availableBarks.filter((b: string) => b !== this.lastBark);
          }
          npcBark = availableBarks[Math.floor(Math.random() * availableBarks.length)];
          // npcBark = barks[onHookTargetName][Math.floor(Math.random() * barks[onHookTargetName].length)];

          // interpolate {keys} if present
          npcBark = npcBark.replace(/{(.*?)}/g, (_, key) => {
            return event.target ? (event.target as any)[key] || `{${key}}` : `{${key}}`;
          });
        }
      }
    }
    // if (npcBark) {
    //   this.lastBark = npcBark;
    // }
    return npcBark;
  }


}