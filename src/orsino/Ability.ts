import Deem from "../deem";
import Combat, { CombatContext } from "./Combat";
import { DamageKind } from "./types/DamageKind";
import { ExperienceEvent, GameEvent, GoldEvent, HitEvent, ReactionEvent, ResurrectEvent, UpgradeEvent } from "./Events";
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
import { DeemValue } from "../deem/stdlib";

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
  | "cast"
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
  | "planeshift"
  | "recalculateHp";

export interface AbilityEffect {
  description?: string;
  kind?: DamageKind;
  type: AbilityType;
  stat?: "str" | "dex" | "con" | "int" | "wis" | "cha";

  amount?: string; // e.g. "=1d6", "=2d8", "3"
  target?: string;  //Target[];
  duration?: number; // in turns
  statusName?: string;
  status?: StatusEffect | string;
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
  options?: {
    _class: string;
    level: number;
    monster_type: string;
    rank: number;
  };
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

  // for cast
  spellName?: string;

  // for teleport/planeshift
  location?: string;
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
    notStatus?: string;
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

    const data = await Files.readJSON<AbilityDictionary>("./settings/fantasy/abilities.json");
    this.abilities = data;
    await this.validateAbilities();
    this.loadedAbilities = true;
  }

  async validateAbilities() {
    // check that referenced abilities in templates exist
    const tables = await Files.readJSON<{ [key: string]: any }>("./settings/fantasy/tables.json");

    const coreLists = [
      ...Object.values(tables['abilities']['groups']),
    ];
    coreLists.forEach((abilities: any) => {
      const abilityNames = abilities[0] as string[];
      abilityNames.forEach((abilityName: string) => {
        if (!this.abilities[abilityName]) {
          throw new Error(`Unknown ability in template: ${abilityName}`);
        }
      });
    });

    // they also show up in aspects
    const npcAspects = Object.values(tables['npcTypeModifier']['groups']).map((a: any) => a.abilities).flat().filter(Boolean) as string[];
    npcAspects.forEach((abilityName: string) => {
      if (!this.abilities[abilityName]) {
        throw new Error(`Unknown ability in templates: ${abilityName}`);
      }
    });
    const creatureAspects = Object.values(tables['creatureAspects']['groups']).map((a: any) => a.abilities).flat().filter(Boolean) as string[];
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
    const targets: (Combatant | Combatant[]) = [];
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
    const healing = ability.effects.every(fx => fx.type === "heal") && ability.effects.length > 0;
    const targets: (Combatant | Combatant[])[] = [];
    const effectiveUser = Fighting.effectiveStats(user);
    for (const t of [...ability.target]) {
      switch (t) {
        case "self":
          if (healing) {
            if (user.hp < effectiveUser.maxHp) {
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
          if ([...(user.activeEffects || []), ...(user.passiveEffects || [])].some(e => e.effect.seeInvisible)) {
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

  static rollAmount(name: string, amount: string, roll: Roll, user: Combatant): number {
    let result = 0;
    const isNumber = !isNaN(parseInt(amount));
    if (isNumber) {
      result = parseInt(amount);
    } else if (amount.startsWith("=")) {
      result = Deem.evaluate(amount.slice(1), { roll, subject: user, ...(user as unknown as Record<string, DeemValue>), description: name }) as number;
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
    const events: Omit<GameEvent, "turn">[] = [];
    if (Array.isArray(target)) {
      for (const t of target) {
        const result = await this.handleSingleEffect(name, effect, user, t, context, handlers);
        success ||= result.success;
        events.push(...result.events);
      }
    } else {
      if (!target) {
        // throw new Error(`No target provided for effect ${effect.type} in ability ${name}`);
        return { success: false, events };
      }

      const result = await this.handleSingleEffect(name, effect, user, target, context, handlers);
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
    const { roll, attack, hit, heal, status, removeStatus, save, summon } = handlers;

    let success = false;
    const events: Omit<GameEvent, "turn">[] = [];

    // console.log(`Handling effect ${effect.type} of ability ${name} from ${user.name} to ${targetCombatant.name}`);

    // does the target meet all conditions?
    const effectCondition = effect.condition;
    if (effectCondition) {
      if (effectCondition.trait) {
        // let traitMatch = !(targetCombatant.traits || []).includes(effect.condition.trait))
        // using regexp
        const traitMatch = (targetCombatant.traits || []).some(t => {
          const re = new RegExp(`^${effectCondition.trait}$`, 'i');
          return re.test(t);
        });
        if (!traitMatch) {
          console.warn(`${targetCombatant.name} does not have required trait ${effectCondition.trait} for effect ${effect.type} of ability ${name}, skipping effect.`);
          return { success, events };
        }
      }
    }

    // try to permit more general responses
    const enemies = context.enemies || [];
    const reactionEffectName = `onEnemy${Words.capitalize(name.replace(/\s+/g, ""))}` as keyof StatusModifications;
    const reactionEvents = await this.performReactions(
      reactionEffectName, enemies, user, context, handlers, "ability " + name
    );
    events.push(...reactionEvents);

    const typeReactionEffectName = `onEnemy${Words.capitalize(effect.type)}` as keyof StatusModifications;
    const typeReactionEvents = await this.performReactions(
      typeReactionEffectName, enemies, user, context, handlers, "ability " + name
    );
    events.push(...typeReactionEvents);
    // }

    if ((targetCombatant.hp <= 0 && effect.type !== "resurrect") || user.hp <= 0) {
      return { success, events };
    }

    const userFx = Fighting.gatherEffects(user);

    if (effect.type === "attack") {
      const onAttackEvents = await this.performHooks('onAttack', user, context, handlers, "on ability " + name)
      events.push(...onAttackEvents);

      const result = await attack(user, targetCombatant, context, effect.spillover || false, handlers.roll);
      success = result.success;
      events.push(...result.events);
      if (!success) {
        return { success: false, events };
      } else {
        const hookEvents = await this.performHooks('onAttackHit', user, context, handlers, "on ability " + name, targetCombatant);
        events.push(...hookEvents);
      }
    } else if (effect.type === "damage") {
      let amount = AbilityHandler.rollAmount(effect.description || name, effect.amount || "1", roll, user);
      if (targetCombatant._savedVersusSpell) {
        if (effect.saveForHalf) {
          amount = Math.floor(amount / 2);
        } else if (effect.saveNegates) {
          amount = 0;
        }
      }
      let damageKind = effect.kind || "true";
      if (damageKind.startsWith("=")) {
        damageKind = Deem.evaluate(damageKind.slice(1), { subject: user }) as DamageKind;
      }
      const hitEvents = await hit(
        user, targetCombatant, amount, false, effect.description || name, true, damageKind,
        effect.cascade || null,
        context, handlers.roll
      );
      events.push(...hitEvents);
      success = hitEvents.some(e => e.type === "hit" && (e as HitEvent).damage > 0 && (e as HitEvent).success)

    } else if (effect.type === "cast") {
      // lookup spell by name and process its effects
      const spellName = effect.spellName || name;
      const spell = AbilityHandler.instance.getAbility(spellName);
      for (const spellEffect of spell.effects) {
        const result = await this.handleEffect(effect.description || spellName, spellEffect, user, targetCombatant, context, handlers);
        success ||= result.success;
        events.push(...result.events);
        if (!success) {
          return { success: false, events };
        }
      }
    } else if (effect.type === "heal") {
      const amount = AbilityHandler.rollAmount(name, effect.amount || "1", roll, user);
      const healEvents = await heal(user, targetCombatant, amount, context);
      events.push(...healEvents);
      success = true;
    } else if (effect.type === "drain") {
      let amount = AbilityHandler.rollAmount(name, effect.amount || "1", roll, user);
      if (targetCombatant._savedVersusSpell) {
        if (effect.saveForHalf) {
          amount = Math.floor(amount / 2);
        } else if (effect.saveNegates) {
          amount = 0;
        }
      }
      const healEvents = await heal(user, user, amount, context);
      const hitEvents = await hit(user, targetCombatant, amount, false, name, true, effect.kind || "true",
        effect.cascade || null,
        context, handlers.roll);
      events.push(...healEvents);
      events.push(...hitEvents);
      success = true;
    } else if (effect.type === "buff") {
      if (!effect.status) {
        throw new Error(`Buff effect must have a status defined`);
      }
      const statusEffect = this.reifyStatus(effect.status, targetCombatant);

      const statusEvents = await status(
        user, targetCombatant,
        statusEffect.name, { ...statusEffect.effect }, effect.duration || 3
      );
      events.push(...statusEvents);
      success = true;
    } else if (effect.type === "debuff") {
      // same as buff with a save
      if (effect.status) {
        const statusEffect = this.reifyStatus(effect.status, targetCombatant);
        // let statusEffect = StatusHandler.instance.dereference(effect.status);
        // if (!statusEffect) {
        //   throw new Error(`Buff effect has unknown status: ${JSON.stringify(effect.status)}`);
        // }
        if (!targetCombatant._savedVersusSpell) {
          const dc = (effect.saveDC || 15) + (userFx.bonusSpellDC as number || 0) + (user.level || 0);

          const { success: saved, events: saveEvents } = await save(targetCombatant, effect.saveKind || statusEffect.saveKind || "magic", dc, handlers.roll);
          events.push(...saveEvents);
          if (!saved) {
            const statusEvents = await status(user, targetCombatant,
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
      const { success: successful, events: saveEvents } = await save(targetCombatant, effect.succeedType || "will", effect.succeedDC || 15, handlers.roll);
      events.push(...saveEvents);

      const saved = successful;
      if (saved || targetCombatant._savedVersusSpell) {
        // console.log(`${targetCombatant.name} resists the urge to flee!`);
        return { success: false, events };
      }

      if (!saved) {
        const statusEvents = await status(user, targetCombatant, "Fleeing", { flee: true }, 2);
        events.push(...statusEvents);
        success = true;
      } else {
        // console.log(`${targetCombatant.name} wanted to flee but resisted!`);
      }
    } else if (effect.type === "removeStatus") {
      if (!effect.statusName) {
        throw new Error(`removeStatus effect must specify a statusName`);
      }
      const statusEvents = await removeStatus(targetCombatant, effect.statusName);
      events.push(...statusEvents);
      success = true;
    } else if (effect.type === "upgrade") {
      const stat = effect.stat;
      if (!stat) {
        throw new Error(`upgrade effect must specify a stat`);
      }

      // console.log("Upgrading stat", stat, "for", user.name, "with effect:", JSON.stringify(effect));

      const amount = Deem.evaluate(effect.amount?.toString() || "1", { subject: user, ...user, description: name } as any);
      // console.log(`${user.name} upgrades ${stat} by ${amount}!`);
      // @ts-expect-error
      user[stat] = (user[stat] || 0) + (amount || 0);
      const upgradeEvent = { type: "upgrade", subject: user, stat, amount, newValue: user[stat] } as UpgradeEvent;
      events.push(upgradeEvent);
      success = true;
    }
    else if (effect.type === "gold") {
      const amount = AbilityHandler.rollAmount(name, effect.amount || "1", roll, user);
      user.gp = (user.gp || 0) + amount;
      // console.log(`${user.name} gains ${amount} gold!`);
      events.push({ type: "gold", subject: user, amount } as GoldEvent);
      success = true;
    }
    else if (effect.type === "xp") {
      const amount = AbilityHandler.rollAmount(name, effect.amount || "1", roll, user);
      user.xp = (user.xp || 0) + amount;
      // console.log(`${user.name} gains ${amount} XP!`);
      events.push({ type: "xp", subject: user, amount } as ExperienceEvent);
      success = true;
    } else if (effect.type === "summon") {
      let amount = AbilityHandler.rollAmount(name, effect.amount || "1", roll, user);
      const allies = 1 + context.allies.length;
      amount = Math.min(amount, 6 - allies);
      // could add summon ability bonus here
      // if (userFx.summonAnimalBonus) {
      //   amount += (userFx.summonAnimalBonus || 0) as number;
      // }
      const summoned: Combatant[] = [];
      for (let i = 0; i < amount; i++) {
        const options: Record<string, any> = effect.options || {};
        // deem-eval option values
        for (const key of Object.keys(options)) {
          const val = options[key];
          if (typeof val === "string" && val.startsWith("=")) {
            options[key] = Deem.evaluate(val.slice(1), { subject: user });
          }
        }
        const summon = Generator.gen((effect.creature || "animal") as GenerationTemplateType, {
          race: user.race,
          _targetCr: Math.max(1, Math.floor((user.level || 1) / 2)),
          ...options
        });
        summoned.push(summon as unknown as Combatant);
      }
      const summonEvents = await summon(user, summoned);
      events.push(...summonEvents);
      success = amount > 0;
    }
    else if (effect.type === "resurrect") {
      let rezzed = false;
      const targetFx = Fighting.gatherEffects(targetCombatant);
      if (targetCombatant.hp > 0) {
        console.warn(`${targetCombatant.name} is not dead and cannot be resurrected.`);
      } else if (targetFx.resurrectable === false) {
        console.warn(`${targetCombatant.name} cannot be resurrected.`);
      } else {
        const effectiveTarget = Fighting.effectiveStats(targetCombatant);
        const amount = effect.hpPercent ? Math.floor((effect.hpPercent / 100) * (effectiveTarget.maxHp || 10)) : 1;
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
      const randomIndex = Math.floor(Math.random() * effect.randomEffects.length);
      const randomEffect = effect.randomEffects[randomIndex];
      const result = await this.handleEffect(name, randomEffect, user, targetCombatant, context, handlers);
      success = result.success;
      events.push(...result.events);
    } else if (effect.type === "cycleEffects") {
      if (!effect.cycledEffects || effect.cycledEffects.length === 0) {
        throw new Error(`cycleEffects type must have cycledEffects defined`);
      }
      let lastCycledIndex = -1;
      const lastEffect = effect.lastCycledEffect;
      if (lastEffect !== undefined) {
        lastCycledIndex = effect.cycledEffects.findIndex(ce => {
          return ce.type === lastEffect.type && ce.kind === lastEffect.kind && ce.amount === lastEffect.amount;
        });
      }
      const nextIndex = (lastCycledIndex + 1) % effect.cycledEffects.length;
      const nextEffect = effect.cycledEffects[nextIndex];
      effect.lastCycledEffect = nextEffect;
      const result = await this.handleEffect(name, nextEffect, user, targetCombatant, context, handlers);
      success = result.success;
      events.push(...result.events);
    } else if (effect.type === "learn") {
      // add ability to user's known abilities
      if (!user.abilities) {
        user.abilities = [];
      }
      const abilityName = effect.abilityName;
      if (!abilityName) {
        throw new Error(`learn effect must specify an abilityName`);
      }
      if (!user.abilities.includes(abilityName)) {
        user.abilities.push(abilityName);
        // console.log(`${user.name} learns ability ${abilityName}!`);
        events.push({ type: "learnAbility", subject: user, abilityName } as Omit<GameEvent, "turn">);
      }
      success = true;
    } else if (effect.type === "grantPassive") {
      if (!user.traits) {
        user.traits = [];
      }
      const traitName = effect.traitName;
      if (!traitName) {
        throw new Error(`grantPassive effect must specify a traitName`);
      }
      if (!user.traits.includes(traitName)) {
        user.traits.push(traitName);
        // console.log(`${user.name} gains passive trait ${traitName}!`);
        events.push({ type: "gainTrait", subject: user, traitName } as Omit<GameEvent, "turn">);
      }
      success = true;
    } else if (effect.type === "planeshift") {
      const location = Deem.evaluate(effect.location || 'Arcadia', { subject: user, ...user, description: name } as any);
      // console.warn("You are being plane shifted to", location);
      events.push({ type: "planeshift", subject: user, plane: location } as Omit<GameEvent, "turn">);
      success = true;
    } else if (effect.type === "teleport") {
      const location = Deem.evaluate(effect.location || 'firstRoom', { subject: user, ...user, description: name } as any);
      // console.warn("You are being teleported to", location);
      events.push({ type: "teleport", subject: user, location } as Omit<GameEvent, "turn">);
      success = true;
    } else if (effect.type === "recalculateHp") {
      const effectiveTarget = Fighting.effectiveStats(targetCombatant);
      targetCombatant.hp = Math.min(targetCombatant.hp, effectiveTarget.maxHp || targetCombatant.hp);
      success = true;
    }

    else {
      // throw new Error(`Unknown effect type: ${effect.type}`);
      // console.warn(`Unknown effect type: ${effect.type} in ability ${name}`);
      return never(effect.type);
    }

    return { success, events };
  }

  static reifyStatus(statusExpression: string | StatusEffect, target: Combatant): StatusEffect {
    let statusEffect = undefined;
    if (typeof statusExpression === "string") {
      if (statusExpression.startsWith("=")) {
        // deem-eval status name
        const statusName = Deem.evaluate(statusExpression.slice(1), { subject: target }) as string;
        statusEffect = StatusHandler.instance.dereference(statusName);
      } else {
        statusEffect = StatusHandler.instance.dereference(statusExpression);
      }
    } else {
      // assume literal effect
      statusEffect = statusExpression;
    }
    if (!statusEffect) {
      throw new Error(`Buff effect has unknown status: ${JSON.stringify(statusEffect)}`);
    }
    return statusEffect;
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
    const events = [];
    const isSpell = ability.type === 'spell';
    // let isOffensive = ability.target.some(t => t.includes("enemy") || t.includes("enemies") || t.includes("randomEnemies"));
    const isOffensive = ability.target.some(t => ["enemy", "enemies", "randomEnemies"].includes(t));
    let targets: Combatant[] = [];
    if (Array.isArray(target)) {
      targets = target;
    } else {
      targets = [target];
    }

    // filter 'untargetable' targets
    const untargetable: Combatant[] = [];
    for (const t of targets) {
      const tFx = Fighting.gatherEffects(t);
      const effectiveTarget = Fighting.effectiveStats(t);
      if (tFx.untargetable && !(t === user)) {
        // give a save chance to avoid
        const dc = Math.max(8, Math.min(25, 15 + (Fighting.statMod(effectiveTarget.wis))));
        const { success: canTarget, events: saveEvents } = await handlers.save(user, "magic", dc, handlers.roll);
        events.push(...saveEvents);
        if (canTarget) {
          continue;
        }
        untargetable.push(t);
        events.push({ type: "untargetable", subject: t, target: user, abilityName: ability.name } as Omit<GameEvent, "turn">);
      }
    }
    targets = targets.filter(t => !untargetable.includes(t));

    const savedTargets: Combatant[] = [];
    if (isSpell && isOffensive) {
      const hasSaveFlags = ability.effects.some(e => e.saveForHalf || e.saveNegates);
      if (hasSaveFlags) {
        const userFx = Fighting.gatherEffects(user);
        const spellDC = 15 + (userFx.bonusSpellDC as number || 0);
        targets.forEach(t => { t._savedVersusSpell = false; });
        // give a save vs magic chance to avoid
        for (const t of targets) {
          const { success: saved, events: saveEvents } = await handlers.save(t, "magic", spellDC, handlers.roll);
          if (saved) {
            savedTargets.push(t);
            t._savedVersusSpell = true;
          }
          events.push(...saveEvents);
        }
      }

      const turnedTargets: Combatant[] = [];
      for (const t of targets) {
        const tFx = Fighting.gatherEffects(t);
        const turned = tFx.reflectSpellChance && Math.random() < (tFx.reflectSpellChance);
        if (turned) {
          turnedTargets.push(t);
          events.push({ type: "spellTurned", subject: t, target: user, spellName: ability.name } as Omit<GameEvent, "turn">);
          for (const effect of ability.effects) {
            const { success, events: effectEvents } = await this.handleEffect(ability.name, { ...effect, reflected: true }, t, user, context, handlers);
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
      const { success, events: effectEvents } = await this.handleEffect(ability.name, effect, user, targets, context, handlers);
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

    return { success: result, events };
  }

  static async performHooks(
    hookKey: keyof StatusModifications,
    user: Combatant,
    context: CombatContext,
    handlers: CommandHandlers,
    label: string,
    prevTarget?: Combatant
  ): Promise<Omit<GameEvent, "turn">[]> {
    const events: Omit<GameEvent, "turn">[] = [];

    const hookFx = Fighting.gatherEffects(user);
    const hookFxWithNames = Fighting.gatherEffectsWithNames(user);
    if (hookFx[hookKey]) {
      const hookEffects = hookFx[hookKey] as Array<AbilityEffect>;
      for (const hookEffect of hookEffects) {
        // console.log("Handling hook effect", hookKey, "for", user.name, ": ", JSON.stringify(hookEffect));
        let target: Combatant | Combatant[] = prevTarget || user;
        if (hookEffect.target && !prevTarget) {
          if (hookEffect.target === "self") {
            target = user;
          } else {
            const newTarget = this.resolveTarget(hookEffect.target as TargetKind, user, context.allies || [], context.enemies || []);
            if (newTarget !== undefined) {
              target = newTarget;
            }
          }
        }
        // console.log("Hook effect target resolved to:", Array.isArray(target) ? target.map(t => t.name).join(", ") : target.name);
        const { success: _ignored, events: hookEvents } = await this.handleEffect(
          (label) + " due to " + Words.humanizeList(hookFxWithNames[hookKey].sources),
          hookEffect, user, target, context, handlers
        );
        events.push(...hookEvents);
        // console.log("hook effect events:", hookEvents, "success:", success);
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
    const userFx = Fighting.gatherEffects(user);
    if (userFx.triggerReactions === false) {
      return [];
    }

    const events: Omit<GameEvent, "turn">[] = [];

    const actorSide = [user, ...(context.allies ?? [])];
    const opponentSide = [...(context.enemies ?? [])];

    for (const reactor of reactors) {
      if (reactor.hp <= 0) { continue; }
      const reactorOnActorSide = actorSide.includes(reactor);
      // If reactor is on the same side as the acting user, then reactor's enemies are context.enemies.
      // Otherwise reactor's enemies are context.allies.
      const reactorAllies = (reactorOnActorSide ? actorSide : opponentSide).filter(c => c !== reactor);
      const reactorEnemies = reactorOnActorSide ? opponentSide : actorSide;

      const reactorContext: CombatContext = {
        subject: reactor,
        allies: reactorAllies,
        enemies: reactorEnemies,
        inventory: reactorOnActorSide ? context.enemyInventory : context.inventory,
        enemyInventory: reactorOnActorSide ? context.inventory : context.enemyInventory,
      };
      const reactionFx = Fighting.gatherEffects(reactor);
      const reactionFxWithNames = Fighting.gatherEffectsWithNames(reactor);
      if (reactionFx[reactionKey]) {
        const sources = Words.humanizeList(reactionFxWithNames[reactionKey].sources);
        const reactionEffects = reactionFx[reactionKey] as Array<AbilityEffect>;
        for (const reactionEffect of reactionEffects) {
          let target: (Combatant | Combatant[]) = user;
          if (reactionEffect.target) {
            target = this.validTargets({ target: [reactionEffect.target], effects: [reactionEffect] } as Ability, reactor, reactorAllies, reactorEnemies).flat();
            if (target.length === 0) {
              target = user;
            }
          }
          const { success, events: reactionEvents } = await this.handleEffect(
            reactor.forename + "'s " + (label).toLocaleLowerCase() + " reaction from " + sources,
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