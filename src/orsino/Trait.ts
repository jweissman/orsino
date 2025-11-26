import { StatusEffect } from "./Ability";
import { Combatant } from "./types/Combatant";
import Files from "./util/Files";

export interface Trait {
  name: string;
  type: "party" | "racial" | "class" | "feat";
  description: string;
  requirements: {
    level?: number;
    // for racial/class traits
    race?: "human" | "elf" | "dwarf" | "halfling" | "orc" | "gnome" | "fae";
    class?: "mage" | "warrior" | "thief" | "ranger" | "cleric" | "bard";

    // for party traits
    races?: ("human" | "elf" | "dwarf" | "halfling" | "orc" | "gnome" | "fae")[];
    formation?: ("mage" | "warrior" | "thief" | "ranger" | "cleric" | "bard")[];
  }
  statuses: StatusEffect[];
}

type TraitDictionary = {
  [key: string]: Trait;
}

export default class TraitHandler {
  traits: TraitDictionary = {};

  async loadTraits() {
    let data = await Files.readJSON<TraitDictionary>("./settings/fantasy/traits.json");
    // console.log("Loaded", Object.keys(data).length, "traits!");
    // add trait name to each trait object
    this.traits = data;
    Object.entries(this.traits).forEach(([key, trait]) => {
      trait.name = key;
    });
    // this.traits = Object.values(data).reduce((acc, trait) => {
    //   acc[trait.name] = trait;
    //   return acc;
    // }, {} as TraitDictionary);
    // this.traits = Object.values(data).reduce((acc, trait) => {
    //   acc[trait.name] = trait;
    //   return acc;
    // }, {} as TraitDictionary);
  }

  getTrait(name: string): Trait | null {
    return this.traits[name] || null;
  }

  partyTraits(combatant: Combatant[]): Trait[] {
    let synergies: Trait[] = [];
    // close, but we need to explicitly match _each_ class in the intended formation
    // the above would allow for a party with just 1 warrior to get the "warrior trio" trait, which is not intended
    Object.values(this.traits).forEach(trait => {
      if (trait.type === "party") {
        if (trait.requirements.formation) {
          let hasRequired = trait.requirements.formation.every(reqClass =>
            combatant.filter(c => c.class === reqClass).length >= trait.requirements.formation!.filter(r => r === reqClass).length
          );
          if (hasRequired) {
            synergies.push(trait);
          }
        } else if (trait.requirements.races) {
          let hasRequired = trait.requirements.races.every(reqRace => 
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
    let features: Trait[] = [];
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

    let feats: Trait[] = [];
    for (let feat of this.classFeatures(pc.class, pc.level)) {
      if (!pc.traits.includes(feat.name)) {
        feats.push(feat);
      }
    }

    return feats;
  }

}