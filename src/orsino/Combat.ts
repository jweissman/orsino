import Choice from "inquirer/lib/objects/choice";
import { Combatant } from "./types/Combatant";
import Presenter from "./tui/Presenter";
import { Team } from "./types/Team";
import { Roll } from "./types/Roll";
import { Fighting } from "./rules/Fighting";
import Events, { CombatEvent, InitiateCombatEvent, StatusExpireEvent, RoundStartEvent, CombatEndEvent, FleeEvent } from "./Events";
import AbilityHandler, { Ability } from "./Ability";
import { Answers } from "inquirer";
import { AbilityScoring } from "./tactics/AbilityScoring";
import { Commands } from "./rules/Commands";

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
    this.roller = options.roller || Commands.roll;
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
          forename: "Hero", name: "Hero",
          hp: 14, maxHp: 14, level: 1, ac: 10,
          dex: 11, str: 12, int: 10, wis: 10, cha: 10, con: 12,
          attackRolls: 1, damageDie: 8, playerControlled: true, xp: 0, gp: 0,
          weapon: "Short Sword", damageKind: "slashing", abilities: ["melee"], traits: []
        }], healingPotions: 3
      },
      {
        name: "Enemy", combatants: [
          { forename: "Zok", name: "Goblin A", hp: 4, maxHp: 4, level: 1, ac: 17, attackRolls: 2, damageDie: 3, str: 8, dex: 14, int: 10, wis: 8, cha: 8, con: 10, weapon: "Dagger", damageKind: "slashing", abilities: ["melee"], traits: [] },
          {
            forename: "Mog", name: "Goblin B", hp: 4, maxHp: 4, level: 1, ac: 17, attackRolls: 2, damageDie: 3,
            str: 8, dex: 14, int: 10, wis: 8, cha: 8, con: 10, weapon: "Dagger", damageKind: "slashing", abilities: ["melee"], traits: []
          }
        ], healingPotions: 0
      }
    ];
  }

  protected note(message: string) { this.outputSink(message); }

  protected emit(event: Omit<CombatEvent, "turn">): void {
    let e: CombatEvent = { ...event, turn: this.turnNumber } as CombatEvent;
    this.journal.push(e);
    this.note(
      Events.iconForEvent(e) + " " + Events.present(e)
    );
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

  get allCombatants() { return this.teams.flatMap(team => team.combatants); }
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
    // this.combatantsByInitiative = await this.determineInitiative();
    this.emit({ type: "initiate", order: this.combatantsByInitiative } as Omit<InitiateCombatEvent, "turn">);
    this.allCombatants.forEach(c => c.abilitiesUsed = []);
    await this.abilityHandler.loadAbilities();
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

  validActions(combatant: Combatant, allies: Combatant[], enemies: Combatant[]): Ability[] {
    const validAbilities: Ability[] = [];

    let spellSlotsRemaining = (Combat.maxSpellSlotsForCombatant(combatant) || 0) - (combatant.spellSlotsUsed || 0);
    let abilities = combatant.abilities.map(a => this.abilityHandler.getAbility(a)); //.filter(a => a);
    abilities.forEach((ability: Ability) => {
      let validTargets = AbilityHandler.validTargets(ability, combatant, allies, enemies);
      let disabled = validTargets.length === 0;
      if (ability.target.includes("randomEnemies") && Combat.living(enemies).length > 0) {
        // note we need a special case here since randomEnemies doesn't have valid targets until we select them
        disabled = false;
      }

      // if _only_ a healing effect and target is ally/self/allies and NO wounded allies, disable
      if (!disabled && ability.effects.every(e => e.type === "heal") && ability.effects.length > 0) {
        if (Combat.wounded([...allies, combatant]).length === 0) {
          disabled = true;
        } else if (ability.target.includes("self") && combatant.hp === combatant.maxHp) {
          disabled = ability.target.length === 1; // if only self-targeting, disable; if also allies, allow
        } else if ((ability.target.includes("allies") || ability.target.includes("ally")) && Combat.wounded(allies).length === 0) {
          disabled = ability.target.length === 1; // if only allies-targeting, disable; if also self, allow
        }
      }

      if (!disabled && ability.effects.some(e => e.type === "summon")) {
        disabled = Combat.living(this.allCombatants).length >= 6; // arbitrary cap on total combatants
      }

      // if there is a conditional status to the ability like backstab requiring Hidden, check for that
      if (ability.condition?.status) {
        if (!combatant.activeEffects?.map(e => e.name).includes(ability.condition.status)) {
          disabled = true;
        }
      }

      if (!disabled) {
        if (ability.type == "spell") {
          disabled = spellSlotsRemaining === 0;
        } else if (ability.type == "skill") {
          // want to track consumption here...
          // console.log("Already used ", ability.name, "?", combatant.abilitiesUsed?.includes(ability.name) || false)
          if (!ability.name.match(/melee|ranged|wait/i)) {
            // let alreadyUsed = (combatant.abilitiesUsed||[]).includes(ability.name);
            // disabled = alreadyUsed;
            // Check cooldown
            let cooldownRemaining = combatant.abilityCooldowns?.[ability.name] || 0;
            if (cooldownRemaining > 0) {
              disabled = true;
            }
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
    let validAbilities = this.validActions(combatant, allies, enemies);
    let allAbilities = combatant.abilities.map(a => this.abilityHandler.getAbility(a));

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
      let combatantFx = Fighting.gatherEffects(combatant);
      let consumableMultiplier = combatantFx.consumableMultiplier || 1;
      choices.push({
        value: { name: "Quaff", type: "potion", description: "Drink a healing potion to restore 2d4+2 HP.", aspect: "divine", target: ["self"], effects: [{ type: "heal", amount: `=round((2d4+2)*${consumableMultiplier})` }, { type: "removeItem", item: "healingPotions" }] },
        name: "Quaff Potion (Heal 2d4+2 HP)",
        short: "Quaff Potion",
        disabled: false
      });
    }

    const action: Ability = await this.select(`Your turn, ${Presenter.combatant(combatant)} - what do you do?`, choices, combatant);

    let validTargets = AbilityHandler.validTargets(action, combatant, allies, enemies);
    let targetOrTargets = validTargets[0];
    if (validTargets.length > 1) {
      targetOrTargets = await this.select(`Select target(s) for ${action.name}:`, validTargets.map(t => ({
        name: Array.isArray(t) ? t.map(c => c.forename).join("; ") : Presenter.combatant(t),
        value: t,
        short: Array.isArray(t) ? t.map(c => c.forename).join(", ") : Presenter.combatant(t),
        disabled: false
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

      // set cooldown
      let cooldown = action.cooldown || 3;
      combatant.abilityCooldowns = combatant.abilityCooldowns || {};
      combatant.abilityCooldowns[action.name] = cooldown;

    } else if (action.type === "spell") {
      combatant.spellSlotsUsed = (combatant.spellSlotsUsed || 0) + 1;
    }

    let team = this.teams.find(t => t.combatants.includes(combatant));
    let { events } = await AbilityHandler.perform(action, combatant, targetOrTargets, Commands.handlers(this.roller, team!));
    events.forEach(e => this.emit({ ...e, turn: this.turnNumber } as CombatEvent));
  }


  async npcTurn(combatant: Combatant, enemies: Combatant[], allies: Combatant[]) {
    let validAbilities = this.validActions(combatant, allies, enemies);
    let scoredAbilities = validAbilities.map(ability => ({
      ability,
      score: AbilityScoring.scoreAbility(ability, combatant, allies, enemies)
    }));
    console.log(`NPC ${combatant.forename} rates abilities:`, scoredAbilities.map(sa => `${sa.ability.name} (${sa.score})`).join(", "));
    scoredAbilities.sort((a, b) => b.score - a.score);
    const action = scoredAbilities[
      Math.floor(Math.random() * Math.min(2, scoredAbilities.length))
    ]?.ability;
    let targetOrTargets: Combatant | Combatant[] = AbilityScoring.bestAbilityTarget(action, combatant, allies, enemies);

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
    this.note(Presenter.minimalCombatant(combatant) + ` ${verb} ` + action.name + "!");
    let team = this.teams.find(t => t.combatants.includes(combatant));
    let { events } = await AbilityHandler.perform(action, combatant, targetOrTargets, Commands.handlers(this.roller, team!));
    events.forEach(e => this.emit({ ...e, turn: this.turnNumber } as CombatEvent));
  }

  async turn(combatant: Combatant) {
    this.emit({ type: "turnStart", subject: combatant, combatants: this.allCombatants } as Omit<CombatEvent, "turn">);

    // Tick down cooldowns
    if (combatant.abilityCooldowns) {
      Object.keys(combatant.abilityCooldowns).forEach(name => {
        combatant.abilityCooldowns![name] = Math.max(0, combatant.abilityCooldowns![name] - 1);
      });
    }

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
            let { events } = await AbilityHandler.handleEffect(status.name, effect, effect.by || combatant, combatant, Commands.handlers(this.roller, this.teams.find(t => t.combatants.includes(combatant))!));
            events.forEach(e => this.emit({ ...e, turn: this.turnNumber } as CombatEvent));
          }
        }
      }
    }
  }

  async round() {
    if (this.isOver()) {
      throw new Error('Combat is already over');
    }
    this.combatantsByInitiative = await this.determineInitiative();
    this.turnNumber++;
    this.emit({
      type: "roundStart", combatants: Combat.living(this.combatantsByInitiative.map(c => c.combatant))
    } as Omit<RoundStartEvent, "turn">);

    // check for escape conditions (if 'flee' status is active, remove the combatant from combat)
    Combat.living(this.allCombatants).forEach(combatant => {
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
    Combat.living(this.allCombatants).forEach(combatant => {
      if (combatant.activeEffects) {
        combatant.activeEffects.forEach(it => { if (it.duration) { it.duration-- } });
        for (const status of combatant.activeEffects) {
          if (status.duration === 0) {
            this.emit({ type: "statusExpire", subject: combatant, effectName: status.name } as Omit<StatusExpireEvent, "turn">);
          }
        }
      }
      combatant.activeEffects = combatant.activeEffects?.filter(it => (it.duration || 0) > 0) || [];
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

