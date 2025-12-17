import { loadSetting } from "./orsino/loader";
import { Gauntlet } from "./orsino/Gauntlet";
import { Combatant } from "./orsino/types/Combatant";
import Dungeoneer from "./orsino/Dungeoneer";
import { ModuleRunner } from "./orsino/ModuleRunner";
import Interactive from "./orsino/tui/User";
import CharacterRecord from "./orsino/rules/CharacterRecord";
import Generator from "./orsino/Generator";
import AbilityHandler from "./orsino/Ability";
import TraitHandler from "./orsino/Trait";
import Combat from "./orsino/Combat";
import { Team } from "./orsino/types/Team";
import Deem from "./deem";
import Presenter from "./orsino/tui/Presenter";
import { Template } from "./orsino/Template";
import Words from "./orsino/tui/Words";

export type Prompt = (message: string) => Promise<string>;

type PlaygroundType = "combat" | "dungeon" | "module";  // TODO "world";

export default class Orsino {
  static environment: 'production' | 'development' | 'test' = 'production';
  // setting: Record<GenerationTemplateType, Template | Table>;

  constructor(public settingName?: string) {
    Generator.setting = settingName ? loadSetting(settingName) : Generator.defaultSetting;
  }

  async play(
    type: PlaygroundType,
    options: Record<string, any> = {}
  ) {
    const partySize = options.partySize || 3;
    const pcs = await CharacterRecord.chooseParty(
      async (opts: Record<string, any>) => await Generator.gen("pc", { setting: 'fantasy', ...opts }) as Combatant,
      partySize
    );
    if (type === "combat") {
      let gauntlet = (new Gauntlet({
        ...options,
        roller: Interactive.roll,
        select: Interactive.selection,
        outputSink: console.log,
      }))

      // const partySize = options.partySize || Math.max(1, Math.floor(Math.random() * 3) + 1);
      await gauntlet.run({
        pcs, //: this.genList("pc", { setting: 'fantasy', ...options }, partySize),
        encounterGen: (targetCr: number) => Generator.gen("encounter", { setting: 'fantasy', ...options, targetCr }),
      });
    }
    else if (type === "dungeon") {
      const averageLevel = Math.round(pcs.reduce((sum, pc) => sum + pc.level, 0) / pcs.length);
      const targetCr = Math.round(averageLevel * 0.75);
      console.log(`Selected party of ${pcs.length} PCs (average level ${averageLevel}), targeting CR ${targetCr}`);
      // this.genList("pc", { setting: 'fantasy', ...options }, partySize);
      const dungeoneer = new Dungeoneer({
        roller: Interactive.roll,
        select: Interactive.selection,
        outputSink: console.log,
        dungeonGen: () => Generator.gen("dungeon", { setting: 'fantasy', ...options, _targetCr: targetCr }),
        gen: Generator.gen, //.bind(this),
        playerTeam: ({
          name: "Heroes", combatants: pcs.map(pc => ({ ...pc, playerControlled: true }))
        } as Team)
      });

      await dungeoneer.run();
    } else if (type === "module") {
      const moduleRunner = new ModuleRunner({
        roller: Interactive.roll,
        select: Interactive.selection,
        prompt: Interactive.prompt,
        outputSink: console.log,
        moduleGen: () => Generator.gen("module", { setting: 'fantasy', ...options }),
        gen: Generator.gen, //.bind(this),
        pcs: pcs.map(pc => ({ ...pc, playerControlled: true })),
      });
      await moduleRunner.run();
    }
    else {
      throw new Error('Unsupported playground type: ' + type);
    }
  }

  async autoplay(options: Record<string, any> = {}) {
    await AbilityHandler.instance.loadAbilities();
    await TraitHandler.instance.loadTraits();
    const pcs = [

      await Generator.gen("pc", { setting: 'fantasy', class: 'warrior', playerControlled: true }) as Combatant,
      await Generator.gen("pc", { setting: 'fantasy', class: 'thief', playerControlled: true }) as Combatant,
      await Generator.gen("pc", { setting: 'fantasy', class: 'mage', playerControlled: true }) as Combatant,
    ].map(pc => ({ ...pc, playerControlled: true }))
    while (true) {
      let averagePartyLevel = Math.round(pcs.reduce((sum, pc) => sum + pc.level, 0) / pcs.length);
      try {
      const moduleRunner = new ModuleRunner({
        outputSink: console.log,
        moduleGen: () => Generator.gen("module", { setting: 'fantasy', ...options, _moduleLevel: averagePartyLevel }),
        gen: Generator.gen, //.bind(this),
        pcs //: pcs.map(pc => ({ ...pc, playerControlled: true })),
      });
      await moduleRunner.run(true);

      // show pc records
      for (let pc of pcs) {
        console.log(await Presenter.characterRecord(pc as Combatant));
      }

      console.log("\n----\nCombat statistics:", Combat.statistics);
      console.log("Rounds per combat:", (Combat.statistics.combats > 0) ? (Combat.statistics.totalRounds / Combat.statistics.combats).toFixed(2) : 0);
      console.log("Victory rate:", Combat.statistics.combats > 0 ? ((Combat.statistics.victories / Combat.statistics.combats) * 100).toFixed(2) + "%" : "N/A");

      } catch (e) {
        console.error("Autoplay encountered an error:", e);
      }
    }
  }

  async monsterManual(options: Record<string, any> = {}) {
    await AbilityHandler.instance.loadAbilities();
    await TraitHandler.instance.loadTraits();
    await Template.bootstrapDeem();
    const monsterTypes = await Deem.evaluate("gather(monsterTypeModifier)");
    for (const monsterType of monsterTypes) {
      let monster = await Generator.gen("monster", {
        setting: 'fantasy', monster_type: monsterType, monster_aspect: 'wildtype', rank: 'standard',
        ...options
      });
      // console.log(`\n=== ${monster.name} ===\n`);
      console.log(await Presenter.characterRecord(monster as Combatant));
    }
  }

  async skillbook(_options: Record<string, any> = {}) {
    await AbilityHandler.instance.loadAbilities();
    await TraitHandler.instance.loadTraits();
    await Template.bootstrapDeem();

    console.log(`# Skills\n`);

    let skills = AbilityHandler.instance.allSkillNames()
    skills.sort((a, b) => a.localeCompare(b));

    skills.forEach(skillName => {
      const ability = AbilityHandler.instance.getAbility(skillName);
      if (ability && ability.type === "skill") {
        console.log(`\n## ${ability.name}`);
        console.log("_" + ability.description + "_");
        console.log(
          Presenter.describeAbility(ability)
        )
      }
    })
  }

  async traitbook(_options: Record<string, any> = {}) {
    await AbilityHandler.instance.loadAbilities();
    await TraitHandler.instance.loadTraits();
    await Template.bootstrapDeem();

    let traits = TraitHandler.instance.allTraitNames()
    traits.sort((a, b) => a.localeCompare(b));

    console.log(`# Traits\n`);

    traits.forEach(traitName => {
      const trait = TraitHandler.instance.getTrait(traitName);
      if (trait) {
        console.log(`\n## ${Words.humanize(trait.name)}`);
        // console.log(trait.description);
        trait.abilities?.forEach(abilityName => {
          const ability = AbilityHandler.instance.getAbility(abilityName);
          if (ability) {
            console.log(`\n#### ${ability.name}`);
            console.log("_" + ability.description + "_");
            console.log(
              Presenter.describeAbility(ability)
            )
          }
        });
        trait.statuses?.forEach(status => {
          console.log(`\n#### ${status.name}`);
          console.log(
            Presenter.describeStatus(status)
          )
        });
      }
    })
  }

  async spellbook(_options: Record<string, any> = {}) {
    await AbilityHandler.instance.loadAbilities();
    await TraitHandler.instance.loadTraits();
    await Template.bootstrapDeem();


    console.log(`# Spells\n`);
    let aspects = ['arcane', 'divine'];
    for (const aspect of aspects) {
      // console.log(`\n=== ${aspect.toUpperCase()} SPELLS ===\n`);
      console.log(`\n## ${Words.capitalize(aspect)} Spells\n`);

      let spells = AbilityHandler.instance.allSpellNames(aspect)
      spells.sort(
        (a, b) => {
          const abilityA = AbilityHandler.instance.getAbility(a);
          const abilityB = AbilityHandler.instance.getAbility(b);
          if (abilityA && abilityB) {
            let levelDiff = ((abilityA.level || 1) - (abilityB.level || 1));
            if (levelDiff !== 0) {
              return levelDiff;
            }
            return ((abilityA.school || abilityA.domain || "").localeCompare(abilityB.school || abilityB.domain || "")) || a.localeCompare(b);
          }
          return a.localeCompare(b);
        }
      )

      spells.forEach(spellName => {
        const ability = AbilityHandler.instance.getAbility(spellName);
        if (ability && ability.type === "spell") {
          console.log(`\n### ${ability.name}`); // (${ability.domain || ability.school}/${ability.level})`);
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
}

