import { describe, it, expect } from 'bun:test';
import Orsino from '../src/orsino';
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

describe('Orsino', () => {
  const orsino = new Orsino('fantasy');
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

  // it('generate pc', async () => {
  //   const response = await orsino.gen("pc", { gender: 'male' });
  //   expect(response.name).toMatch(/[A-Z][a-z]+/);
  //   expect(typeof response.age).toBe("number");
  //   expect(response.age).toBeGreaterThanOrEqual(16);
  // });

  it("generate room", async () => {
    const response = await Generator.gen("room", { targetCr: 12 });
    expect(response.narrative).toMatch(/[A-Z][a-z]+/);
    expect(response.room_size).toMatch(/tiny|small|medium|large|enormous/);
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
    expect(pc).toHaveProperty('maxHp');
    expect(pc).toHaveProperty('level');
    expect(pc).toHaveProperty('ac');
    expect(pc).toHaveProperty('weapon');
  });

  it('combat generator', async () => {
    let combat = new Combat();
    expect(combat.abilityHandler).toBeInstanceOf(AbilityHandler);

    await combat.setUp(Combat.defaultTeams());
    expect(combat.isOver()).toBe(false);
    expect(combat.teams[0]).toHaveProperty('name');
    expect(combat.teams[1]).toHaveProperty('name');
    expect(combat.teams[0].combatants[0].hp).toBeGreaterThan(0);
    expect(combat.teams[1].combatants[0].hp).toBeGreaterThan(0);

    // await combat.setUp();
    let turn = await combat.round();
    // expect(turn).toHaveProperty('number');
    // expect(turn).toHaveProperty('description');
    while (!combat.isOver()) {
      turn = await combat.round();
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

  it.skip('party generator', async () => {
    await AbilityHandler.instance.loadAbilities();
    await TraitHandler.instance.loadTraits();

    let party = await CharacterRecord.chooseParty(
      async (options?: any) => (await Generator.gen("pc", { setting: "fantasy", ...options }) as Combatant),
      3,
      // Combat.samplingSelect
      async (_prompt: string, options: string[]) => {
        let pick = options[
          Math.floor(Math.random() * options.length)
          // 0
        ];
        // console.log(`Auto-selecting option for test: ${pick}`);
        return pick;
      }
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
      async (options?: any) => (await Generator.gen("pc", { setting: "fantasy", ...options }) as Combatant),
      3,
      // Combat.samplingSelect
      async (_prompt: string, options: string[]) => {
        let pick = options[
          Math.floor(Math.random() * options.length)
          // 0
        ];
        // console.log(`Auto-selecting option for test: ${pick}`);
        return pick;
      }
    );

    console.log("Generated party:", party.map(p => p.name));

    let explorer = new ModuleRunner({
      gen: async (type: GenerationTemplateType, options: Record<string, any>) => {
        return await Generator.gen(type, options);
      },
      moduleGen: () => mod,
      pcs: party,
      // pcs: [
      //   { ...await Generator.gen("pc", { setting: "fantasy", class: "warrior" }), playerControlled: true },
      //   { ...await Generator.gen("pc", { setting: "fantasy", class: "warrior" }), playerControlled: true },
      //   { ...await Generator.gen("pc", { setting: "fantasy", class: "warrior" }), playerControlled: true }
      // ]
    });

    await explorer.run(true);

    // console.log("Active module after run:", explorer.activeModule);

    expect(explorer.activeModule).toBeDefined();
    expect(explorer.activeModule!.name).toBe(mod.name);
    expect(explorer.activeModule!.terrain).toBe(mod.terrain);
    expect(explorer.activeModule!.town).toEqual(mod.town);
    expect(explorer.activeModule!.dungeons).toEqual(mod.dungeons);

    for (let pc in explorer.pcs) {
      Presenter.printCharacterRecord(explorer.pcs[pc] as Combatant);
    }

    console.log("\n----\nCombat statistics:", Combat.statistics);
    console.log("Rounds per combat:", (Combat.statistics.combats > 0) ? (Combat.statistics.totalRounds / Combat.statistics.combats).toFixed(2) : 0);

  });

});
