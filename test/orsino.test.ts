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
});
