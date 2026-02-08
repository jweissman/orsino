import { CampaignModule } from "../ModuleRunner";
import { Combatant } from "./Combatant";
import { ItemInstance } from "./ItemInstance";

export interface Quest {
  name: string;
  description: string;
  difficulty: number;
  dungeonIndex: number;
  reward: {
    gold: number;
    items?: ItemInstance[];
  }
}

export interface GameState {
  day: number;
  party: Combatant[];
  sharedGold: number;
  inventory: Array<ItemInstance>;
  campaignModule: CampaignModule;
  activeQuest?: Quest;
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

const availableDungeons = (gameState: GameState) => {
  if (!gameState.campaignModule) { return []; }
  return gameState.campaignModule.dungeons.filter(d => d.dungeonIndex && !gameState.campaignModule.completedDungeons.includes(d.dungeonIndex));
}

export { newGameState, availableDungeons };