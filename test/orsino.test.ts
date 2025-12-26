import { describe, it, expect } from 'bun:test';
import Combat from '../src/orsino/Combat';
import Dungeoneer, { BossRoom, Dungeon, Room } from '../src/orsino/Dungeoneer';
import { CampaignModule, ModuleRunner } from '../src/orsino/ModuleRunner';
import AbilityHandler from '../src/orsino/Ability';
import Generator from '../src/orsino/Generator';
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

  it('generate male name', async () => {
    const response = await Generator.gen("name", { group: 'male' });
    expect(response).toMatch(/[A-Z][a-z]+/);
  });

  it('generate female name', async () => {
    const response = await Generator.gen("name", { gender: 'female' });
    expect(response).toMatch(/[A-Z][a-z]+/);
  });

  it('generate pc', async () => {
    const response = await Generator.gen("pc", { gender: 'male' }) as unknown as Combatant;
    expect(response.name).toMatch(/[A-Z][a-z]+/);
    expect(typeof response.age).toBe("number");
    expect(response.age).toBeGreaterThanOrEqual(16);
  });

  it("generate room", async () => {
    const room = await Generator.gen("room", { setting: "fantasy", targetCr: 12 }) as unknown as Room;

    // console.log("Generated room:", room);
    // console.log(room.narrative);
    expect(room.narrative).toMatch(/[a-z\s]+/);
    expect(room.room_size).toMatch(/tiny|small|medium|large|enormous/);
  });

  it('pc gen', async () => {
    const pc = await Generator.gen("pc", { setting: "fantasy" }) as unknown as Combatant;
    // console.log(pc);
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
    const crawler = new Dungeoneer({ dungeonGen: async () => await Generator.gen("dungeon") });
    await crawler.setUp();
    expect(crawler.isOver()).toBe(false);
    expect(crawler.dungeon).toBeDefined();
    expect(crawler.dungeon).toHaveProperty('dungeon_name');
    expect(crawler.dungeon!.rooms.length).toBeGreaterThan(1);
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
    const pc = await Generator.gen("pc", { setting: "fantasy" }) as unknown as Combatant;
    const npc = await Generator.gen("npc", { setting: "fantasy", targetCr: pc.level }) as unknown as Combatant;
    const animal = await Generator.gen("animal", { setting: "fantasy" }) as unknown as Combatant;
    const monster = await Generator.gen("monster", { setting: "fantasy" }) as unknown as Combatant;

    console.log("\n--- Character Presentations (minimal) ---\n");
    console.log("PC:      ", Presenter.minimalCombatant(pc));
    console.log("NPC:     ", Presenter.minimalCombatant(npc));
    console.log("Animal:  ", Presenter.minimalCombatant(animal));
    console.log("Monster: ", Presenter.minimalCombatant(monster));

    console.log("\n--- Character Presentations (full) ---\n");
    console.log("PC:      ", Presenter.combatant(pc));
    console.log("NPC:     ", Presenter.combatant(npc));
    console.log("Animal:  ", Presenter.combatant(animal));
    console.log("Monster: ", Presenter.combatant(monster));

    console.log("\n--- Party Presentation ---\n")
    const teams: Team[] = [
      { name: "Heroes", combatants: [pc, npc], inventory: [] },
      { name: "Foes", combatants: [animal, monster], inventory: [] }
    ];
    console.log(Presenter.parties(teams));

    console.log("\n--- Round Presentation ---\n")
    const roundEvent: GameEvent = {
      type: "roundStart",
      turn: 1,
      combatants: [pc, npc, animal, monster] as Combatant[],
      parties: teams,
      auras: [],
      environment: "Dark Cave"
    };
    console.log(await Events.present(roundEvent));
  });

  it('simple mod runner', async () => {
    Combat.statistics = { combats: 0, victories: 0, totalRounds: 0, defeats: 0 };
    await AbilityHandler.instance.loadAbilities();
    await TraitHandler.instance.loadTraits();
    const mod = await Generator.gen("module", { setting: "fantasy" }) as unknown as CampaignModule;
    expect(mod).toHaveProperty('name');
    expect(mod).toHaveProperty('terrain');
    expect(mod).toHaveProperty('town');
    expect(mod.town).toHaveProperty('name');
    expect(mod.town).toHaveProperty('population');
    expect(mod.town).toHaveProperty('deity');
    expect(mod).toHaveProperty('dungeons');
    expect(mod.dungeons).toBeInstanceOf(Array);

    const party = await CharacterRecord.chooseParty(
      async (options?: any) => (await Generator.gen("pc", { setting: "fantasy", ...options }) as unknown as Combatant),
      3,
      Automatic.randomSelect.bind(Automatic)
    );
    for (const pc of party) {
      await CharacterRecord.pickInitialSpells(pc, Automatic.randomSelect.bind(Automatic));
    }
    await CharacterRecord.assignPartyPassives(party);

    console.log("Generated party:", party.map(p => p.name));

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
      await Presenter.printCharacterRecord(explorer.pcs[pc]);
    }

    console.log("\n----\nCombat statistics:", Combat.statistics);
    console.log("Rounds per combat:", (Combat.statistics.combats > 0) ? (Combat.statistics.totalRounds / Combat.statistics.combats).toFixed(2) : 0);
    console.log("Victory rate:", Combat.statistics.combats > 0 ? ((Combat.statistics.victories / Combat.statistics.combats) * 100).toFixed(2) + "%" : "N/A");
  });

  it.only('autoplay', async () => {
    Combat.statistics = { combats: 0, victories: 0, totalRounds: 0, defeats: 0 };
    const party: Combatant[] = [];
    await AbilityHandler.instance.loadAbilities();
    await TraitHandler.instance.loadTraits();
    const mod = await Generator.gen("module", { setting: "fantasy" });
    const pcs = [
      await Generator.gen("pc", { setting: 'fantasy', class: 'warrior', }) as unknown as Combatant,
      await Generator.gen("pc", { setting: 'fantasy', class: 'thief', }) as unknown as Combatant,
      await Generator.gen("pc", { setting: 'fantasy', class: 'mage', }) as unknown as Combatant,
      await Generator.gen("pc", { setting: 'fantasy', class: 'cleric', }) as unknown as Combatant,
      await Generator.gen("pc", { setting: 'fantasy', class: 'ranger', }) as unknown as Combatant,
      await Generator.gen("pc", { setting: 'fantasy', class: 'bard', }) as unknown as Combatant,
    ].map(pc => ({ ...pc, playerControlled: true }))
    for (const pc of party) {
      await CharacterRecord.pickInitialSpells(pc, Automatic.randomSelect.bind(this));
    }
    await CharacterRecord.assignPartyPassives(party);

    // console.log("Generated party:", party.map(p => p.name));

    const explorer = new ModuleRunner({
      gen: Generator.gen.bind(Generator),
      moduleGen: () => mod,
      pcs
    });

    await explorer.run(true);

    expect(explorer.activeModule).toBeDefined();
    expect(explorer.activeModule!.name).toBe(mod.name);
    expect(explorer.activeModule!.terrain).toBe(mod.terrain);
    expect(explorer.activeModule!.town).toEqual(mod.town);
    expect(explorer.activeModule!.dungeons).toEqual(mod.dungeons);

    for (const pc in explorer.pcs) {
      await Presenter.printCharacterRecord(explorer.pcs[pc]);
    }

    console.log("\n----\nCombat statistics:", Combat.statistics);
    console.log("Rounds per combat:", (Combat.statistics.combats > 0) ? (Combat.statistics.totalRounds / Combat.statistics.combats).toFixed(2) : 0);
    console.log("Victory rate:", Combat.statistics.combats > 0 ? ((Combat.statistics.victories / Combat.statistics.combats) * 100).toFixed(2) + "%" : "N/A");
  });

});
