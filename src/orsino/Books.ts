import Deem from "../deem";
import Orsino from "../orsino";
import AbilityHandler, { Ability, AbilityEffect } from "./Ability";
import Generator from "./Generator";
import { Inventory, Weapon } from "./Inventory";
import StatusHandler, { StatusEffect, StatusModifications } from "./Status";
import { Template } from "./Template";
import TraitHandler from "./Trait";
import Presenter from "./tui/Presenter";
import Words from "./tui/Words";
import { Combatant } from "./types/Combatant";

export default class Books {
  static write(message: string) {
    Orsino.outputSink(message);
  }

  static async bootstrap() {
    await AbilityHandler.instance.loadAbilities();
    await TraitHandler.instance.loadTraits();
    await StatusHandler.instance.loadStatuses();
    Template.bootstrapDeem();

    this.write("\n");
  }

  static async monsters(options: Record<string, any> = {}) {
    await this.bootstrap();

    const monsterKinds = Deem.evaluate("gather(monsterKind)") as string[];
    monsterKinds.sort((a: string, b: string) => a.localeCompare(b));

    const monsterList = [];

    for (const monsterKind of monsterKinds) {
      // this.write(`\n## ${Words.capitalize(monsterKind)}s\n`);
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
      this.write(
        Presenter.markdownCharacterRecord(monster)
      )
    }

  }

  static async skillbook(_options: Record<string, any> = {}) {
    await this.bootstrap();

    this.write(`## Skills\n`);

    const skills = AbilityHandler.instance.allSkillNames()
    skills.sort((a, b) => a.localeCompare(b));

    this.write("| Skill | Description | Details |");
    this.write("|-------|-------------|---------|");

    skills.forEach(skillName => {
      const ability = AbilityHandler.instance.getAbility(skillName);
      if (ability && ability.type === "skill") {
        // this.write(`\n### ${ability.name}`);
        // this.write("_" + ability.description + "_");
        // this.write(
        //   Presenter.describeAbility(ability)
        // )
        let row = `| ${Words.capitalize(ability.name)} | _${ability.description}_ | `;
        row += Presenter.describeAbility(ability).replace(/\n/g, " ") + " |";
        this.write(row);
      }
    })
  }

  static async traitbook(_options: Record<string, any> = {}) {
    await this.bootstrap();


    const traits = TraitHandler.instance.allTraitNames()
    traits.sort((a, b) => a.localeCompare(b));

    this.write(`## Traits\n`);
    this.write("| Trait | Description | Abilities/Statuses |");
    this.write("|-------|-------------|--------------------|");

    traits.forEach(traitName => {
      const trait = TraitHandler.instance.getTrait(traitName);
      if (trait) {
        // this.write(`\n### ${Words.humanize(trait.name)}`);
        // this.write(trait.description);
        let line = `| ${Words.humanize(trait.name)} | _${trait.description}_ | `;
        trait.statuses?.forEach(status => {
          line += `**${Words.humanize(status.name)}** - ${Presenter.describeStatus(status).replace(/\n/g, " ")}<br/>`;
        });
        if (trait.abilities?.length || 0 > 0) {
          line += "*You gain the following abilities:*<br/>";
        }
        trait.abilities?.forEach(abilityName => {
          const ability = AbilityHandler.instance.getAbility(abilityName);
          if (ability) {
            line += `**${Words.capitalize(ability.name)}** - ${Presenter.describeAbility(ability).replace(/\n/g, " ")}<br/>`;
          }
        });

        line += " |";
        this.write(line);
      }
    })
  }

  // static async spells()

  static async spellbook(_options: Record<string, any> = {}) {
    await this.bootstrap();

    this.write(`## Spells\n`);

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
    this.write("\n### Legend")
    this.write("\n| Icon | School/Domain |");
    this.write("|------|---------------|");
    Object.entries(categoryIcons).forEach(([category, icon]) => {
      this.write(`| ${icon} | ${Words.capitalize(category)} |`);
    });

    const aspects = ['arcane', 'divine'];
    for (const aspect of aspects) {
      // this.write(`\n=== ${aspect.toUpperCase()} SPELLS ===\n`);
      this.write(`\n### ${Words.capitalize(aspect)} Spells\n`);

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
      this.write("\n| Cantrip | Level 1 | Level 2 | Level 3 | Level 4 | Level 5 | Level 6 | Level 7 | Level 8 | Level 9 |");
      this.write("  |---------|---------|---------|---------|---------|---------|---------|---------|---------|---------|");
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
        this.write(row);
      }



      this.write("\n| Name | Level | School/Domain | Description | Details |");
      this.write("|---|---|---|---|-----|");
      spells.forEach(spellName => {
        const ability = AbilityHandler.instance.getAbility(spellName);
        if (ability && ability.type === "spell") {
          let row = `| <p id="${ability.name}">${Words.capitalize(ability.name)}</p> | `;
          row += `${ability.level || "Cantrip"} `;
          if (ability.school) {
            row += `| School of ${Words.capitalize(ability.school)}`;
          } else if (ability.domain) {
            row += `| ${ability.domain} domain `;
          } else {
            row += "| -- ";
          }
          row += `| _${ability.description}_ | `;
          row += `${Presenter.describeAbility(ability).replace(/\n/g, " ")} |`;
          this.write(row);
          // this.write(`\n#### ${ability.name}`); // (${ability.domain || ability.school}/${ability.level})`);
          // this.write(`Level: ${ability.level || 1} ${ability.school ? `| School: ${ability.school}` : ''}${ability.domain ? `| Domain: ${ability.domain}` : ''}`);
          // markdown table
          // this.write(`| **Level** | ${ability.level || "??"} |`);
          // if (ability.school) {
          //   this.write(`| **School** | ${ability.school} |`);
          // }
          // if (ability.domain) {
          //   this.write(`| **Domain** | ${ability.domain} |`);
          // }
          // // this.write("\n");
          // // this.write(`Target: ${ability.target}`);

          // this.write("_" + ability.description + "_");
          // this.write(
          //   Presenter.describeAbility(ability)
          // )
        }
      });
    }
  }

  static async itembook(_options: Record<string, any> = {}) {
    await this.bootstrap();

    this.write(`## Items\n`);
    // magic items
    this.write(`\n### Magic Items\n`);
    const magicItemNames = Deem.evaluate("gather(equipment)") as string[];
    magicItemNames.sort((a: string, b: string) => a.localeCompare(b));
    this.write("| Item | Description | Effects |");
    this.write("|------|-------------|---------|");
    for (const magicItemName of magicItemNames) {
      const magicItem = Deem.evaluate('lookup(masterEquipment, "' + magicItemName + '")') as unknown as { name: string; description: string; effect: StatusModifications };
      // this.write(`\n#### ${magicItem.name}\n`);
      // this.write("_" + magicItem.description + "_\n");
      // this.write(
      //   Presenter.describeModifications(magicItem.effect)
      // )
      let row = `| ${Words.capitalize(magicItem.name)} | _${magicItem.description}_ | `;
      row += Presenter.describeModifications(magicItem.effect).replace(/\n/g, " ") + " |";
      this.write(row);
    }

    // consumables
    this.write(`\n### Consumables\n`);
    this.write("| Consumable | Description | Effects |");
    this.write("|------------|-------------|---------|");
    const consumableNames = Deem.evaluate("gather(consumables)") as string[];
    consumableNames.sort((a: string, b: string) => a.localeCompare(b));
    for (const consumableName of consumableNames) {
      const consumable = Deem.evaluate('lookup(consumables, "' + consumableName + '")') as unknown as Ability;
      // this.write(`\n#### ${consumable.name}\n`);
      // this.write("_" + consumable.description + "_\n");
      // this.write(
      //   Presenter.describeAbility(consumable)
      // )
      let row = `| ${Words.capitalize(consumable.name)} | _${consumable.description}_ | `;
      row += Presenter.describeAbility(consumable).replace(/\n/g, " ") + " |";
      this.write(row);
    }
  }

  static async statusbook(_options: Record<string, any> = {}) {
    await this.bootstrap();

    this.write(`## Status Effects\n`);

    const statuses = StatusHandler.instance.statusList;
    statuses.sort((a, b) => a.name.localeCompare(b.name));
    this.write("| Status Effect | Description | Details |");
    this.write("|---------------|-------------|---------|");

    statuses.forEach(status => {
      let row = `| ${status.name} | `;
      row += status.description ? `_${status.description}_ | ` : " | ";
      row += Presenter.describeStatus(status).replace(/\n/g, " ") + " |";
      this.write(row);
    });
  }

  static async wonderbook(_options: Record<string, any> = {}) {
    await Books.bootstrap();

    this.write(`## Wonders\n`);

    const wonderNames = Deem.evaluate("gather(wonderDescriptions)") as string[];
    wonderNames.sort((a: string, b: string) => a.localeCompare(b));
    this.write("| Wonder | Description | Effects |");
    this.write("|--------|-------------|---------|");
    for (const wonderName of wonderNames) {
      // this.write(`\n### ${Words.humanize(wonderName)}\n`);
      // let description = await Deem.evaluate('lookup(wonderDescriptions, "' + wonderName + '")');
      // this.write("_" + Words.capitalize(description) + "_\n");
      // let effects = await Deem.evaluate('lookup(wonderEffects, "' + wonderName + '")');
      // this.write(
      //   Presenter.describeEffects(effects, 'user')
      // )
      const description = Deem.evaluate('lookup(wonderDescriptions, "' + wonderName + '")') as string;
      const effects = Deem.evaluate('lookup(wonderEffects, "' + wonderName + '")') as unknown as AbilityEffect[];
      let row = `| ${Words.humanize(wonderName)} | _${Words.capitalize(description)}_ | `;
      row += Presenter.describeEffects(effects, 'user').replace(/\n/g, " ") + " |";
      this.write(row);
    }
  }

  static async planebook(_options: Record<string, any> = {}) {
    await this.bootstrap();

    this.write(`## Planes\n`);
    const planeNames = Deem.evaluate("gather(planeModifiers)") as string[];
    planeNames.sort((a: string, b: string) => a.localeCompare(b));
    for (const planeName of planeNames) {
      this.write(`\n### ${Words.humanize(planeName)}\n`);
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
      this.write("_" + planeName + " is " + description + "_\n");
      this.write("| Alignment | Terrain | Domain | Climate | Race Association |");
      this.write("|-----------|---------|--------|---------|------------------|");
      this.write(`| ${Words.capitalize(plane.order || "--")} ${Words.capitalize(plane.alignment || "--")} | ${Words.capitalize(plane.terrain || "Varied")} | ${Words.capitalize(plane.domain || "None")} | ${Words.capitalize(plane.weather || "Varied")} | ${Words.capitalize(plane.race || "--")} |\n`);

      this.write("**Global Effects:** " + Presenter.describeModifications(plane.globalEffects) + "\n");
    }
  }

  static async trapbook(_options: Record<string, any> = {}) {
    await this.bootstrap();

    this.write(`## Traps\n`);

    const trapNames = Deem.evaluate("gather(trapPunishmentDescriptions)") as string[];
    trapNames.sort((a: string, b: string) => a.localeCompare(b));
    this.write("| Trap | Description | Effects |");
    this.write("|------|-------------|---------|");
    for (const trapName of trapNames) {
      const trapDescription = Deem.evaluate('lookup(trapPunishmentDescriptions, "' + trapName + '")');
      const trapEffects = Deem.evaluate('lookup(trapEffects, "' + trapName + '")') as unknown as AbilityEffect[];
      let row = `| ${Words.humanize(trapName)} | _${trapDescription}_ | `;
      row += Presenter.describeEffects(trapEffects, 'target').replace(/\n/g, " ") + " |";
      this.write(row);
    }
  }

  static async weaponbook(_options: Record<string, any> = {}) {
    await this.bootstrap();

    this.write(`## Weapons\n`);

    const weaponNames = Deem.evaluate(
      `gather(masterWeapon, -1, '!dig(#__it, "natural")')`

    ) as string[];
    weaponNames.sort((a, b) => a.localeCompare(b));
    this.write("| Weapon | Description | Type | Damage | Properties | Value |");
    this.write("|--------|-------------|------|--------|------------|-------|");
    for (const weaponName of weaponNames) {
      const weapon = Deem.evaluate('lookup(masterWeapon, "' + weaponName + '")') as unknown as Weapon;
      const row = `| ${Words.humanize(weaponName)} | ${weapon.description} | ${weapon.type} | ${weapon.damage} | ${Words.capitalize(weapon.weight)} ${weapon.intercept ? "Intercept " : ""
        }${weapon.missile ? "Missile " : ""
        } | ${weapon.value} gp |`;
      this.write(row);
    }
  }

  static async armorbook(_options: Record<string, any> = {}) {
    await this.bootstrap();

    this.write(`## Armor\n`);

    const armorNames = Deem.evaluate("gather(masterArmor)") as string[];
    armorNames.sort((a, b) => a.localeCompare(b));
    this.write("| Armor | AC Bonus | Description | Weight | Value |");
    this.write("|-------|----------|-------------|--------|-------|");
    for (const armorName of armorNames) {
      const armor = Deem.evaluate('lookup(masterArmor, "' + armorName + '")') as unknown as { name: string; description: string; weight: string; value: number };
      const acBonus = Deem.evaluate('lookup(armorAC, "' + armorName + '")') as number;
      const row = `| ${Words.capitalize(armorName)} | ${acBonus} | _${armor.description}_ | ${Words.capitalize(armor.weight)} | ${armor.value} gp |`;
      this.write(row);
    }
  }

  static async gearbook(_options: Record<string, any> = {}) {
    await this.bootstrap();

    this.write(`## Gear\n`);

    const gearNames = Deem.evaluate("gather(masterGear)") as string[];
    gearNames.sort((a, b) => a.localeCompare(b));
    this.write("| Gear | Description | Value |");
    this.write("|------|-------------|-------|");

    for (const gearName of gearNames) {
      const gear = Deem.evaluate('lookup(masterGear, "' + gearName + '")') as unknown as { name: string; description: string; value: number };
      const row = `| ${Words.humanize(gearName)} | _${gear.description}_ | ${gear.value} gp |`;
      this.write(row);
    }
  }

  static async treasurebook(_options: Record<string, any> = {}) {
    await this.bootstrap();

    this.write(`## Treasure Tables\n`);

    const treasureTypes = Deem.evaluate("gather(treasure)") as string[];
    for (const treasureType of treasureTypes) {
      this.write(`\n### ${Words.capitalize(treasureType)} Treasure\n`);
      this.write("| Treasure | Description | Value | Kind |");
      this.write("|----------|-------------|-------|------|");
      const treasureEntries = Deem.evaluate('lookup(treasure, "' + treasureType + '")') as string[];
      for (let i = 0; i < treasureEntries.length; i++) {
        const treasureEntry = Words.humanize(treasureEntries[i]);
        const item = Inventory.item(treasureEntries[i]);
        this.write(`| ${treasureEntry} | ${item.description || 'A mysterious item'} | ${item.value || 'varies'} gp | ${item.itemClass || '--'} |`);
      }
    }
  }
}