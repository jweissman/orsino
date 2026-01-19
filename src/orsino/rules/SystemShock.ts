import { Driver } from "../Driver";
import { CombatantID } from "../types/Combatant";
import { GameState } from "../types/GameState";
import { Commands } from "./Commands";
import { Fighting } from "./Fighting";

export default class SystemShock {
  constructor(
    private readonly gameState: GameState,
    private readonly driver: Driver,
  ) { }

  async perform(subjectId: CombatantID): Promise<{ died: boolean }> {
    let died = false;
    const c = this.gameState.party.find(c => c.id === subjectId);
    if (!c) {
      throw new Error(`SystemShock.perform: could not find combatant with id ${subjectId}`);
    }
    const conMod = Fighting.statMod(c.con);
    const proceed = await this.driver.confirm(`Would you like to attempt to stabilize ${c.name}? This cannot be undone.`);
    if (!proceed) {
      return { died: false };
    }
    let systemShockDc = 10;
    systemShockDc += conMod;
    const systemShockRoll = Commands.roll(c, `System Shock Save (DC ${systemShockDc})`, 20);
    const total = systemShockRoll.amount;
    if (total < systemShockDc) {
      died = true;
    }
    return { died };
  }
}