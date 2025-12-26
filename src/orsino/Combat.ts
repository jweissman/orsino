import Choice from "inquirer/lib/objects/choice";
import { Combatant } from "./types/Combatant";
import Presenter from "./tui/Presenter";
import { Team } from "./types/Team";
import { Roll } from "./types/Roll";
import { Fighting } from "./rules/Fighting";
import Events, { CombatEvent, RoundStartEvent, CombatEndEvent, FleeEvent, GameEvent, CombatantEngagedEvent, WaitEvent, NoActionsForCombatant, AllegianceChangeEvent, ItemUsedEvent, ActionEvent, ActedRandomly, StatusExpiryPreventedEvent, HealEvent, HitEvent, UnsummonEvent, PlaneshiftEvent } from "./Events";
import AbilityHandler, { Ability, AbilityEffect } from "./Ability";
import { Answers } from "inquirer";
import { AbilityScoring } from "./tactics/AbilityScoring";
import { Commands } from "./rules/Commands";
import Deem from "../deem";
import TraitHandler from "./Trait";
import Stylist from "./tui/Style";
import Bark from "./Bark";
import { Inventory } from "./Inventory";
import Orsino from "../orsino";
import Words from "./tui/Words";
import { StatusEffect } from "./Status";
import Automatic from "./tui/Automatic";

export type ChoiceSelector<T extends Answers> = (description: string, options: Choice<T>[], combatant?: Combatant) => Promise<T>;

export interface CombatContext {
  subject: Combatant;
  allies: Combatant[];
  enemies: Combatant[];
}

type CombatStats = {
  combats: number;
  victories: number;
  defeats: number;
  totalRounds: number;
}

export default class Combat {
  static statistics: CombatStats = {
    combats: 0,
    victories: 0,
    defeats: 0,
    totalRounds: 0,
  }

  private turnNumber: number = 0;
  public winner: string | null = null;
  public _teams: Team[] = [];
  public abilityHandler = AbilityHandler.instance;
  private combatantsByInitiative: { combatant: any; initiative: number }[] = [];
  private environmentName: string = "Unknown Location";

  protected roller: Roll;
  protected select: ChoiceSelector<any>;
  protected journal: CombatEvent[] = [];
  protected outputSink: (message: string) => void;
  public dry: boolean = false;

  private auras: StatusEffect[] = [];

  constructor(
    options: Record<string, any> = {},
  ) {
    this.roller = options.roller || Commands.roll;
    this.select = options.select || Automatic.randomSelect;
    this.outputSink = options.outputSink || console.debug;
  }

  protected _note(message: string) { this.outputSink(message); }
  protected async emit(event: Omit<GameEvent, "turn">, prefix = ""): Promise<void> {
    const e: CombatEvent = { ...event, turn: this.turnNumber } as CombatEvent;
    this.journal.push(e);

    const presentedEvent = await Events.present(e);
    if (presentedEvent !== "") {
      this._note(prefix + presentedEvent);
    }

    let bark = await Bark.lookup(event);
    if (bark) {
      bark = bark.charAt(0).toUpperCase() + bark.slice(1);
      this._note(prefix + Stylist.italic(bark));
    }

    await Events.appendToLogfile(e);
  }

  protected async emitAll(events: Omit<GameEvent, "turn">[], message: string, subject: Combatant): Promise<void> {
    events = events.filter(e => {
      // remove heal events for 0
      if (e.type === "heal") {
        const healEvent = e as HealEvent;
        if (healEvent.amount <= 0) {
          return false;
        }
      } else if (e.type === "hit") {
        const damageEvent = e as HitEvent;
        if (damageEvent.damage <= 0) {
          return false;
        }
      } else if (e.type === "tempHpAbsorb") {
        const tempHpEvent = e as HealEvent;
        if (tempHpEvent.amount <= 0) {
          return false;
        }
      }
      return true;
    })
    if (events.length === 0) { return; }

    await this.emit({ type: "action", subject, actionName: message } as Omit<ActionEvent, "turn">);
    if (message) {
      // this._note(Stylist.bold(message));
      const arrow = " └ ";
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
    const initiativeOrder = [];
    for (const c of this.allCombatants) {
      const effective = await Fighting.effectiveStats(c);
      const initBonus = (await Fighting.turnBonus(c, ["initiative"])).initiative || 0;
      const initiative = (await Commands.roll(c, "for initiative", 20)).amount + Fighting.statMod(effective.dex) + initBonus;
      // (await this.roller(c, "for initiative", 20)).amount + Fighting.statMod(effective.dex) + initBonus;
      initiativeOrder.push({ combatant: c, initiative });
    }
    return initiativeOrder.sort((a, b) => b.initiative - a.initiative);
  }

  get allCombatants() { return this._teams.flatMap(team => [...team.combatants, ...team.combatants.flatMap(c => c.activeSummonings || [])]); }

  get playerCombatants(): Combatant[] {
    return this._teams[0].combatants.concat(...this._teams[0].combatants.flatMap(c => c.activeSummonings || []));
  }
  get enemyCombatants(): Combatant[] {
    return this._teams[1].combatants.concat(...this._teams[1].combatants.flatMap(c => c.activeSummonings || []));
  }
  get enemyTeam(): Team {
    return this._teams[1];
  }

  alliesOf(combatant: Combatant): Combatant[] {
    const team = this._teams.find(t => t.combatants.includes(combatant));
    return team ? team.combatants.concat(...team.combatants.flatMap(c => c.activeSummonings || [])).filter(c => c !== combatant) : [];
  }

  enemiesOf(combatant: Combatant): Combatant[] {
    const team = this._teams.find(t => t.combatants.includes(combatant));
    return this._teams.filter(t => t !== team).flatMap(t => t.combatants.concat(...t.combatants.flatMap(c => c.activeSummonings || [])));
  }

  static living(combatants: Combatant[]): Combatant[] { return combatants.filter(c => c.hp > 0); }
  static wounded(combatants: Combatant[]): Combatant[] {
    return combatants
      .filter(c => {
        const effective = Fighting.effectiveStats(c);
        return c.hp > 0 && c.hp < effective.maxHp
      });
  }
  static weakest(combatants: Combatant[]): Combatant {
    return this.living(combatants).reduce((weakest, current) => {
      return current.hp < weakest.hp ? current : weakest;
    }, this.living(combatants)[0]);
  }
  static visible(combatants: Combatant[]): Combatant[] {
    return combatants.filter(c => {
      const fx = Fighting.effectList(c);
      const invisibleEffect = fx.find(e => e.effect.invisible);
        //c.activeEffects?.find(e => e.effect.invisible);
      return !invisibleEffect;
    });
  }

  static async applyEquipmentEffects(combatant: Combatant): Promise<void> {
    const equipmentKeys = Object.values(combatant.equipment || []).filter(it => it !== undefined);
    const equipmentList: StatusEffect[] = [];
    for (const eq of equipmentKeys) {
      const eqEffects = await Deem.evaluate(`lookup(equipment, '${eq}')`);
      if (eqEffects.effect) {
        equipmentList.push(eqEffects);
      }
    }

    combatant.passiveEffects ||= [];
    combatant.passiveEffects = combatant.passiveEffects.filter(e => !e.equipment);
    for (const effect of equipmentList) {
      if (!combatant.passiveEffects.map(e => e.name).includes(effect.name)) {
        combatant.passiveEffects.push({ ...effect, equipment: true } );
      }
    }
  }

  static async reifyTraits(combatant: Combatant): Promise<void> {
    const traitHandler = TraitHandler.instance;
    await traitHandler.loadTraits();
    combatant.traits.forEach(traitName => {
      const trait = traitHandler.getTrait(traitName);
      if (trait) {
        combatant.passiveEffects ||= [];
        if (trait.statuses) {
          for (const status of trait.statuses) {
            if (!combatant.passiveEffects?.map(e => e.name).includes(status.name)) {
              combatant.passiveEffects.push(status);
            }
          }
        }

        if (trait.abilities) {
          for (const ability of trait.abilities || []) {
            if (!combatant.abilities.includes(ability)) {
              combatant.abilities.push(ability);
            }
          }
        }
      }
    });
  }

  // note: we could pre-bake the weapon weight into the combatant for efficiency here
  static async filterEffects(combatant: Combatant, effectList: StatusEffect[]): Promise<StatusEffect[]> {
    const filteredEffects: StatusEffect[] = [];
    for (const it of effectList) {
      if (it.whileEnvironment) {
        if (combatant.currentEnvironment !== it.whileEnvironment) {
          continue;
        }
      }
      if (it.condition) {
        let meetsCondition = true;
        if (it.condition.weapon) {
          if (it.condition.weapon.weight) {
            const weaponRecord = await Deem.evaluate(`lookup(masterWeapon, '${combatant.weapon}')`);
            if (weaponRecord.weight !== it.condition.weapon.weight) {
              meetsCondition = false;
            }
          }
        }
        if (meetsCondition) {
          filteredEffects.push(it);
        }
      } else {
        filteredEffects.push(it);
      }
    }
    return filteredEffects;
  }

  async setUp(
    teams = Combat.defaultTeams(),
    environment = 'Dungeon | Room -1',
    auras: StatusEffect[] = [],
    dry: boolean = Orsino.environment === 'test',
  ) {
    this.turnNumber = 0;
    this.winner = null;
    this._teams = teams;
    this.environmentName = environment;
    this.auras = auras;
    this.dry = dry;
    for (const c of this.allCombatants) {
      c.abilitiesUsed = [];
      c.abilityCooldowns = {};
      c.savedTimes = {};
      c.passiveEffects = [];
      c.traits = c.traits || [];

      await Combat.reifyTraits(c);
      await Combat.applyEquipmentEffects(c);

      c.activeEffects = await Combat.filterEffects(c, c.activeEffects || []);
      c.passiveEffects = await Combat.filterEffects(c, c.passiveEffects || []);

      // apply auras
      c.activeEffects ||= [];
      // remove other auras
      c.activeEffects = c.activeEffects.filter(effect => !effect.aura);
      c.activeEffects.push(...auras);

      await this.emit({ type: "engage", subject: c } as Omit<CombatantEngagedEvent, "turn">);
    }
    await this.abilityHandler.loadAbilities();

    Combat.statistics.combats += 1;

    // handle onCombatStart effects from statuses
    for (const combatant of this.allCombatants) {
      let allies = this.alliesOf(combatant);
      allies = allies.filter(c => c !== combatant);
      const enemies = this.enemiesOf(combatant);
      const ctx: CombatContext = { subject: combatant, allies, enemies };
      const events = await AbilityHandler.performHooks("onCombatStart", combatant, ctx, Commands.handlers(this.roller), "combat start effects");
      await this.emitAll(events, `combat start effects`, combatant);
    }
  }

  static maxSpellSlotsForLevel(level: number): number { return 2 + Math.ceil(level); }
  static maxSpellSlotsForCombatant(combatant: Combatant): number {
    if (combatant.class === "mage") {
      return 4 + Combat.maxSpellSlotsForLevel(combatant.level || 1) + 2 * Math.max(0, Fighting.statMod(combatant.int));
    } else if (combatant.class === "cleric") {
      return 2 + Combat.maxSpellSlotsForLevel(combatant.level || 1) + Math.max(0, Fighting.statMod(combatant.wis));
    } else if (combatant.class === "bard") {
      return 1 + Combat.maxSpellSlotsForLevel(combatant.level || 1) + Math.max(0, Fighting.statMod(combatant.cha));
    }

    return Combat.maxSpellSlotsForLevel(combatant.level || 1)
  }

  static maxSummoningsForCombatant(combatant: Combatant): number {
    return 1 + Math.floor((combatant.level || 1) / 3);
  }

  validateAction(ability: Ability, combatant: Combatant, allies: Combatant[], enemies: Combatant[]): boolean {
    const valid = this._actionIsValid(ability, combatant, allies, enemies);
    // console.warn("Validating action:", ability.name, "for", Presenter.minimalCombatant(combatant), "valid:", valid);
    return valid;
  }

  _actionIsValid(ability: Ability, combatant: Combatant, allies: Combatant[], enemies: Combatant[]): boolean {
    const activeFx = Fighting.gatherEffects(combatant);
    if (activeFx.compelNextMove) {
      const compelledAbility = this.abilityHandler.getAbility(activeFx.compelNextMove);
      const validTargets = AbilityHandler.validTargets(compelledAbility, combatant, allies, enemies);
      if (compelledAbility && validTargets.length > 0) {
        return ability.name === compelledAbility.name;
      }
    }

    const maxSpellLevel = Math.ceil(combatant.level / 2);
    if (ability.level && ability.level > maxSpellLevel) { return false; }

    const validTargets = AbilityHandler.validTargets(ability, combatant, allies, enemies);
    let disabled = validTargets.length === 0;
    if (ability.target.includes("randomEnemies") && Combat.living(enemies).length > 0) {
      // note we need a special case here since randomEnemies doesn't have valid targets until we select them
      disabled = false;
    }

    // if _only_ a healing effect and target is ally/self/allies and NO wounded allies, disable
    const effectiveCombatant = Fighting.effectiveStats(combatant);
    if (!disabled && ability.effects.every(e => e.type === "heal") && ability.effects.length > 0) {
      if (Combat.wounded([...allies, combatant]).length === 0) {
        disabled = true;
      } else if (ability.target.includes("self") && combatant.hp === effectiveCombatant.maxHp) {
        disabled = ability.target.length === 1; // if only self-targeting, disable; if also allies, allow
      } else if ((ability.target.includes("allies") || ability.target.includes("ally")) && Combat.wounded(allies).length === 0) {
        disabled = ability.target.length === 1; // if only allies-targeting, disable; if also self, allow
      }
    }

    // if there is a conditional status to the ability like backstab requiring Hidden, check for that
    const condition = ability.condition;
    if (condition) {
      if (condition.status) {
        if (!combatant.activeEffects?.map(e => e.name).includes(condition.status)) {
          disabled = true;
        }
      }
      if (condition.notStatus) {
        if (combatant.activeEffects?.map(e => e.name).includes(condition.notStatus)) {
          disabled = true;
        }
      }

      if (condition.dead) {
        if (ability.target.includes("ally") || ability.target.includes("allies")) {
          const targetAllies = allies.filter(a => a.hp <= 0);
          if (targetAllies.length === 0) {
            disabled = true;
          }
        }
      }
    }

    if (condition?.hasInterceptWeapon) {
      disabled = !combatant.hasInterceptWeapon;
    }

    if (!disabled) {
      if (ability.type === "spell") {
        let spellSlotsRemaining = (Combat.maxSpellSlotsForCombatant(combatant) || 0) - (combatant.spellSlotsUsed || 0);
        // if we have a noSpellcasting effect, set spellSlotsRemaining to 0
        if (activeFx.noSpellcasting) {
          spellSlotsRemaining = 0;
        }
        disabled = spellSlotsRemaining === 0;
      } else if (ability.type === "skill") {
        if (!ability.name.match(/melee|ranged|wait/i)) {
          const cooldownRemaining = combatant.abilityCooldowns?.[ability.name] || 0;
          if (cooldownRemaining > 0) {
            disabled = true;
          }
        }
      }
    }
    return !disabled;

  }

  validActions(combatant: Combatant, allies: Combatant[], enemies: Combatant[]): Ability[] {
    const validAbilities: Ability[] = [];

    // do we have a 'compelNextMove' effect?
    const activeFx = Fighting.gatherEffects(combatant);
    if (activeFx.compelNextMove) {
      const compelledAbility = this.abilityHandler.getAbility(activeFx.compelNextMove);
      const validTargets = AbilityHandler.validTargets(compelledAbility, combatant, allies, enemies);
      if (compelledAbility && validTargets.length > 0) {
        return [compelledAbility];
      }
    }
    const uniqAbilities = Array.from(new Set(combatant.abilities));
    const abilities = uniqAbilities.map(a => this.abilityHandler.getAbility(a)); //.filter(a => a);
    for (const ability of abilities) {
      const disabled = !(this.validateAction(ability, combatant, allies, enemies));
      if (!disabled) {
        validAbilities.push(ability);
      }
    }

    return validAbilities;
  }

  // static inventoryQuantities(team: Team): { [itemName: string]: number } {
  //   return Inventory.quantities(team.inventory || []);
  // }

  async pcTurn(combatant: Combatant, enemies: Combatant[], allies: Combatant[]): Promise<{
    haltRound: boolean,
    haltCombat?: boolean,
    newPlane?: string
  }> {
    if (!combatant) {
      throw new Error("No combatant provided to pcTurn");
    }

    console.warn(`It's ${Presenter.minimalCombatant(combatant)}'s turn.`);

    const inventoryItems = this._teams[0].inventory || [];
    const itemQuantities = Inventory.quantities(inventoryItems);
    const itemAbilities = [];
    for (const [itemKey, qty] of Object.entries(itemQuantities)) {
      const itemAbility = await Deem.evaluate(`lookup(consumables, '${itemKey}')`) as unknown as Ability;
      const proficient = Inventory.isItemProficient(itemAbility.kind || 'kit', itemAbility.aspect, combatant.itemProficiencies || {})
      if (!proficient) { continue; }

      if (qty > 0) {
        // sum charges across all instances of this item
        const matchingItems = inventoryItems.filter(ii => ii.name === itemKey);
        let totalCharges = 0;
        const chargeBased = itemAbility.charges !== undefined;
        if (!chargeBased) {
          // not charge based, so just add as is
          itemAbilities.push({ ...itemAbility, key: itemKey });
          continue;
        }

        for (const mi of matchingItems) {
          if (mi.charges !== undefined) {
            totalCharges += mi.charges;
          } else {
            throw new Error(`Item instance ${mi.name} is missing charges property.`);
          }
        }
        if (totalCharges <= 0) {
          continue;
        }
        itemAbilities.push({
          ...itemAbility,
          description: itemAbility.description + `(${totalCharges} charges left)`,
          key: itemKey
        });
      }
    }

    const allAbilities = combatant.abilities.map(a => this.abilityHandler.getAbility(a))
      .concat(itemAbilities);

    let pips = "";
    pips += "⚡".repeat((Combat.maxSpellSlotsForCombatant(combatant) || 0) - ((combatant.spellSlotsUsed || 0))) + "⚫".repeat(combatant.spellSlotsUsed || 0);
    const choices = [];
    // allAbilities.map(ability => {
    //   return ({
    for (const ability of allAbilities) {
      // if (await this.validateAction(ability, combatant, allies, enemies)) {
      choices.push({
        value: ability,
        name: `${ability.name.padEnd(15)} (${ability.description}/${ability.type === "spell" ? pips : "skill"})`,
        short: ability.name,
        disabled: !this.validateAction(ability, combatant, allies, enemies)
      })
      // }
    }

    const waitAction: Ability = { name: "Wait", type: "skill", description: "Skip your turn to wait and see what happens.", aspect: "physical", target: ["self"], effects: [] };
    choices.push({
      value: waitAction,
      name: "Wait (Skip your turn)",
      short: "Wait",
      disabled: false
    })

    choices.push({
      value: { name: "Flee", type: "skill", description: "Attempt to flee from combat.", aspect: "physical", target: ["self"], effects: [{ type: "flee" }] },
      name: "Flee (Attempt to escape combat)",
      short: "Flee",
      disabled: this.dry // can't flee in dry mode
    })

    let action: Ability = waitAction;
    const fx = Fighting.gatherEffects(combatant);
    if (fx.randomActions) {
      await this.emit({ type: "actedRandomly", subject: combatant } as Omit<ActedRandomly, "turn">);
      // pick a non-disabled action at random
      const enabledChoices = choices.filter(c => !c.disabled);
      const randomChoice = enabledChoices[Math.floor(Math.random() * enabledChoices.length)];
      action = randomChoice.value as Ability;
    } else {
      action = await this.select(`Your turn, ${Presenter.minimalCombatant(combatant)} - what do you do?`, choices, combatant) as Ability;
    }

    if (action.name === "Flee") {
      const succeed = Math.random() < 0.5;
      if (succeed) {
        // console.log("You successfully flee from combat!");
        this.winner = "Enemy";
        // this.combatantsByInitiative = [];
        await this.emit({ type: "flee", subject: combatant } as Omit<FleeEvent, "turn">);
        return { haltRound: true };
      }
      // console.log("You attempt to flee but could not escape!");
      return { haltRound: false };

    } else if (action.name === "Wait") {
      // this.note(`${Presenter.combatant(combatant)} waits and watches.`);
      await this.emit({ type: "wait", subject: combatant } as Omit<WaitEvent, "turn">);
      return { haltRound: false };
    }

    const validTargets = AbilityHandler.validTargets(action, combatant, allies, enemies);
    let targetOrTargets = validTargets[0];
    if (validTargets.length > 1) {
      targetOrTargets = await this.select(`Select target(s) for ${action.name}:`, validTargets.map(t => ({
        name: Array.isArray(t) ? t.map(c => c.forename).join("; ") : Presenter.combatant(t),
        value: t,
        short: Array.isArray(t) ? t.map(c => c.forename).join(", ") : Presenter.minimalCombatant(t),
        disabled: false
      })), combatant) as Combatant | Combatant[];
    } else if (action.target.includes("randomEnemies") && action.target.length === 2) {
      // pick random enemies
      // if (action.target[1] is a number use that)
      let count = 1;
      if (typeof action.target[1] === "number") {
        count = action.target[1];
      } else if (typeof action.target[1] === "string") {
        count = await Deem.evaluate(action.target[1], { ...combatant }) as number; // as any as number;
      } else {
        throw new Error(`Invalid target count specification for randomEnemies: ${action.target[1]}`);
      }
      // console.warn(`Selecting ${count} random enemy targets for ${action.name}...`);
      const possibleTargets = Combat.living(enemies);
      targetOrTargets = [];
      for (let i = 0; i < count; i++) {
        targetOrTargets.push(possibleTargets[Math.floor(Math.random() * possibleTargets.length)]);
      }
    }

    if (!targetOrTargets) {
      throw new Error(`No valid targets found for ability ${action.name} used by ${Presenter.minimalCombatant(combatant)}.`);
    }

    if (action.type === "skill" && !action.name.match(/melee|ranged|wait/i)) {
      // set cooldown
      const cooldown = action.cooldown || 3;
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
        const inventory = this._teams[0].inventory || [];
        const itemInstance = inventory.find(ii => ii.name === action.key && (ii.charges === undefined || ii.charges > 0));
        if (itemInstance) {
          if (itemInstance.charges !== undefined) {
            itemInstance.charges -= 1;
          }
          // this.note(`${Presenter.combatant(combatant)} uses ${action.name} (${itemInstance.charges} charges remaining).`);
          const chargesLeft = itemInstance.charges;
          await this.emit({ type: "itemUsed", subject: combatant, itemName: action.name, chargesLeft } as Omit<ItemUsedEvent, "turn">);
        }
      } else {
        // _remove_ item from inventory
        const inventory = this._teams[0].inventory || [];
        const itemIndex = inventory.findIndex(ii => ii.name === action.key);
        if (itemIndex !== -1) {
          inventory.splice(itemIndex, 1);
          this._teams[0].inventory = inventory;
        }
        const remaining = inventory.filter(ii => ii.name === action.key).length;
        await this.emit({ type: "itemUsed", subject: combatant, itemName: action.name, countLeft: remaining } as Omit<ItemUsedEvent, "turn">);
      }

    }

    // let team = this.teams.find(t => t.combatants.includes(combatant));
    const ctx: CombatContext = { subject: combatant, allies, enemies };
    const numTargets = Array.isArray(targetOrTargets) ? targetOrTargets.length : 1;
    console.warn(`${combatant.forename} ${Combat.describeAbility(action)} on ${numTargets} target${numTargets > 1 ? "s" : ""}.`);
    const { events } = await AbilityHandler.perform(action, combatant, targetOrTargets, ctx, Commands.handlers(this.roller));
    await this.emitAll(events, Combat.describeAbility(action), combatant);

    let haltRound = false;
    let haltCombat = false;
    let newPlane = undefined;
    // if action was planeshift, end combat immediately
    if (events.some(e => e.type === "planeshift")) {
      haltRound = true;
      haltCombat = true;
      newPlane = (events.find(e => e.type === "planeshift") as PlaneshiftEvent).plane;
    }
    return { haltRound, haltCombat, newPlane };
  }


  async npcTurn(combatant: Combatant, enemies: Combatant[], allies: Combatant[]) {
    const validAbilities = this.validActions(combatant, allies, enemies);
    if (validAbilities.length === 0) {
      await this.emit({ type: "wait", subject: combatant } as Omit<WaitEvent, "turn">);
      return { haltRound: false };
    }

    let scoredAbilities = validAbilities.map(ability => ({
      ability,
      score: AbilityScoring.scoreAbility(ability, combatant, allies, enemies)
    }));

    // console.log(`${combatant.forename} rates abilities:`, scoredAbilities.map(sa => `${sa.ability.name} (${sa.score})`).join(", "));
    scoredAbilities = scoredAbilities.filter(sa => sa.score > 0);

    scoredAbilities.sort((a, b) => b.score - a.score);
    let action = scoredAbilities[
      Math.floor(Math.random() * Math.min(2, scoredAbilities.length))
    ]?.ability;

    // if randomActions enabled, pick randomly from valid actions
    const fx = Fighting.gatherEffects(combatant);
    if (fx.randomActions) {
      const randomIndex = Math.floor(Math.random() * validAbilities.length);
      await this.emit({ type: "actedRandomly", subject: combatant } as Omit<ActedRandomly, "turn">);
      action = validAbilities[randomIndex];
    }

    if (!action) {
      // this.note(`${Presenter.minimalCombatant(combatant)} has no valid actions and skips their turn.`);
      this.emit({ type: "wait", subject: combatant } as Omit<WaitEvent, "turn">);
      return { haltRound: false };
    }
    // console.log(
    //   `Considering best targets for ${action?.name}...`, { allies: allies.map(a => a.name), enemies: enemies.map(e => e.name) }
    // )
    const targetOrTargets: Combatant | Combatant[] = AbilityScoring.bestAbilityTarget(action, combatant, allies, enemies);

    if (targetOrTargets === null || targetOrTargets === undefined) {
      this.emit({ type: "wait", subject: combatant } as Omit<WaitEvent, "turn">);
      return { haltRound: false };
    }


    combatant.abilityCooldowns = combatant.abilityCooldowns || {};
    if (action.type === "skill" && !action.name.match(/melee|ranged|wait/i)) {
      // set cooldown
      const cooldown = action.cooldown || 3;
      combatant.abilityCooldowns[action.name] = cooldown;
    }

    // use spell slots
    if (action.type === "spell") {
      combatant.spellSlotsUsed = (combatant.spellSlotsUsed || 0) + 1;
    }

    // invoke the action
    const ctx: CombatContext = { subject: combatant, allies, enemies };
    const { events } = await AbilityHandler.perform(action, combatant, targetOrTargets, ctx, Commands.handlers(this.roller));
    await this.emitAll(events, Combat.describeAbility(action), combatant);

    return { haltRound: false };
  }

  static describeAbility(action: Ability): string {
    const verb = action.type === "spell" ? 'casts' : 'performs';
    const actionName = Stylist.italic(action.name.toLowerCase());
    const message = (verb ? `${verb} ` : "") + actionName;
    return message;
  }

  async turn(combatant: Combatant): Promise<{ haltRound: boolean, haltCombat?: boolean, newPlane?: string }> {
    if (combatant.hp <= 0) {
      return { haltRound: false };
    }

    await this.emit({ type: "turnStart", subject: combatant, combatants: this.allCombatants } as Omit<CombatEvent, "turn">);

    // Tick down cooldowns
    if (combatant.abilityCooldowns) {
      Object.keys(combatant.abilityCooldowns).forEach(name => {
        combatant.abilityCooldowns![name] = Math.max(0, combatant.abilityCooldowns![name] - 1);
      });
    }

    if (combatant.activeEffects?.some(e => e.effect.noActions)) {
      const status = combatant.activeEffects.find(e => e.effect.noActions)!;
      this.emit({ type: "inactive", subject: combatant, statusName: status.name, duration: status.duration } as Omit<NoActionsForCombatant, "turn">);

      return { haltRound: false };
    }

    const enemies = this.enemiesOf(combatant);
    let livingEnemies = Combat.living(enemies);

    let allies = this.alliesOf(combatant);
    allies = allies.filter(c => c !== combatant);
    const livingAllies = Combat.living(allies);

    // do we have an effect changing our allegiance? in which case -- flip our allies/enemies
    const allegianceEffect = combatant.activeEffects?.find(e => e.effect.changeAllegiance);
    const playerControlled = Fighting.effectivelyPlayerControlled(combatant);
    // let controlEffect = combatant.activeEffects?.find(e => e.effect.controlledActions);
    if (allegianceEffect) {
      this.emit({ type: "allegianceChange", subject: combatant, statusName: allegianceEffect.name } as Omit<AllegianceChangeEvent, "turn">);
      
      [allies, livingEnemies] = [enemies, livingAllies];

      // if (controlEffect) {
      //   playerControlled = !playerControlled;
      // }
    }
    // console.log("allegiance check:", { playerControlled, allegianceEffect: allegianceEffect?.name, controlEffect: controlEffect?.name });

    let attacksPerTurn = combatant.attacksPerTurn || 1;
    
    // gather effects to see if we have extra attacks
    const activeFx = Fighting.gatherEffects(combatant);
    if (activeFx.extraAttacksPerTurn) {
      attacksPerTurn += activeFx.extraAttacksPerTurn;
      attacksPerTurn = Math.max(1, attacksPerTurn);
    }
    let turns = 1;
    if (activeFx.extraTurns) {
      turns += activeFx.extraTurns;
    }
    for (let j = 0; j < turns; j++) {
      for (let i = 0; i < attacksPerTurn; i++) {
        if (playerControlled) {
          const result = await this.pcTurn(combatant, livingEnemies, allies);
          if (result.haltRound) {
            return result;
          }
        } else {
          await this.npcTurn(combatant, livingEnemies, allies);
        }
      }
    }

    const ctx = { subject: combatant, allies, enemies: livingEnemies };
    const events = await AbilityHandler.performHooks("onTurnEnd", combatant, ctx, Commands.handlers(this.roller), "turn end effects");
    await this.emitAll(events, `ends their turn`, combatant);
    return { haltRound: false };
  }

  private roundsWithoutNetHpChange: number = 0;

  async round(
    creatureFlees: (combatant: Combatant) => Promise<void> = async (_c: Combatant) => { }
  ): Promise<{
    haltCombat?: boolean
    newPlane?: string
  }> {
    Combat.statistics.totalRounds += 1;

    if (this.isOver()) {
      throw new Error('Combat is already over');
    }
    this.combatantsByInitiative = await this.determineInitiative();
    this.turnNumber++;
    // check for escape conditions (if 'flee' status is active, remove the combatant from combat)
    for (const combatant of this.enemyCombatants) {
      if (combatant.activeEffects?.some(e => e.effect?.flee)) {
        // remove from combatants / teams
        this.enemyTeam.combatants = this.enemyTeam.combatants.filter(c => c !== combatant);
        this.combatantsByInitiative = this.combatantsByInitiative.filter(c => c.combatant !== combatant);
        await this.emit({ type: "flee", subject: combatant } as Omit<FleeEvent, "turn">);

        await creatureFlees(combatant);
      }
    }

    // ask to press enter
    if (!this.dry) {
      console.log(`\nThe next round begins...`);
      process.stdin.setRawMode(true);
      process.stdin.resume();
      await new Promise<void>(resolve => {
        process.stdin.once("data", () => {
          process.stdin.setRawMode(false);
          resolve();
        });
      });
    }
    process.stdout.write('\x1Bc');

    await this.emit({
      type: "roundStart",
      combatants: Combat.living(this.combatantsByInitiative.map(c => ({ ...c.combatant }))),
      parties: [
        { name: "Player", combatants: (this.playerCombatants) },
        { name: this.enemyTeam.name, combatants: (this.enemyCombatants) }
      ],
      environment: this.environmentName,
      auras: this.auras
    } as Omit<RoundStartEvent, "turn">);

    const netHp = this.allCombatants.reduce((sum, c) => sum + c.hp, 0);
    for (const { combatant } of this.combatantsByInitiative) {
      if (this.enemyTeam.combatants.every(c => c.hp <= 0)) {
        this.winner = "Player";

        console.log(Stylist.bold("All enemies defeated! You are victorious!"));
        break;
      }
      if (combatant.hp <= 0) { continue; } // Skip defeated combatants
      if ((combatant.activeEffects || []).some((e: StatusEffect) => e.effect?.flee)) { continue; } // Skip fleeing combatants

      // tick down status
      const expiryEvents: Omit<GameEvent, "turn">[] = [];
      const noStatusExpiry = combatant.activeEffects?.some((se: StatusEffect) => se.effect?.noStatusExpiry);
      if (noStatusExpiry) {
        const sources = combatant.activeEffects?.filter((se: StatusEffect) => se.effect?.noStatusExpiry).map((se: StatusEffect) => se.name) || [];
        await this.emit({ type: "statusExpiryPrevented", subject: combatant, reason: Words.humanize(sources) } as Omit<StatusExpiryPreventedEvent, "turn">);
      } else if (combatant.activeEffects) {
        combatant.activeEffects.forEach((it: StatusEffect) => {
          if (it.duration !== undefined && it.duration !== Infinity) {
            it.duration = Math.max(0, it.duration - 1);
          }
        });

        const activeFx: StatusEffect[] = combatant.activeEffects ?? [];
        const expired = activeFx.filter(s => s.duration === 0);

        for (const status of expired) {
          const expiryHookEvents = await AbilityHandler.performHooks("onExpire", combatant, { subject: combatant, allies: this.alliesOf(combatant), enemies: this.enemiesOf(combatant) }, Commands.handlers(this.roller), "status expire hook");
          expiryEvents.push(...expiryHookEvents);
          expiryEvents.push(...(await Commands.handleRemoveStatusEffect(combatant, status.name)));
        }
      }

      if (expiryEvents.length > 0) {
        await this.emitAll(expiryEvents, "effects expire", combatant);
      }
      const result = await this.turn(combatant);
      
      if (result.haltCombat) {
        return { haltCombat: true, newPlane: result.newPlane };
      } else if (result.haltRound) {
        break;
      }
    }

    if (this.playerCombatants.every(c => c.hp <= 0)) {
      this.winner = this.enemyTeam.name;
      await this.emit({ type: "combatEnd", winner: this.winner } as Omit<CombatEndEvent, "turn">);
    } else if (this.enemyCombatants.every(c => c.hp <= 0)) {
      this.winner = "Player";
      await this.emit({ type: "combatEnd", winner: this.winner } as Omit<CombatEndEvent, "turn">);
    }

    // didn't contemplate summons
    // for (const team of this._teams) {
    //   if (team.combatants.every((c: any) => c.hp <= 0)) {
    //     this.winner = team === this._teams[0] ? this._teams[1].name : this._teams[0].name;
    //     await this.emit({ type: "combatEnd", winner: this.winner } as Omit<CombatEndEvent, "turn">);
    //     break;
    //   }
    // }

    const netHpAfter = this.allCombatants.reduce((sum, c) => sum + c.hp, 0);
    const netHpLoss = netHp - netHpAfter;
    if (netHpLoss === 0) {
      this.roundsWithoutNetHpChange += 1;
    } else {
      this.roundsWithoutNetHpChange = 0;
    }

    if (this.roundsWithoutNetHpChange >= 10) {
      console.warn("Combat has reached stalemate (10 rounds without net HP change).");
    }

    return {};
  }

  async tearDown() {
    // unsummonings for all combatants
    for (const combatant of this.allCombatants) {
      const summoned = combatant.activeSummonings || [];
      for (const summon of summoned) {
        await this.emit({ type: "unsummon", subject: combatant, summonedName: summon.forename } as Omit<UnsummonEvent, "turn">);
      }
      combatant.activeSummonings = [];
    }
  }

  isOver() {
    return this.winner !== null;
  }


  static defaultTeams(): Team[] {
    return [
      {
        name: "Player", combatants: [{
          forename: "Hero", name: "Hero", alignment: "neutral",
          hp: 14, maximumHitPoints: 14, level: 1, ac: 10,
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
            forename: "Zok", name: "Goblin A", alignment: "neutral", hp: 4, maximumHitPoints: 4, level: 1, ac: 17,
            attackDie: "1d3",
            str: 8, dex: 14, int: 10, wis: 8, cha: 8, con: 10, weapon: "Dagger", damageKind: "slashing", abilities: ["melee"], traits: [], hasMissileWeapon: false, xp: 0, gp: 0
          },
          {
            forename: "Mog", name: "Goblin B", alignment: "neutral", hp: 4, maximumHitPoints: 4, level: 1, ac: 17,
            attackDie: "1d3",
            str: 8, dex: 14, int: 10, wis: 8, cha: 8, con: 10, weapon: "Dagger", damageKind: "slashing", abilities: ["melee"], traits: [], hasMissileWeapon: false, xp: 0, gp: 0
          }
        ],
        inventory: []
      }
    ];
  }
}

