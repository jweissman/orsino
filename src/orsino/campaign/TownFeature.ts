import Choice from "inquirer/lib/objects/choice";
import { Driver } from "../Driver";
import { ModuleEvent } from "../Events";
import { Combatant, CombatantID } from "../types/Combatant";
import { GameState } from "../types/GameState";

type StepResult = { done: boolean; events: ModuleEvent[] };

export default abstract class TownFeature<ServiceType extends string> {
  constructor(protected driver: Driver, protected readonly gameState: GameState) {
  }

  get gold() { return this.gameState.sharedGold }
  get day() { return this.gameState.day }
  get party() { return this.gameState.party }

  abstract get services(): Record<ServiceType, () => Promise<ModuleEvent[]>>;
  abstract serviceName(type: ServiceType): string;

  serviceApplicable(_serviceType: ServiceType): boolean {
    return true;
  }

  protected leaving: boolean = false;

  async enter(): Promise<ModuleEvent[]> {
    return Promise.resolve([]);
  }

  async interact(serviceName?: ServiceType): Promise<StepResult> {
    this.leaving = false;
    if (serviceName) {
      const serviceAction = this.services[serviceName].bind(this);
      const events: ModuleEvent[] = await serviceAction();
      return { done: this.leaving, events };
    }
    const serviceChoices = Object.keys(this.services).map(s => ({
      // name: s.charAt(0).toUpperCase() + s.slice(1) + " Service",
      name: this.serviceName(s as ServiceType),
      short: s.charAt(0).toUpperCase() + s.slice(1),
      value: s,
      disabled: !this.serviceApplicable(s as ServiceType),
    })).concat([{ name: "Leave", short: "Leave", value: "leave", disabled: false }]);
    const serviceType = await this.driver.select<string>(`What would you like to do?`, serviceChoices);
    if (serviceType === "leave") {
      this.leaving = true;
      return { done: true, events: [] };
    }
    const serviceAction = this.services[serviceType as ServiceType].bind(this);
    const events: ModuleEvent[] = await serviceAction();
    return { done: this.leaving, events };
  }

  protected async pickPartyMember(
    prompt: string, presenter: (combatant: Combatant) => string = (combatant) => combatant.name
  ): Promise<CombatantID | null> {
    const pcOptions: Choice<Combatant>[] = this.party.map(pc => ({
      short: pc.name,
      value: pc.id,
      name: presenter(pc),
      disabled: false,
    }));
    const noOne: Choice = { short: "No one", value: null, name: "Cancel", disabled: false };
    pcOptions.push(noOne); 
    const pc = await this.driver.select(prompt, pcOptions) as CombatantID | null;
    return pc;
  }

  protected findPartyMember(id: CombatantID): Combatant {
    const pc = this.party.find(pc => pc.id === id);
    if (!pc) {
      throw new Error(`Party member with ID ${id} not found.`);
    }
    return pc;
  }
}