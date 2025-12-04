import AbilityHandler, { Ability } from "../Ability";
import Combat from "../Combat";
import Presenter from "../tui/Presenter";
import { Combatant } from "../types/Combatant";

type AbilityAnalysis = {
  attack: boolean;
  heal: boolean;
  damage: boolean;
  buff: boolean;
  debuff: boolean;
  defense: boolean;
  aoe: boolean;
  flee: boolean;
  summon: boolean;
  rez: boolean;
};

export class AbilityScoring {
  static bestAbilityTarget(ability: Ability, user: Combatant, allies: Combatant[], enemies: Combatant[]): Combatant | Combatant[] {
    let validTargets = AbilityHandler.validTargets(ability, user, allies, enemies);
    if (validTargets.length === 0 && !ability.target.includes("randomEnemies")) {
      // return null;
      throw new Error(`No valid targets for ${ability.name}`);
    } else if (validTargets.length === 1) {
      return validTargets[0];
    }

    // are we being taunted?
    let tauntEffect = user.activeEffects?.find(e => e.effect.forceTarget);
    if (tauntEffect) {
      if (validTargets.some(t => t === tauntEffect.effect.by)) {
        console.warn(`${Presenter.combatant(user)} is taunted by ${Presenter.combatant(tauntEffect.effect.by)} and must target them!`);
        return tauntEffect.effect.by;
      }
    }

    if (ability.target.includes("randomEnemies") && ability.target.length === 2) {
      // pick random enemies
      let count = ability.target[1] as any as number;
      let possibleTargets = Combat.living(enemies);
      let targetOrTargets: Combatant[] = [];
      for (let i = 0; i < count; i++) {
        targetOrTargets.push(possibleTargets[Math.floor(Math.random() * possibleTargets.length)]);
      }
      return targetOrTargets;
    } else if (ability.target.includes("deadAlly") && ability.target.length === 1) {
      // pick a random downed ally
      let downedAllies = allies.filter(a => a.hp <= 0);
      if (downedAllies.length === 0) {
        throw new Error(`No valid downed allies to target for ${ability.name}`);
      }
      return downedAllies[Math.floor(Math.random() * downedAllies.length)];
    } else {
      // pick the weakest/most wounded of the targets
      if (!Array.isArray(validTargets[0])) {
        if (ability.effects.some(e => e.type === "heal")) {
          return Combat.wounded(validTargets as Combatant[]).sort((a, b) => (a.hp / a.maxHp) - (b.hp / b.maxHp))[0];
        }

        return Combat.weakest(validTargets as Combatant[]);
      }
      console.log("!!! Defaulting to first valid target in array of arrays:", validTargets);
      return validTargets[0];
    }
  }

  static scoreAbility(ability: Ability, user: Combatant, allies: Combatant[], enemies: Combatant[]): number {
    let score = 0;
    let analysis = this.analyzeAbility(ability);
    if (analysis.attack) {
      // score += 2;
      // for each attack effect add +3
      ability.effects.forEach(e => {
        if (e.type === "attack") {
          score += 10;
        }
      });
    }
    if (analysis.flee) {
      score -= 15; // last resort action
      // is my hp low?
      const hpRatio = user.hp / user.maxHp;
      score += (1 - hpRatio) * 15; // higher score for lower hp
    }
    if (analysis.heal) {
      // any allies <= 50% hp?
      allies.forEach(ally => {
        if (ally.hp / ally.maxHp <= 0.25) {
          score += 10;
        } else if (ally.hp / ally.maxHp <= 0.5) {
          score += 5;
        }
      });
    }
    if (analysis.aoe) {
      score += enemies.filter(e => e.hp > 0).length * 3;
    }
    if (analysis.debuff) {
      // are there enemies with higher hp than us?
      enemies.forEach(enemy => {
        if (enemy.hp > 0 && enemy.hp > user.hp) {
          score += 3;
        }
      });
    }
    if (analysis.defense) {
      // are we low on hp?
      if (user.hp / user.maxHp <= 0.5) {
        score += 5;
      }
    }
    if (analysis.buff) {
      // if we already _have_ this buff and it targets ["self"] -- don't use it
      if (ability.target.includes("self") && ability.target.length === 1 &&
        user.activeEffects?.some(e => e.name === ability.effects[0].status?.name)) {
        return -10;
      }

      score += 3;
      // are we near full hp?
      // if (user.hp / user.maxHp >= 0.8) {
      //   score += 10;
      // }
        // NEW: Only buff when HP is high AND no enemies are critical
      if (user.hp / user.maxHp >= 0.8) {
        let anyCriticalEnemies = enemies.some(e => e.hp > 0 && e.hp / e.maxHp <= 0.3);
        if (!anyCriticalEnemies) {
          score += 10;
        }
      }
    }
    if (analysis.damage) {
      score += 3;
      // are enemies low on hp?
      enemies.forEach(enemy => {
        if (enemy.hp > 0 && enemy.hp / enemy.maxHp <= 0.5) {
          score += 5;
        }
      });
    }
    if (analysis.summon) {
      // does our party have < 6 combatants?
      if (allies.length < 6) {
        score += 4 * (6 - allies.length);
      } else {
        score -= 5;
      }
    }
    if (analysis.rez) {
      // any allies downed?
      allies.forEach(ally => {
        if (ally.hp <= 0) {
          score += 15;
        }
      });
    }

    // note: ideally these shouldn't be valid actions in the first place!!
    // they really should be disabled at other layers if not usable
    // if a skill and already used, give -10 penalty
    if (ability.type === "skill" && user.abilitiesUsed?.includes(ability.name)) {
      score -= 100;
    }

    // if a spell and no spell slots remaining, give -10 penalty
    if (ability.type === "spell") {
      let spellSlotsRemaining = (Combat.maxSpellSlotsForCombatant(user) || 0) - (user.spellSlotsUsed || 0);
      if (spellSlotsRemaining <= 0) {
        score -= 100;
      }
    }

    return Math.round(score);
  }

  static analyzeAbility(ability: Ability): AbilityAnalysis {
    let attack = ability.effects.some(e => e.type === "attack");
    let damage = ability.effects.some(e => e.type === "damage" || e.type === "attack");
    let heal = ability.effects.some(e => e.type === "heal");
    let aoe = ability.target.includes("enemies");
    let buff = ability.effects.some(e => e.type === "buff");
    let debuff = ability.effects.some(e => e.type === "debuff");
    let defense = ability.effects.some(e => e.type === "buff" && e.status?.effect.ac);
    let flee = ability.effects.some(e => e.type === "flee");
    let summon = ability.effects.some(e => e.type === "summon");
    let rez = ability.effects.some(e => e.type === "resurrect");

    return { attack, heal, damage, buff, debuff, defense, aoe, flee, summon, rez };
  }
}
