import Deem from "../deem";
import AbilityHandler, { Ability, AbilityEffect } from "./Ability";
import Generator from "./Generator";
import StatusHandler, { StatusEffect, StatusModifications } from "./Status";
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
    Template.bootstrapDeem();

    process.stdout.write("\n");
  }

  static async monsters(options: Record<string, any> = {}) {
    await this.bootstrap();

    const monsterKinds = Deem.evaluate("gather(monsterKind)") as string[];
    monsterKinds.sort((a: string, b: string) => a.localeCompare(b));

    const monsterList = [];

    for (const monsterKind of monsterKinds) {
      // process.stdout.write(`\n## ${Words.capitalize(monsterKind)}s\n`);
      const monsterNames = Deem.evaluate("lookup(monsterKind, '" + monsterKind + "')") as string[];
      monsterNames.sort((a: string, b: string) => a.localeCompare(b));

      if (monsterKind === "elemental") {
        const elements = Deem.evaluate("gather(elementalModifiers)") as string[];
        for (const element of elements) {
          for (const monsterName of monsterNames) {
            const monster = Generator.gen("monster", {
              setting: 'fantasy',
              monster_type: monsterName,
              monster_aspect: 'wildtype',
              rank: 'standard',
              element,
              ...options
            }) as unknown as Combatant;

            monsterList.push(monster);
          }
        }
      } else {
        for (const monsterName of monsterNames) {
          const monster = Generator.gen("monster", {
            setting: 'fantasy',
            monster_type: monsterName,
            monster_aspect: 'wildtype',
            rank: 'standard',
            ...options
          }) as unknown as Combatant;

          monsterList.push(monster);
        }
      }
    }

    // sort monsterList by monster name
    monsterList.sort((a, b) => a.forename.localeCompare(b.forename));
    for (const monster of monsterList) {
      process.stdout.write(
        Presenter.markdownCharacterRecord(monster)
      )
    }

  }

  static async skillbook(_options: Record<string, any> = {}) {
    await this.bootstrap();

    process.stdout.write(`## Skills\n`);

    const skills = AbilityHandler.instance.allSkillNames()
    skills.sort((a, b) => a.localeCompare(b));

    process.stdout.write("| Skill | Description | Details |");
    process.stdout.write("|-------|-------------|---------|");

    skills.forEach(skillName => {
      const ability = AbilityHandler.instance.getAbility(skillName);
      if (ability && ability.type === "skill") {
        // process.stdout.write(`\n### ${ability.name}`);
        // process.stdout.write("_" + ability.description + "_");
        // process.stdout.write(
        //   Presenter.describeAbility(ability)
        // )
        let row = `| ${Words.capitalize(ability.name)} | _${ability.description}_ | `;
        row += Presenter.describeAbility(ability).replace(/\n/g, " ") + " |";
        process.stdout.write(row);
      }
    })
  }

  static async traitbook(_options: Record<string, any> = {}) {
    await this.bootstrap();


    const traits = TraitHandler.instance.allTraitNames()
    traits.sort((a, b) => a.localeCompare(b));

    process.stdout.write(`## Traits\n`);
    process.stdout.write("| Trait | Description | Abilities/Statuses |");
    process.stdout.write("|-------|-------------|--------------------|");

    traits.forEach(traitName => {
      const trait = TraitHandler.instance.getTrait(traitName);
      if (trait) {
        // process.stdout.write(`\n### ${Words.humanize(trait.name)}`);
        // process.stdout.write(trait.description);
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
        process.stdout.write(line);
      }
    })
  }

  // static async spells()

  static async spellbook(_options: Record<string, any> = {}) {
    await this.bootstrap();

    process.stdout.write(`## Spells\n`);
    const aspects = ['arcane', 'divine'];
    for (const aspect of aspects) {
      // process.stdout.write(`\n=== ${aspect.toUpperCase()} SPELLS ===\n`);
      process.stdout.write(`\n### ${Words.capitalize(aspect)} Spells\n`);

      const spells = AbilityHandler.instance.allSpellNames(aspect, Infinity, false)
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

      const categoryIcons: { [key: string]: string } = {
        "abjuration": "🛡️",
        "conjuration": "✨",
        "divination": "🔮",
        "enchantment": "💫",
        "evocation": "🔥",
        "necromancy": "💀",
        "transmutation": "🔄",
        "illusion": "🎭",

        "life": "🌿",
        "death": "☠️",
        "light": "🌞",
        "darkness": "🌑",
        "law": "⚖️",
        "chaos": "🎲",
        "nature": "🍃",
        "war": "⚔️",
      }

      process.stdout.write("\n| Cantrip | Level 1 | Level 2 | Level 3 | Level 4 | Level 5 | Level 6 | Level 7 | Level 8 | Level 9 |");
      process.stdout.write("  |---------|---------|---------|---------|---------|---------|---------|---------|---------|---------|");
      const spellLevels: Record<number, string[]> = {};
      spells.forEach(spellName => {
        const ability = AbilityHandler.instance.getAbility(spellName);
        if (ability && ability.type === "spell" && ability.alignment !== "evil") {
          const level = ability.level || 0;
          if (!spellLevels[level]) {
            spellLevels[level] = [];
          }
          // let category = ability.school || ability.domain || "";
          spellLevels[level].push(
            // "<small>" +
            // (category ? ` ${categoryIcons[category] || category}` : "")
            Words.capitalize(ability.name)
            // + "</small>"
          );
        }
      });
      const maxSpellsPerLevel = Math.max(...Object.values(spellLevels).map(arr => arr.length));
      for (let i = 0; i < maxSpellsPerLevel; i++) {
        let row = "| ";
        for (let level = 0; level <= 9; level++) {
          if (spellLevels[level] && spellLevels[level][i]) {
            const ability = AbilityHandler.instance.getAbility(spellLevels[level][i]);
            const category = ability?.school || ability?.domain || "";
            const icon = category ? ` ${categoryIcons[category] || category}` : "";
            row += `[<small>${icon} ${Words.capitalize(spellLevels[level][i])}</small>](#${spellLevels[level][i]}) | `;
          } else {
            row += " | ";
          }
        }
        process.stdout.write(row);
      }

      

      process.stdout.write("\n| Name | Level | School/Domain | Description | Details |");
      process.stdout.write("|---|---|---|---|-----|");
      spells.forEach(spellName => {
        const ability = AbilityHandler.instance.getAbility(spellName);
        if (ability && ability.type === "spell") {
          let row = `| <p id="${ability.name}">${Words.capitalize(ability.name)}</p> | `;
          row += `${ability.level || "??"} `;
          if (ability.school) {
            row += `| School of ${Words.capitalize(ability.school)}`;
          } else if (ability.domain) {
            row += `| ${ability.domain} domain `;
          } else {
            row += "| -- ";
          }
          row += `| _${ability.description}_ | `;
          row += `${Presenter.describeAbility(ability).replace(/\n/g, " ")} |`;
          process.stdout.write(row);
          // process.stdout.write(`\n#### ${ability.name}`); // (${ability.domain || ability.school}/${ability.level})`);
          // process.stdout.write(`Level: ${ability.level || 1} ${ability.school ? `| School: ${ability.school}` : ''}${ability.domain ? `| Domain: ${ability.domain}` : ''}`);
          // markdown table
          // process.stdout.write(`| **Level** | ${ability.level || "??"} |`);
          // if (ability.school) {
          //   process.stdout.write(`| **School** | ${ability.school} |`);
          // }
          // if (ability.domain) {
          //   process.stdout.write(`| **Domain** | ${ability.domain} |`);
          // }
          // // process.stdout.write("\n");
          // // process.stdout.write(`Target: ${ability.target}`);

          // process.stdout.write("_" + ability.description + "_");
          // process.stdout.write(
          //   Presenter.describeAbility(ability)
          // )
        }
      });
    }
  }

  static async itembook(_options: Record<string, any> = {}) {
    await this.bootstrap();

    process.stdout.write(`## Items\n`);
    // magic items
    process.stdout.write(`\n### Magic Items\n`);
    const magicItemNames = Deem.evaluate("gather(equipment)") as string[];
    magicItemNames.sort((a: string, b: string) => a.localeCompare(b));
    process.stdout.write("| Item | Description | Effects |");
    process.stdout.write("|------|-------------|---------|");
    for (const magicItemName of magicItemNames) {
      const magicItem = Deem.evaluate('lookup(equipment, "' + magicItemName + '")') as unknown as { name: string; description: string; effect: StatusModifications };
      // process.stdout.write(`\n#### ${magicItem.name}\n`);
      // process.stdout.write("_" + magicItem.description + "_\n");
      // process.stdout.write(
      //   Presenter.describeModifications(magicItem.effect)
      // )
      let row = `| ${Words.capitalize(magicItem.name)} | _${magicItem.description}_ | `;
      row += Presenter.describeModifications(magicItem.effect).replace(/\n/g, " ") + " |";
      process.stdout.write(row);
    }

    // consumables
    process.stdout.write(`\n### Consumables\n`);
    process.stdout.write("| Consumable | Description | Effects |");
    process.stdout.write("|------------|-------------|---------|");
    const consumableNames = Deem.evaluate("gather(consumables)") as string[];
    consumableNames.sort((a: string, b: string) => a.localeCompare(b));
    for (const consumableName of consumableNames) {
      const consumable = Deem.evaluate('lookup(consumables, "' + consumableName + '")') as unknown as Ability;
      // process.stdout.write(`\n#### ${consumable.name}\n`);
      // process.stdout.write("_" + consumable.description + "_\n");
      // process.stdout.write(
      //   Presenter.describeAbility(consumable)
      // )
      let row = `| ${Words.capitalize(consumable.name)} | _${consumable.description}_ | `;
      row += Presenter.describeAbility(consumable).replace(/\n/g, " ") + " |";
      process.stdout.write(row);
    }
  }

  static async statusbook(_options: Record<string, any> = {}) {
    await this.bootstrap();

    process.stdout.write(`## Status Effects\n`);

    const statuses = StatusHandler.instance.statusList;
    statuses.sort((a, b) => a.name.localeCompare(b.name));
    process.stdout.write("| Status Effect | Description | Details |");
    process.stdout.write("|---------------|-------------|---------|");

    statuses.forEach(status => {
      let row = `| ${status.name} | `;
      row += status.description ? `_${status.description}_ | ` : " | ";
      row += Presenter.describeStatus(status).replace(/\n/g, " ") + " |";
      process.stdout.write(row);
    });
  }

  static async wonderbook(_options: Record<string, any> = {}) {
    await Books.bootstrap();

    process.stdout.write(`## Wonders\n`);

    const wonderNames = Deem.evaluate("gather(wonderDescriptions)") as string[];
    wonderNames.sort((a: string, b: string) => a.localeCompare(b));
    process.stdout.write("| Wonder | Description | Effects |");
    process.stdout.write("|--------|-------------|---------|");
    for (const wonderName of wonderNames) {
      // process.stdout.write(`\n### ${Words.humanize(wonderName)}\n`);
      // let description = await Deem.evaluate('lookup(wonderDescriptions, "' + wonderName + '")');
      // process.stdout.write("_" + Words.capitalize(description) + "_\n");
      // let effects = await Deem.evaluate('lookup(wonderEffects, "' + wonderName + '")');
      // process.stdout.write(
      //   Presenter.describeEffects(effects, 'user')
      // )
      const description = Deem.evaluate('lookup(wonderDescriptions, "' + wonderName + '")') as string;
      const effects = Deem.evaluate('lookup(wonderEffects, "' + wonderName + '")') as unknown as AbilityEffect[];
      let row = `| ${Words.humanize(wonderName)} | _${Words.capitalize(description)}_ | `;
      row += Presenter.describeEffects(effects, 'user').replace(/\n/g, " ") + " |";
      process.stdout.write(row);
    }
  }

  static async planebook(_options: Record<string, any> = {}) {
    await this.bootstrap();

    process.stdout.write(`## Planes\n`);
    const planeNames = Deem.evaluate("gather(planeModifiers)") as string[];
    planeNames.sort((a: string, b: string) => a.localeCompare(b));
    for (const planeName of planeNames) {
      process.stdout.write(`\n### ${Words.humanize(planeName)}\n`);
      const plane = Deem.evaluate('lookup(planeModifiers, "' + planeName + '")') as unknown as {
        name: string;
        order?: string;
        alignment?: string;
        terrain?: string;
        domain?: string;
        weather?: string;
        race?: string;
        globalEffects: StatusModifications;
      };
      const description = Deem.evaluate('lookup(planeDescriptions, "' + planeName + '")') as string;
      process.stdout.write("_" + planeName + " is " + description + "_\n");
      process.stdout.write("| Alignment | Terrain | Domain | Climate | Race Association |");
      process.stdout.write("|-----------|---------|--------|---------|------------------|");
      process.stdout.write(`| ${Words.capitalize(plane.order || "--")} ${Words.capitalize(plane.alignment || "--")} | ${Words.capitalize(plane.terrain || "Varied")} | ${Words.capitalize(plane.domain || "None")} | ${Words.capitalize(plane.weather || "Varied")} | ${Words.capitalize(plane.race || "--")} |\n`);

      process.stdout.write("**Global Effects:** " + Presenter.describeModifications(plane.globalEffects) + "\n");
    }
  }

  static async trapbook(_options: Record<string, any> = {}) {
    await this.bootstrap();

    process.stdout.write(`## Traps\n`);

    const trapNames = Deem.evaluate("gather(trapPunishmentDescriptions)") as string[];
    trapNames.sort((a: string, b: string) => a.localeCompare(b));
    process.stdout.write("| Trap | Description | Effects |");
    process.stdout.write("|------|-------------|---------|");
    for (const trapName of trapNames) {
      const trapDescription = Deem.evaluate('lookup(trapPunishmentDescriptions, "' + trapName + '")');
      const trapEffects = Deem.evaluate('lookup(trapEffects, "' + trapName + '")');
      let row = `| ${Words.humanize(trapName)} | _${trapDescription}_ | `;
      row += Presenter.describeEffects(trapEffects, 'target').replace(/\n/g, " ") + " |";
      process.stdout.write(row);
    }
  }
      
}