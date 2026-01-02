import { describe, it, expect } from 'bun:test';
import Combat from '../src/orsino/Combat';
import Dungeoneer, { BossRoom, Dungeon, Room } from '../src/orsino/Dungeoneer';
import { CampaignModule, ModuleRunner } from '../src/orsino/ModuleRunner';
import AbilityHandler from '../src/orsino/Ability';
import Generator, { GeneratorOptions } from '../src/orsino/Generator';
import CharacterRecord from '../src/orsino/rules/CharacterRecord';
import { Combatant } from '../src/orsino/types/Combatant';
import Presenter from '../src/orsino/tui/Presenter';
import TraitHandler from '../src/orsino/Trait';
import { loadSetting } from '../src/orsino/loader';
import Events, { GameEvent } from '../src/orsino/Events';
import { Team } from '../src/orsino/types/Team';
import Orsino from '../src/orsino';
import Automatic from '../src/orsino/tui/Automatic';

describe('Orsino', () => {
  Orsino.environment = 'test';
  Generator.setting = loadSetting('fantasy');

  it('generate male name', () => {
    const response = Generator.gen("name", { group: 'male' });
    expect(response).toMatch(/[A-Z][a-z]+/);
  });

  it('generate female name', () => {
    const response = Generator.gen("name", { gender: 'female' });
    expect(response).toMatch(/[A-Z][a-z]+/);
  });

  it('generate pc', () => {
    const response = Generator.gen("pc", { gender: 'male' }) as unknown as Combatant;
    expect(response.name).toMatch(/[A-Z][a-z]+/);
    expect(typeof response.age).toBe("number");
    expect(response.age).toBeGreaterThanOrEqual(16);
  });

  it("generate room", () => {
    const room = Generator.gen("room", { setting: "fantasy", targetCr: 12 }) as unknown as Room;
    expect(room.narrative).toMatch(/[a-z\s]+/);
    expect(room.room_size).toMatch(/tiny|small|medium|large|enormous/);
  });

  it('pc gen', () => {
    const pc = Generator.gen("pc", { setting: "fantasy" }) as unknown as Combatant;
    expect(pc).toHaveProperty('name');
    expect(pc.name).toMatch(/[A-Z][a-z]+/);

    expect(pc).toHaveProperty('age');
    expect(pc.age).toBeGreaterThanOrEqual(16);

    expect(pc).toHaveProperty('class');
    expect(pc).toHaveProperty('str');
    expect(pc).toHaveProperty('dex');
    expect(pc).toHaveProperty('con');
    expect(pc).toHaveProperty('int');
    expect(pc).toHaveProperty('wis');
    expect(pc).toHaveProperty('cha');
    expect(pc).toHaveProperty('hp');
    expect(pc).toHaveProperty('maximumHitPoints');
    expect(pc).toHaveProperty('level');
    // expect(pc).toHaveProperty('ac');
    expect(pc).toHaveProperty('equipment');
    expect(pc.equipment).toBeInstanceOf(Object);
    expect(pc.equipment).toHaveProperty('weapon');
    expect(pc.equipment).toHaveProperty('body');
  });

  it('combat generator', async () => {
    const combat = new Combat();
    expect(combat.abilityHandler).toBeInstanceOf(AbilityHandler);

    await combat.setUp(Combat.defaultTeams());
    expect(combat.isOver()).toBe(false);
    expect(combat._teams[0]).toHaveProperty('name');
    expect(combat._teams[1]).toHaveProperty('name');
    expect(combat._teams[0].combatants[0].hp).toBeGreaterThan(0);
    expect(combat._teams[1].combatants[0].hp).toBeGreaterThan(0);

    // await combat.setUp();
    let _turn = await combat.round();
    // expect(turn).toHaveProperty('number');
    // expect(turn).toHaveProperty('description');
    while (!combat.isOver()) {
      _turn = await combat.round();
      // expect(turn).toHaveProperty('number');
      // expect(turn).toHaveProperty('description');
    }
    expect(combat.winner).toBeDefined();
    expect(combat.winner).toMatch(/Player|Enemy/);
  });

  it('dungeon generator', async () => {
    const crawler = new Dungeoneer({ dungeonGen: () => Generator.gen("dungeon") as unknown as Dungeon });
    crawler.setUp();
    expect(crawler.isOver()).toBe(false);
    expect(crawler.dungeon).toBeDefined();
    expect(crawler.dungeon).toHaveProperty('dungeon_name');
    expect(crawler.dungeon.rooms.length).toBeGreaterThan(1);
    while (!crawler.isOver()) {
      const room = crawler.currentRoom as Room | BossRoom;
      await crawler.enterRoom(room);
      // console.log("- Room target CR level:", room.targetCr, "actual:", encounter?.cr);
      // console.log("  Creature levels:", encounter?.creatures.map(c => `${c.name} (level ${c.level})`).join(", "));
      expect(room).toHaveProperty('narrative');
      expect(room).toHaveProperty('room_type');
      expect(room).toHaveProperty('room_size');
      expect(room).toHaveProperty('treasure');
      // expect(room).toHaveProperty('encounter');
      // const _encounter = crawler.currentEncounter;

      crawler.currentMonsterTeam.combatants.forEach(monster => {
        monster.hp = 0; // Simulate defeating the monster
      });
      crawler.moveToNextRoom();

    }
    expect(crawler.winner).toBeDefined();
    expect(crawler.winner).toMatch(/Player|Enemy/);
  });

  it('name presentation', async () => {
    const pc      = Generator.gen("pc", { setting: "fantasy" }) as unknown as Combatant;
    const npc     = Generator.gen("npc", { setting: "fantasy", targetCr: pc.level }) as unknown as Combatant;
    const animal  = Generator.gen("animal", { setting: "fantasy" }) as unknown as Combatant;
    const monster = Generator.gen("monster", { setting: "fantasy" }) as unknown as Combatant;

    console.warn("\n--- Character Presentations (minimal) ---\n");
    console.warn("PC:      ", Presenter.minimalCombatant(pc));
    console.warn("NPC:     ", Presenter.minimalCombatant(npc));
    console.warn("Animal:  ", Presenter.minimalCombatant(animal));
    console.warn("Monster: ", Presenter.minimalCombatant(monster));
    console.warn("\n--- Character Presentations (full) ---\n");
    console.warn("PC:      ", Presenter.combatant(pc));
    console.warn("NPC:     ", Presenter.combatant(npc));
    console.warn("Animal:  ", Presenter.combatant(animal));
    console.warn("Monster: ", Presenter.combatant(monster));

    console.warn("\n--- Party Presentation ---\n")
    const teams: Team[] = [
      { name: "Heroes", combatants: [pc, npc], inventory: [] },
      { name: "Foes", combatants: [animal, monster], inventory: [] }
    ];
    console.warn(Presenter.parties(teams));

    console.warn("\n--- Round Presentation ---\n")
    const roundEvent: GameEvent = {
      type: "roundStart",
      turn: 1,
      combatants: [pc, npc, animal, monster] as Combatant[],
      parties: teams,
      auras: [],
      environment: "Dark Cave"
    };
    console.warn(await Events.present(roundEvent));
  });

  it('simple mod runner', async () => {
    Combat.statistics = { combats: 0, victories: 0, totalRounds: 0, defeats: 0 };
    await AbilityHandler.instance.loadAbilities();
    await TraitHandler.instance.loadTraits();
    const mod = Generator.gen("module", { setting: "fantasy" }) as unknown as CampaignModule;
    expect(mod).toHaveProperty('name');
    expect(mod).toHaveProperty('terrain');
    expect(mod).toHaveProperty('town');
    expect(mod.town).toHaveProperty('name');
    expect(mod.town).toHaveProperty('population');
    expect(mod.town).toHaveProperty('deity');
    expect(mod).toHaveProperty('dungeons');
    expect(mod.dungeons).toBeInstanceOf(Array);

    const party = await CharacterRecord.chooseParty(
      (options?: GeneratorOptions) => (Generator.gen("pc", { setting: "fantasy", ...options }) as unknown as Combatant),
      3,
      Automatic.randomSelect.bind(Automatic),
      (message: string) => Promise.resolve(true)
    );
    for (const pc of party) {
      // await CharacterRecord.pickInitialSpells(pc, Automatic.randomSelect.bind(Automatic));
      await CharacterRecord.chooseTraits(pc, Automatic.randomSelect.bind(Automatic));
    }
    await CharacterRecord.assignPartyPassives(party);

    // console.log("Generated party:", party.map(p => p.name));

    const explorer = new ModuleRunner({
      gen: Generator.gen.bind(Generator),
      moduleGen: () => mod,
      pcs: party
    });

    await explorer.run(true);

    expect(explorer.activeModule).toBeDefined();
    expect(explorer.activeModule!.name).toBe(mod.name);
    expect(explorer.activeModule!.terrain).toBe(mod.terrain);
    expect(explorer.activeModule!.town).toEqual(mod.town);
    expect(explorer.activeModule!.dungeons).toEqual(mod.dungeons);

    // for (const pc in explorer.pcs) {
    for (let pc = 0; pc < explorer.pcs.length; pc++) {
      await Presenter.printCharacterRecord(explorer.pcs[pc], explorer.inventory);
    }

    console.warn("\n----\nCombat statistics:", Combat.statistics);
    console.warn("Rounds per combat:", (Combat.statistics.combats > 0) ? (Combat.statistics.totalRounds / Combat.statistics.combats).toFixed(2) : 0);
    console.warn("Victory rate:", Combat.statistics.combats > 0 ? ((Combat.statistics.victories / Combat.statistics.combats) * 100).toFixed(2) + "%" : "N/A");
  });

  it('autoplay', async () => {
    Combat.statistics = { combats: 0, victories: 0, totalRounds: 0, defeats: 0 };
    const party: Combatant[] = [];
    await AbilityHandler.instance.loadAbilities();
    await TraitHandler.instance.loadTraits();
    const mod: CampaignModule = Generator.gen("module", { setting: "fantasy" }) as unknown as CampaignModule;
    const pcs = [
      Generator.gen("pc", { setting: 'fantasy', class: 'warrior', }) as unknown as Combatant,
      Generator.gen("pc", { setting: 'fantasy', class: 'thief', }) as unknown as Combatant,
      Generator.gen("pc", { setting: 'fantasy', class: 'mage', }) as unknown as Combatant,
      Generator.gen("pc", { setting: 'fantasy', class: 'cleric', }) as unknown as Combatant,
      Generator.gen("pc", { setting: 'fantasy', class: 'ranger', }) as unknown as Combatant,
      Generator.gen("pc", { setting: 'fantasy', class: 'bard', }) as unknown as Combatant,
    ].map(pc => ({ ...pc, playerControlled: true }))
    for (const pc of party) {
      await CharacterRecord.chooseTraits(pc, Automatic.randomSelect.bind(Automatic));
    }
    await CharacterRecord.assignPartyPassives(party);

    // console.log("Generated party:", party.map(p => p.name));

    const explorer = new ModuleRunner({
      gen: Generator.gen.bind(Generator),
      moduleGen: () => mod,
      pcs
    });

    await explorer.run(true);

    let module: CampaignModule = explorer.activeModule!;
    expect(module).toBeDefined();
    expect(module.name).toBe(mod.name);
    expect(module.terrain).toBe(mod.terrain);
    expect(module.town).toEqual(mod.town);
    expect(module.dungeons).toEqual(mod.dungeons);

    for (const pc in explorer.pcs) {
      await Presenter.printCharacterRecord(explorer.pcs[pc], explorer.inventory);
    }

    console.warn("\n----\nCombat statistics:", Combat.statistics);
    console.warn("Rounds per combat:", (Combat.statistics.combats > 0) ? (Combat.statistics.totalRounds / Combat.statistics.combats).toFixed(2) : 0);
    console.warn("Victory rate:", Combat.statistics.combats > 0 ? ((Combat.statistics.victories / Combat.statistics.combats) * 100).toFixed(2) + "%" : "N/A");
  });

});
