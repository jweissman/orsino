import { Driver } from "../Driver";
import { ItemRechargedEvent, ModuleEvent } from "../Events";
import { Deity } from "../ModuleRunner";
import { StatusEffect } from "../Status";
import { GameState } from "../types/GameState";

type TempleStepResult =
  | { done: true; events: ModuleEvent[] }
  | { done: false; events: ModuleEvent[] }

type TempleServiceType = 'resurrection' | 'blessing' | 'recharge';
export default class Temple {

  constructor(
    private readonly deity: Deity,
    private driver: Driver
  ) { }

  private readonly gameState!: GameState;
  private leaving = false;
  private currentGold: number = 0;

  get gold() { return this.currentGold }
  get party() { return this.gameState.party; }

  get feeSchedule() {
    return {
      blessing: 10,
      recharge: 25,
      resurrection: 100,
    }
  }

  async interact(gameState: GameState): Promise<TempleStepResult> {
    // @ts-expect-error single mutation of game state
    this.gameState = gameState;
    this.currentGold = gameState.sharedGold;

    const services: Record<TempleServiceType, () => Promise<ModuleEvent[]>> = {
      resurrection: this.resurrectionService.bind(this),
      blessing: this.blessingService.bind(this),
      recharge: this.rechargeService.bind(this),
    }
    const serviceApplicable: Record<TempleServiceType, boolean> = {
      resurrection: this.party.some(pc => pc.dead),
      blessing: true,
      recharge: this.gameState.inventory.some(i => i.maxCharges !== undefined && i.charges && i.charges < i.maxCharges),
    }
    const serviceTypes = Object.keys(services) as TempleServiceType[];
    const serviceOptions = serviceTypes.map(s => ({
      name: s.charAt(0).toUpperCase() + s.slice(1) + " Service",
      short: s.charAt(0).toUpperCase() + s.slice(1),
      value: s,
      disabled: !serviceApplicable[s] || this.currentGold < this.feeSchedule[s],
    }));
    const selectedServiceType: TempleServiceType | 'leave' = await this.driver.select<TempleServiceType | 'leave'>("Choose a service:", [
      ...serviceOptions,
      { name: "Leave Temple", short: "Leave", value: 'leave', disabled: false },
    ]);
    if (selectedServiceType === 'leave') {
      this.leaving = true;
      return { done: this.leaving, events: [] };
    }
    const events: ModuleEvent[] = await services[selectedServiceType].bind(this)()
    return { done: this.leaving, events  };
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
            this.currentGold -= rezCost;
            // pc.dead = false;
            // pc.hp = Math.max(1, Math.floor(Fighting.effectiveStats(pc).maxHp * 0.5));
            // pc.spellSlotsUsed = 0;
            // pc.activeEffects = [];
            // blessingsGranted.push(`${pc.name} was resurrected by ${deityName}`);
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

    const offerDonation = await this.driver.confirm(
      `The Temple of ${deityName} offers blessings for ${this.feeSchedule.blessing}g. Would you like to make a donation?`
    );
    if (offerDonation) {
      this.currentGold -= this.feeSchedule.blessing;
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
    this.currentGold -= this.feeSchedule.recharge;

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

  /**
   * const mod = this.mod;
    const deityName = mod.town.deity.name;
    const blessingsGranted: string[] = [];

    const offerDonation = await this.select(
      `The Temple of ${Words.capitalize(deityName)} offers blessings for 10g. Wands will also be recharged. Would you like to make a donation?`,
      [
        { short: "Yes", value: true, name: `Donate to ${deityName} Temple`, disabled: this.sharedGold < 10 },
        { short: "No", value: false, name: "Decline", disabled: false },
      ]
    ) as unknown as boolean;

    if (offerDonation) {
      this.state.sharedGold -= 10;
      const effect = mod.town.deity.blessing;
      const duration = 10;
      const blessingName = `${mod.town.deity.forename}'s Favor`;
      const blessing: StatusEffect = {
        name: blessingName,
        type: "buff",
        description: "Blessed by " + Words.capitalize(deityName),
        duration, effect, aura: false
      };
      blessing.description = Presenter.describeStatusWithName(blessing);
      // this.outputSink(`You pray to ${Words.capitalize(mod.town.deity)}.`);
      this.pcs.forEach(pc => {
        pc.activeEffects = pc.activeEffects || [];
        if (!pc.activeEffects.some(e => e.name === blessingName)) {
          pc.activeEffects.push(blessing);
          blessingsGranted.push(`Blessings of ${deityName} upon ${pc.name}`);
        }
      });
      // recharge wands/staves
      for (const item of this.state.inventory) {
        if (item.maxCharges !== undefined) {
          item.charges = item.maxCharges;
        }
      }
    }

    let anyDead = this.pcs.some(pc => pc.dead);
    const rezCost = 100;
    if (anyDead) {
      for (const pc of this.pcs) {
        if (pc.dead) {
          const choice = await this.select(
            `${pc.name} is dead. Would you like to be resurrected for ${rezCost}g?`,
            [
              { short: "Yes", value: true, name: `Resurrect ${pc.forename}`, disabled: this.sharedGold < rezCost },
              { short: "No", value: false, name: "Decline resurrection", disabled: false },
            ]
          ) as unknown as boolean;

          if (choice) {
            this.state.sharedGold -= rezCost;
            pc.dead = false;
            pc.hp = Math.max(1, Math.floor(Fighting.effectiveStats(pc).maxHp * 0.5));
            pc.spellSlotsUsed = 0;
            pc.activeEffects = [];
            blessingsGranted.push(`${pc.name} was resurrected by ${deityName}`);
          }
        }
      };
    }

    await this.emit({
      type: "templeVisited", templeName: `${mod.town.townName} Temple of ${Words.capitalize(deityName)}`, day: this.days,
      blessingsGranted,
      itemsRecharged: this.state.inventory
        .filter(i => i.maxCharges !== undefined)
        .map(i => i.name),
    });
  }
   */
}