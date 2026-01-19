import { Driver } from "./Driver";
import { Commands } from "./rules/Commands";
import { Fighting } from "./rules/Fighting";
import { StatusModifications } from "./Status";
import Presenter from "./tui/Presenter";
import { Combatant } from "./types/Combatant";
import { GameState } from "./types/GameState";

type SkillType = "search" | "examine" | "disarm" | "gatherInformation"; // | "pickLock" | "climb" | "swim" | "jump" | "listen" | "spot";

export default class SkillCheck {
  constructor(
    private readonly gameState: GameState,
    private readonly driver: Driver,
  ) {}

  async skillCheck(type: SkillType, action: string, stat: keyof Combatant, dc: number, valid: (c: Combatant) => boolean = (): boolean => true): Promise<{
    actor: Combatant;
    success: boolean;
  }> {
    const team = this.gameState.party;
    const validCombatants = team.filter(c => valid(c) && c.hp > 0);
    if (validCombatants.length === 0) {
      console.warn(`No valid combatants available for ${action}`);
      return { actor: team[0], success: false };
    }
    const actor = await this.driver.select(`Who will attempt ${action}?`, validCombatants.map(c => ({
      name: `${c.name} ${Presenter.stat(stat, c[stat] as number)} (${Presenter.statMod(c[stat] as number)})`,
      value: c,
      short: c.name,
      disabled: c.hp <= 0
    })));
    if (!actor) {
      // throw new Error(`No valid actor selected for ${action}`);
      console.warn(`No valid actor selected for ${action}`);
      return { actor: team[0], success: false };
    }

    const actorFx = Fighting.gatherEffects(actor);
    const skillBonusName = `${type}Bonus` as keyof StatusModifications;
    const skillBonus = actorFx[skillBonusName] as number || 0;
    const skillMod = Fighting.statMod(actor[stat] as number);

    // this.note(`${actor.name} attempts ${action} with modifier ${skillMod}` + (skillBonus > 0 ? ` and +${skillBonus} bonus.` : '.'));
    const mustRollValueOrHigher = dc - skillMod - skillBonus;
    const roll = Commands.roll(actor, action + ` (must roll ${mustRollValueOrHigher} or better)`, 20);
    const total = roll.amount + skillMod + skillBonus;
    return { actor, success: total >= dc };
  }
}