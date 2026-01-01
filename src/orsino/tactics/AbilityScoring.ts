import Deem from "../../deem";
import AbilityHandler, { Ability, AbilityEffect } from "../Ability";
import Combat from "../Combat";
import { GeneratorOptions } from "../Generator";
import { Fighting } from "../rules/Fighting";
import StatusHandler from "../Status";
import Presenter from "../tui/Presenter";
import { Combatant } from "../types/Combatant";
import { CombatContext } from "../types/CombatContext";

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
  static bestAbilityTarget(ability: Ability, user: Combatant, allies: Combatant[], enemies: Combatant[]): Combatant | Combatant[] | null {
    const validTargets = AbilityHandler.validTargets(ability, user, allies, enemies);
    if (validTargets.length === 0 && !ability.target.includes("randomEnemies")) {
      return null;
      // throw new Error(`No valid targets for ${ability.name}`);
    } else if (validTargets.length === 1) {
      return validTargets[0];
    }

    // are we being taunted?
    const tauntEffect = user.activeEffects?.find(e => e.effect.forceTarget);
    if (tauntEffect) {
      if (tauntEffect.by && validTargets.some(t => t === tauntEffect.by)) {
        console.warn(`${(user.forename)} is taunted by ${Presenter.combatant(tauntEffect.by)} and must target them!`);
        return tauntEffect.by;
      }
    }

    if (ability.target.includes("randomEnemies") && ability.target.length === 2) {
      // pick random enemies
      const count = ability.target[1] as any as number;
      const possibleTargets = Combat.living(enemies);
      const targetOrTargets: Combatant[] = [];
      for (let i = 0; i < count; i++) {
        targetOrTargets.push(possibleTargets[Math.floor(Math.random() * possibleTargets.length)]);
      }
      return targetOrTargets;
    } else if (ability.target.includes("deadAlly") && ability.target.length === 1) {
      // pick a random downed ally
      const downedAllies = allies.filter(a => a.hp <= 0);
      if (downedAllies.length === 0) {
        throw new Error(`No valid downed allies to target for ${ability.name}`);
      }
      return downedAllies[Math.floor(Math.random() * downedAllies.length)];
    } else {
      // pick the weakest/most wounded of the targets
      if (!Array.isArray(validTargets[0])) {
        if (ability.effects.some(e => e.type === "heal")) {
          return Combat.wounded(validTargets as Combatant[]).sort((a, b) => (a.hp / a.maximumHitPoints) - (b.hp / b.maximumHitPoints))[0];
        }

        return Combat.weakest(validTargets as Combatant[]);
      }
      console.log("!!! Defaulting to first valid target in array of arrays:", validTargets);
      return validTargets[0];
    }
  }

  static scoreModifiers = {
    impossible: -10,
    terrible: -5,
    bad: -3,
    poor: -2,
    average: 1,
    good: 2,
    excellent: 3,
    outstanding: 5,
    perfect: 10,
  }

  static HARD_CONTROL = new Set(["asleep", "paralyzed", "prone", "stun", "confused", "charmed", "dominated", "fear", "silence"]);

  static scoreAbility(ability: Ability, context: CombatContext): number {
    const { subject: user, allies, enemies } = context;
    const livingEnemies = enemies.filter(e => e.hp > 0).length;
    const analysis = this.analyzeAbility(ability);
    const expectedDamage = this.expectedDamage(ability, user, context);

    const { impossible, terrible, bad, poor, average, good, excellent, outstanding, perfect } = this.scoreModifiers;
    const { attack, heal, damage, buff, debuff, defense, aoe, flee, summon, rez } = analysis;
    // are any opponents less than expected-damage hp?
    const expectedPerTarget = aoe && livingEnemies > 0
      ? expectedDamage / livingEnemies
      : expectedDamage;

    let score = Math.min(expectedDamage, perfect); // base score on expected damage, capped at 'perfect'
    if (attack) {
      score += good;
      // for each attack effect add +excellent
      ability.effects.forEach(e => {
        if (e.type === "attack") {
          score += excellent;
        }
      });

      for (const enemy of enemies) {
        if (enemy.hp > 0 && enemy.hp <= expectedPerTarget) {
          score += outstanding;
        }
      }

      // is there only one enemy left?
      if (livingEnemies === 1 && user.hp / user.maximumHitPoints >= 0.35) {
        score += excellent;
      }
    }
    if (flee) {
      score += terrible;
      // is my hp low?
      const hpRatio = user.hp / user.maximumHitPoints;
      score += (1 - hpRatio) * outstanding; // higher score for lower hp
    }
    if (heal) {
      // if all allies at full hp, don't heal
      const allAtFullHp = allies.every(ally => ally.hp >= ally.maximumHitPoints || ally.hp <= 0);
      if (allAtFullHp) {
        return terrible;
      }

      // any allies <= 50% hp?
      allies.forEach(ally => {
        if (ally.hp / ally.maximumHitPoints <= 0.25) {
          score += outstanding;
        } else if (ally.hp / ally.maximumHitPoints <= 0.5) {
          score += good;
        }
      });
    }
    if (aoe) {
      if (livingEnemies >= 3) {
        score += good;
      }
    }
    if (debuff) {
      // are there enemies with higher hp than us?
      enemies.forEach(enemy => {
        if (enemy.hp > 0 && enemy.hp > user.hp) {
          score += good;
        }
      });

      let debuffEffects = ability.effects.filter(e => e.type === "debuff");
      for (let effect of debuffEffects) {
        if (effect?.status) {
          let status = StatusHandler.instance.dereference(effect.status);
          if (status && status.effect) {
            if (aoe) {
              const allHaveAlready = Combat.living(enemies).every(e => e.activeEffects?.some(ae => ae.name === status!.name));
              if (allHaveAlready) {
                return impossible;
              }
            } else {
              const target = this.bestAbilityTarget(ability, user, allies, enemies) as Combatant;
              if (!target) {
                return impossible;
              }
              if (target) {
                const hasDebuffAlready = target.activeEffects?.some(e => e.name === status!.name);
                if (hasDebuffAlready) {
                  return impossible;
                }
              }
            }
            const isHardControl = this.HARD_CONTROL.has(status.name);
            if (isHardControl) {
              score += outstanding;
            }
          }
        }
      }
    }
    if (defense) {
      // are we low on hp?
      if (user.hp / user.maximumHitPoints <= 0.5) {
        score += good;
      } else {
        score += bad;
      }

      if (livingEnemies === 1 && user.hp / user.maximumHitPoints >= 0.35) {
        return impossible;
      }
    }
    if (buff) {
      // if we already _have_ this buff and it targets ["self"] -- don't use it
      if (ability.target.includes("self") && ability.target.length === 1) { //} &&
        // let buffEffect = ability.effects.find(e => e.type === "buff");
        let buffEffects = ability.effects.filter(e => e.type === "buff");
        for (let buffEffect of buffEffects) {
          if (buffEffect?.status) {
            let status = StatusHandler.instance.dereference(buffEffect.status);
            if (status && status.effect) {
              const hasBuffAlready = user.activeEffects?.some(e => e.name === status!.name);
              if (hasBuffAlready) {
                return impossible;
              }
            }
          }
        }
      }

      score += average;
      // Only buff when HP is high AND no enemies are critical
      if (user.hp / user.maximumHitPoints >= 0.8) {
        const anyCriticalEnemies = enemies.some(e => e.hp > 0 && e.hp / e.maximumHitPoints <= 0.3);
        if (!anyCriticalEnemies) {
          score += outstanding;
        }
      }
    }
    if (damage) {
      score += good;
      // are enemies low on hp?
      enemies.forEach(enemy => {
        if (enemy.hp > 0 && enemy.hp / enemy.maximumHitPoints <= 0.5) {
          score += good;
        }
      });
    }
    if (summon) {
      let maxSummons = Combat.maxSummoningsForCombatant(user);
      let currentSummons = user.activeSummonings ? Combat.living(user.activeSummonings).length : 0;
      if (currentSummons >= maxSummons) {
        return impossible;
      }
      // does our party have < 6 combatants?
      if (Combat.living(allies).length < 6) {
        score += good;
      } else {
        score += terrible;
      }
    }
    if (rez) {
      // any allies downed?
      allies.forEach(ally => {
        // does rez effect have a conditional trait?
        let canRez = true;
        ability.effects.forEach(effect => {
          if (effect.type === "resurrect" && effect.condition?.trait) {
            if (!ally.traits.includes(effect.condition?.trait)) {
              canRez = false;
            }
          }
        });
        if (ally.hp <= 0 && canRez) {
          score += perfect;
        }
      });
    }

    // note: ideally these shouldn't be valid actions in the first place!!
    // they really should be disabled at other layers if not usable
    // if a skill and already used, give -10 penalty
    if (ability.type === "skill" && user.abilitiesUsed?.includes(ability.name)) {
      score = impossible;
    }

    // if a spell and no spell slots remaining, give -10 penalty
    if (ability.type === "spell") {
      const spellSlotsRemaining = (Combat.maxSpellSlotsForCombatant(user) || 0) - (user.spellSlotsUsed || 0);
      if (spellSlotsRemaining <= 0) {
        score = impossible;
      }
    }

    return Math.round(score);
  }

  static analyzeAbility(ability: Ability): AbilityAnalysis {
    const attack = ability.effects.some(e => e.type === "attack");
    const damage = ability.effects.some(e => e.type === "damage" || e.type === "attack");
    const heal = ability.effects.some(e => e.type === "heal");
    const aoe = ability.target.includes("enemies") || (ability.target[0] === "randomEnemies" && ability.target.length === 2);
    const buff = ability.effects.some(e => e.type === "buff");
    const debuff = ability.effects.some(e => e.type === "debuff");
    const defense = ability.effects.some(e => e.type === "buff" && this.abilityBoostsAC(e));
    const flee = ability.effects.some(e => e.type === "flee");
    const summon = ability.effects.some(e => e.type === "summon");
    const rez = ability.effects.some(e => e.type === "resurrect");

    return { attack, heal, damage, buff, debuff, defense, aoe, flee, summon, rez };
  }

  private static abilityBoostsAC(effect: any): boolean {
    if (effect.type !== "buff") return false;
    let status = StatusHandler.instance.dereference(effect.status);
    if (status && status.effect && status.effect.ac && status.effect.ac < 0) {
      return true;
    }
    return false;
  }

  private static expectedDamage(ability: Ability, user: Combatant, context: CombatContext): number {
    let totalDamage = 0;
    ability.effects.forEach(effect => {
      let effectDamage = 0;
      if (effect.type === "attack") {
        let expectedDamage = 1;
        let attackDie = Fighting.effectiveAttackDie(user, context);

        // check for simple XdY+Z or XdY-Z
        const attackDieSolvable = attackDie.match(/^(\d+)d(\d+)([+-]\d+)?$/);
        if (attackDieSolvable) {
          const numDice = parseInt(attackDieSolvable[1], 10);
          const dieSides = parseInt(attackDieSolvable[2], 10);
          const modifier = attackDieSolvable[3] ? parseInt(attackDieSolvable[3], 10) : 0;
          expectedDamage = (numDice * (dieSides + 1)) / 2 + modifier;
        } else {
          // roll attack die 5x then average
          let sum = 0;
          const evalCount = 5;
          for (let i = 0; i < evalCount; i++) {
            const rollResult = Deem.evaluate(attackDie, { ...user } as GeneratorOptions) as number;
            sum += rollResult;
          }
          expectedDamage = sum / evalCount;
        }

        const fx = Fighting.turnBonus(user, ['toHit']);

        let hitChance = 0.65; // default 65% chance to hit
        hitChance += (fx.toHit ?? 0) * 0.03; // each +1 to hit adds 3% chance
        hitChance = Math.min(Math.max(hitChance, 0.05), 0.95); // clamp between 5% and 95%

        effectDamage += expectedDamage * hitChance;
      } else if (effect.type === "damage") {
        if (typeof effect.amount === "number") {
          effectDamage += effect.amount;
        } else if (typeof effect.amount === "string" && effect.amount.startsWith("=")) {
          // deem eval 5x then average
          let sum = 0;
          const evalCount = 5;
          for (let i = 0; i < evalCount; i++) {
            const rollResult = Deem.evaluate(effect.amount, { ...user } as GeneratorOptions) as number;
            sum += rollResult;
          }
          effectDamage += sum / evalCount;
        }

        if (effect.saveForHalf) {
          effectDamage *= 0.825; // assume 65% chance to fail save, so 82.5% average damage
        }
      }

      const livingEnemies = Combat.living(context.enemies).length;
      if (ability.target.includes("enemies")) {
        effectDamage *= livingEnemies;
      } else if (ability.target[0] === "randomEnemies" && ability.target.length === 2) {
        const count = ability.target[1] as any as number;
        effectDamage *= Math.min(count, livingEnemies);
      }

      totalDamage += effectDamage;
    });
    return totalDamage;
  }
}
