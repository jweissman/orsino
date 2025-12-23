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

    console.log("\n");
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

    console.log("| Skill | Description | Details |");
    console.log("|-------|-------------|---------|");

    skills.forEach(skillName => {
      const ability = AbilityHandler.instance.getAbility(skillName);
      if (ability && ability.type === "skill") {
        // console.log(`\n### ${ability.name}`);
        // console.log("_" + ability.description + "_");
        // console.log(
        //   Presenter.describeAbility(ability)
        // )
        let row = `| ${Words.capitalize(ability.name)} | _${ability.description}_ | `;
        row += Presenter.describeAbility(ability).replace(/\n/g, " ") + " |";
        console.log(row);
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
    console.log("| Trait | Description | Abilities/Statuses |");
    console.log("|-------|-------------|--------------------|");

    traits.forEach(traitName => {
      const trait = TraitHandler.instance.getTrait(traitName);
      if (trait) {
        // console.log(`\n### ${Words.humanize(trait.name)}`);
        // console.log(trait.description);
        let line = `| ${Words.humanize(trait.name)} | _${trait.description}_ | `;
        trait.statuses?.forEach(status => {
          line += `**${Words.humanize(status.name)}** - ${Presenter.describeStatus(status).replace(/\n/g, " ")}<br/>`;
        });
        if (trait.abilities?.length||0 > 0) {
          line += "*You gain the following abilities:*<br/>";
        }
        trait.abilities?.forEach(abilityName => {
          const ability = AbilityHandler.instance.getAbility(abilityName);
          if (ability) {
            line += `**${Words.capitalize(ability.name)}** - ${Presenter.describeAbility(ability).replace(/\n/g, " ")}<br/>`;
          }
        });
        
        line += " |";
        console.log(line);
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

          console.log("\n| Name | Level | School/Domain | Description | Details |");
          console.log("|---|---|---|---|-----|");
      spells.forEach(spellName => {
        const ability = AbilityHandler.instance.getAbility(spellName);
        if (ability && ability.type === "spell") {
          // let row = `| ${Words.capitalize(ability.name)} | Level: ${ability.level || "??"} ${ability.school ? `| School: ${ability.school}` : ''}${ability.domain ? `| Domain: ${ability.domain}` : ''} | _${ability.description}_ | ${Presenter.describeAbility(ability).replace(/\n/g, " ")} |`;
          let row = `| ${Words.capitalize(ability.name)} | `;
          row += `${ability.level || "??"} `;
          if (ability.school) {
            row += `| ${ability.school} school `;
          } else if (ability.domain) {
            row += `| ${ability.domain} domain `;
          } else {
            row += "| -- ";
          }
          row += `| _${ability.description}_ | `;
          row += `${Presenter.describeAbility(ability).replace(/\n/g, " ")} |`;
          console.log(row);
          // console.log(`\n#### ${ability.name}`); // (${ability.domain || ability.school}/${ability.level})`);
          // console.log(`Level: ${ability.level || 1} ${ability.school ? `| School: ${ability.school}` : ''}${ability.domain ? `| Domain: ${ability.domain}` : ''}`);
          // markdown table
          // console.log(`| **Level** | ${ability.level || "??"} |`);
          // if (ability.school) {
          //   console.log(`| **School** | ${ability.school} |`);
          // }
          // if (ability.domain) {
          //   console.log(`| **Domain** | ${ability.domain} |`);
          // }
          // // console.log("\n");
          // // console.log(`Target: ${ability.target}`);

          // console.log("_" + ability.description + "_");
          // console.log(
          //   Presenter.describeAbility(ability)
          // )
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
    console.log("| Item | Description | Effects |");
    console.log("|------|-------------|---------|");
    for (const magicItemName of magicItemNames) {
      let magicItem = await Deem.evaluate('lookup(equipment, "' + magicItemName + '")');
      // console.log(`\n#### ${magicItem.name}\n`);
      // console.log("_" + magicItem.description + "_\n");
      // console.log(
      //   Presenter.describeModifications(magicItem.effect)
      // )
      let row = `| ${Words.capitalize(magicItem.name)} | _${magicItem.description}_ | `;
      row += Presenter.describeModifications(magicItem.effect).replace(/\n/g, " ") + " |";
      console.log(row);
    }

    // consumables
    console.log(`\n### Consumables\n`);
    console.log("| Consumable | Description | Effects |");
    console.log("|------------|-------------|---------|");
    let consumableNames = await Deem.evaluate("gather(consumables)");
    consumableNames.sort((a: string, b: string) => a.localeCompare(b));
    for (const consumableName of consumableNames) {
      let consumable = await Deem.evaluate('lookup(consumables, "' + consumableName + '")');
      // console.log(`\n#### ${consumable.name}\n`);
      // console.log("_" + consumable.description + "_\n");
      // console.log(
      //   Presenter.describeAbility(consumable)
      // )
      let row = `| ${Words.capitalize(consumable.name)} | _${consumable.description}_ | `;
      row += Presenter.describeAbility(consumable).replace(/\n/g, " ") + " |";
      console.log(row);
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

  static async wonderbook(_options: Record<string, any> = {}) {
    await Books.bootstrap();

    console.log(`## Wonders\n`);

    let wonderNames = await Deem.evaluate("gather(wonderDescriptions)");
    wonderNames.sort((a: string, b: string) => a.localeCompare(b));
    console.log("| Wonder | Description | Effects |");
    console.log("|--------|-------------|---------|");
    for (const wonderName of wonderNames) {
      // console.log(`\n### ${Words.humanize(wonderName)}\n`);
      // let description = await Deem.evaluate('lookup(wonderDescriptions, "' + wonderName + '")');
      // console.log("_" + Words.capitalize(description) + "_\n");
      // let effects = await Deem.evaluate('lookup(wonderEffects, "' + wonderName + '")');
      // console.log(
      //   Presenter.describeEffects(effects, 'user')
      // )
      let description = await Deem.evaluate('lookup(wonderDescriptions, "' + wonderName + '")');
      let effects = await Deem.evaluate('lookup(wonderEffects, "' + wonderName + '")');
      let row = `| ${Words.humanize(wonderName)} | _${Words.capitalize(description)}_ | `;
      row += Presenter.describeEffects(effects, 'user').replace(/\n/g, " ") + " |";
      console.log(row);
    }
  }

  static async planebook(_options: Record<string, any> = {}) {
    await this.bootstrap();

    console.log(`## Planes\n`);
    let planeNames = await Deem.evaluate("gather(planeModifiers)");
    planeNames.sort((a: string, b: string) => a.localeCompare(b));
    for (const planeName of planeNames) {
      console.log(`\n### ${Words.humanize(planeName)}\n`);
      let plane = await Deem.evaluate('lookup(planeModifiers, "' + planeName + '")');
      let description = await Deem.evaluate('lookup(planeDescriptions, "' + planeName + '")');
      console.log("_" + planeName + " is " + description + "_\n");
      // console.log("**Alignment:** " + (plane.order || "Neutral") + " " + (plane.alignment || "Neutral") + "\n");
      // console.log("**Terrain:** " + (plane.terrain || "Varied") + "\n");
      // console.log("**Domain:** " + (plane.domain || "None") + "\n");
      // console.log("**Climate:** " + (plane.weather || "Varied") + "\n");
      console.log("| Alignment | Terrain | Domain | Climate | Race Association |");
      console.log("|-----------|---------|--------|---------|------------------|");
      console.log(`| ${Words.capitalize(plane.order || "--")} ${Words.capitalize(plane.alignment || "--")} | ${Words.capitalize(plane.terrain || "Varied")} | ${Words.capitalize(plane.domain || "None")} | ${Words.capitalize(plane.weather || "Varied")} | ${Words.capitalize(plane.race || "--")} |\n`);

      console.log("**Global Effects:** " + Presenter.describeModifications(plane.globalEffects) + "\n");
    }
  }
}