import { loadSetting } from "./orsino/loader";
import { Combatant } from "./orsino/types/Combatant";
import Dungeoneer, { Dungeon } from "./orsino/Dungeoneer";
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
import { ItemInstance } from "./orsino/types/ItemInstance";
import StatusHandler from "./orsino/Status";
import { Template } from "./orsino/Template";
import { AutomaticPlayDriver, ConsoleDriver, InquirerDriver, NullDriver } from "./orsino/Driver";

type PlaygroundType = "dungeon" | "module";  // TODO "world";

type CommandLineOptions = {
  partySize?: number;
}

export default class Orsino {
  static environment: 'production' | 'development' | 'test' = 'production';
  static outputSink: (message: string) => void = (message: string) => {
    if (message) {
      process.stdout.write(message + "\n");
    }
  }
  useInquirer: boolean = true;

  constructor(public settingName?: string) {
    Generator.setting = settingName ? loadSetting(settingName) : Generator.defaultSetting;
  }

  async play(
    type: PlaygroundType,
    options: CommandLineOptions = {}
  ) {
    const driver = this.useInquirer ? new InquirerDriver() : new ConsoleDriver();
    Orsino.outputSink = driver.writeLn.bind(driver);

    const partySize = options.partySize || 1;
    const pcs = await CharacterRecord.chooseParty(
      (opts: GeneratorOptions) => Generator.gen("pc", { setting: 'fantasy', ...opts }) as unknown as Combatant,
      partySize,
      driver.select.bind(driver),
      driver.confirm.bind(driver)
    );
    
    if (type === "dungeon") {
      const averageLevel = Math.round(pcs.reduce((sum, pc) => sum + pc.level, 0) / pcs.length);
      const targetCr = Math.round(averageLevel * 0.75);
      const dungeoneer = new Dungeoneer({
        roller: Interactive.roll.bind(Interactive),
        driver,
        // pause: driver.pause.bind(driver),
        // select: driver.select.bind(driver),
        // clear: driver.clear.bind(driver),
        // outputSink: Orsino.outputSink,
        dungeonGen: () => Generator.gen("dungeon", { setting: 'fantasy', ...options, _targetCr: targetCr }) as unknown as Dungeon,
        gen: Generator.gen.bind(Generator), //.bind(this),
        playerTeam: ({
          name: "Heroes", combatants: pcs.map(pc => ({ ...pc, playerControlled: true }))
        } as Team)
      });

      await dungeoneer.run();
    } else if (type === "module") {
      const moduleRunner = new ModuleRunner({
        roller: Interactive.roll.bind(Interactive),
        driver,
        // select: driver.select.bind(driver),
        // pause: driver.pause.bind(driver),
        // clear: driver.clear.bind(driver),
        // outputSink: Orsino.outputSink,
        moduleGen: (opts?: GeneratorOptions) => Generator.gen("module", { setting: 'fantasy', ...options, ...opts }) as unknown as CampaignModule,
        gen: Generator.gen.bind(Generator), //.bind(this),
        pcs: pcs.map(pc => ({ ...pc, playerControlled: true })),
      });
      await moduleRunner.run();
    }
    else {
      return never(type);
    }
  }

  async autoplay(options: Record<string, any> = {}) {
    await AbilityHandler.instance.loadAbilities();
    await TraitHandler.instance.loadTraits();
    await StatusHandler.instance.loadStatuses();
    Template.bootstrapDeem({ setting: 'fantasy' });

    const pcGen = (pcClass: string) => (options: GeneratorOptions) => Generator.gen("pc", { ...options, setting: 'fantasy', class: pcClass }) as unknown as Combatant
    const pcs: Combatant[] = [
      await CharacterRecord.autogen(CharacterRecord.pcRaces, pcGen("warrior")),
      await CharacterRecord.autogen(CharacterRecord.pcRaces, pcGen("thief")),
      await CharacterRecord.autogen(CharacterRecord.pcRaces, pcGen("mage")),
      await CharacterRecord.autogen(CharacterRecord.pcRaces, pcGen("cleric")),
      await CharacterRecord.autogen(CharacterRecord.pcRaces, pcGen("ranger")),
      await CharacterRecord.autogen(CharacterRecord.pcRaces, pcGen("bard")),
    ].map(pc => ({ ...pc, playerControlled: true }))
    for (const pc of pcs) {
      await CharacterRecord.chooseTraits(pc, Automatic.randomSelect.bind(Automatic));
    }
    await CharacterRecord.assignPartyPassives(pcs);

    const outputSink = Orsino.outputSink;

    let inventory: ItemInstance[] = [];

    const driver = new AutomaticPlayDriver();

    while (true) {
      const averagePartyLevel = Math.round(pcs.reduce((sum, pc) => sum + pc.level, 0) / pcs.length);
      try {
      const moduleRunner: ModuleRunner = new ModuleRunner({
        driver,
        // outputSink,
        // clear: () => process.stdout.write('\x1Bc'),
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

