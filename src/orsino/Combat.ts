import Choice from "inquirer/lib/objects/choice";
import { Combatant } from "./types/Combatant";
import Presenter from "./tui/Presenter";
import { Team } from "./types/Team";
import { Roll } from "./types/Roll";
import { Fighting } from "./rules/Fighting";
import Stylist from "./tui/Style";
import Events, { CombatEvent, InitiateCombatEvent, HealEvent, MissEvent, HitEvent, FallenEvent, StatusExpireEvent, RoundStartEvent, CombatEndEvent, StatusEffectEvent } from "./Events";
import AbilityHandler, { Ability } from "./Ability";
import { Answers } from "inquirer";

export type RollResult = {
  amount: number;
  description: string;
};

export type ChoiceSelector<T extends Answers> = (description: string, options: Choice<T>[], combatant?: Combatant) => Promise<T>;
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
    this.roller = options.roller || this.autoroll;
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
          abilities: ["melee"]
        }], healingPotions: 3
      },
      {
        name: "Enemy", combatants: [
          { forename: "Zok", name: "Goblin A", hp: 4, maxHp: 4, level: 1, ac: 17, attackRolls: 2, damageDie: 3, str: 8, dex: 14, int: 10, wis: 8, cha: 8, con: 10, weapon: "Dagger", abilities: ["melee"] },
          {
            forename: "Mog", name: "Goblin B", hp: 4, maxHp: 4, level: 1, ac: 17, attackRolls: 2, damageDie: 3,
            str: 8, dex: 14, int: 10, wis: 8, cha: 8, con: 10, weapon: "Dagger", abilities: ["melee"]
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
      const initiative = (await this.roller(c, "for initiative", 20)).amount + Fighting.statMod(c.dex);
      initiativeOrder.push({ combatant: c, initiative });
    }
    return initiativeOrder.sort((a, b) => b.initiative - a.initiative);
  }

  get allCombatants() {
    return this.teams.flatMap(team => team.combatants);
  }

  static rollDie(subject: Combatant, description: string, sides: number): RollResult {
    let result = Math.floor(Math.random() * sides) + 1;
    let prettyResult = Stylist.colorize(result.toString(), result === sides ? 'green' : result === 1 ? 'red' : 'yellow');

    let rollDescription = Stylist.italic(`${subject.name} rolled ${description} and got a ${prettyResult}.`);

    if (subject.activeEffects) {
      // check for 'allRolls' bonus effects
      subject.activeEffects.forEach(status => {
        if (status.effect && status.effect.allRolls) {
          result += status.effect.allRolls;
          rollDescription += ` ${subject.name} has the ${status.name} status, adding ${status.effect.allRolls} to the roll (roll is now ${result}).`;
        }
      });
    }

    return { amount: result, description: rollDescription };
  }

  autoroll = async (subject: Combatant, description: string, sides: number) => Combat.rollDie(subject, description, sides);
  living(combatants: Combatant[] = this.allCombatants): Combatant[] { return combatants.filter(c => c.hp > 0); }
  wounded(combatants: Combatant[] = this.allCombatants): Combatant[] { return combatants.filter(c => c.hp > 0 && c.hp < c.maxHp); }
  weakest(combatants: Combatant[] = this.living(this.allCombatants)): Combatant {
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

  static maxSpellSlotsForLevel(level: number): number { return Math.ceil(level / 2); }
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

  get commandHandlers() {
    return {
      roll: this.roller,
      attack: this.pcAttacks.bind(this),
      hit: this.handleHit.bind(this),
      heal: this.handleHeal.bind(this),
      status: this.handleStatusEffect.bind(this)
    }
  }

  async pcTurn(combatant: Combatant, enemies: Combatant[], allies: Combatant[]) {
    console.log(`It's ${Presenter.combatant(combatant)}'s turn!`);
    const choices: Choice<Ability>[] = [ ];

    let spellSlotsRemaining = (Combat.maxSpellSlotsForCombatant(combatant) || 0) - (combatant.spellSlotsUsed || 0);
    let pips = "";

    let abilities = combatant.abilities.map(a => this.abilityHandler.getAbility(a)); //.filter(a => a);
    abilities.forEach((ability: Ability) => {
      let validTargets = this.abilityHandler.validTargets(ability, combatant, allies, enemies);
      let disabled = validTargets.length === 0;
      if (ability.target.includes("randomEnemies") && this.living(enemies).length > 0) {
        disabled = false;
      }
      if (!disabled) {
        if (ability.type == "spell") {
          pips = "⚡".repeat(spellSlotsRemaining) + "⚫".repeat((Combat.maxSpellSlotsForCombatant(combatant) || 0) - spellSlotsRemaining);
          disabled = spellSlotsRemaining === 0;
        } else if (ability.type == "skill") {
          // want to track consumption here
          // console.log("Already used ", ability.name, "?", combatant.abilitiesUsed?.includes(ability.name) || false)
          // disabled = !combatant.abilitiesUsed?.includes(ability.name);
        } else {
          throw new Error(`Unknown ability type: ${ability.type}`);
        }
      }

      choices.push({
        disabled,
        short: ability.name + " " + pips,
        name: `${ability.name} (${ability.description})`,
        value: ability
      })
    });

    const action: Ability = await this.select(`Your turn, ${Presenter.combatant(combatant)} - what do you do?`, choices, combatant);

    let validTargets = this.abilityHandler.validTargets(action, combatant, allies, enemies);
    let targetOrTargets = validTargets[0];
    if (validTargets.length > 1) {
      targetOrTargets = await this.select(`Select target(s) for ${action.name}:`, validTargets.map(t => ({
        name: Array.isArray(t) ? t.map(c => Presenter.combatant(c)).join("; ") : t.name,
        value: t,
        short: Array.isArray(t) ? t.map(c => c.name).join(", ") : t.name,
        disabled: false //Array.isArray(t) ? t.every(c => c.hp <= 0) : t.hp <= 0
      })), combatant);
    } else if (action.target.includes("randomEnemies") && action.target.length === 2) {
      // pick random enemies
      let count = action.target[1] as any as number;
      let possibleTargets = this.living(enemies);
      targetOrTargets = [];
      for (let i = 0; i < count; i++) {
        targetOrTargets.push(possibleTargets[Math.floor(Math.random() * possibleTargets.length)]);
      }
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
    }
    this.emit({ type: "heal", subject: healer, target, amount } as Omit<HealEvent, "turn">);
  }

  async handleHit(attacker: Combatant, defender: Combatant, damage: number, critical: boolean, by: string, success: boolean): Promise<void> {
    if (!success) {
      this.emit({ type: "miss", subject: attacker, target: defender } as Omit<MissEvent, "turn">);
      return;
    }

    defender.hp -= damage;
    this.emit({ type: "hit", subject: attacker, target: defender, damage, success: true, critical, by } as Omit<HitEvent, "turn">);
    if (defender.hp <= 0) {
      this.emit({ type: "fall", subject: defender } as Omit<FallenEvent, "turn">);
    }
  }

  async pcAttacks(combatant: Combatant, target: Combatant, roller: Roll = this.roller): Promise<{
    success: boolean;
    target: Combatant;
  }> {
    const { damage, critical, success } = await Fighting.attack(roller, combatant, target);
    await this.handleHit(combatant, target, damage, critical, `${combatant.forename}'s ${combatant.weapon}`, success);
    return { success, target };
  }

  async npcTurn(combatant: Combatant, enemies: Combatant[], allies: Combatant[]) {
    // TODO pick weakest enemy / apply AI behavior...
    await this.pcTurn(combatant, enemies, allies);
  }

  async turn(combatant: Combatant) {
    const targets = this.teams.find(team => team.combatants.includes(combatant)) === this.teams[0] ? (this.teams[1].combatants) : (this.teams[0].combatants);

    let validTargets = this.living(targets);
    if (validTargets.length === 0) {
      return;
    }

    if (combatant.activeEffects) {
      combatant.activeEffects.forEach(it => it.duration--);
      for (const status of combatant.activeEffects) {
        if (status.duration === 0) {
          this.emit({ type: "statusExpire", subject: combatant, effectName: status.name } as Omit<StatusExpireEvent, "turn">);
        }
      }
    }

    // don't attempt to act if we're already defeated
    if (combatant.hp <= 0) { return; }

    let allies = this.teams.find(team => team.combatants.includes(combatant))?.combatants || [];
    allies = this.living(allies).filter(c => c !== combatant);
    if (combatant.playerControlled) {
      await this.pcTurn(combatant, validTargets, allies);
    } else {
      await this.npcTurn(combatant, validTargets, allies);
    }

    if (combatant.activeEffects) {
      combatant.activeEffects = combatant.activeEffects.filter(it => it.duration > 0);
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
      type: "roundStart", combatants: this.living(this.combatantsByInitiative.map(c => c.combatant))
    } as Omit<RoundStartEvent, "turn">);

    for (const { combatant } of this.combatantsByInitiative) {
      if (combatant.hp <= 0) continue; // Skip defeated combatants
      await this.turn(combatant);
    }

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

