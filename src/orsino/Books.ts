import Deem from "../deem";
import AbilityHandler from "./Ability";
import Generator from "./Generator";
import StatusHandler from "./Status";
import { Template } from "./Template";
import TraitHandler from "./Trait";
import Presenter from "./tui/Presenter";
import Words from "./tui/Words";
import { Combatant } from "./types/Combatant";

export default class Books {
  static async bootstrap() {
    await AbilityHandler.instance.loadAbilities();
    await TraitHandler.instance.loadTraits();
    await StatusHandler.instance.loadStatuses();
    await Template.bootstrapDeem();
  }

  static async monsters(options: Record<string, any> = {}) {
    await this.bootstrap();

    // console.log(`## Monsters\n`);
    const monsterKinds = await Deem.evaluate("gather(monsterKind)");
    monsterKinds.sort((a: string, b: string) => a.localeCompare(b));
    for (const monsterKind of monsterKinds) {
      console.log(`\n## ${Words.capitalize(monsterKind)}s\n`);
      let monsterNames = await Deem.evaluate("lookup(monsterKind, '" + monsterKind + "')");
      monsterNames.sort((a: string, b: string) => a.localeCompare(b));

      if (monsterKind === "elemental") {
        // loop through known elements
        let elements = await Deem.evaluate("gather(elementalModifiers)");
        for (const element of elements) {
          for (const monsterName of monsterNames) {
            let monster = await Generator.gen("monster", {
              setting: 'fantasy',
              monster_type: monsterName,
              monster_aspect: 'wildtype',
              rank: 'standard',
              element,
              ...options
            });
            console.log(
              await Presenter.markdownCharacterRecord(monster as Combatant)
            )
          }
        }
      } else {
        for (const monsterName of monsterNames) {
          let monster = await Generator.gen("monster", {
            setting: 'fantasy',
            monster_type: monsterName,
            monster_aspect: 'wildtype',
            rank: 'standard',
            ...options
          });
          console.log(
            await Presenter.markdownCharacterRecord(monster as Combatant)
          )
        }
      }
    }
    // const monsterTypes = await Deem.evaluate("gather(monsterTypeModifier)");
    // monsterTypes.sort((a: string, b: string) => a.localeCompare(b));
    // for (const monsterType of monsterTypes) {
    //   let monster = await Generator.gen("monster", {
    //     setting: 'fantasy', monster_type: monsterType, monster_aspect: 'wildtype', rank: 'standard',
    //     ...options
    //   });

    //   // console.log(`\n=== ${monster.name} ===\n`);
    //   console.log(await Presenter.markdownCharacterRecord(monster as Combatant));
    // }
  }

  static async skillbook(_options: Record<string, any> = {}) {
    await this.bootstrap();

    console.log(`## Skills\n`);

    let skills = AbilityHandler.instance.allSkillNames()
    skills.sort((a, b) => a.localeCompare(b));

    skills.forEach(skillName => {
      const ability = AbilityHandler.instance.getAbility(skillName);
      if (ability && ability.type === "skill") {
        console.log(`\n### ${ability.name}`);
        console.log("_" + ability.description + "_");
        console.log(
          Presenter.describeAbility(ability)
        )
      }
    })
  }

  static async traitbook(_options: Record<string, any> = {}) {
    await this.bootstrap();
    // await AbilityHandler.instance.loadAbilities();
    // await TraitHandler.instance.loadTraits();
    // await Template.bootstrapDeem();

    let traits = TraitHandler.instance.allTraitNames()
    traits.sort((a, b) => a.localeCompare(b));

    console.log(`## Traits\n`);

    traits.forEach(traitName => {
      const trait = TraitHandler.instance.getTrait(traitName);
      if (trait) {
        console.log(`\n### ${Words.humanize(trait.name)}`);
        // console.log(trait.description);
        trait.abilities?.forEach(abilityName => {
          const ability = AbilityHandler.instance.getAbility(abilityName);
          if (ability) {
            console.log(`\n##### ${ability.name}`);
            console.log("_" + ability.description + "_");
            console.log(
              Presenter.describeAbility(ability)
            )
          }
        });
        trait.statuses?.forEach(status => {
          console.log(`\n##### ${status.name}`);
          console.log(
            Presenter.describeStatus(status)
          )
        });
      }
    })
  }

  static async spellbook(_options: Record<string, any> = {}) {
    await this.bootstrap();

    console.log(`## Spells\n`);
    let aspects = ['arcane', 'divine'];
    for (const aspect of aspects) {
      // console.log(`\n=== ${aspect.toUpperCase()} SPELLS ===\n`);
      console.log(`\n### ${Words.capitalize(aspect)} Spells\n`);

      let spells = AbilityHandler.instance.allSpellNames(aspect, Infinity, false)
      spells.sort(
        (a, b) => {
          // const abilityA = AbilityHandler.instance.getAbility(a);
          // const abilityB = AbilityHandler.instance.getAbility(b);
          // if (abilityA && abilityB) {
          //   let levelDiff = ((abilityA.level || 1) - (abilityB.level || 1));
          //   if (levelDiff !== 0) {
          //     return levelDiff;
          //   }
          //   return ((abilityA.school || abilityA.domain || "").localeCompare(abilityB.school || abilityB.domain || "")) || a.localeCompare(b);
          // }
          return a.localeCompare(b);
        }
      )

      spells.forEach(spellName => {
        const ability = AbilityHandler.instance.getAbility(spellName);
        if (ability && ability.type === "spell") {
          console.log(`\n#### ${ability.name}`); // (${ability.domain || ability.school}/${ability.level})`);
          // console.log(`Level: ${ability.level || 1} ${ability.school ? `| School: ${ability.school}` : ''}${ability.domain ? `| Domain: ${ability.domain}` : ''}`);
          // markdown table
          console.log("\n| | |");
          console.log("|---|---|");
          console.log(`| **Level** | ${ability.level || "??"} |`);
          if (ability.school) {
            console.log(`| **School** | ${ability.school} |`);
          }
          if (ability.domain) {
            console.log(`| **Domain** | ${ability.domain} |`);
          }
          console.log("\n");
          // console.log(`Target: ${ability.target}`);

          console.log("_" + ability.description + "_");
          console.log(
            Presenter.describeAbility(ability)
          )
        }
      });
    }
  }

  static async itembook(_options: Record<string, any> = {}) {
    await this.bootstrap();

    console.log(`## Items\n`);
    // magic items
    console.log(`\n### Magic Items\n`);
    let magicItemNames = await Deem.evaluate("gather(equipment)");
    magicItemNames.sort((a: string, b: string) => a.localeCompare(b));
    for (const magicItemName of magicItemNames) {
      let magicItem = await Deem.evaluate('lookup(equipment, "' + magicItemName + '")');
      console.log(`\n#### ${magicItem.name}\n`);
      console.log("_" + magicItem.description + "_\n");
      console.log(
        Presenter.describeModifications(magicItem.effect)
      )
    }

    // consumables
    console.log(`\n### Consumables\n`);
    let consumableNames = await Deem.evaluate("gather(consumables)");
    consumableNames.sort((a: string, b: string) => a.localeCompare(b));
    for (const consumableName of consumableNames) {
      let consumable = await Deem.evaluate('lookup(consumables, "' + consumableName + '")');
      console.log(`\n#### ${consumable.name}\n`);
      console.log("_" + consumable.description + "_\n");
      console.log(
        Presenter.describeAbility(consumable)
      )
    }
  }

  static async statusbook(_options: Record<string, any> = {}) {
    await this.bootstrap();

    console.log(`## Status Effects\n`);

    let statuses = StatusHandler.instance.statusList;
    statuses.sort((a, b) => a.name.localeCompare(b.name));
    console.log("| Status Effect | Description | Details |");
    console.log("|---------------|-------------|---------|");

    statuses.forEach(status => {
      let row = `| ${status.name} | `;
      row += status.description ? `_${status.description}_ | ` : " | ";
      row += Presenter.describeStatus(status).replace(/\n/g, " ") + " |";
      console.log(row);
    });
    
  }
}