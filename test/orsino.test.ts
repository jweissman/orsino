import { describe, it, expect } from 'bun:test';
import Combat from '../src/orsino/Combat';
import Dungeoneer, { BossRoom, Dungeon, Room } from '../src/orsino/Dungeoneer';
import { ModuleRunner } from '../src/orsino/ModuleRunner';
import AbilityHandler from '../src/orsino/Ability';
import { GenerationTemplateType } from '../src/orsino/types/GenerationTemplateType';
import Generator from '../src/orsino/Generator';
import CharacterRecord from '../src/orsino/rules/CharacterRecord';
import { Combatant } from '../src/orsino/types/Combatant';
import Presenter from '../src/orsino/tui/Presenter';
import TraitHandler from '../src/orsino/Trait';
import { loadSetting } from '../src/orsino/loader';
import Events from '../src/orsino/Events';
import { Team } from '../src/orsino/types/Team';
import Orsino from '../src/orsino';
import Automatic from '../src/orsino/tui/System';

describe('Orsino', () => {
  // before(async () => {
    Orsino.environment = 'test';
    Generator.setting = loadSetting('fantasy'); // : Generator.defaultSetting;
  // });
  it('generate male name', async () => {
    const response = await Generator.gen("name", { group: 'male' });
    // expect(response).toMatch(/John|Michael|David|James|Robert/);
    expect(response).toMatch(/[A-Z][a-z]+/);
  });
  
  it('generate female name', async () => {
    const response = await Generator.gen("name", { gender: 'female' });
    // expect(response).toMatch(/Jane|Emily|Sarah|Jessica|Lisa/);
    expect(response).toMatch(/[A-Z][a-z]+/);
  });

  it('generate pc', async () => {
    const response = await Generator.gen("pc", { gender: 'male' });
    expect(response.name).toMatch(/[A-Z][a-z]+/);
    expect(typeof response.age).toBe("number");
    expect(response.age).toBeGreaterThanOrEqual(16);
  });

  it("generate room", async () => {
    const room = await Generator.gen("room", { setting: "fantasy", targetCr: 12 });

    console.log("Generated room:", room);
    console.log(room.narrative);
    expect(room.narrative).toMatch(/[a-z\s]+/);
    expect(room.room_size).toMatch(/tiny|small|medium|large|enormous/);
  });

  it('pc gen', async () => {
    const pc = await Generator.gen("pc", { setting: "fantasy" });
    console.log(pc);
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
    expect(pc).toHaveProperty('ac');
    expect(pc).toHaveProperty('weapon');
  });

  it('combat generator', async () => {
    let combat = new Combat();
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
    let crawler = new Dungeoneer({ dungeonGen: async () => await Generator.gen("dungeon") });
    await crawler.setUp();
    expect(crawler.isOver()).toBe(false);
    expect(crawler.dungeon).toBeDefined();
    expect(crawler.dungeon).toHaveProperty('dungeon_name');
    expect(crawler.dungeon!.rooms.length).toBeGreaterThan(1);
    while (!crawler.isOver()) {
      const room = crawler.currentRoom as Room | BossRoom;
      crawler.enterRoom(room);
      let encounter = crawler.currentEncounter;
      console.log("- Room target CR level:", room.targetCr, "actual:", encounter?.cr);
      console.log("  Creature levels:", encounter?.creatures.map(c => `${c.name} (level ${c.level})`).join(", "));
      expect(room).toHaveProperty('narrative');
      expect(room).toHaveProperty('room_type');
      expect(room).toHaveProperty('room_size');
      expect(room).toHaveProperty('treasure');
      // expect(room).toHaveProperty('encounter');
      
      crawler.currentMonsterTeam.combatants.forEach(monster => {
        monster.hp = 0; // Simulate defeating the monster
      });
      crawler.moveToNextRoom();
      
    }
    expect(crawler.winner).toBeDefined();
    expect(crawler.winner).toMatch(/Player|Enemy/);
  });

  it('name presentation', async () => {
    const pc = await Generator.gen("pc", { setting: "fantasy" });
    const npc = await Generator.gen("npc", { setting: "fantasy", _targetCr: pc.level });
    const animal = await Generator.gen("animal", { setting: "fantasy" });
    const monster = await Generator.gen("monster", { setting: "fantasy" });

    console.log("\n--- Character Presentations (minimal) ---\n");
    console.log("PC:      ", Presenter.minimalCombatant(pc as Combatant));
    console.log("NPC:     ", Presenter.minimalCombatant(npc as Combatant));
    console.log("Animal:  ", Presenter.minimalCombatant(animal as Combatant));
    console.log("Monster: ", Presenter.minimalCombatant(monster as Combatant));

    console.log("\n--- Character Presentations (full) ---\n");
    console.log("PC:      ", Presenter.combatant(pc as Combatant));
    console.log("NPC:     ", Presenter.combatant(npc as Combatant));
    console.log("Animal:  ", Presenter.combatant(animal as Combatant));
    console.log("Monster: ", Presenter.combatant(monster as Combatant));

    console.log("\n--- Party Presentation ---\n")
    let teams: Team[] = [
      { name: "Heroes", combatants: [pc as Combatant, npc as Combatant], inventory: [] },
      { name: "Foes", combatants: [animal as Combatant, monster as Combatant], inventory: [] }
    ];
    console.log(Presenter.parties(teams));

    console.log("\n--- Round Presentation ---\n")
    let roundEvent = {
      type: "roundStart",
      turn: 1,
      combatants: [pc, npc, animal, monster] as Combatant[],
      parties: teams,
      environment: "Dark Cave"
    };
    console.log(await Events.present(roundEvent as any));
  });

  it.skip('party generator', async () => {
    await AbilityHandler.instance.loadAbilities();
    await TraitHandler.instance.loadTraits();

    let party = await CharacterRecord.chooseParty(
      async (options?: any) => (await Generator.gen("pc", { setting: "fantasy", ...options }) as Combatant),
      3,
      Automatic.randomSelect
    );

    console.log("Generated party:", party.map(p => p.name));
  });

  it.skip('mod gen', async () => {

    await AbilityHandler.instance.loadAbilities();
    await TraitHandler.instance.loadTraits();
    const mod = await Generator.gen("module", { setting: "fantasy" });

    // display each dungeon, cr + race
    mod.dungeons.forEach((dungeon: Dungeon) => {
      console.log(`${dungeon.dungeon_name} (CR target: ${dungeon.intendedCr})`);
      console.log(` - Room count: ${dungeon.rooms.length} [CRs: ${dungeon.rooms.map((r: any) => r.targetCr).join(", ")}]`);
    });
  })

  it('mod runner', async () => {
    await AbilityHandler.instance.loadAbilities();
    await TraitHandler.instance.loadTraits();
    const mod = await Generator.gen("module", { setting: "fantasy" });
    expect(mod).toHaveProperty('name');
    expect(mod).toHaveProperty('terrain');
    expect(mod).toHaveProperty('town');
    expect(mod.town).toHaveProperty('name');
    expect(mod.town).toHaveProperty('population');
    expect(mod.town).toHaveProperty('deity');
    expect(mod).toHaveProperty('dungeons');
    expect(mod.dungeons).toBeInstanceOf(Array);

    let party = await CharacterRecord.chooseParty(
      async (options?: any) => (await Generator.gen("pc", { setting: "fantasy",  ...options }) as Combatant),
      3,
      Automatic.randomSelect
    );
    for (let pc of party) {
      await CharacterRecord.pickInitialSpells(pc, Automatic.randomSelect);
    }
    await CharacterRecord.assignPartyPassives(party);

    console.log("Generated party:", party.map(p => p.name));

    let explorer = new ModuleRunner({
      gen: Generator.gen,
      moduleGen: () => mod,
      pcs: party
    });

    await explorer.run(true);

    expect(explorer.activeModule).toBeDefined();
    expect(explorer.activeModule!.name).toBe(mod.name);
    expect(explorer.activeModule!.terrain).toBe(mod.terrain);
    expect(explorer.activeModule!.town).toEqual(mod.town);
    expect(explorer.activeModule!.dungeons).toEqual(mod.dungeons);

    for (let pc in explorer.pcs) {
      await Presenter.printCharacterRecord(explorer.pcs[pc] as Combatant);
    }

    console.log("\n----\nCombat statistics:", Combat.statistics);
    console.log("Rounds per combat:", (Combat.statistics.combats > 0) ? (Combat.statistics.totalRounds / Combat.statistics.combats).toFixed(2) : 0);
    console.log("Victory rate:", Combat.statistics.combats > 0 ? ((Combat.statistics.victories / Combat.statistics.combats) * 100).toFixed(2) + "%" : "N/A");
  });

});
