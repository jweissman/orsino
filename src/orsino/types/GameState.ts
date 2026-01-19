import { CampaignModule } from "../ModuleRunner";
import { Combatant } from "./Combatant";
import { ItemInstance } from "./ItemInstance";

export interface GameState {
  day: number;
  party: Combatant[];
  sharedGold: number;
  inventory: Array<ItemInstance>;
  campaignModule: CampaignModule;
}

const newGameState = ({ party, sharedGold, inventory, mod }: {
  party: Combatant[];
  sharedGold: number;
  inventory: ItemInstance[];
  mod: CampaignModule;
}): GameState => ({
  day: 1,
  party,
  sharedGold,
  inventory,
  campaignModule: {
    ...mod,
    completedDungeons: [],
    discoveredDungeons: [],
  }
});

export { newGameState };