import AbilityHandler, { Ability, AbilityEffect, TargetKind } from "../Ability";
import TraitHandler from "../Trait";
import Presenter from "../tui/Presenter";
import Words from "../tui/Words";
import { never } from "../util/never";
import StatusPresenter from "./StatusPresenter";

export default class AbilityPresenter extends Presenter {


  static describeSummoning(effect: AbilityEffect): string {
    let options = "";
    if ((effect.options)?._class) {
      options += ` of class ${Words.capitalize((effect.options)._class)} `;
    } else if ((effect.options)?.level) {
      options += ` level ${(effect.options).level} `;
    } else if ((effect.options)?.monster_type) {
      options += ` with type ${(effect.options).monster_type} `;
    } else if ((effect.options)?.rank) {
      options += ` at rank ${(effect.options).rank} `;
    }
    return options;
  }

  static describeEffect(effect: AbilityEffect, targetDescription: string): string {
    let description = "";
    let amount = effect.amount ? effect.amount.toString() : "1";
    if (amount.startsWith('=')) {
      amount = amount.slice(1);
    }

    switch (effect.type) {
      case "attack":
        description = (`Attack ${targetDescription}`);
        break;
      case "damage":
        description = (`Deal ${amount} ${effect.kind || "true"} damage to ${targetDescription}`);
        break;
      case "cast":
        if (!effect.spellName) {
          throw new Error(`Cast effect must have a spellName`);
        }
        description = (`Cast ability ${Words.humanize(effect.spellName)} (${this.describeAbility(AbilityHandler.instance.getAbility(effect.spellName))
          }) on ${targetDescription}`);
        break;
      case "heal": description = (`Heal ${targetDescription} ${amount} HP`); break;
      case "drain": description = (`Drain ${targetDescription} ${amount} HP`); break;
      case "buff":
        if (effect.status) {
          description = (`Grant ${targetDescription} ${StatusPresenter.describeStatusWithName(effect.status)}`);
        } else {
          console.warn(`Buff effect missing status: ${JSON.stringify(effect)}`);
          throw new Error(`Buff effect must have a status defined`);
        }
        break;
      case "debuff":
        if (effect.status) {
          const verb = targetDescription.startsWith("all") || targetDescription.includes("enemies")
            ? "suffer"
            : "suffers";
          description = (`${Words.capitalize(targetDescription)} ${verb} ${StatusPresenter.describeStatusWithName(effect.status)}`); // ${this.describeDuration(effect.status.duration)}`);
        } else {
          throw new Error(`Debuff effect ${JSON.stringify(effect)} must have a status defined`);
        }
        break;
      case "summon":
        description = (`Summon ${this.describeSummoning(effect)}${effect.creature || "creature"}`); break;
      case "removeStatus":
        description = (`Purge ${targetDescription} of ${effect.statusName}`); break;
      case "upgrade":
        if (effect.stat) {
          description = (`Permanently increase ${targetDescription} ${Words.statName(effect.stat)} by ${effect.amount || "1"}`);
        } else {
          throw new Error(`Upgrade effect must specify a stat`);
        }
        break;
      case "flee":
        description = (`Force ${targetDescription} to flee`); break;
      case "resurrect":
        // const hp = effect.hpPercent && effect.hpPercent < 100 ? `${effect.hpPercent}%` : "full";
        // description = (`Restore ${targetDescription} to life${effect.hpPercent ? ` with ${hp} health` : ""}`); break;

        description = this.describeResurrectEffect(effect, targetDescription);
        break;
      case "kill":
        description = (`Instantly kill ${targetDescription}`); break;
      case "gold":
        description = (`Gain ${amount} gold`); break;
      case "xp":
        description = (`Gain ${amount} XP`); break;
      case "randomEffect":
        description = (`Apply one of the following random effects to ${targetDescription}: ${(effect.randomEffects || []).map((opt: AbilityEffect) => this.describeEffect(opt, targetDescription)).join('; ')
          }`); break;
      case "cycleEffects":
        description = (`Cycle through the following effects on ${targetDescription}: ${(effect.cycledEffects || []).map((opt: AbilityEffect) => this.describeEffect(opt, opt.target || targetDescription)).join('; ')
          }`); break;
      case "learn":
        description = (`Learn ability ${Words.humanize(effect.abilityName!)} (${this.describeAbility(AbilityHandler.instance.getAbility(effect.abilityName!))
          })`); break;
      case "grantPassive":
        description = this.describePassiveGrantingEffect(effect, targetDescription);
        break;
      case "teleport":
        description = (`Teleport ${targetDescription} to ${effect.location} `); break;
      case "planeshift":
        description = (`Planeshift ${targetDescription} to ${effect.location}`); break;
      case "recalculateHp":
        description = (`Recalculate HP for ${targetDescription}`); break;
      case "acquireItem":
        description = (`Acquire item ${effect.itemName} for ${targetDescription}`); break;
      default:
        // console.warn(`Unknown effect type: ${effect.type} for effect ${JSON.stringify(effect)}`);
        return never(effect.type);
    }

    if (effect.spillover) {
      description += ` with spillover to adjacent targets`;
    }

    const cascade = effect.cascade ? ` cascading ${effect.cascade.count} times` : "";
    description += cascade;


    let condition = '';
    if (effect.condition) {
      condition += effect.condition.trait ? ` if ${effect.condition.trait}` : "";
      // condition += effect.condition.status ? ` if ${effect.condition.status}` : "";
    }
    description += condition;

    return description
      // strip extra spaces
      .replace(/\s+/g, ' ');
  }

  private static describeResurrectEffect(effect: AbilityEffect, targetDescription: string): string {
    const hp = effect.hpPercent && effect.hpPercent < 100 ? `${effect.hpPercent}%` : "full";
    return (`Restore ${targetDescription} to life${effect.hpPercent ? ` with ${hp} health` : ""}`);
  }

  private static describePassiveGrantingEffect(effect: AbilityEffect, targetDescription: string): string {
    if (!effect.traitName) {
      throw new Error(`grantPassive effect must have a traitName`);
    }
    const trait = TraitHandler.instance.getTrait(effect.traitName);
    const statuses = trait?.statuses && trait.statuses.length > 0 ?
      trait.statuses.map(s => StatusPresenter.describeStatusWithName(s)).join(' and ')
      : '';
    const abilities = trait?.abilities && trait.abilities.length > 0 ?
      trait.abilities.map(a => this.describeAbility(
        AbilityHandler.instance.getAbility(a)
      )).join(' and ')
      : '';
    const conferParts = [];
    if (statuses) { conferParts.push(`statuses: ${statuses}`); }
    if (abilities) { conferParts.push(`abilities: ${abilities}`); }
    return (`Grant passive trait ${effect.traitName} conferring ${conferParts.join(' and ')} to ${targetDescription}`);
  }


  static describeEffects(effects: AbilityEffect[], targetDescription: string = ""): string {
    const parts: string[] = [];
    if (effects.every(e => e.type === 'removeStatus') && effects.length > 0) {
      const statuses = effects.map(e => e.statusName).join(', ');
      return `Remove ${statuses} from ${targetDescription}`;
    }
    for (const effect of effects) {
      parts.push(this.describeEffect(effect, effect.target || targetDescription || "[missing target]"));
    }
    return Words.capitalize(parts.join("; "));
  }

  static describeTarget(target: TargetKind[]): string {
    const parts: string[] = [];
    for (const t of target) {
      let desc = "";
      switch (t) {
        case "self": desc = "yourself"; break;
        case "ally": desc = "an ally"; break;
        case "enemy": desc = "an enemy"; break;
        case "allies": desc = "all allies"; break;
        case "party": desc = "your party"; break;
        case "enemies": desc = "all enemies"; break;
        case "all": desc = "all combatants"; break;
        case "deadAlly": desc = "a fallen ally"; break;
        case "randomEnemies": return `${target[1]} random enemies`;
        default: return never(t);
      }
      parts.push(desc);
    }
    return parts.join(" or ");
  }

  static describeAbility(ability: Ability): string {
    if (ability.effects.length === 0) {
      return "Does nothing.";
    }
    // let parts: string[] = [];
    // parts.push("Narrative: " + ability.description);
    // parts.push("Mechanical: " + this.describeEffects(ability.effects, this.describeTarget(ability.target)) + ".");
    // return parts.join("\n");
    // console.log("Describing ability:", ability.name, ability);
    return this.describeEffects(ability.effects, this.describeTarget(ability.target)) + ".";
  }
}