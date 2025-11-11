import { describe, it, expect } from 'bun:test';
import Orsino from '../src/orsino';

describe('Orsino', () => {
  const orsino = new Orsino();
  it('generate male name', async () => {
    const response = await orsino.gen("name", { group: 'male' });
    expect(response).toMatch(/John|Michael|David|James|Robert/);
  });
  
  it('generate female name', async () => {
    const response = await orsino.gen("name", { gender: 'female' });
    expect(response).toMatch(/Jane|Emily|Sarah|Jessica|Lisa/);
  });

  it('generate pc', async () => {
    const response = await orsino.gen("pc", { gender: 'male' });
    expect(response.name).toMatch(/John|Michael|David|James|Robert/);
    expect(response.occupation).toMatch(/Artist|Engineer|Merchant|Adventurer/);
    expect(typeof response.age).toBe("number");
    expect(response.age).toBeGreaterThanOrEqual(20);
    expect(response.age).toBeLessThanOrEqual(56);
  });

  it('generate npc', async () => {
    const response = await orsino.gen("npc");
    expect(response.name).toMatch(/John|Michael|David|James|Robert|Jane|Emily|Sarah|Jessica|Lisa|Alex|Taylor|Jordan|Morgan|Casey/);
    expect(response.role).toMatch(/Shopkeeper|Guard|Villager/);
    expect(typeof response.age).toBe("number");
    expect(response.age).toBeGreaterThanOrEqual(20);
    expect(response.age).toBeLessThanOrEqual(56);
  });

  it("generate room", async () => {
    const response = await orsino.gen("room");
    expect(response.narrative).toMatch(/A dimly lit tavern|A bustling marketplace|A quiet library|A shadowy alleyway|A grand hall/);
  });

  it('combat generator', async () => {
    let combat = orsino.play("combat", { 
      outputSink: (_message: string) => {}
    });
    combat.setUp();
    expect(combat.isOver()).toBe(false);
    expect(combat.teams[0]).toHaveProperty('name');
    expect(combat.teams[1]).toHaveProperty('name');
    expect(combat.teams[0].combatants[0].hp).toBeGreaterThan(0);
    expect(combat.teams[1].combatants[0].hp).toBeGreaterThan(0);

    await combat.setUp();
    let turn = await combat.nextTurn();
    expect(turn).toHaveProperty('number');
    expect(turn).toHaveProperty('description');
    while (!combat.isOver()) {
      turn = await combat.nextTurn();
      expect(turn).toHaveProperty('number');
      expect(turn).toHaveProperty('description');
    }
    expect(combat.winner).toBeDefined();
    expect(combat.winner).toMatch(/Player|Enemy/);
  });
});
