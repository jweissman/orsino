import { StatusEffect } from "./Status";
import { Combatant } from "./types/Combatant";
import Files from "./util/Files";

export interface Trait {
  name: string;
  type: "party" | "racial" | "class" | "feat";
  description: string;
  requirements: {
    level?: number;
    // for racial/class traits
    race?: string; // "human" | "elf" | "dwarf" | "halfling" | "orc" | "gnome" | "fae";
    class?: string;  //"mage" | "warrior" | "thief" | "ranger" | "cleric" | "bard";

    // for party traits
    races?: string[]; //("human" | "elf" | "dwarf" | "halfling" | "orc" | "gnome" | "fae")[];
    formation?: string[]; //("mage" | "warrior" | "thief" | "ranger" | "cleric" | "bard")[];
  }
  statuses: StatusEffect[];
  abilities?: string[];

  spellbooks?: string[];
  domain?: string;
  school?: string;
}

type TraitDictionary = {
  [key: string]: Trait;
}

export default class TraitHandler {
  traits: TraitDictionary = {};
  loadedTraits: boolean = false;
  static instance = new TraitHandler();

  async loadTraits() {
    if (this.loadedTraits) {
      return;
    }
    const data = await Files.readJSON<TraitDictionary>("./settings/fantasy/traits.json");
    this.traits = data;
    Object.entries(this.traits).forEach(([key, trait]) => {
      trait.name = key;
    });
    this.loadedTraits = true;
  }

  allTraitNames(): string[] {
    return Object.keys(this.traits);
  }

  getTrait(name: string): Trait {
    if (!this.traits[name]) {
      throw new Error(`Trait not found: ${name}`);
    }
    return this.traits[name];
  }

  partyTraits(combatant: Combatant[]): Trait[] {
    const synergies: Trait[] = [];
    // close, but we need to explicitly match _each_ class in the intended formation
    // the above would allow for a party with just 1 warrior to get the "warrior trio" trait, which is not intended
    Object.values(this.traits).forEach(trait => {
      if (trait.type === "party") {
        if (trait.requirements.formation) {
          const hasRequired = trait.requirements.formation.every(reqClass =>
            combatant.filter(c => c.class === reqClass).length >= trait.requirements.formation!.filter(r => r === reqClass).length
          );
          if (hasRequired) {
            synergies.push(trait);
          }
        } else if (trait.requirements.races) {
          const hasRequired = trait.requirements.races.every(reqRace => 
            combatant.filter(c => c.race === reqRace).length >= trait.requirements.races!.filter(r => r === reqRace).length
          );
          if (hasRequired) {
            synergies.push(trait);
          }
        }
      }
    });

    return synergies;
  }

  classFeatures(pcClass: string, level: number): Trait[] {
    const features: Trait[] = [];
    Object.values(this.traits).forEach(trait => {
      if (trait.type === "feat" && trait.requirements.class === pcClass && trait.requirements.level !== undefined && trait.requirements.level <= level) {
        features.push(trait);
      }
    });
    console.log(`Class features for ${pcClass} level ${level}:`, features.map(f => f.name));
    return features;
  }

  featsForCombatant(pc: Combatant): Trait[] {
    if (!pc.class) {
      console.warn("No class for combatant", pc.name);
      return [];
    }

    const feats: Trait[] = [];
    for (const feat of this.classFeatures(pc.class, pc.level)) {
      if (!pc.traits.includes(feat.name)) {
        feats.push(feat);
      }
    }

    return feats;
  }


}