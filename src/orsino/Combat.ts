import Choice from "inquirer/lib/objects/choice";
import { Select } from "./types/Select";
import { Combatant } from "./types/Combatant";
import Presenter from "./tui/Presenter";
import { Team } from "./types/Team";
import { Roll } from "./types/Roll";
import { Fighting } from "./rules/Fighting";
import Stylist from "./tui/Style";
import Events, { CombatEvent, InitiateCombatEvent, InspireEvent, HealEvent, MissEvent, HitEvent, FallenEvent, DefendEvent, FleeEvent, FearEvent, StatusExpireEvent, RoundStartEvent, CombatEndEvent, StumbleEvent, PoisonedBladeEvent, PoisonDamageEvent, PoisoningEvent, ScreamEvent, PoisonCloudEvent } from "./Events";

export type RollResult = {
  amount: number;
  description: string;
};

export default class Combat {
  private turnNumber: number = 0;
  public winner: string | null = null;
  public teams: Team[] = [];
  private combatantsByInitiative: { combatant: any; initiative: number }[] = [];

  protected roller: Roll;
  protected select: Select<any>;
  protected journal: CombatEvent[] = [];
  protected outputSink: (message: string) => void;

  constructor(
    options: Record<string, any> = {},
  ) {
    this.roller = options.roller || this.autoroll;
    this.select = options.select || this.samplingSelect;
    this.outputSink = options.outputSink || console.debug;
  }

  async samplingSelect(_prompt: string, options: Choice<any>[]): Promise<any> {
    let enabledOptions = options.filter(
      (option) => !option.disabled
    )
    return enabledOptions[Math.floor(Math.random() * enabledOptions.length)].value;
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
          weapon: "Short Sword"
        }], healingPotions: 3
      },
      {
        name: "Enemy", combatants: [
          { forename: "Zok", name: "Goblin A", hp: 4, maxHp: 4, level: 1, ac: 17, attackRolls: 2, damageDie: 3, str: 8, dex: 14, int: 10, wis: 8, cha: 8, con: 10, weapon: "Dagger" },
          {
            forename: "Mog", name: "Goblin B", hp: 4, maxHp: 4, level: 1, ac: 17, attackRolls: 2, damageDie: 3,
            str: 8, dex: 14, int: 10, wis: 8, cha: 8, con: 10, weapon: "Dagger"
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


  async pcTurn(combatant: Combatant, enemies: Combatant[], allies: Combatant[]) {
    const choices = [
      { disabled: false, short: "Attack!", name: "⚔️ Attack", value: "attack" },
      { disabled: false, short: "Defend", name: "🛡️ Defend (gain +4 AC until your next turn)", value: "defend" },
      { disabled: this.wounded(allies).length == 0, short: "First Aid", name: "🩹 First Aid (heal 1d4 HP to ally)", value: "heal" },
      {
        short: "Quaff", name: `🍶 Quaff Potion (${this.teams[0].healingPotions})`, value: "quaff",
        disabled: (this.teams[0].healingPotions === 0 || combatant.hp >= combatant.maxHp),
      }
    ];

    let spellSlotsRemaining = (Combat.maxSpellSlotsForCombatant(combatant) || 0) - (combatant.spellSlotsUsed || 0);
    let standingAllies = this.living(allies);
    let pips = "⚡".repeat(spellSlotsRemaining) + "⚫".repeat((Combat.maxSpellSlotsForCombatant(combatant) || 0) - spellSlotsRemaining);
    if (combatant.class === "mage") {
      choices.push({ disabled: spellSlotsRemaining === 0, short: "Magic Missile " + pips, name: "✨ Magic Missile (deal 3d4 damage to an enemy)", value: "missile" });
    } else if (combatant.class === "bard") {
      choices.push({
        disabled: spellSlotsRemaining === 0 && standingAllies.length > 0, short: "Inspire " + pips, name: "🎶 Inspire (grant to-hit bonus for an ally until their next turn)", value: "inspire"
      });
    } else if (combatant.class === "cleric") {
      choices.push({ disabled: spellSlotsRemaining === 0, short: "Cure Wounds " + pips, name: "🙏 Cure Wounds (restore 2d6 HP to self or ally)", value: "cure" });
    } else if (combatant.class === "thief") {
      if (!combatant.activeEffects?.some(e => e.name === "Poisoned Blade")) {
        choices.push({ disabled: false, short: "Poison Dagger", name: "🗡️ Poison Dagger (add 1d3 poison damage to next attack)", value: "poison" });
      }
    }

    const action = await this.select(`Your turn, ${Presenter.combatant(combatant)} - what do you do?`, choices);

    switch (action) {
      case "attack":
        await this.pcAttacks(combatant, enemies);
        break;
      case "defend":
        combatant.activeEffects = combatant.activeEffects || [];
        combatant.activeEffects.push({ name: "Defending", effect: { ac: 4 }, duration: 1 });
        this.emit({ type: "defend", subject: combatant });
        break;
      case "quaff":
        this.emit({ type: "quaff", subject: combatant });
        combatant.hp = Math.min(combatant.maxHp, combatant.hp + 10);
        this.teams[0].healingPotions = Math.max(0, this.teams[0].healingPotions - 1);
        break;
      case "heal":
        await this.pcFirstAid(combatant, this.wounded(allies));
        break;
      case "inspire":
        const inspireTarget = await this.selectTarget(allies, "inspiration");
        let toHit = 2 + Fighting.statMod(combatant.cha);
        inspireTarget.activeEffects = inspireTarget.activeEffects || [];
        inspireTarget.activeEffects.push({ name: "Inspired", effect: { toHit }, duration: 2 });
        this.emit({ type: "inspire", subject: combatant, target: inspireTarget, toHitBonus: toHit } as Omit<InspireEvent, "turn">);
        combatant.spellSlotsUsed = (combatant.spellSlotsUsed || 0) + 1;
        break;
      case "cure":
        const cureTarget = await this.selectTarget([...allies, combatant], "healing");
        let healAmount = (await this.roller(combatant, "for healing", 6)).amount + (await this.roller(combatant, "for healing", 6)).amount + 2;
        let wisMod = Math.max(0, Fighting.statMod(combatant.wis));
        if (wisMod > 0) {
          healAmount += wisMod;
        }
        cureTarget.hp = Math.min(cureTarget.maxHp, cureTarget.hp + healAmount);
        this.emit({ type: "heal", subject: combatant, target: cureTarget, amount: healAmount } as Omit<HealEvent, "turn">);
        combatant.spellSlotsUsed = (combatant.spellSlotsUsed || 0) + 1;
        break;
      case "missile":
        const target = await this.selectTarget(enemies, "casting of Magic Missile");
        const attackRolls = [];
        for (let i = 0; i < 3; i++) {
          attackRolls.push(await this.roller(combatant, `for Magic Missile damage (bolt ${i + 1}/3)`, 4));
        }
        let damage = attackRolls
          .map(r => r.amount)
          .reduce((sum: number, dmg: number) => sum + dmg, 0);
        let intMod = Math.max(0, Fighting.statMod(combatant.int));
        damage += intMod;
        this.handleHit(combatant, target, damage, false, `${combatant.forename}'s magic missile`, true);
        combatant.spellSlotsUsed = (combatant.spellSlotsUsed || 0) + 1;
        break;
      case "poison":
        combatant.activeEffects = combatant.activeEffects || [];
        combatant.activeEffects.push({ name: "Poisoned Blade", effect: { poisonDamage: "1d3" }, duration: 2 });
        this.emit({ type: "poisoned_blade", subject: combatant } as Omit<PoisonedBladeEvent, "turn">);
        break;
    }
  }

  async handleHit(attacker: Combatant, defender: Combatant, damage: number, critical: boolean, by: string, success: boolean): Promise<void> {
    if (!success) {
      this.emit({ type: "miss", subject: attacker, target: defender } as Omit<MissEvent, "turn">);
      if (critical) {
        attacker.activeEffects = attacker.activeEffects || [];
        attacker.activeEffects.push({
          name: "stumbling",
          effect: { toHit: -2, ac: 2 },
          duration: 1
        });
        this.emit({ type: "stumble", subject: attacker } as Omit<StumbleEvent, "turn">);
      }
      return;
    }

    defender.hp -= damage;
    this.emit({ type: "hit", subject: attacker, target: defender, damage, success: true, critical, by } as Omit<HitEvent, "turn">);
    if (defender.hp <= 0) {
      this.emit({ type: "fall", subject: defender } as Omit<FallenEvent, "turn">);
    } else {
      if (by !== "poison") {
        let hasPoisonedBlade = attacker.activeEffects?.some(e => e.name === "Poisoned Blade");
        if (hasPoisonedBlade) {
          const poisonDamage = (await this.roller(attacker, "for poison damage", 3)).amount;
          this.emit({ type: "poisoned", subject: defender } as Omit<PoisoningEvent, "turn">);
          // don't recurse here if we can avoid it -- await this.handleHit(defender, defender, poisonDamage, false, "poison", true);
          defender.activeEffects = defender.activeEffects || [];
          defender.activeEffects.push({
            name: "Poisoned",
            effect: { hpLoss: poisonDamage },
            duration: 3
          });
        }
      }
    }
  }

  async pcFirstAid(healer: Combatant, allies: Combatant[]) {
    let validTargets = this.living(allies);
    let target = this.weakest(validTargets);
    if (validTargets.length > 1) {
      target = await this.selectTarget(validTargets, "first aid");
    }
    const wisBonus = Math.max(0, Fighting.statMod(healer.wis));
    const healAmount = (await this.roller(healer, "for first aid", 4)).amount + wisBonus;
    target.hp = Math.min(target.maxHp, target.hp + healAmount);
    this.emit({ type: "heal", subject: healer, target, amount: healAmount } as Omit<HealEvent, "turn">);
  }

  async selectTarget(validTargets: Combatant[], action: string): Promise<Combatant> {
    let target = validTargets[0];
    if (validTargets.length > 1) {
      const targetOptions: Choice<Combatant>[] = validTargets.map(t => ({ name: t.name, short: t.forename.substring(0, 8), description: Presenter.combatant(t), value: t, disabled: false }));
      target = (await this.select(`Select target for ${action}:`, targetOptions));
    }
    return target;
  }

  async pcAttacks(combatant: Combatant, validTargets: Combatant[]) {
    let target = this.weakest(validTargets);
    if (validTargets.length > 1) { target = await this.selectTarget(validTargets, "attack with " + combatant.weapon); }
    const { damage, critical, success } = await Fighting.attack(this.roller, combatant, target);
    await this.handleHit(combatant, target, damage, critical, `${combatant.forename}'s ${combatant.weapon}`, success);
  }

  async npcTurn(combatant: Combatant, enemies: Combatant[], allies: Combatant[]) {
    let target = this.weakest(enemies);
    let actions = ["attack", "defend"];

    if (combatant.type === "Shaman" || combatant.type === "Sage" || combatant.type === "Hierophant" || combatant.type === "Death Priest") {
      if (this.wounded([...allies, combatant]).length > 0) {
        actions.push("heal");
      }
    } else if (combatant.type === "Hierophant" || combatant.type === "Archmage" || combatant.type === "Cultist" || combatant.type === "Stalker") {
      if (this.living(enemies).length > 1) {
        actions.push("fear");
      }
    } else if (combatant.type === "Mercenary" || combatant.type === "Bandit" || combatant.type === "Assassin" || combatant.type === "Thief") {
      actions.push("poison");
    } else if (
      combatant.type === "Warrior" || combatant.type === "Fury" || combatant.type === "Barbarian" || 
      combatant.type === "Brute" || combatant.type === "Berserker" || combatant.type === "Warlord" || combatant.type === "General"
    ) {
      actions.push("charge");
    } else if (combatant.hp < combatant.maxHp / 3) {
      actions.push("flee");
    }

    const action = actions[Math.floor(Math.random() * actions.length)];
    switch (action) {
      case "attack":
        let attack = await Fighting.attack(this.roller, combatant, target);
        await this.handleHit(combatant, target, attack.damage, attack.critical, `${combatant.forename}'s attack`, attack.success);
        break;
      case "defend":
        combatant.activeEffects = combatant.activeEffects || [];
        combatant.activeEffects.push({ name: "Defending", effect: { ac: 4 }, duration: 1 });
        this.emit({ type: "defend", subject: combatant } as Omit<DefendEvent, "turn">);
        break;
      case "heal":
        const healTarget = this.weakest([...allies, combatant]);
        const healAmount = (await this.roller(combatant, "for healing", 4)).amount + Fighting.statMod(combatant.wis);

        healTarget.hp = Math.min(healTarget.maxHp, healTarget.hp + healAmount);
        this.emit({ type: "heal", subject: combatant, target: healTarget, amount: healAmount } as Omit<HealEvent, "turn">);
        break;
      case "charge":
        const chargeAttack = await Fighting.attack(this.roller, combatant, target); //, this._note.bind(this));
        await this.handleHit(combatant, target, chargeAttack.damage, chargeAttack.critical, `${combatant.forename}'s charge`, chargeAttack.success);
        if (chargeAttack.success) {
          const extraDamage = (await this.roller(combatant, "for charge damage", 6)).amount;
          await this.handleHit(combatant, target, extraDamage, false, `${combatant.forename}'s charge bonus damage`, true);
          // target.hp -= extraDamage;
          // this.note(`${target.name} takes an additional ${extraDamage} damage from the charge!`);
        }
        break;
      case "flee":
        const fleeRoll = await this.roller(combatant, "to flee", 20);
        if (fleeRoll.amount + Math.round((combatant.dex - 10) / 2) >= 10) {
          this.emit({ type: "flee", subject: combatant } as Omit<FleeEvent, "turn">);
          let team = this.teams.find(team => team.combatants.includes(combatant));
          if (team) {
            team.combatants = team.combatants.filter(c => c !== combatant);
          }
          // remove from initiative order
          this.combatantsByInitiative = this.combatantsByInitiative.filter(c => c.combatant !== combatant);
        } else {
          combatant.activeEffects = combatant.activeEffects || [];
          combatant.activeEffects.push({ name: "Frightened", effect: { toHit: -2 }, duration: 1 });
          this.emit({ type: "fear", subject: combatant } as Omit<FearEvent, "turn">);
        }
        break;
      case "fear":
        // apply frightened status to all enemies (DC 10 wisdom check saves)
        this.emit({ type: "scream", subject: combatant } as Omit<ScreamEvent, "turn">);
        for (let enemy of enemies) {
          const saveRoll = await this.roller(enemy, "to resist fear", 20);
          if (saveRoll.amount + Math.round((enemy.wis - 10) / 2) < 10) {
            enemy.activeEffects = enemy.activeEffects || [];
            enemy.activeEffects.push({ name: "Frightened", effect: { toHit: -2 }, duration: 2 });
            this.emit({ type: "fear", subject: enemy } as Omit<FearEvent, "turn">);
          }
        }
        break;
      case "poison":
        this.emit({ type: "poison_cloud", subject: combatant } as Omit<PoisonCloudEvent, "turn">);
        for (let enemy of enemies) {
          const saveRoll = await this.roller(enemy, "to resist poison", 20);
          if (saveRoll.amount + Math.round((enemy.con - 10) / 2) < 10) {
            this.emit({ type: "poisoned", subject: enemy } as Omit<PoisoningEvent, "turn">);
            enemy.activeEffects = enemy.activeEffects || [];
            enemy.activeEffects.push({
              name: "Poisoned",
              effect: { hpLoss: (await this.roller(combatant, "for poison damage", 3)).amount },
              duration: 3
            });
          }
        }
        break;
    }
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
        } else {
          switch (status.name) {
            case "Poisoned":
              await this.handleHit(combatant, combatant, status.effect.hpLoss, false, "poison", true);
              break;
          }
        }
      }
      combatant.activeEffects = combatant.activeEffects.filter(it => it.duration > 0);
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

