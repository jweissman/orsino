import { ModuleEvent } from "../Events";
import { Inventory } from "../Inventory";
import Stylist from "../tui/Style";
import Words from "../tui/Words";
import { availableDungeons, Quest } from "../types/GameState";
import { never } from "../util/never";
import TownFeature from "./TownFeature";

type TownHallService = "quest" | "guild" | "tournament";

export default class TownHall extends TownFeature<TownHallService> {
  get services(): Record<TownHallService, (options?: { [key: string]: string[]; }) => Promise<ModuleEvent[]>> {
    return {
      quest: this.questBoard.bind(this),
      guild: this.guildHall.bind(this),
      tournament: this.tournament.bind(this),
    };
  }

  serviceName(type: TownHallService): string {
    switch (type) {
      case 'quest': return "Quest Board";
      case 'guild': return "Guild Hall";
      case 'tournament': return "Tournament";
      default: return never(type);
    }
  }

  serviceApplicable(serviceType: TownHallService): boolean {
    switch (serviceType) {
      case 'quest':
        return this.gameState.activeQuest === undefined || this.gameState.activeQuest === null;
      case 'guild':
        return true;
      case 'tournament':
        return false;  // this.gameState.campaignModule.town.tournament?.active || false;
      default:
        return never(serviceType);
    }
  }

  private get hall() { return this.gameState.campaignModule.town.townHall; }
  private get dungeons() { return availableDungeons(this.gameState); }

  async questBoard(): Promise<ModuleEvent[]> {
    const dungeon = this.dungeons[0];
    const goldReward = Math.round(1000 * Math.ceil(dungeon.intendedCr / 5));
    const quest: Quest = {
      name: dungeon.quest_name,
        // `Seal the ${dungeon.dungeon_name}`,
      description: `The ${dungeon.dungeon_type} to the ${dungeon.direction} has been a source of trouble for the town. We need brave adventurers to venture inside, defeat the monsters within, and seal it off once and for all!` + (dungeon.macguffin ? ` It is said that a ${Words.humanize(dungeon.macguffin)} can be found within, which might be of interest to you adventurers.` : "") + ` Good hunting! Your reward will be ${goldReward} gold if you succeed.`,
      difficulty: dungeon.intendedCr,
      dungeonIndex: dungeon.dungeonIndex,
      reward: {
        gold: goldReward,
        items: [ Inventory.reifyFromKey("healing_potion") ]
      }
    };

    this.driver.writeLn(`The magistrate ${this.hall.magistrate.name} greets you as you enter the town hall. They inform you about a new quest.\n"${Stylist.italic(quest.description)}"`);
    if (await this.driver.confirm("Do you want to accept this quest?")) {
      return [{ type: "questAccepted", quest, day: this.day, subject: this.hall.magistrate }];
    }
    // return Promise.resolve([]);
    this.driver.writeLn("You decide not to take on the quest at this time. The magistrate nods understandingly and encourages you to check back later for more opportunities.");
    return [];
  }

  guildHall(): Promise<ModuleEvent[]> {
    this.driver.writeLn("The guild hall is currently under construction. Please check back later.");
    return Promise.resolve([]);
  }

  tournament(): Promise<ModuleEvent[]> {
    this.driver.writeLn("The tournament is currently under construction. Please check back later.");
    return Promise.resolve([]);
  }
}