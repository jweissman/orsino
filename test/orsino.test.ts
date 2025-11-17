import { describe, it, expect } from 'bun:test';
import Orsino from '../src/orsino';
import Combat from '../src/orsino/Combat';
import Dungeoneer, { BossRoom, Room } from '../src/orsino/Dungeoneer';
import { ModuleRunner } from '../src/orsino/ModuleRunner';

describe('Orsino', () => {
  const orsino = new Orsino('fantasy');
  it('generate male name', async () => {
    const response = await orsino.gen("name", { group: 'male' });
    // expect(response).toMatch(/John|Michael|David|James|Robert/);
    expect(response).toMatch(/[A-Z][a-z]+/);
  });
  
  it('generate female name', async () => {
    const response = await orsino.gen("name", { gender: 'female' });
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
    const response = await orsino.gen("room", { targetCr: 12 });
    expect(response.narrative).toMatch(/[A-Z][a-z]+/);
    expect(response.room_size).toMatch(/tiny|small|medium|large|enormous/);
  });

  it('pc gen', async () => {
    const pc = orsino.gen("pc", { setting: "fantasy" });
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
    combat.setUp(Combat.defaultTeams());
    expect(combat.isOver()).toBe(false);
    expect(combat.teams[0]).toHaveProperty('name');
    expect(combat.teams[1]).toHaveProperty('name');
    expect(combat.teams[0].combatants[0].hp).toBeGreaterThan(0);
    expect(combat.teams[1].combatants[0].hp).toBeGreaterThan(0);

    await combat.setUp();
    let turn = await combat.round();
    expect(turn).toHaveProperty('number');
    // expect(turn).toHaveProperty('description');
    while (!combat.isOver()) {
      turn = await combat.round();
      expect(turn).toHaveProperty('number');
      // expect(turn).toHaveProperty('description');
    }
    expect(combat.winner).toBeDefined();
    expect(combat.winner).toMatch(/Player|Enemy/);
  });

  it('dungeon generator', async () => {
    let crawler = new Dungeoneer(
      { dungeonGen: () => orsino.gen("dungeon", { depth: 2 }) },
    );
    expect(crawler.isOver()).toBe(false);
    expect(crawler.dungeon.rooms).toHaveLength(2);
    while (!crawler.isOver()) {
      const room = crawler.currentRoom;
      crawler.enterRoom(room as Room);
      // console.log("Current room:", room);
      expect(room).toHaveProperty('narrative');
      expect(room).toHaveProperty('room_type');
      expect(room).toHaveProperty('room_size');
      expect(room).toHaveProperty('treasure');
      // expect(room).toHaveProperty('encounter');
      
      crawler.currentMonsterTeam.combatants.forEach(monster => {
        monster.hp = 0; // Simulate defeating the monster
      });
      crawler.nextRoom();
      
    }
    expect(crawler.winner).toBeDefined();
    expect(crawler.winner).toMatch(/Player|Enemy/);
  });

  it('mod generator', async () => {
    const mod = await orsino.gen("module", { setting: "fantasy" });
    expect(mod).toHaveProperty('name');
    expect(mod).toHaveProperty('terrain');
    expect(mod).toHaveProperty('town');
    expect(mod.town).toHaveProperty('name');
    expect(mod.town).toHaveProperty('population');
    expect(mod.town).toHaveProperty('deity');
    expect(mod).toHaveProperty('dungeons');
    expect(mod.dungeons).toBeInstanceOf(Array);

    let explorer = new ModuleRunner({
      moduleGen: () => Promise.resolve(mod),
      pcs: [orsino.gen("pc", { setting: "fantasy" })]
    });

    await explorer.run();

    expect(explorer.activeModule).toBeDefined();
    expect(explorer.activeModule!.name).toBe(mod.name);
    expect(explorer.activeModule!.terrain).toBe(mod.terrain);
    expect(explorer.activeModule!.town).toEqual(mod.town);
    expect(explorer.activeModule!.dungeons).toEqual(mod.dungeons);
  });

});
