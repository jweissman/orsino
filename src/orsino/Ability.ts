import Deem from "../deem";
import Combat, { CombatContext } from "./Combat";
import { DamageKind } from "./types/DamageKind";
import { GameEvent, ReactionEvent, ResurrectEvent, UpgradeEvent } from "./Events";
import Generator from "./Generator";
import { CommandHandlers } from "./rules/Commands";
import { Fighting } from "./rules/Fighting";
import StatusHandler, { StatusEffect, StatusModifications } from "./Status";
import Words from "./tui/Words";
import { Combatant } from "./types/Combatant";
import { GenerationTemplateType } from "./types/GenerationTemplateType";
import { Roll } from "./types/Roll";
import { SaveKind } from "./types/SaveKind";
import Files from "./util/Files";
import { never } from "./util/never";

export type TargetKind
  = "self"
  | "ally"
  | "deadAlly"
  | "allies"
  | "party"
  | "enemy"
  | "enemies"
  | "randomEnemies"
  | "all";

export type AbilityType
  = "attack"
  | "damage"
  | "heal"
  | "buff"
  | "debuff"
  | "flee"
  | "drain"
  | "summon"
  | "removeStatus"
  | "upgrade"
  | "gold"
  | "xp"
  | "resurrect"
  | "kill"
  | "randomEffect"
  | "cycleEffects"
  | "learn"
  | "grantPassive"
  | "teleport"
  | "planeshift";

export interface AbilityEffect {
  description?: string;
  kind?: DamageKind;
  type: AbilityType;
  stat?: "str" | "dex" | "con" | "int" | "wis" | "cha";

  amount?: string; // e.g. "=1d6", "=2d8", "3"
  target?: string;  //Target[];
  duration?: number; // in turns
  statusName?: string;
  status?: StatusEffect;
  saveDC?: number;
  // saveType?: SaveKind;
  saveKind?: SaveKind;
  succeedDC?: number;
  succeedType?: SaveKind;
  chance?: number; // 0.0-1.0
  item?: string;

  condition?: {
    trait?: string; // traits the target must have
  }

  // for summoning
  creature?: string;
  options?: {};
  // for resurrection effects
  hpPercent?: number;

  cascade?: { count: number, damageRatio: number };

  spillover?: boolean;

  saveForHalf?: boolean;
  saveNegates?: boolean;

  // ie for rez with animate dead which should apply an undead template
  applyTraits?: string[];

  reflected?: boolean;

  randomEffects?: AbilityEffect[];
  cycledEffects: AbilityEffect[];
  lastCycledEffect?: AbilityEffect;

  // for learn/grantPassive effects
  abilityName?: string;
  traitName?: string;

  location?: any;
}

export interface Ability {
  name: string;
  type: "spell" | "skill" | "consumable";
  alignment?: 'good' | 'neutral' | 'evil';
  description: string;
  level?: number;
  kind?: string;
  domain?: "life" | "death" | "nature" | "knowledge" | "war" | "trickery" | "law" | "chaos";
  school?: "abjuration" | "conjuration" | "divination" | "enchantment" | "evocation" | "illusion" | "necromancy" | "transmutation";
  aspect: "arcane" | "physical" | "divine" | "social" | "stealth" | "nature";
  target: TargetKind[];
  effects: AbilityEffect[];
  condition?: {
    hasInterceptWeapon?: boolean;
    status?: string;
    dead?: boolean;
  };
  cooldown?: number;

  // for room feature interaction costs
  offer?: string;

  // for consumables/inventory items
  key?: any;
  charges?: number;
}

type AbilityDictionary = { [key: string]: Ability };

export default class AbilityHandler {
  static instance: AbilityHandler = new AbilityHandler();
  abilities: AbilityDictionary = {};
  loadedAbilities: boolean = false;

  constructor() { }

  // load abilities from JSON file
  async loadAbilities() {
    if (this.loadedAbilities) {
      return;
    }

    let data = await Files.readJSON<AbilityDictionary>("./settings/fantasy/abilities.json");
    this.abilities = data;
    await this.validateAbilities();
    this.loadedAbilities = true;
  }

  async validateAbilities() {
    // check that referenced abilities in templates exist
    let tables = await Files.readJSON<{ [key: string]: any }>("./settings/fantasy/tables.json");

    let coreLists = [
      ...Object.values(tables['abilities']['groups']),
    ];
    coreLists.forEach((abilities: any) => {
      let abilityNames = abilities[0] as string[];
      abilityNames.forEach((abilityName: string) => {
        if (!this.abilities[abilityName]) {
          throw new Error(`Unknown ability in template: ${abilityName}`);
        }
      });
    });

    // they also show up in aspects
    let npcAspects = Object.values(tables['npcTypeModifier']['groups']).map((a: any) => a.abilities).flat().filter(Boolean) as string[];
    npcAspects.forEach((abilityName: string) => {
      if (!this.abilities[abilityName]) {
        throw new Error(`Unknown ability in templates: ${abilityName}`);
      }
    });
    let creatureAspects = Object.values(tables['creatureAspects']['groups']).map((a: any) => a.abilities).flat().filter(Boolean) as string[];
    creatureAspects.forEach((abilityName: string) => {
      if (!this.abilities[abilityName]) {
        throw new Error(`Unknown ability in templates: ${abilityName}`);
      }
    });
  }

  getAbility(name: string): Ability {
    let ability = this.abilities[name];
    if (!ability) {
      // throw new Error(`Ability not found: ${name} (known abilities: ${Object.keys(this.abilities).join(", ") || "none"})`);
      // is it the .name of an ability?
      ability = Object.values(this.abilities).find(ab => ab.name === name) as Ability;
      if (!ability) {
        throw new Error(`Ability not found: ${name} (known abilities: ${Object.keys(this.abilities).join(", ") || "none"})`);
      }
    }
    return ability;
  }

  get spells(): Ability[] {
    return Object.values(this.abilities).filter(ab => ab.type === 'spell');
  }

  allSpellNames(aspect: string, maxLevel = Infinity, excludeEvilSpells = true): string[] {
    return Object.entries(this.abilities)
      .filter(([_key, ab]) => ab.aspect === aspect && ab.type === 'spell' && (ab.level ?? 0) <= maxLevel && (!excludeEvilSpells || ab.alignment !== 'evil'))
      .map(([key, _ab]) => key);
  }

  allSkillNames(): string[] {
    return Object.entries(this.abilities)
      .filter(([_key, ab]) => ab.type === 'skill')
      .map(([key, _ab]) => key);
  }

  static resolveTarget(targetName: TargetKind, user: Combatant, allies: Combatant[], enemies: Combatant[]): (Combatant | Combatant[]) {
    let targets: (Combatant | Combatant[]) = [];
    switch (targetName) {
      case "self": targets.push(user); break;
      case "ally": targets.push(...Combat.living(allies)); break;
      case "deadAlly": targets.push(...(allies.filter(a => a.hp <= 0))); break;
      case "allies": targets.push(...Combat.living(allies)); break;
      case "party": targets.push(...([user, ...Combat.living(allies)])); break;

      case "enemy": targets.push(...(enemies)); break;
      case "enemies": targets.push(...(enemies)); break;

      case "all": targets.push(...([user, ...allies, ...enemies])); break;

      // we need to special case randomEnemies since we need to select them ourselves
      case "randomEnemies": break;

      default:
        // return never(targetName);
        // console.warn(`Unknown target type: ${targetName}`);
        break;
    }
    return targets;
  }

  static validTargets(ability: Ability, user: Combatant, allies: Combatant[], enemies: Combatant[]): (Combatant | Combatant[])[] {
    let healing = ability.effects.every(fx => fx.type === "heal") && ability.effects.length > 0;
    let targets: (Combatant | Combatant[])[] = [];
    for (const t of [...ability.target]) {
      switch (t) {
        case "self":
          if (healing) {
            if (user.hp < user.maxHp) {
              targets.push(user);
            }
          } else {
            targets.push(user);
          }
          break;
        case "ally":
          if (healing) {
            targets.push(...Combat.wounded(allies));
          } else {
            targets.push(...Combat.living(allies));
          }
          break;
        case "deadAlly": targets.push(...(allies.filter(a => a.hp <= 0))); break;
        case "enemy":
          // n.b. really need to make all this async so we can gather effects properly?
          // can't make a ring of true seeing work this way otherwise
          // or we could pre-process equipment to active effects (would be nicer overall and could make some other things _not_ async)
          if ([...(user.activeEffects || []), ...(user.passiveEffects || []) ].some(e => e.effect.seeInvisible)) {
            targets.push(...enemies);
          } else {
            targets.push(...Combat.visible(enemies));
          }
          break;
        case "allies":
          if (healing) {
            targets.push(Combat.wounded(allies));
          } else {
            targets.push(Combat.living(allies));
          }
          break;
        case "party":
          if (healing) {
            targets.push(Combat.wounded([user, ...allies]));
          } else {
            targets.push([user, ...Combat.living(allies)]);
          }
          break;
        case "enemies": targets.push((enemies)); break;
        case "all": targets.push(([user, ...allies, ...enemies])); break;

        // we need to special case randomEnemies since we need to select them ourselves
        case "randomEnemies": break;

        // default:
        // throw new Error(`Unknown target type: ${t}`);
      }
    }
    return targets;
  }

  static async rollAmount(name: string, amount: string, roll: Roll, user: Combatant): Promise<number> {
    let result = 0;
    let isNumber = !isNaN(parseInt(amount));
    if (isNumber) {
      result = parseInt(amount);
    } else if (amount.startsWith("=")) {
      result = await Deem.evaluate(amount.slice(1), { roll, subject: user, ...user, description: name })
    }
    return result;
  }

  static async handleEffect(
    name: string,
    effect: AbilityEffect,
    user: Combatant,
    target: Combatant | Combatant[],
    context: CombatContext,
    handlers: CommandHandlers
  ): Promise<{
    success: boolean, events: Omit<GameEvent, "turn">[]
  }> {
    // normalize target and pass to handleSingleEffect
    let success = false;
    let events: Omit<GameEvent, "turn">[] = [];
    if (Array.isArray(target)) {
      for (const t of target) {
        let result = await this.handleSingleEffect(name, effect, user, t, context, handlers);
        success ||= result.success;
        events.push(...result.events);
      }
    } else {
      if (!target) {
        // throw new Error(`No target provided for effect ${effect.type} in ability ${name}`);
        return { success: false, events };
      }

      let result = await this.handleSingleEffect(name, effect, user, target, context, handlers);
      success = result.success;
      events.push(...result.events);
    }
    return { success, events };
  }

  static async handleSingleEffect(
    name: string, effect: AbilityEffect,
    user: Combatant, targetCombatant: Combatant,
    context: CombatContext,
    handlers: CommandHandlers
  ): Promise<{
    success: boolean, events: Omit<GameEvent, "turn">[]
  }> {
    let { roll, attack, hit, heal, status, removeStatus, save, summon } = handlers;

    let success = false;
    let events: Omit<GameEvent, "turn">[] = [];

    // console.log(`Handling effect ${effect.type} of ability ${name} from ${user.name} to ${targetCombatant.name}`);

    // does the target meet all conditions?
    if (effect.condition) {
      if (effect.condition.trait && !(targetCombatant.traits || []).includes(effect.condition.trait)) {
        console.warn(`${targetCombatant.name} does not have required trait ${effect.condition.trait} for effect ${effect.type} of ability ${name}, skipping effect.`);
        return { success, events };
      }
    }

    // check if _any_ ally of the target has a reaction effect for this ability or effect type
    const isHostileAction =
      (context.enemies ?? []).includes(targetCombatant); // had: && (context.allies ?? []).includes(user);

    // console.log(
    //   "abilityName:", name,
    //   "isHostileAction:", isHostileAction, "user:", user.name, "target:", targetCombatant.name, "context.allies:", (context.allies ?? []).map(a => a.name), "context.enemies:", (context.enemies ?? []).map(e => e.name));
    if (isHostileAction) {
      const targetsParty = context.enemies;
      // was alliesOfTarget = (context.allies ?? []).includes(targetCombatant)
        //   ? (context.allies ?? [])
        //   : (context.enemies ?? []);
      let reactionEffectName = `onEnemy${Words.capitalize(name.replace(/\s+/g, ""))}` as keyof StatusModifications;
      let reactionEvents = await this.performReactions(
        reactionEffectName, targetsParty, user, context, handlers, "ability " + name
      );
      events.push(...reactionEvents);

      let typeReactionEffectName = `onEnemy${Words.capitalize(effect.type)}` as keyof StatusModifications;
      let typeReactionEvents = await this.performReactions(
        typeReactionEffectName, targetsParty, user, context, handlers, "ability " + name
      );
      events.push(...typeReactionEvents);
    }

    if ((targetCombatant.hp <= 0 && effect.type !== "resurrect") || user.hp <= 0) {
      return { success, events };
    }

    let userFx = await Fighting.gatherEffects(user);

    if (effect.type === "attack") {
      let onAttackEvents = await this.performHooks('onAttack', user, context, handlers, "on ability " + name)
      events.push(...onAttackEvents);
      

      let result = await attack(user, targetCombatant, context, effect.spillover || false, handlers.roll);
      success = result.success;
      events.push(...result.events);
      if (!success) {
        return { success: false, events };
      } else {
        if (userFx.onAttackHit) {
          for (const attackFx of userFx.onAttackHit as Array<AbilityEffect>) {
            let fxTarget: Combatant | Combatant[] = targetCombatant;
            if (attackFx.target) {
              fxTarget = this.validTargets({ target: [attackFx.target] } as Ability, user, [], [targetCombatant])[0];
            }
            let effectResult = await this.handleEffect(name, attackFx, user, fxTarget, context, handlers);
            events.push(...effectResult.events);
            if (!effectResult.success) {
              break;
            }
          }
        }
      }
    } else if (effect.type === "damage") {
      let amount = await AbilityHandler.rollAmount(name, effect.amount || "1", roll, user);
      if (targetCombatant._savedVersusSpell) {
        if (effect.saveForHalf) {
          amount = Math.floor(amount / 2);
        } else if (effect.saveNegates) {
          amount = 0;
        }
      }
      let hitEvents = await hit(
        user, targetCombatant, amount, false, name, true, effect.kind || "true",
        effect.cascade || null,
        context, handlers.roll
      );
      events.push(...hitEvents);
      success = hitEvents.some(e => e.type === "hit" && (e as any).amount > 0);

    } else if (effect.type === "heal") {
      let amount = await AbilityHandler.rollAmount(name, effect.amount || "1", roll, user);
      let healEvents = await heal(user, targetCombatant, amount, context);
      events.push(...healEvents);
      success = true;
    } else if (effect.type === "drain") {
      let amount = await AbilityHandler.rollAmount(name, effect.amount || "1", roll, user);
      if (targetCombatant._savedVersusSpell) {
        if (effect.saveForHalf) {
          amount = Math.floor(amount / 2);
        } else if (effect.saveNegates) {
          amount = 0;
        }
      }
      let healEvents = await heal(user, user, amount, context);
      let hitEvents = await hit(user, targetCombatant, amount, false, name, true, effect.kind || "true",
        effect.cascade || null,
        context, handlers.roll);
      events.push(...healEvents);
      events.push(...hitEvents);
      success = true;
    } else if (effect.type === "buff") {
      if (!effect.status) {
        throw new Error(`Buff effect must have a status defined`);
      }

      let statusEffect = StatusHandler.instance.dereference(effect.status);
      if (!statusEffect) {
        throw new Error(`Buff effect has unknown status: ${JSON.stringify(effect.status)}`);
      }

      let statusEvents = await status(
        user, targetCombatant,
        statusEffect.name, { ...statusEffect.effect }, effect.duration || 3
      );
      events.push(...statusEvents);
      success = true;
    } else if (effect.type === "debuff") {
      // same as buff with a save
      if (effect.status) {
        let statusEffect = StatusHandler.instance.dereference(effect.status);
        if (!statusEffect) {
          throw new Error(`Buff effect has unknown status: ${JSON.stringify(effect.status)}`);
        }
        if (!targetCombatant._savedVersusSpell) {
          let dc = (effect.saveDC || 15) + (userFx.bonusSpellDC as number || 0) + (user.level || 0);

          let { success: saved, events: saveEvents } = await save(targetCombatant, effect.saveKind || statusEffect.saveKind || "magic", dc, handlers.roll);
          events.push(...saveEvents);
          if (!saved) {
            let statusEvents = await status(user, targetCombatant,
              statusEffect.name, { ...statusEffect.effect }, effect.duration || 3
            );
            events.push(...statusEvents);
            success = true;
          }
        }
      } else {
        throw new Error(`Debuff effect ${effect.status} must have a status defined`);
      }
    } else if (effect.type === "flee") {
      // roll save vs fear
      let { success, events: saveEvents } = await save(targetCombatant, effect.succeedType || "will", effect.succeedDC || 15, handlers.roll);
      events.push(...saveEvents);

      let saved = success;
      if (saved || targetCombatant._savedVersusSpell) {
        console.log(`${targetCombatant.name} resists the urge to flee!`);
        return { success: false, events };
      }

      if (!saved) {
        let statusEvents = await status(user, targetCombatant, "Fleeing", { flee: true }, 2);
        events.push(...statusEvents);
        success = true;
      } else {
        console.log(`${targetCombatant.name} wanted to flee but resisted!`);
      }
    } else if (effect.type === "removeStatus") {
      if (!effect.statusName) {
        throw new Error(`removeStatus effect must specify a statusName`);
      }
      let statusEvents = await removeStatus(targetCombatant, effect.statusName);
      events.push(...statusEvents);
      success = true;
    } else if (effect.type === "upgrade") {
      let stat = effect.stat;
      if (!stat) {
        throw new Error(`upgrade effect must specify a stat`);
      }

      console.log("Upgrading stat", stat, "for", user.name, "with effect:", JSON.stringify(effect));

      let amount = await Deem.evaluate(effect.amount?.toString() || "1", { subject: user, ...user, description: name });
      console.log(`${user.name} upgrades ${stat} by ${amount}!`);
      user[stat] = (user[stat] || 0) + amount;
      let upgradeEvent = { type: "upgrade", subject: user, stat, amount, newValue: user[stat] } as UpgradeEvent;
      events.push(upgradeEvent);
      success = true;
    }
    else if (effect.type === "gold") {
      let amount = await AbilityHandler.rollAmount(name, effect.amount || "1", roll, user);
      user.gp = (user.gp || 0) + amount;
      // console.log(`${user.name} gains ${amount} gold!`);
      events.push({ type: "gold", subject: user, amount } as any);
      success = true;
    }
    else if (effect.type === "xp") {
      let amount = await AbilityHandler.rollAmount(name, effect.amount || "1", roll, user);
      user.xp = (user.xp || 0) + amount;
      // console.log(`${user.name} gains ${amount} XP!`);
      events.push({ type: "xp", subject: user, amount } as any);
      success = true;
    } else if (effect.type === "summon") {
      let amount = await AbilityHandler.rollAmount(name, effect.amount || "1", roll, user);
      let allies = 1 + context.allies.length;
      amount = Math.min(amount, 6 - allies);
      // could add summon ability bonus here
      // if (userFx.summonAnimalBonus) {
      //   amount += (userFx.summonAnimalBonus || 0) as number;
      // }
      let summoned: Combatant[] = [];
      for (let i = 0; i < amount; i++) {
        let options: Record<string, any> = effect.options || {};
        // deem-eval option values
        for (const key of Object.keys(options)) {
          let val = options[key];
          if (typeof val === "string" && val.startsWith("=")) {
            options[key] = await Deem.evaluate(val.slice(1), { subject: user });
          }
        }
        let summon = await Generator.gen((effect.creature || "animal") as GenerationTemplateType, {
          race: user.race,
          _targetCr: Math.max(1, Math.floor((user.level || 1) / 2)),
          ...options
        });
        summoned.push(summon as Combatant);
      }
      let summonEvents = await summon(user, summoned);
      events.push(...summonEvents);
      success = amount > 0;
    }
    else if (effect.type === "resurrect") {
      let rezzed = false;
      let targetFx = await Fighting.gatherEffects(targetCombatant);
      if (targetCombatant.hp > 0) {
        console.warn(`${targetCombatant.name} is not dead and cannot be resurrected.`);
      } else if (targetFx.resurrectable === false) {
        console.warn(`${targetCombatant.name} cannot be resurrected.`);
      } else {
        // let amount = await AbilityHandler.rollAmount(name, effect.amount || "1", roll, user);
        let amount = effect.hpPercent ? Math.floor((effect.hpPercent / 100) * (targetCombatant.maxHp || 10)) : 1;
        targetCombatant.hp = Math.max(1, amount);
        // todo handle applied traits + reify (and maybe update type???)
        if (effect.applyTraits) {
          targetCombatant.traits = Array.from(new Set([...(targetCombatant.traits || []), ...effect.applyTraits]));
          // reify traits
          await Combat.reifyTraits(targetCombatant);
        }
        events.push({ type: "resurrect", subject: targetCombatant, amount } as Omit<ResurrectEvent, "turn">);
        rezzed = true;
      }
      success = rezzed;
    }
    else if (effect.type === "kill") {
      if (targetCombatant.hp <= 0) {
        console.warn(`${targetCombatant.name} is already dead.`);
      } else {
        targetCombatant.hp = 0;
        events.push({ type: "fall", subject: targetCombatant } as Omit<GameEvent, "turn">);
        success = true;
      }
    } else if (effect.type === "randomEffect") {
      if (!effect.randomEffects || effect.randomEffects.length === 0) {
        throw new Error(`randomEffect type must have randomEffects defined`);
      }
      let randomIndex = Math.floor(Math.random() * effect.randomEffects.length);
      let randomEffect = effect.randomEffects[randomIndex];
      let result = await this.handleEffect(name, randomEffect, user, targetCombatant, context, handlers);
      success = result.success;
      events.push(...result.events);
    } else if (effect.type === "cycleEffects") {
      if (!effect.cycledEffects || effect.cycledEffects.length === 0) {
        throw new Error(`cycleEffects type must have cycledEffects defined`);
      }
      let lastCycledIndex = -1;
      if (effect.lastCycledEffect !== undefined) {
        lastCycledIndex = effect.cycledEffects.findIndex(ce => {
          return ce.type === effect.lastCycledEffect!.type && ce.kind === effect.lastCycledEffect!.kind && ce.amount === effect.lastCycledEffect!.amount;
        });
      }
      let nextIndex = (lastCycledIndex + 1) % effect.cycledEffects.length;
      let nextEffect = effect.cycledEffects[nextIndex];
      effect.lastCycledEffect = nextEffect;
      let result = await this.handleEffect(name, nextEffect, user, targetCombatant, context, handlers);
      success = result.success;
      events.push(...result.events);
    } else if (effect.type === "learn") {
      // add ability to user's known abilities
      if (!user.abilities) {
        user.abilities = [];
      }
      let abilityName = effect.abilityName;
      if (!abilityName) {
        throw new Error(`learn effect must specify an abilityName`);
      }
      if (!user.abilities.includes(abilityName)) {
        user.abilities.push(abilityName);
        console.log(`${user.name} learns ability ${abilityName}!`);
        events.push({ type: "learnAbility", subject: user, abilityName } as Omit<GameEvent, "turn">);
      }
      success = true;
    } else if (effect.type === "grantPassive") {
      if (!user.traits) {
        user.traits = [];
      }
      let traitName = effect.traitName;
      if (!traitName) {
        throw new Error(`grantPassive effect must specify a traitName`);
      }
      if (!user.traits.includes(traitName)) {
        user.traits.push(traitName);
        console.log(`${user.name} gains passive trait ${traitName}!`);
        events.push({ type: "gainTrait", subject: user, traitName } as Omit<GameEvent, "turn">);
      }
      success = true;
    } else if (effect.type === "planeshift") {
      let location = await Deem.evaluate(effect.location, { subject: user, ...user, description: name });
      console.warn("You are being plane shifted to", location);
      events.push({ type: "planeshift", subject: user, plane: location } as Omit<GameEvent, "turn">);
      success = true;
    } else if (effect.type === "teleport") {
      let location = await Deem.evaluate(effect.location, { subject: user, ...user, description: name });
      console.warn("You are being teleported to", location);
      events.push({ type: "teleport", subject: user, location } as Omit<GameEvent, "turn">);
      success = true;
    }

    else {
      // throw new Error(`Unknown effect type: ${effect.type}`);
      console.warn(`Unknown effect type: ${effect.type} in ability ${name}`);
      return never(effect.type);
    }

    return { success, events };
  }

  static async perform(
    ability: Ability,
    user: Combatant,
    target: Combatant | Combatant[],
    context: CombatContext,
    handlers: CommandHandlers
  ): Promise<{
    success: boolean;
    events: Omit<GameEvent, "turn">[];
  }> {
    let result = false;
    let events = [];
    let isSpell = ability.type === 'spell';
    // let isOffensive = ability.target.some(t => t.includes("enemy") || t.includes("enemies") || t.includes("randomEnemies"));
    let isOffensive = ability.target.some(t => ["enemy", "enemies", "randomEnemies"].includes(t));
    let targets: Combatant[] = [];
    if (Array.isArray(target)) {
      targets = target;
    } else {
      targets = [target];
    }

    // filter 'untargetable' targets
    let untargetable = [];
    for (const t of targets) {
      let tFx = await Fighting.gatherEffects(t);
      let effectiveTarget = await Fighting.effectiveStats(t);
      if (tFx.untargetable && !(t === user)) {
        // give a save chance to avoid
        let dc = Math.max(8, Math.min(25, 15 + (Fighting.statMod(effectiveTarget.wis))));
        let { success: canTarget, events: saveEvents } = await handlers.save(user, "magic", dc, handlers.roll);
        events.push(...saveEvents);
        if (canTarget) {
          continue;
        }
        untargetable.push(t);
        events.push({ type: "untargetable", subject: t, target: user, abilityName: ability.name } as Omit<GameEvent, "turn">);
      }
    }
    targets = targets.filter(t => !untargetable.includes(t));

    let savedTargets: Combatant[] = [];
    if (isSpell && isOffensive) {
      let hasSaveFlags = ability.effects.some(e => e.saveForHalf || e.saveNegates);
      if (hasSaveFlags) {
        let userFx = await Fighting.gatherEffects(user);
        let spellDC = 15 + (userFx.bonusSpellDC as number || 0);
        targets.forEach(t => { t._savedVersusSpell = false; });
        // give a save vs magic chance to avoid
        for (const t of targets) {
          let { success: saved, events: saveEvents } = await handlers.save(t, "magic", spellDC, handlers.roll);
          if (saved) {
            savedTargets.push(t);
            t._savedVersusSpell = true;
          }
          events.push(...saveEvents);
        }
      }

      let turnedTargets: Combatant[] = [];
      for (const t of targets) {
        let tFx = await Fighting.gatherEffects(t);
        let turned = tFx.reflectSpellChance && Math.random() < (tFx.reflectSpellChance as number);
        if (turned) {
          turnedTargets.push(t);
          events.push({ type: "spellTurned", subject: t, target: user, spellName: ability.name } as Omit<GameEvent, "turn">);
          for (const effect of ability.effects) {
            let { success, events: effectEvents } = await this.handleEffect(ability.name, { ...effect, reflected: true }, t, user, context, handlers);
            result = result || success;
            events.push(...effectEvents);
            if (success === false) {
              break;
            }
          }
        }
      }

      // filter out turned targets from normal processing
      targets = targets.filter(t => !turnedTargets.includes(t));
    }



    // console.log(`${user.name} is performing ${ability.name} on ${Array.isArray(target) ? target.map(t => t.name).join(", ") : target?.name}...`);
    for (const effect of ability.effects) {
      // console.log("performing effect of type", effect.type, "...");
      let { success, events: effectEvents } = await this.handleEffect(ability.name, effect, user, targets, context, handlers);
      result = result || success;
      events.push(...effectEvents);
      if (success === false) {
        break;
      }
    }

    const enemies = context?.enemies ?? [];
    // if (result) {
      // console.log(`${user.name} successfully uses ${ability.name} on ${Array.isArray(target) ? target.map(t => t.name).join(", ") : target.name}!`);
      if (isSpell) {
        if (isOffensive) {
          events.push(...await this.performHooks(
            'onOffensiveCasting',
            user,
            context,
            handlers,
            ability.name
          ));
          // do enemies have onEnemyOffensiveSpell reactions?
          events.push(...await this.performReactions(
            'onEnemyOffensiveCasting',
            enemies,
            user,
            context,
            handlers,
            ability.name
          ));
        }

          // do any enemies have `onEnemySpell` reactions?
          events.push(...await this.performReactions(
            'onEnemyCasting',
            enemies,
            user,
            context,
            handlers,
            ability.name
          ));
      }
    // }

    return { success: result, events };
  }

  static async performHooks(
    hookKey: keyof StatusModifications,
    user: Combatant,
    context: CombatContext,
    handlers: CommandHandlers,
    label: string
  ): Promise<Omit<GameEvent, "turn">[]> {
    let events: Omit<GameEvent, "turn">[] = [];

    let hookFx = await Fighting.gatherEffects(user);
    let hookFxWithNames = await Fighting.gatherEffectsWithNames(user);
    // console.log("performHooks:", String(hookKey), "for", user.name, "with effects:", hookFx[hookKey]);
    if (hookFx[hookKey]) {
      // console.log(`${user.name} has hook ${String(hookKey)} due to ${Words.humanizeList(hookFxWithNames[hookKey].sources)}`);
      let hookEffects = hookFx[hookKey] as Array<AbilityEffect>;

      for (const hookEffect of hookEffects) {
        // console.log(`${user.name} has hook ${String(hookKey)} due to ${Words.humanizeList(hookFxWithNames[hookKey].sources)}`);
        let { success, events: hookEvents } = await this.handleEffect(
          (hookEffect.status?.name || label) + " due to " + Words.humanizeList(hookFxWithNames[hookKey].sources),
          hookEffect, user, user, context, handlers
        );
        events.push(...hookEvents);
        if (!success) {
          break;
        }
      }
    }

    return events;
  }

  static async performReactions(
    reactionKey: keyof StatusModifications,
    reactors: Combatant[],
    user: Combatant,
    context: CombatContext,
    handlers: CommandHandlers,
    label: string
  ): Promise<Omit<GameEvent, "turn">[]> {
    // if the user has 'triggerReactions' false, skip
    let userFx = await Fighting.gatherEffects(user);
    if (userFx.triggerReactions === false) {
      return [];
    }

    let events: Omit<GameEvent, "turn">[] = [];

    const actorSide = [user, ...(context.allies ?? [])];
    const opponentSide = [...(context.enemies ?? [])];

    for (const reactor of reactors) {
      if (reactor.hp <= 0) { continue; }
      const reactorOnActorSide = actorSide.includes(reactor);
      // If reactor is on the same side as the acting user, then reactor's enemies are context.enemies.
      // Otherwise reactor's enemies are context.allies.
      // const reactorAllies = reactorIsAllyOfUser ? (context.allies ?? []) : (context.enemies ?? []);
      // const reactorEnemies = reactorIsAllyOfUser ? (context.enemies ?? []) : (context.allies ?? []);
      const reactorAllies = (reactorOnActorSide ? actorSide : opponentSide).filter(c => c !== reactor);
      const reactorEnemies = reactorOnActorSide ? opponentSide : actorSide;

      let reactorContext: CombatContext = {
        subject: reactor,
        allies: reactorAllies,
        enemies: reactorEnemies,
      };
      // let flippedContext: CombatContext = {
      //   subject: reactor,
      //   allies: context.enemies,
      //   enemies: context.allies,
      // };
      let reactionFx = await Fighting.gatherEffects(reactor);
      let reactionFxWithNames = await Fighting.gatherEffectsWithNames(reactor);
      if (reactionFx[reactionKey]) {
        let sources = Words.humanizeList(reactionFxWithNames[reactionKey].sources);
        // console.log(`${reactor.name} has reaction ${String(reactionKey)} to ${label} due to ${sources}`);
        let reactionEffects = reactionFx[reactionKey] as Array<AbilityEffect>;
        for (const reactionEffect of reactionEffects) {
          let target: (Combatant | Combatant[]) = user;
          if (reactionEffect.target) {
            target = this.validTargets({ target: [reactionEffect.target], effects: [reactionEffect] } as Ability, reactor, reactorAllies, reactorEnemies).flat();
            if (target.length === 0) {
              // console.log(`No valid targets '${reactionEffect.target}' for ${reactor.name} reaction ${String(reactionKey)} for ${reactionEffect.type} effect type, default to ${user.name}`);
              target = user;
            } else {
              // console.log(`Resolved reaction target(s) for ${reactor.name} reaction ${String(reactionKey)} for ${reactionEffect.type} effect type:`, target.map(t => t.name));
            }
          }
          let { success, events: reactionEvents } = await this.handleEffect(
            reactor.forename + "'s " + (reactionEffect.status?.name || label).toLocaleLowerCase() + " reaction from " + sources,
            reactionEffect, reactor, target, reactorContext, handlers
          );
          if (reactionEvents.length > 0) {
            events.push({ type: "reaction", subject: reactor, target: user, reactionName: `to ${label}` } as Omit<ReactionEvent, "turn">);
            events.push(...reactionEvents);
          }
          if (!success) {
            break;
          }
        }
      }
    }

    return events;
  }


}