import Choice from "inquirer/lib/objects/choice";
import { Combatant } from "./types/Combatant";
import Presenter from "./tui/Presenter";
import { Team } from "./types/Team";
import { Roll } from "./types/Roll";
import { Fighting } from "./rules/Fighting";
import Stylist from "./tui/Style";
import Events, { CombatEvent, InitiateCombatEvent, HealEvent, MissEvent, HitEvent, FallenEvent, StatusExpireEvent, RoundStartEvent, CombatEndEvent, StatusEffectEvent, FleeEvent } from "./Events";
import AbilityHandler, { Ability } from "./Ability";
import { Answers } from "inquirer";

export type RollResult = {
  amount: number;
  description: string;
};

export type ChoiceSelector<T extends Answers> = (description: string, options: Choice<T>[], combatant?: Combatant) => Promise<T>;

export type CommandHandlers = {
  roll: Roll;
  attack: (combatant: Combatant, target: Combatant, roller?: Roll) => Promise<{ success: boolean; target: Combatant }>;
  hit: (attacker: Combatant, defender: Combatant, damage: number, critical: boolean, by: string, success: boolean) => Promise<void>;
  heal: (healer: Combatant, target: Combatant, amount: number) => Promise<void>;
  status: (user: Combatant, target: Combatant, name: string, effect: { [key: string]: any }, duration: number) => Promise<void>;
  removeItem: (user: Combatant, item: keyof Team) => Promise<void>;
}
export default class Combat {
  private turnNumber: number = 0;
  public winner: string | null = null;
  public teams: Team[] = [];
  public abilityHandler = new AbilityHandler();
  private combatantsByInitiative: { combatant: any; initiative: number }[] = [];

  protected roller: Roll;
  protected select: ChoiceSelector<any>;
  protected journal: CombatEvent[] = [];
  protected outputSink: (message: string) => void;

  constructor(
    options: Record<string, any> = {},
  ) {
    this.roller = options.roller || Combat.roll;
    this.select = options.select || Combat.samplingSelect;
    this.outputSink = options.outputSink || console.debug;
  }

  static async samplingSelect(_prompt: string, options: Choice<any>[]): Promise<any> {
    let enabledOptions = options.filter(
      (option) => !option.disabled
    )
    return enabledOptions[Math.floor(Math.random() * enabledOptions.length)]?.value;
  }

  static defaultTeams(): Team[] {
    return [
      {
        name: "Player", combatants: [{
          forename: "Hero",
          name: "Hero",
          hp: 14, maxHp: 14, level: 1, ac: 10,
          dex: 11, str: 12, int: 10, wis: 10, cha: 10, con: 12,
          attackRolls: 1,
          damageDie: 8, playerControlled: true, xp: 0, gp: 0,
          weapon: "Short Sword",
          abilities: ["melee"], traits: []
        }], healingPotions: 3
      },
      {
        name: "Enemy", combatants: [
          { forename: "Zok", name: "Goblin A", hp: 4, maxHp: 4, level: 1, ac: 17, attackRolls: 2, damageDie: 3, str: 8, dex: 14, int: 10, wis: 8, cha: 8, con: 10, weapon: "Dagger", abilities: ["melee"], traits: [] },
          {
            forename: "Mog", name: "Goblin B", hp: 4, maxHp: 4, level: 1, ac: 17, attackRolls: 2, damageDie: 3,
            str: 8, dex: 14, int: 10, wis: 8, cha: 8, con: 10, weapon: "Dagger", abilities: ["melee"], traits: []
          }
        ], healingPotions: 0
      }
    ];
  }

  protected note(message: string) { this.outputSink(message); }

  protected emit(event: Omit<CombatEvent, "turn">): void {
    let e: CombatEvent = { ...event, turn: this.turnNumber } as CombatEvent;
    this.journal.push(e);
    this.note(Events.present(e));
  }

  private async determineInitiative(): Promise<{ combatant: any; initiative: number }[]> {
    let initiativeOrder = [];
    for (let c of this.allCombatants) {
      let effective = Fighting.effectiveStats(c);
      let initBonus = Fighting.turnBonus(c, ["initiative"]).initiative || 0;
      const initiative = (await this.roller(c, "for initiative", 20)).amount + Fighting.statMod(effective.dex) + initBonus;
      initiativeOrder.push({ combatant: c, initiative });
    }
    return initiativeOrder.sort((a, b) => b.initiative - a.initiative);
  }

  get allCombatants() {
    return this.teams.flatMap(team => team.combatants);
  }

  static roll(subject: Combatant, description: string, sides: number): RollResult {
    let result = Math.floor(Math.random() * sides) + 1;
    let prettyResult = Stylist.colorize(result.toString(), result === sides ? 'green' : result === 1 ? 'red' : 'yellow');

    let rollDescription = Stylist.italic(`${subject.name} rolled d${sides} ${description} and got a ${prettyResult}.`);

    if (subject.activeEffects) {
      // check for 'allRolls' bonus effects
      subject.activeEffects.forEach(status => {
        if (status.effect && status.effect.allRolls) {
          result += status.effect.allRolls;
          rollDescription += ` ${subject.name} has the ${status.name} status, adding ${status.effect.allRolls} to the roll (roll is now ${result}).`;
        }
      });
    }

    if (result === 1 && subject.traits?.includes("lucky")) {
      rollDescription += ` ${subject.name} is Lucky and rolled a 1, so they get to re-roll!`;
      // re-roll a 1
      return Combat.roll(subject, description + " (re-roll)", sides);
    }

    return { amount: result, description: rollDescription };
  }

  // autoroll = async (subject: Combatant, description: string, sides: number) => Combat.rollDie(subject, description, sides);
  static living(combatants: Combatant[]): Combatant[] { return combatants.filter(c => c.hp > 0); }
  static wounded(combatants: Combatant[]): Combatant[] { return combatants.filter(c => c.hp > 0 && c.hp < c.maxHp); }
  static weakest(combatants: Combatant[]): Combatant {
    return this.living(combatants).reduce((weakest, current) => {
      return current.hp < weakest.hp ? current : weakest;
    }, this.living(combatants)[0]);
  }

  async setUp(
    teams = Combat.defaultTeams()
  ) {
    this.turnNumber = 0;
    this.winner = null;
    this.teams = teams;

    this.combatantsByInitiative = await this.determineInitiative();
    this.emit({ type: "initiate", order: this.combatantsByInitiative } as Omit<InitiateCombatEvent, "turn">);

    this.allCombatants.forEach(c => c.abilitiesUsed = []);

    await this.abilityHandler.loadAbilities();
    console.log("Combat setup complete!");
  }

  static maxSpellSlotsForLevel(level: number): number { return 1 + Math.ceil(level / 2); }
  static maxSpellSlotsForCombatant(combatant: Combatant): number {
    if (combatant.class === "mage") {
      return Combat.maxSpellSlotsForLevel(combatant.level || 1) + Math.max(0, Fighting.statMod(combatant.int));
    } else if (combatant.class === "bard") {
      return Combat.maxSpellSlotsForLevel(combatant.level || 1) + Math.max(0, Fighting.statMod(combatant.cha));
    } else if (combatant.class === "cleric") {
      return Combat.maxSpellSlotsForLevel(combatant.level || 1) + Math.max(0, Fighting.statMod(combatant.wis));
    }

    return 0;
  }

  get commandHandlers(): CommandHandlers {
    return {
      roll: this.roller,
      attack: this.handleAttack.bind(this),
      hit: this.handleHit.bind(this),
      heal: this.handleHeal.bind(this),
      status: this.handleStatusEffect.bind(this),
      removeItem: async (user: Combatant, item: keyof Team) => { //}'healingPotions') => {
        // find team and remove item
        let team = this.teams.find(t => t.combatants.includes(user));
        if (team) {
          console.log("Removing item", item, "from", team.name);
          // @ts-ignore
          team[item] = Math.max(0, (team[item] as number || 0) - 1);
          console.log("Team", team.name, "now has", team[item], item);
        }
      }
    }
  }

  validActions(combatant: Combatant, allies: Combatant[], enemies: Combatant[]): Ability[] {
    const validAbilities: Ability[] = [];

    let spellSlotsRemaining = (Combat.maxSpellSlotsForCombatant(combatant) || 0) - (combatant.spellSlotsUsed || 0);
    // let pips = "";

    let abilities = combatant.abilities.map(a => this.abilityHandler.getAbility(a)); //.filter(a => a);
    abilities.forEach((ability: Ability) => {
      let validTargets = this.abilityHandler.validTargets(ability, combatant, allies, enemies);
      let disabled = validTargets.length === 0;
      if (ability.target.includes("randomEnemies") && Combat.living(enemies).length > 0) {
        disabled = false;
      }

      // if _only_ a healing effect and target is ally/self/allies and NO wounded allies, disable
      if (!disabled && ability.effects.every(e => e.type === "heal") && ability.effects.length > 0) {
        if (Combat.wounded([...allies, combatant]).length === 0) {
          disabled = true;
        } else if (ability.target.includes("self") && combatant.hp === combatant.maxHp) {
          disabled = ability.target.length === 1; // if only self-targeting, disable; if also allies, allow
        } else if (ability.target.includes("allies") && Combat.wounded(allies).length === 0) {
          disabled = ability.target.length === 1; // if only allies-targeting, disable; if also self, allow
        }
      }

      if (!disabled) {
        if (ability.type == "spell") {
          // pips = "⚡".repeat(spellSlotsRemaining) + "⚫".repeat((Combat.maxSpellSlotsForCombatant(combatant) || 0) - spellSlotsRemaining);
          disabled = spellSlotsRemaining === 0;
        } else if (ability.type == "skill") {
          // want to track consumption here...
          // console.log("Already used ", ability.name, "?", combatant.abilitiesUsed?.includes(ability.name) || false)
          if (!ability.name.match(/melee|ranged|wait/i)) {
            disabled = combatant.abilitiesUsed?.includes(ability.name) || false;
          }
        } else {
          throw new Error(`Unknown ability type: ${ability.type}`);
        }
      }

      if (!disabled) {
        validAbilities.push(ability);
      }
    });

    return validAbilities;
  }

  async pcTurn(combatant: Combatant, enemies: Combatant[], allies: Combatant[]) {
    // this.note(`It's ${Presenter.combatant(combatant)}'s turn!`);

    let validAbilities = this.validActions(combatant, allies, enemies);
    let allAbilities = combatant.abilities.map(a => this.abilityHandler.getAbility(a)); //.filter(a => a);

    let pips = "";
    pips += "⚡".repeat((Combat.maxSpellSlotsForCombatant(combatant) || 0) - ((combatant.spellSlotsUsed || 0))) + "⚫".repeat(combatant.spellSlotsUsed || 0);
    let choices = allAbilities.map(ability => {
      return ({
        value: ability,
        name: `${ability.name.padEnd(15)} (${ability.description}/${ability.type === "spell" ? pips : "skill"})`,
        short: ability.name,
        disabled: !validAbilities.some(a => a.name === ability.name)
      })
    });

    // if we have potions, add a quaff potion action
    if (this.teams[0].healingPotions > 0) {
      choices.push({
        value: { name: "Quaff", type: "potion", description: "Drink a healing potion to restore 2d4+2 HP.", aspect: "divine", target: ["self"], effects: [{ type: "heal", amount: "=2d4+2" }, { type: "removeItem", item: "healingPotions" }] },
        name: "Quaff Potion (Heal 2d4+2 HP)",
        short: "Quaff Potion",
        disabled: false
      });
    }

    const action: Ability = await this.select(`Your turn, ${Presenter.minimalCombatant(combatant)} - what do you do?`, choices, combatant);

    let validTargets = this.abilityHandler.validTargets(action, combatant, allies, enemies);
    let targetOrTargets = validTargets[0];
    if (validTargets.length > 1) {
      targetOrTargets = await this.select(`Select target(s) for ${action.name}:`, validTargets.map(t => ({
        name: Array.isArray(t) ? t.map(c => Presenter.combatant(c)).join("; ") : t.name,
        value: t,
        short: Array.isArray(t) ? t.map(c => Presenter.combatant(c)).join(", ") : t.name,
        disabled: false //Array.isArray(t) ? t.every(c => c.hp <= 0) : t.hp <= 0
      })), combatant);
    } else if (action.target.includes("randomEnemies") && action.target.length === 2) {
      // pick random enemies
      let count = action.target[1] as any as number;
      let possibleTargets = Combat.living(enemies);
      targetOrTargets = [];
      for (let i = 0; i < count; i++) {
        targetOrTargets.push(possibleTargets[Math.floor(Math.random() * possibleTargets.length)]);
      }
    }

    if (action.type === "skill" && !action.name.match(/melee|ranged|wait/i)) {
      combatant.abilitiesUsed = combatant.abilitiesUsed || [];
      combatant.abilitiesUsed.push(action.name);
    } else if (action.type === "spell") {
      combatant.spellSlotsUsed = (combatant.spellSlotsUsed || 0) + 1;
    }

    await AbilityHandler.perform(action, combatant, targetOrTargets, this.commandHandlers);
  }

  async handleStatusEffect(_user: Combatant, target: Combatant, name: string, effect: { [key: string]: any }, duration: number): Promise<void> {
    // if they already have the effect, remove it and reapply it with the new duration
    if (target.activeEffects) {
      let existingEffectIndex = target.activeEffects.findIndex(e => e.name === name);
      if (existingEffectIndex !== -1) {
        target.activeEffects.splice(existingEffectIndex, 1);
      }
    }

    target.activeEffects = target.activeEffects || [];
    target.activeEffects.push({ name, effect, duration });
    this.emit({
      type: "statusEffect", subject: target, effectName: name, effect, duration
    } as Omit<StatusEffectEvent, "turn">);
  }

  async handleHeal(healer: Combatant, target: Combatant, amount: number): Promise<void> {
    target.hp = Math.min(target.maxHp, target.hp + amount);
    // add wis bonus to healing
    const effective = Fighting.effectiveStats(healer);
    const wisBonus = Math.max(0, Fighting.statMod(effective.wis));
    if (wisBonus > 0) {
      target.hp = Math.min(target.maxHp, target.hp + wisBonus);
      amount += wisBonus;
      console.log(`Healing increased by ${wisBonus} for WIS ${healer.wis}`);
    }
    this.emit({ type: "heal", subject: healer, target, amount } as Omit<HealEvent, "turn">);
  }

  async handleHit(attacker: Combatant, defender: Combatant, damage: number, critical: boolean, by: string, success: boolean): Promise<void> {
    if (!success) {
      this.emit({ type: "miss", subject: attacker, target: defender } as Omit<MissEvent, "turn">);
      return;
    }

    if (defender.hp <= 0) {
      // this.emit({ type: "miss", subject: attacker, target: defender } as Omit<MissEvent, "turn">);
      this.note(`${Presenter.combatant(defender)} is already defeated. No damage applied.`);
      return;
    }

    // if there is an evasion effect, check for it
    if (defender.activeEffects?.some(e => e.effect.evasion)) {
      const evasionEffect = defender.activeEffects.find(e => e.effect.evasion);
      const evasionBonus = evasionEffect?.effect.evasion || 0;
      let whatNumberEvades = 15 - evasionBonus;
      const evasionRoll = await this.roller(defender, `for evasion (must roll ${whatNumberEvades} or higher)`, 20);
      if (evasionRoll.amount + evasionBonus >= 15) {
        this.note(`${Presenter.combatant(defender)} evades the attack!`);
        this.emit({ type: "miss", subject: attacker, target: defender } as Omit<MissEvent, "turn">);
        return;
      }
    }

    // does the combatant has a bonus damage effect?
    if (defender.activeEffects?.some(e => e.effect.bonusDamage)) {
      const bonusDamageEffect = defender.activeEffects.find(e => e.effect.bonusDamage);
      const bonusDamage = bonusDamageEffect?.effect.bonusDamage || 0;
      damage += bonusDamage;
      this.note(`${Presenter.combatant(defender)} has a bonus damage effect, adding ${bonusDamage} damage!`);
    }

    // apply damage
    let originalHp = defender.hp;
    defender.hp -= damage;

    if (defender.hp <= 0 && originalHp >= defender.maxHp / 2) {
      // if we have resilient trait, we drop to 1 hp instead of 0
      if (defender.traits?.includes("resilient")) {
        defender.hp = 1;
        this.note(`${Presenter.combatant(defender)} is resilient and drops to 1 HP instead of 0!`);
      }
    }

    this.emit({ type: "hit", subject: attacker, target: defender, damage, success: true, critical, by } as Omit<HitEvent, "turn">);
    if (defender.hp <= 0) {
      this.emit({ type: "fall", subject: defender } as Omit<FallenEvent, "turn">);
    }
  }

  async handleAttack(combatant: Combatant, target: Combatant, roller: Roll = this.roller): Promise<{
    success: boolean;
    target: Combatant;
  }> {
    const { damage, critical, success } = await Fighting.attack(roller, combatant, target);
    await this.handleHit(combatant, target, damage, critical, `${combatant.forename}'s ${combatant.weapon}`, success);
    return { success, target };
  }

  async npcTurn(combatant: Combatant, enemies: Combatant[], allies: Combatant[]) {
    let validAbilities = this.validActions(combatant, allies, enemies);
    let scoredAbilities = validAbilities.map(ability => ({
      ability,
      score: this.scoreAbility(ability, combatant, allies, enemies)
    }));
    // console.log(`NPC ${combatant.forename} rates abilities:`, scoredAbilities.map(sa => `${sa.ability.name} (${sa.score})`).join(", "));
    scoredAbilities.sort((a, b) => b.score - a.score);
    const action = scoredAbilities[0]?.ability;
    let targetOrTargets: Combatant | Combatant[] = this.bestAbilityTarget(action, combatant, allies, enemies);

    combatant.abilitiesUsed = combatant.abilitiesUsed || [];
    if (action && action.type === "skill" && !action.name.match(/melee|ranged|wait/i)) {
      combatant.abilitiesUsed.push(action.name);
    }

    // use spell slots
    if (action && action.type === "spell") {
      combatant.spellSlotsUsed = (combatant.spellSlotsUsed || 0) + 1;
    }

    if (!action) {
      this.note(`${Presenter.combatant(combatant)} has no valid actions and skips their turn.`);
      return;
    }

    // invoke the action
    let verb = action.type === "spell" ? 'casts' : 'uses';
    this.note(Presenter.combatant(combatant) + ` ${verb} ` + action.name + "!");
    await AbilityHandler.perform(action, combatant, targetOrTargets, this.commandHandlers);
  }

  bestAbilityTarget(ability: Ability, user: Combatant, allies: Combatant[], enemies: Combatant[]): Combatant | Combatant[] {
    let validTargets = this.abilityHandler.validTargets(ability, user, allies, enemies);
    if (validTargets.length === 0) {
      // return null;
      throw new Error(`No valid targets for ${ability.name}`);
    } else if (validTargets.length === 1) {
      return validTargets[0];
    }

    // are we being taunted?
    let tauntEffect = user.activeEffects?.find(e => e.effect.forceTarget);
    if (tauntEffect) {
      if (validTargets.some(t => t === tauntEffect.effect.by)) {
        this.note(`${Presenter.combatant(user)} is taunted by ${Presenter.combatant(tauntEffect.effect.by)} and must target them!`);
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
    } else {
      // pick the weakest/most wounded of the targets
      if (!Array.isArray(validTargets[0])) {
        if (ability.effects.some(e => e.type === "heal")) {
          return Combat.wounded(validTargets as Combatant[]).sort((a, b) => (a.hp / a.maxHp) - (b.hp / b.maxHp))[0];
        }

        return Combat.weakest(validTargets as Combatant[]);
      }
      return validTargets[0];
    }
  }

  scoreAbility(ability: Ability, user: Combatant, allies: Combatant[], enemies: Combatant[]): number {
    let score = 0;
    let analysis = this.analyzeAbility(ability);
    if (analysis.flee) {
      // is my hp low?
      const hpRatio = user.hp / user.maxHp;
      score += (1 - hpRatio) * 15; // higher score for lower hp
    } else if (analysis.heal) {
      // any allies <= 50% hp?
      allies.forEach(ally => {
        if (ally.hp / ally.maxHp <= 0.5) {
          score += 10;
        }
      });
    } else if (analysis.aoe) {
      score += enemies.filter(e => e.hp > 0).length * 3;
    } else if (analysis.debuff) {
      // are there enemies with higher hp than us?
      enemies.forEach(enemy => {
        if (enemy.hp > 0 && enemy.hp > user.hp) {
          score += 4;
        }
      });
    } else if (analysis.defense) {
      // are we low on hp?
      if (user.hp / user.maxHp <= 0.5) {
        score += 5;
      }
    } else if (analysis.buff) {
      // if we already _have_ this buff and it targets ["self"] -- don't use it
      if (ability.target.includes("self") && ability.target.length === 1 &&
        user.activeEffects?.some(e => e.name === ability.effects[0].status?.name)) {
        return -10;
      }

      score += 3;
      // are we near full hp?
      if (user.hp / user.maxHp >= 0.8) {
        score += 5;
      }
    } else if (analysis.damage) {
      score += 6;
      // are enemies low on hp?
      enemies.forEach(enemy => {
        if (enemy.hp > 0 && enemy.hp / enemy.maxHp <= 0.5) {
          score += 5;
        }
      });
    }

    // if a skill and already used, give -10 penalty
    if (ability.type === "skill" && user.abilitiesUsed?.includes(ability.name)) {
      score -= 10;
    }

    // if a spell and no spell slots remaining, give -10 penalty
    if (ability.type === "spell") {
      let spellSlotsRemaining = (Combat.maxSpellSlotsForCombatant(user) || 0) - (user.spellSlotsUsed || 0);
      if (spellSlotsRemaining <= 0) {
        score -= 10;
      }
    }

    return score;
  }

  analyzeAbility(ability: Ability): {
    heal: boolean; damage: boolean; buff: boolean; debuff: boolean; defense: boolean; aoe: boolean; flee: boolean
  } {
    let damage = ability.effects.some(e => e.type === "damage" || e.type === "attack");
    let heal = ability.effects.some(e => e.type === "heal");
    let aoe = ability.target.includes("enemies");
    let buff = ability.effects.some(e => e.type === "buff");
    let debuff = ability.effects.some(e => e.type === "debuff");
    let defense = ability.effects.some(e => e.type === "buff" && e.status?.effect.ac);
    let flee = ability.effects.some(e => e.type === "flee");

    return { heal, damage, buff, debuff, defense, aoe, flee };
  }

  async turn(combatant: Combatant) {
    this.emit({ type: "turnStart", subject: combatant, combatants: this.allCombatants } as Omit<CombatEvent, "turn">);

    // if we have an 'inactive' status (eg from sleep spell) skip our turn
    if (combatant.activeEffects?.some(e => e.effect.noActions)) {
      let status = combatant.activeEffects.find(e => e.effect.noActions);
      this.note(`${Presenter.combatant(combatant)} is ${status!.name} and skips their turn!`);
      return;
    }

    const targets = this.teams.find(team => team.combatants.includes(combatant)) === this.teams[0] ? (this.teams[1].combatants) : (this.teams[0].combatants);

    let validTargets = Combat.living(targets);
    if (validTargets.length === 0) {
      return;
    }

    // if (combatant.activeEffects) {
    // }

    // don't attempt to act if we're already defeated
    if (combatant.hp <= 0) { return; }

    let allies = this.teams.find(team => team.combatants.includes(combatant))?.combatants || [];
    allies = Combat.living(allies).filter(c => c !== combatant);

    // do we have an effect changing our allegiance? in which case -- flip our allies/enemies
    let allegianceEffect = combatant.activeEffects?.find(e => e.effect.changeAllegiance);
    if (allegianceEffect) {
      this.note(`${Presenter.combatant(combatant)} is under the effect of ${allegianceEffect.name} and has switched sides!`);
      [allies, validTargets] = [validTargets, allies];
    }

    let attacksPerTurn = combatant.attacksPerTurn || 1;
    for (let i = 0; i < attacksPerTurn; i++) {
      if (combatant.playerControlled) {
        await this.pcTurn(combatant, validTargets, allies);
      } else {
        await this.npcTurn(combatant, validTargets, allies);
      }
    }

    if (combatant.activeEffects) {
      //combatant.activeEffects.forEach(it => it.duration--);
      //for (const status of combatant.activeEffects) {
      //  if (status.duration === 0) {
      //    this.emit({ type: "statusExpire", subject: combatant, effectName: status.name } as Omit<StatusExpireEvent, "turn">);
      //  }
      //}
      // combatant.activeEffects = combatant.activeEffects.filter(it => it.duration > 0);
      // run onTurnEnd for all active effects
      for (const status of combatant.activeEffects) {
        if (status.effect['onTurnEnd']) {
          for (const effect of status.effect['onTurnEnd']) {
            // apply fx to self
            await AbilityHandler.handleEffect(status.name, effect, effect.by || combatant, combatant, this.commandHandlers);
          }
        }
      }
    }
  }

  async round() {
    if (this.isOver()) {
      throw new Error('Combat is already over');
    }
    this.turnNumber++;
    this.emit({
      type: "roundStart", combatants: Combat.living(this.combatantsByInitiative.map(c => c.combatant))
    } as Omit<RoundStartEvent, "turn">);

    // check for escape conditions (if 'flee' status is active, remove the combatant from combat)
    this.allCombatants.forEach(combatant => {
      if (combatant.activeEffects?.some(e => e.effect?.flee)) {
        // remove from combatants / teams
        this.teams.forEach(team => {
          team.combatants = team.combatants.filter(c => c !== combatant);
        });
        this.combatantsByInitiative = this.combatantsByInitiative.filter(c => c.combatant !== combatant);

        this.emit({ type: "flee", subject: combatant } as Omit<FleeEvent, "turn">);
      }
    });

    for (const { combatant } of this.combatantsByInitiative) {
      if (combatant.hp <= 0) continue; // Skip defeated combatants
      await this.turn(combatant);
    }

    // tick down status
    this.allCombatants.forEach(combatant => {
      if (combatant.activeEffects) {
        combatant.activeEffects.forEach(it => it.duration--);
        for (const status of combatant.activeEffects) {
          if (status.duration === 0) {
            this.emit({ type: "statusExpire", subject: combatant, effectName: status.name } as Omit<StatusExpireEvent, "turn">);
          }
        }
      }
      combatant.activeEffects = combatant.activeEffects?.filter(it => it.duration > 0) || [];
    });

    for (const team of this.teams) {
      if (team.combatants.every((c: any) => c.hp <= 0)) {
        this.winner = team === this.teams[0] ? this.teams[1].name : this.teams[0].name;
        this.emit({ type: "combatEnd", winner: this.winner } as Omit<CombatEndEvent, "turn">);
        break;
      }
    }

    return { number: this.turnNumber, done: this.isOver() };
  }

  isOver() {
    return this.winner !== null;
  }
}

