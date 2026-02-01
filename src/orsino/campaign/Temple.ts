import { ItemRechargedEvent, ModuleEvent } from "../Events";
import { StatusEffect } from "../Status";
import Words from "../tui/Words";
import { never } from "../util/never";
import TownFeature from "./TownFeature";

type TempleServiceType = 'resurrection' | 'blessing' | 'recharge';
export default class Temple extends TownFeature<TempleServiceType> {
  get deity() {
    return this.gameState.campaignModule.town.deity;
  }

  get feeSchedule() {
    return {
      blessing: 1,
      recharge: 10,
      resurrection: 50
    }
  }

  services: Record<TempleServiceType, () => Promise<ModuleEvent[]>> = {
    resurrection: this.resurrectionService.bind(this),
    blessing: this.blessingService.bind(this),
    recharge: this.rechargeService.bind(this),
  };

  serviceName(type: TempleServiceType): string {
    switch (type) {
      case 'resurrection': return "Resurrection";
      case 'blessing': return "Prayer";
      case 'recharge': return "Recharge Wands/Items";
      default: return never(type);
    }
  }

  async enter(): Promise<ModuleEvent[]> {
    const town = this.gameState.campaignModule.town;
    const templeName = `${town.townName} Temple of ${Words.capitalize(town.deity.name)}`;
    return Promise.resolve([({ type: "templeEntered", templeName, day: this.day })]);
  }

  serviceApplicable(serviceType: TempleServiceType): boolean {
    if (this.gold < (this.feeSchedule)[serviceType]) {
      return false;
    }

    switch (serviceType) {
      case 'resurrection':
        return this.party.some(pc => pc.dead);
      case 'blessing':
        return true;
      case 'recharge':
        return this.gameState.inventory.some(i => i.maxCharges !== undefined && i.charges && i.charges < i.maxCharges);
      default:
        return never(serviceType);
    }
  }

  private async resurrectionService(): Promise<ModuleEvent[]> {
    const events: ModuleEvent[] = [];
    const anyDead = this.party.some(pc => pc.dead);
    const rezCost = 100;
    if (anyDead) {
      for (const pc of this.party) {
        if (pc.dead) {
          const choice = await this.driver.confirm(
            `${pc.name} is dead. Would you like to attempt resurrection for ${rezCost}g?`,
          );

          if (choice) {
            events.push({
              type: "donation",
              description: `Resurrection of ${pc.name}`,
              amount: rezCost,
              subject: pc,
              deityName: this.deity.name,
              day: this.gameState.day,
            })
            events.push({
              type: "resurrectionService",
              subject: pc,
              cost: rezCost,
              day: this.gameState.day,
            });
          }
        }
      };
    }
    return events;
  }

  private async blessingService(): Promise<ModuleEvent[]> {
    const events: ModuleEvent[] = [];
    const deityName = this.deity.name;
    const blessingsGranted: string[] = [];

    // do we have enough gold?
    if (this.gold < this.feeSchedule.blessing) {
      return events;
    }

    const offerDonation = await this.driver.confirm(
      `The Temple of ${deityName} offers blessings for ${this.feeSchedule.blessing}g. Would you like to make a donation?`
    );
    if (offerDonation) {
      const effect = this.deity.blessing;
      const duration = 10;
      const blessingName = `${this.deity.forename}'s Favor`;

      events.push({
        type: "donation",
        description: `Blessing from ${deityName}`,
        amount: this.feeSchedule.blessing,
        subject: this.party[0],
        deityName: this.deity.name,
        day: this.gameState.day,
      });

      const blessing: StatusEffect = {
        name: blessingName,
        type: "buff",
        description: "Blessed by " + deityName,
        duration, effect, aura: false
      };
      for (const pc of this.party) {
        events.push({
          type: "blessingGranted",
          subject: pc,
          blessing: blessing,
          day: this.gameState.day,
        });
        blessingsGranted.push(`Blessings of ${deityName} upon ${pc.name}`);
      }
    }
    return events;
  }

  private async rechargeService(): Promise<ModuleEvent[]> {
    const events: ModuleEvent[] = [];

    events.push({
      type: "donation",
      description: `Recharge Service`,
      amount: this.feeSchedule.recharge,
      subject: this.party[0],
      deityName: this.deity.name,
      day: this.gameState.day,
    });

    for (const item of this.gameState.inventory) {
      if (item.maxCharges !== undefined && item.charges && item.charges < item.maxCharges) {
        events.push({
          type: "itemRecharged",
          itemName: item.name,
          subject: this.party[0],
          day: this.gameState.day,
          chargesBefore: item.charges,
          chargesAfter: item.maxCharges,
          itemId: item.id,
        } as ItemRechargedEvent);
      }
    }

    return Promise.resolve(events);
  }
}