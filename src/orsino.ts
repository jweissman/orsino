import { loadSetting } from "./orsino/loader";
import { Combatant } from "./orsino/types/Combatant";
import Dungeoneer from "./orsino/Dungeoneer";
import { CampaignModule, ModuleRunner } from "./orsino/ModuleRunner";
import Interactive from "./orsino/tui/User";
import CharacterRecord from "./orsino/rules/CharacterRecord";
import Generator, { GeneratorOptions } from "./orsino/Generator";
import AbilityHandler from "./orsino/Ability";
import TraitHandler from "./orsino/Trait";
import Combat from "./orsino/Combat";
import { Team } from "./orsino/types/Team";
import Presenter from "./orsino/tui/Presenter";
import Automatic from "./orsino/tui/Automatic";
import { never } from "./orsino/util/never";

export type Prompt = (message: string) => Promise<string>;

type PlaygroundType = "dungeon" | "module";  // TODO "world";

type CommandLineOptions = {
  partySize?: number;
}

// const outputSink = console.log;

export default class Orsino {
  static environment: 'production' | 'development' | 'test' = 'production';
  static outputSink: (message: string) => void = (message: string) => {
    if (message) {
      process.stdout.write(message + "\n");
    }
  }

  constructor(public settingName?: string) {
    Generator.setting = settingName ? loadSetting(settingName) : Generator.defaultSetting;
  }

  async play(
    type: PlaygroundType,
    options: CommandLineOptions = {}
  ) {
    const partySize = options.partySize || 3;
    const pcs = await CharacterRecord.chooseParty(
      (opts: GeneratorOptions) => Generator.gen("pc", { setting: 'fantasy', ...opts }) as unknown as Combatant,
      partySize
    );
    
    if (type === "dungeon") {
      const averageLevel = Math.round(pcs.reduce((sum, pc) => sum + pc.level, 0) / pcs.length);
      const targetCr = Math.round(averageLevel * 0.75);
      // console.log(`Selected party of ${pcs.length} PCs (average level ${averageLevel}), targeting CR ${targetCr}`);
      // this.genList("pc", { setting: 'fantasy', ...options }, partySize);
      const dungeoneer = new Dungeoneer({
        roller: Interactive.roll.bind(Interactive),
        select: Interactive.selection.bind(Interactive),
        outputSink: Orsino.outputSink,
        dungeonGen: () => Generator.gen("dungeon", { setting: 'fantasy', ...options, _targetCr: targetCr }),
        gen: Generator.gen.bind(Generator), //.bind(this),
        playerTeam: ({
          name: "Heroes", combatants: pcs.map(pc => ({ ...pc, playerControlled: true }))
        } as Team)
      });

      await dungeoneer.run();
    } else if (type === "module") {
      const moduleRunner = new ModuleRunner({
        roller: Interactive.roll.bind(Interactive),
        select: Interactive.selection.bind(Interactive),
        // prompt: Interactive.prompt.bind(Interactive),
        outputSink: Orsino.outputSink,
        moduleGen: (opts?: GeneratorOptions) => Generator.gen("module", { setting: 'fantasy', ...options, ...opts }) as unknown as CampaignModule,
        gen: Generator.gen.bind(Generator), //.bind(this),
        pcs: pcs.map(pc => ({ ...pc, playerControlled: true })),
      });
      await moduleRunner.run();
    }
    else {
      // throw new Error('Unsupported playground type: ' + type);
      return never(type);
    }
  }

  async autoplay(options: Record<string, any> = {}) {
    await AbilityHandler.instance.loadAbilities();
    await TraitHandler.instance.loadTraits();
    const pcs = [
      Generator.gen("pc", { setting: 'fantasy', class: 'warrior' }) as unknown as Combatant,
      Generator.gen("pc", { setting: 'fantasy', class: 'thief'   }) as unknown as Combatant,
      Generator.gen("pc", { setting: 'fantasy', class: 'mage'    }) as unknown as Combatant,
      Generator.gen("pc", { setting: 'fantasy', class: 'cleric'  }) as unknown as Combatant,
      Generator.gen("pc", { setting: 'fantasy', class: 'ranger'  }) as unknown as Combatant,
      Generator.gen("pc", { setting: 'fantasy', class: 'bard'    }) as unknown as Combatant,
    ].map(pc => ({ ...pc, playerControlled: true }))
    for (const pc of pcs) {
      await CharacterRecord.pickInitialSpells(pc, Automatic.randomSelect.bind(Automatic));
    }
    await CharacterRecord.assignPartyPassives(pcs);

    const outputSink = Orsino.outputSink;

    let inventory = [];

    while (true) {
      const averagePartyLevel = Math.round(pcs.reduce((sum, pc) => sum + pc.level, 0) / pcs.length);
      try {
      const moduleRunner = new ModuleRunner({
        outputSink,
        moduleGen: () => Generator.gen("module", { setting: 'fantasy', ...options, _moduleLevel: averagePartyLevel }) as unknown as CampaignModule,
        gen: Generator.gen.bind(Generator),
        pcs,
        inventory
      });
      await moduleRunner.run(true);
      inventory = moduleRunner.inventory;

      // show pc records
      for (const pc of pcs) {
        outputSink(await Presenter.characterRecord(pc as Combatant, inventory));
      }

      outputSink("\n----\nCombat statistics: " + JSON.stringify(Combat.statistics));
      outputSink("Rounds per combat:" + String((Combat.statistics.combats > 0) ? (Combat.statistics.totalRounds / Combat.statistics.combats).toFixed(2) : 0));
      outputSink("Victory rate: " + (Combat.statistics.combats > 0 ? ((Combat.statistics.victories / Combat.statistics.combats) * 100).toFixed(2) + "%" : "N/A"));

      } catch (e) {
        console.error("Autoplay encountered an error:", e);
        throw e;
      }
    }
  }
}

