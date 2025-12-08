import Choice from "inquirer/lib/objects/choice";
import { Combatant } from "./types/Combatant";
import Presenter from "./tui/Presenter";
import { Team } from "./types/Team";
import { Roll } from "./types/Roll";
import { Fighting } from "./rules/Fighting";
import Events, { CombatEvent, StatusExpireEvent, RoundStartEvent, CombatEndEvent, FleeEvent, GameEvent, CombatantEngagedEvent } from "./Events";
import AbilityHandler, { Ability, StatusEffect } from "./Ability";
import { Answers } from "inquirer";
import { AbilityScoring } from "./tactics/AbilityScoring";
import { Commands } from "./rules/Commands";
import Deem from "../deem";
import TraitHandler from "./Trait";
import Stylist from "./tui/Style";
import Bark from "./Bark";
import { Inventory } from "./Inventory";

export type ChoiceSelector<T extends Answers> = (description: string, options: Choice<T>[], combatant?: Combatant) => Promise<T>;

export interface CombatContext {
  subject: Combatant;
  allies: Combatant[];
  enemies: Combatant[];
}

export default class Combat {
  static statistics = {
    combats: 0,
    victories: 0,
    defeats: 0,
    totalRounds: 0,
  }

  private turnNumber: number = 0;
  public winner: string | null = null;
  public teams: Team[] = [];
  public abilityHandler = AbilityHandler.instance;
  private combatantsByInitiative: { combatant: any; initiative: number }[] = [];
  private environmentName: string = "Unknown Location";

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

  protected note(message: string) { this.outputSink(message); }
  protected async emit(event: Omit<GameEvent, "turn">, prefix = ""): Promise<void> {
    let e: CombatEvent = { ...event, turn: this.turnNumber } as CombatEvent;
    this.journal.push(e);

    if (Events.present(e) !== "") {
      this.note(prefix + Events.present(e));
    }

    let bark = await Bark.lookup(event);
    if (bark) {
      bark = bark.charAt(0).toUpperCase() + bark.slice(1);
      this.note(prefix + Stylist.italic(bark));
    }
  }

  protected async emitAll(events: Omit<GameEvent, "turn">[], message?: string): Promise<void> {
    if (message) {
      this.note(Stylist.bold(message));
      let arrow = " └ ";
      for (let i = 0; i < events.length; i++) {
        await this.emit(events[i], arrow);
      }
    } else {
      for (let i = 0; i < events.length; i++) {
        await this.emit(events[i]);
      }
    }
  }

  private async determineInitiative(): Promise<{ combatant: any; initiative: number }[]> {
    let initiativeOrder = [];
    for (let c of this.allCombatants) {
      let effective = await Fighting.effectiveStats(c);
      let initBonus = Fighting.turnBonus(c, ["initiative"]).initiative || 0;
      const initiative = (await Commands.roll(c, "for initiative", 20)).amount + Fighting.statMod(effective.dex) + initBonus;
      // (await this.roller(c, "for initiative", 20)).amount + Fighting.statMod(effective.dex) + initBonus;
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
    teams = Combat.defaultTeams(),
    environment = 'Dungeon | Room -1',
    auras: StatusEffect[] = []
  ) {
    this.turnNumber = 0;
    this.winner = null;
    this.teams = teams;
    this.environmentName = environment;
    for (let c of this.allCombatants) {
      c.abilitiesUsed = [];
      c.abilityCooldowns = {};
      c.savedTimes = {};
      c.activeEffects = []; // c.activeEffects || [];

      c.passiveEffects = [];
      c.traits = c.traits || [];

      let traitHandler = TraitHandler.instance;
      await traitHandler.loadTraits();
      c.traits.forEach(traitName => {
        const trait = traitHandler.getTrait(traitName);
        if (trait) {
          c.passiveEffects ||= [];
          for (const status of trait.statuses) {
            if (!c.passiveEffects?.map(e => e.name).includes(status.name)) {
              c.passiveEffects.push(status);
            }
          }
        }
      });

      // apply auras
      c.activeEffects ||= [];
      c.activeEffects.push(...auras);

      await this.emit({ type: "engage", subject: c } as Omit<CombatantEngagedEvent, "turn">);
    }
    await this.abilityHandler.loadAbilities();

    Combat.statistics.combats += 1;
  }

  static maxSpellSlotsForLevel(level: number): number { return 2 + Math.ceil(level); }
  static maxSpellSlotsForCombatant(combatant: Combatant): number {
    if (combatant.class === "mage") {
      return Combat.maxSpellSlotsForLevel(combatant.level || 1) + Math.max(0, Fighting.statMod(combatant.int));
    } else if (combatant.class === "bard") {
      return Combat.maxSpellSlotsForLevel(combatant.level || 1) + Math.max(0, Fighting.statMod(combatant.cha));
    } else if (combatant.class === "cleric") {
      return Combat.maxSpellSlotsForLevel(combatant.level || 1) + Math.max(0, Fighting.statMod(combatant.wis));
    }

    return Combat.maxSpellSlotsForLevel(combatant.level || 1)
  }

  async validateAction(ability: Ability, combatant: Combatant, allies: Combatant[], enemies: Combatant[]): Promise<boolean> {
    let activeFx = await Fighting.gatherEffects(combatant);
    if (activeFx.compelNextMove) {
      let compelledAbility = this.abilityHandler.getAbility(activeFx.compelNextMove as string);
      let validTargets = AbilityHandler.validTargets(compelledAbility, combatant, allies, enemies);
      if (compelledAbility && validTargets.length > 0) {
        return ability.name === compelledAbility.name;
      }
    }

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
      // let allies = this.teams.find(t => t.combatants.includes(combatant));
      // console.log(`Checking summon ability ${ability.name} for combatant ${combatant.forename} with ${allies.length} allies...`);
      disabled = allies.length >= 5; // arbitrary cap on total combatants
    }

    // if there is a conditional status to the ability like backstab requiring Hidden, check for that
    let condition = ability.condition;
    if (condition) {
      if (condition.status) {
        if (!combatant.activeEffects?.map(e => e.name).includes(condition.status)) {
          disabled = true;
        }
      } else if (condition.dead) {
        if (ability.target.includes("ally") || ability.target.includes("allies")) {
          let targetAllies = allies.filter(a => a.hp <= 0);
          if (targetAllies.length === 0) {
            disabled = true;
          }
        }
      }
    }

    if (ability.condition?.hasInterceptWeapon) {
      disabled = !combatant.hasInterceptWeapon;
    }

    if (!disabled) {
      if (ability.type == "spell") {
        let spellSlotsRemaining = (Combat.maxSpellSlotsForCombatant(combatant) || 0) - (combatant.spellSlotsUsed || 0);
        // if we have a noSpellcasting effect, set spellSlotsRemaining to 0
        if (activeFx.noSpellcasting) {
          spellSlotsRemaining = 0;
        }
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
        // } else {
        // throw new Error(`Unknown ability type: ${ability.type}`);
      }
    }
    // console.log(`Validating action '${ability.name}' for ${combatant.forename}: disabled=${disabled}`);
    return !disabled;

  }

  async validActions(combatant: Combatant, allies: Combatant[], enemies: Combatant[]): Promise<Ability[]> {
    const validAbilities: Ability[] = [];

    // do we have a 'compelNextMove' effect?
    let activeFx = await Fighting.gatherEffects(combatant);
    if (activeFx.compelNextMove) {
      let compelledAbility = this.abilityHandler.getAbility(activeFx.compelNextMove as string);
      let validTargets = AbilityHandler.validTargets(compelledAbility, combatant, allies, enemies);
      if (compelledAbility && validTargets.length > 0) {
        return [compelledAbility];
      }
    }
    let uniqAbilities = Array.from(new Set(combatant.abilities));
    let abilities = uniqAbilities.map(a => this.abilityHandler.getAbility(a)); //.filter(a => a);
    for (const ability of abilities) {
      let disabled = !(await this.validateAction(ability, combatant, allies, enemies));
      if (!disabled) {
        validAbilities.push(ability);
      }
    }

    return validAbilities;
  }

  static inventoryQuantities(team: Team): { [itemName: string]: number } {
    return Inventory.quantities(team.inventory || []);
  }

  async pcTurn(combatant: Combatant, enemies: Combatant[], allies: Combatant[]): Promise<{ haltRound: boolean }> {
    let inventoryItems = this.teams[0].inventory || [];
    let itemQuantities = Combat.inventoryQuantities(this.teams[0]);
    let itemAbilities = [];
    for (let [itemKey, qty] of Object.entries(itemQuantities)) {
      if (qty > 0) {
        let itemAbility = await Deem.evaluate(`lookup(consumables, '${itemKey}')`);
        // sum charges across all instances of this item
        let matchingItems = inventoryItems.filter(ii => ii.name === itemKey);
        let totalCharges = 0;
        let chargeBased = itemAbility.charges !== undefined;
        if (!chargeBased) {
          // not charge based, so just add as is
          itemAbilities.push({ ...itemAbility, key: itemKey });
          continue;
        }

        for (let mi of matchingItems) {
          if (mi.charges !== undefined) {
            totalCharges += mi.charges;
          } else {
            throw new Error(`Item instance ${mi.name} is missing charges property.`);
          }
        }
        if (totalCharges <= 0) {
          continue;
        }
        itemAbilities.push({ ...itemAbility, description: itemAbility.description + `(${totalCharges} charges left)`, key: itemKey });
      }
    }

    let allAbilities = combatant.abilities.map(a => this.abilityHandler.getAbility(a))
      .concat(itemAbilities);

    let pips = "";
    pips += "⚡".repeat((Combat.maxSpellSlotsForCombatant(combatant) || 0) - ((combatant.spellSlotsUsed || 0))) + "⚫".repeat(combatant.spellSlotsUsed || 0);
    let choices = [];
    // allAbilities.map(ability => {
    //   return ({
    for (const ability of allAbilities) {
      choices.push({
        value: ability,
        name: `${ability.name.padEnd(15)} (${ability.description}/${ability.type === "spell" ? pips : "skill"})`,
        short: ability.name,
        disabled: !(await this.validateAction(ability, combatant, allies, enemies))
      })
    }

    choices.push({
      value: { name: "Wait", type: "skill", description: "Skip your turn to wait and see what happens.", aspect: "physical", target: ["self"], effects: [] },
      name: "Wait (Skip your turn)",
      short: "Wait",
      disabled: false
    })

    // choices.push({
    //   value: { name: "Flee", type: "skill", description: "Attempt to flee from combat.", aspect: "physical", target: ["self"], effects: [{ type: "flee" }] },
    //   name: "Flee (Attempt to escape combat)",
    //   short: "Flee",
    //   disabled: false
    // })

    const action: Ability = await this.select(`Your turn, ${Presenter.minimalCombatant(combatant)} - what do you do?`, choices, combatant);

    if (action.name === "Flee") {
      let succeed = Math.random() < 0.5;
      if (succeed) {
        console.log("You successfully flee from combat!");
        this.winner = "Enemy";
        // this.combatantsByInitiative = [];
        return { haltRound: true };
      }
      console.log("You attempt to flee but could not escape!");
      return { haltRound: false };

    } else if (action.name === "Wait") {
      this.note(`${Presenter.combatant(combatant)} waits and watches.`);
      return { haltRound: false };
    }

    let validTargets = AbilityHandler.validTargets(action, combatant, allies, enemies);
    let targetOrTargets = validTargets[0];
    if (validTargets.length > 1) {
      targetOrTargets = await this.select(`Select target(s) for ${action.name}:`, validTargets.map(t => ({
        name: Array.isArray(t) ? t.map(c => c.forename).join("; ") : Presenter.combatant(t),
        value: t,
        short: Array.isArray(t) ? t.map(c => c.forename).join(", ") : Presenter.minimalCombatant(t),
        disabled: false
      })), combatant);
    } else if (action.target.includes("randomEnemies") && action.target.length === 2) {
      // pick random enemies
      // if (action.target[1] is a number use that)
      let count = 1;
      if (typeof action.target[1] === "number") {
        count = action.target[1];
      } else if (typeof action.target[1] === "string") {
        count = await Deem.evaluate(action.target[1], { ...combatant }); // as any as number;
      } else {
        throw new Error(`Invalid target count specification for randomEnemies: ${action.target[1]}`);
      }
      console.log(`Selecting ${count} random enemy targets for ${action.name}...`);
      let possibleTargets = Combat.living(enemies);
      targetOrTargets = [];
      for (let i = 0; i < count; i++) {
        targetOrTargets.push(possibleTargets[Math.floor(Math.random() * possibleTargets.length)]);
      }
    }

    if (action.type === "skill" && !action.name.match(/melee|ranged|wait/i)) {
      // combatant.abilitiesUsed = combatant.abilitiesUsed || [];
      // combatant.abilitiesUsed.push(action.name);

      // set cooldown
      let cooldown = action.cooldown || 3;
      combatant.abilityCooldowns = combatant.abilityCooldowns || {};
      combatant.abilityCooldowns[action.name] = cooldown;

    } else if (action.type === "spell") {
      combatant.spellSlotsUsed = (combatant.spellSlotsUsed || 0) + 1;
    }

    if (action.type === "consumable") {
      // would be nice to handle charges (find first one with charges available and reduce that)
      if (action.charges !== undefined) {
        // note we don't actually store a full item record so we need a secondary way to track charges
        // find first item instance with charges available and reduce that
        let inventory = this.teams[0].inventory || [];
        let itemInstance = inventory.find(ii => ii.name === action.key && (ii.charges === undefined || ii.charges > 0));
        if (itemInstance) {
          if (itemInstance.charges !== undefined) {
            itemInstance.charges -= 1;
          }
          this.note(`${Presenter.combatant(combatant)} uses ${action.name} (${itemInstance.charges} charges remaining).`);
        }
      } else {
        // _remove_ item from inventory
        let inventory = this.teams[0].inventory || [];
        let itemIndex = inventory.findIndex(ii => ii.name === action.key);
        if (itemIndex !== -1) {
          inventory.splice(itemIndex, 1);
          this.teams[0].inventory = inventory;
        }
        let remaining = inventory.filter(ii => ii.name === action.key).length;
        this.note(`${Presenter.combatant(combatant)} uses ${action.name} (${remaining} remaining).`);
        // reduce item count in inventory
        // let inventory = this.teams[0].inventory || {};
        // if (inventory[action.key] && inventory[action.key] > 0) {
        //   inventory[action.key] -= 1;
        //   this.teams[0].inventory = inventory;
        // }
        // this.note(`${Presenter.combatant(combatant)} uses ${action.name} (${inventory[action.key]} remaining).`);
      }

    }

    let team = this.teams.find(t => t.combatants.includes(combatant));
    let ctx: CombatContext = { subject: combatant, allies, enemies };
    let { events } = await AbilityHandler.perform(action, combatant, targetOrTargets, ctx, Commands.handlers(this.roller, team!));
    await this.emitAll(events, Combat.describeAbility(action, combatant));

    return { haltRound: false };
  }


  async npcTurn(combatant: Combatant, enemies: Combatant[], allies: Combatant[]) {
    let validAbilities = await this.validActions(combatant, allies, enemies);
    if (validAbilities.length === 0) {
      this.note(`${Presenter.combatant(combatant)} has no valid actions and skips their turn.`);
      return { haltRound: false };
    }

    let scoredAbilities = validAbilities.map(ability => ({
      ability,
      score: AbilityScoring.scoreAbility(ability, combatant, allies, enemies)
    }));

    // console.log(`${combatant.forename} rates abilities:`, scoredAbilities.map(sa => `${sa.ability.name} (${sa.score})`).join(", "));

    scoredAbilities.sort((a, b) => b.score - a.score);
    const action = scoredAbilities[
      Math.floor(Math.random() * Math.min(2, scoredAbilities.length))
    ]?.ability;

    if (!action) {
      this.note(`${Presenter.minimalCombatant(combatant)} has no valid actions and skips their turn.`);
      return { haltRound: false };
    }
    // console.log(
    //   `Considering best targets for ${action?.name}...`, { allies: allies.map(a => a.name), enemies: enemies.map(e => e.name) }
    // )
    let targetOrTargets: Combatant | Combatant[] = AbilityScoring.bestAbilityTarget(action, combatant, allies, enemies);

    if (targetOrTargets === null || targetOrTargets === undefined) {
      this.note(`${Presenter.minimalCombatant(combatant)} has no valid targets for ${action?.name} and skips their turn.`);
      return { haltRound: false };
      // } else {
    }
    // console.log(
    //   `${combatant.forename} chooses to use ${action?.name} on ${Array.isArray(targetOrTargets) ? targetOrTargets.map(t => t.forename).join(", ") : (targetOrTargets as Combatant).forename}.`
    // );

    combatant.abilityCooldowns = combatant.abilityCooldowns || {};
    if (action.type === "skill" && !action.name.match(/melee|ranged|wait/i)) {
      // set cooldown
      let cooldown = action.cooldown || 3;
      combatant.abilityCooldowns[action.name] = cooldown;
    }

    // use spell slots
    if (action.type === "spell") {
      combatant.spellSlotsUsed = (combatant.spellSlotsUsed || 0) + 1;
    }

    // invoke the action
    let team = this.teams.find(t => t.combatants.includes(combatant));
    let ctx: CombatContext = { subject: combatant, allies, enemies };
    let { events } = await AbilityHandler.perform(action, combatant, targetOrTargets, ctx, Commands.handlers(this.roller, team!));
    await this.emitAll(events, Combat.describeAbility(action, combatant));

    return { haltRound: false };
  }

  static describeAbility(action: Ability, user: Combatant): string {
    let verb = action.type === "spell" ? 'casts' : 'readies';
    let actionName = Stylist.italic(action.name.toLowerCase());
    let message = (user.forename + (verb ? ` ${verb} ` : " ") + actionName + "."); // for " + (Array.isArray(targetOrTargets) ? + targetOrTargets.map(t => Presenter.minimalCombatant(t)).join(", ") : Presenter.minimalCombatant(targetOrTargets)) + ".");
    return message;
  }

  async turn(combatant: Combatant): Promise<{ haltRound: boolean }> {
    // don't attempt to act if we're already defeated
    if (combatant.hp <= 0) {
      console.warn(`${Presenter.minimalCombatant(combatant)} is defeated and cannot act.`);
      return { haltRound: false };
    }

    console.log("\n" + Presenter.combatant(combatant));

    await this.emit({ type: "turnStart", subject: combatant, combatants: this.allCombatants } as Omit<CombatEvent, "turn">);

    // Tick down cooldowns
    if (combatant.abilityCooldowns) {
      Object.keys(combatant.abilityCooldowns).forEach(name => {
        combatant.abilityCooldowns![name] = Math.max(0, combatant.abilityCooldowns![name] - 1);
      });
    }

    // if we have an 'inactive' status (eg from sleep spell) skip our turn
    if (combatant.activeEffects?.some(e => e.effect.noActions)) {
      let status = combatant.activeEffects.find(e => e.effect.noActions);
      this.note(`${Presenter.minimalCombatant(combatant)} is ${status!.name} (${status!.duration || "--"}) and skips their turn!`);
      return { haltRound: false };
    }

    const targets = this.teams.find(team => team.combatants.includes(combatant)) === this.teams[0] ? (this.teams[1].combatants) : (this.teams[0].combatants);

    let validTargets = Combat.living(targets);
    // if (validTargets.length === 0) {
    //   console.warn("No valid targets for ", Presenter.minimalCombatant(combatant), " -- skipping turn.");
    //   console.log(" - All possible targets:", targets.map(t => Presenter.minimalCombatant(t)).join(", "));
    //   console.log(" - Living targets:", validTargets.map(t => Presenter.minimalCombatant(t)).join(", "));
    //   return { haltRound: false };
    // }

    let allies = this.teams.find(team => team.combatants.includes(combatant))?.combatants || [];
    allies = allies.filter(c => c !== combatant);

    let allEnemies = this.teams.find(team => team.combatants.includes(combatant)) === this.teams[0] ? (this.teams[1].combatants) : (this.teams[0].combatants);
    allEnemies = Combat.living(allEnemies);

    // do we have an effect changing our allegiance? in which case -- flip our allies/enemies
    let allegianceEffect = combatant.activeEffects?.find(e => e.effect.changeAllegiance);
    if (allegianceEffect) {
      this.note(`${combatant.forename} is under the effect of ${allegianceEffect.name} and has switched sides!`);
      [allies, validTargets] = [validTargets, allies];
    }

    // console.log(`DEBUG ${combatant.forename} turn:`);
    // console.log(`  - This combatant's team: ${this.teams.find(t => t.combatants.includes(combatant)) === this.teams[0] ? 'team0' : 'team1'}`);
    // console.log(`  - Team 0 combatants: ${this.teams[0].combatants.map(c => `${c.forename}(${c.hp}HP)`).join(', ')}`);
    // console.log(`  - Team 1 combatants: ${this.teams[1].combatants.map(c => `${c.forename}(${c.hp}HP)`).join(', ')}`);
    // console.log(`  - Living enemies (validTargets): ${validTargets.map(c => `${c.forename}(${c.hp}HP)`).join(', ')}`);
    // console.log(`  - Allies: ${allies.map(c => `${c.forename}(${c.hp}HP)`).join(', ')}`);

    let attacksPerTurn = combatant.attacksPerTurn || 1;
    for (let i = 0; i < attacksPerTurn; i++) {
      if (combatant.playerControlled && !allegianceEffect) {
        let result = await this.pcTurn(combatant, validTargets, allies);
        if (result.haltRound) {
          return { haltRound: true };
        }
      } else {
        await this.npcTurn(combatant, validTargets, allies);
      }
    }

    if (combatant.activeEffects) {
      // run onTurnEnd for all active effects
      let ctx = { subject: combatant, allies, enemies: allEnemies };
      for (const status of combatant.activeEffects) {
        if (status.effect['onTurnEnd']) {
          for (const effect of status.effect['onTurnEnd']) {
            // apply fx to self
            let { events } = await AbilityHandler.handleEffect(status.name, effect, effect.by || combatant, combatant, ctx, Commands.handlers(this.roller, this.teams.find(t => t.combatants.includes(combatant))!));
            await this.emitAll(events);
          }
        }
      }
    }

    return { haltRound: false };
  }

  async round(
    creatureFlees: (combatant: Combatant) => Promise<void> = async (_c: Combatant) => { }
  ) {
    Combat.statistics.totalRounds += 1;

    if (this.isOver()) {
      throw new Error('Combat is already over');
    }
    this.combatantsByInitiative = await this.determineInitiative();
    this.turnNumber++;
    // check for escape conditions (if 'flee' status is active, remove the combatant from combat)
    // Combat.living(this.allCombatants)
    // this.teams[1].combatants
    //   .forEach(combatant => {
    for (const combatant of this.teams[1].combatants) {
      if (combatant.activeEffects?.some(e => e.effect?.flee)) {
        // remove from combatants / teams
        this.teams.forEach(team => {
          team.combatants = team.combatants.filter(c => c !== combatant);
        });
        this.combatantsByInitiative = this.combatantsByInitiative.filter(c => c.combatant !== combatant);
        await this.emit({ type: "flee", subject: combatant } as Omit<FleeEvent, "turn">);

        await creatureFlees(combatant);
      }
    }

    await this.emit({
      type: "roundStart",
      combatants: Combat.living(this.combatantsByInitiative.map(c => ({ ...c.combatant, friendly: this.teams[0].combatants.includes(c.combatant) }))),
      parties: this.teams,
      environment: this.environmentName
    } as Omit<RoundStartEvent, "turn">);

    for (const { combatant } of this.combatantsByInitiative) {
      let nonplayerCombatants = this.teams[1].combatants.filter(c => c.hp > 0);
      if (nonplayerCombatants.length === 0) {
        // console.warn("All nonplayer combatants dead, skipping remaining turns: ", this.combatantsByInitiative.map(c => c.combatant.forename + `(${c.combatant.hp} HP)`));
        this.winner = this.teams[0].name;

        console.log(Stylist.bold("All enemies defeated! You are victorious!"));
        break;
      }
      if (combatant.hp <= 0) { continue; } // Skip defeated combatants
      if ((combatant.activeEffects || []).some((e: StatusEffect) => e.effect?.flee)) { continue; } // Skip fleeing combatants
      let result = await this.turn(combatant);
      if (result.haltRound) {
        break;
      }
      // }

      // tick down status
      let expiryEvents: StatusExpireEvent[] = [];
      // Combat.living(this.allCombatants).forEach(combatant => {
      if (combatant.activeEffects) {
        combatant.activeEffects.forEach((it: StatusEffect) => {
          if (it.duration !== undefined && it.duration !== Infinity) {
            it.duration = Math.max(0, it.duration - 1);
          }
        });

        for (const status of combatant.activeEffects) {
          if (status.duration === 0) {
            expiryEvents.push({ type: "statusExpire", subject: combatant, effectName: status.name, turn: this.turnNumber });
          }
        }
      }

      combatant.activeEffects = combatant.activeEffects?.filter((it: StatusEffect) =>
        it.duration === undefined || it.duration === Infinity || it.duration > 0
      );

      if (expiryEvents.length > 0) {
        await this.emitAll(expiryEvents, "Effects expire.");
      }
    }


    for (const team of this.teams) {
      if (team.combatants.every((c: any) => c.hp <= 0)) {
        this.winner = team === this.teams[0] ? this.teams[1].name : this.teams[0].name;
        await this.emit({ type: "combatEnd", winner: this.winner } as Omit<CombatEndEvent, "turn">);
        break;
      }
    }

    return; // { number: this.turnNumber, done: this.isOver() };
  }

  isOver() {
    return this.winner !== null;
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
          forename: "Hero", name: "Hero", alignment: "neutral",
          hp: 14, maxHp: 14, level: 1, ac: 10,
          dex: 11, str: 12, int: 10, wis: 10, cha: 10, con: 12,
          attackDie: "1d8",
          playerControlled: true, xp: 0, gp: 0,
          weapon: "Short Sword", damageKind: "slashing", abilities: ["melee"], traits: [],
          hasMissileWeapon: false
        }],
        inventory: []
      },
      {
        name: "Enemy", combatants: [
          {
            forename: "Zok", name: "Goblin A", alignment: "neutral", hp: 4, maxHp: 4, level: 1, ac: 17, //attackRolls: 2, damageDie: 3,
            attackDie: "1d3",
            str: 8, dex: 14, int: 10, wis: 8, cha: 8, con: 10, weapon: "Dagger", damageKind: "slashing", abilities: ["melee"], traits: [], hasMissileWeapon: false, xp: 0, gp: 0
          },
          {
            forename: "Mog", name: "Goblin B", alignment: "neutral", hp: 4, maxHp: 4, level: 1, ac: 17, //attackRolls: 2, damageDie: 3,
            attackDie: "1d3",
            str: 8, dex: 14, int: 10, wis: 8, cha: 8, con: 10, weapon: "Dagger", damageKind: "slashing", abilities: ["melee"], traits: [], hasMissileWeapon: false, xp: 0, gp: 0
          }
        ],
        inventory: []
      }
    ];
  }
}

