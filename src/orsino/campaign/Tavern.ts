import { Dungeon } from "../Dungeoneer";
import { AllRumorsHeardEvent, DonationEvent, ModuleEvent, PurchaseEvent, RumorHeardEvent } from "../Events";
import CharacterRecord from "../rules/CharacterRecord";
import SkillCheck from "../rules/SkillCheck";
import SystemShock from "../rules/SystemShock";
import Automatic from "../tui/Automatic";
import Words from "../tui/Words";
import { CombatantID } from "../types/Combatant";
import { never } from "../util/never";
import TownFeature from "./TownFeature";

type TavernService
  = 'drink'
  // | 'gamble'
  | 'hire'
  | 'converse'
  | 'rooms'

export default class Tavern extends TownFeature<TavernService> {
  get services(): Record<TavernService, () => Promise<ModuleEvent[]>> {
    return {
      drink: this.barkeep.bind(this),
      rooms: this.hostel.bind(this),
      // gamble: this.cardsTable.bind(this),
      hire: this.hirelingBoard.bind(this),
      converse: this.commonRoom.bind(this),
    };
  }

  serviceName(type: TavernService): string {
    switch (type) {
      case 'drink': return "Barkeep";
      // case 'gamble': return "Cards Table";
      case 'hire': return "Hireling Board";
      case 'converse': return "Common Room";
      case 'rooms': return "Hostel";
      default: return never(type);
    }
  }

  serviceApplicable(serviceType: TavernService): boolean {
    switch (serviceType) {
      case 'drink':
        return this.gold >= 2;
      // case 'gamble':
      //   return true;
      case 'hire':
        return this.campaignModule?.town.tavern?.hirelings.length ? true : false;
      case 'converse':
        return this.availableDungeons.length > 0;
      case 'rooms':
        return this.gold >= 5;
      default:
        return never(serviceType);
    }
  }

  private async barkeep(): Promise<ModuleEvent[]> {
    const events: ModuleEvent[] = [];
    if (this.gold < 2) {
      console.warn("Not enough gold to buy a drink.");
      return Promise.resolve(events);
    }
    const drinkerId = await this.pickPartyMember("Who is buying a drink?");
    if (drinkerId === null) {
      return Promise.resolve(events);
    }
    const drinker = this.findPartyMember(drinkerId);
    events.push({ type: "purchase", itemName: "beverage", cost: 2, subject: drinker, day: this.day });
    events.push({
      type: "drink", subject: drinker, amount: 1, day: this.day,
      beverage: "ale"
    });
    // console.warn(`${drinker.forename} buys a drink for 2 gold...`);
    return Promise.resolve(events);
  }

  get campaignModule() {
    return this.gameState.campaignModule;
  }

  get availableDungeons(): Dungeon[] {
    if (!this.campaignModule) { return []; }
    return this.campaignModule.dungeons.filter(d => d.dungeonIndex && !this.campaignModule.completedDungeons.includes(d.dungeonIndex));
  }

  private async commonRoom(): Promise<ModuleEvent[]> {
    const available = this.availableDungeons.filter(d => d.dungeonIndex && !this.campaignModule.discoveredDungeons.includes(d.dungeonIndex));
    if (available.length === 0) {
      return Promise.resolve([
        { type: "allRumorsHeard", subject: this.party[0], day: this.day } as AllRumorsHeardEvent
      ]);
    }

    const howMuchToSpend = await this.driver.select<number>(
      "How much gold are you spending to gather information?",
      [
        { name: "5 gold", short: "5g", value: 5, disabled: this.gold < 5 },
        { name: "10 gold", short: "10g", value: 10, disabled: this.gold < 10 },
        { name: "25 gold", short: "25g", value: 25, disabled: this.gold < 25 },
        { name: "50 gold", short: "50g", value: 50, disabled: this.gold < 50 },
        { name: "100 gold", short: "100g", value: 100, disabled: this.gold < 100 },
        { name: "Cancel", short: "Cancel", value: 0, disabled: false },
      ]
    );

    const dc = 18 - Math.floor(howMuchToSpend / 10);
    // if (howMuchToSpend >= 10) { dc = 15; }
    // if (howMuchToSpend >= 25) { dc = 10; }
    // if (howMuchToSpend >= 50) { dc = 5; }
    // if (howMuchToSpend >= 100) { dc = 2; }
    const skillCheck = new SkillCheck(this.gameState, this.driver);
    const { actor: gatherInformationActor, success } = await skillCheck.perform(
      "gatherInformation",
      "gathering information in the tavern",
      "wis",
      dc,
      () => true
    );

    if (!success) {
      return Promise.resolve([
        {
          type: "purchase",
          subject: gatherInformationActor,
          itemName: `unsuccessful information gathering attempt`,
          cost: howMuchToSpend,
          day: this.day,
        } as PurchaseEvent,
      ]);
    }


    const index = Math.floor(Math.random() * available.length);
    const rumor = available[index].rumor;
    return Promise.resolve([
      {
        type: "donation",
        subject: gatherInformationActor,
        description: `Gathering information in the tavern`,
        amount: howMuchToSpend,
        day: this.day,
      } as DonationEvent,
      {
        subject: gatherInformationActor,
        type: "rumorHeard",
        rumor,
        day: this.day,
        dungeonIndex: available[index].dungeonIndex
      } as RumorHeardEvent
    ])
  }

  private async hirelingBoard(): Promise<ModuleEvent[]> {
    const cost = 100;
    const partySize = this.party.length;
    if (partySize >= 6 || this.gold < cost) {
      return [];
    }
    const hirelings = this.campaignModule.town.tavern?.hirelings || [];
    if (hirelings.length === 0) {
      return [];
    }
    const hireling = hirelings[Math.floor(Math.random() * hirelings.length)];
    hireling.level = 1;
    hireling.gp = 0;
    await CharacterRecord.chooseTraits(hireling); //, Automatic.randomSelect.bind(Automatic));
    const race = hireling.race;
    const charClass = hireling.class;
    if (!race || !charClass) {
      throw new Error("Hireling generation failed!");
    }
    const wouldLikeHireling = await this.driver.confirm(
      `A ${Words.humanize(race)} ${Words.humanize(charClass)} named ${hireling.forename} is looking for work. Would you like to interview them?`,
    );

    if (!wouldLikeHireling) {
      return [];
    }

    const hirelingDescription = CharacterRecord.describe(hireling);
    const hirelingIntro = CharacterRecord.introduce(hireling);

    this.driver.writeLn(`${hirelingDescription}\n\n${hireling.forename} says: "${hirelingIntro} I would be honored to join your party for a fee of ${cost} gold."`);

    const events: ModuleEvent[] = [({
      type: "hirelingOffered",
      hireling,
      cost,
      day: this.day,
    })];

    const choice: boolean = await this.driver.confirm(`Would you like to hire ${hireling.name} for ${cost}?`);

    if (choice) {
      events.push({
        type: "hirelingHired",
        hireling,
        cost,
        day: this.day,
      });
    }

    return events;
  }

  private async hostel(): Promise<ModuleEvent[]> {
    const events: ModuleEvent[] = [];
    const roomCost = 5;
    if (this.gold < roomCost) {
      console.warn("Not enough gold to rent a room.");
      return Promise.resolve(events);
    }
    const renterId = await this.pickPartyMember("Who is renting a room?");
    if (renterId === null) {
      return Promise.resolve(events);
    }
    const renter = this.findPartyMember(renterId);
    events.push({ type: "purchase", itemName: "room rental", cost: roomCost, subject: renter, day: this.day });

    const healedCombatantIds: CombatantID[] = [];
    const stabilizedCombatantIds: CombatantID[] = [];
    const diedCombatantIds: CombatantID[] = [];
    for (const pc of this.party) {
      if (pc.hp <= 0) {
        const stabilization = new SystemShock(this.gameState, this.driver);
        const { died } = await stabilization.perform(pc.id);
        if (!died) {
          stabilizedCombatantIds.push(pc.id);
        } else {
          diedCombatantIds.push(pc.id);
        }
      } else if (!pc.dead) {
        healedCombatantIds.push(pc.id);
      }
    }

    events.push({
      type: "rest",
      subject: renter,
      cost: 8,
      restType: "long",
      stabilizedCombatantIds,
      healedCombatantIds,
      diedCombatantIds
    });

    return events;
  }
}