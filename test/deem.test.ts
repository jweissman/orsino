import { describe, it, expect } from 'bun:test';
import Deem from '../src/deem';

describe('Deem', () => {
  it('should evaluate simple addition', () => {
    expect(Deem.evaluate('2 + 3')).toBe(5);
  });

  it('should evaluate multiple additions', () => {
    expect(Deem.evaluate('1 + 2 + 3')).toBe(6);
  });

  it('should roll dice', () => {
    const result = Deem.evaluate('2d6');
    expect(result).toBeGreaterThanOrEqual(2);
    expect(result).toBeLessThanOrEqual(12);
  });

  it('should handle combined expressions', () => {
    const result = Deem.evaluate('1 + 2d4 * 3');
    expect(result).toBeGreaterThanOrEqual(1 + 2 * 3); // Minimum: 1 + (2*3)
    expect(result).toBeLessThanOrEqual(1 + 8 * 3);    // Maximum: 1 + (4*3)
  });

  it('should handle functions', () => {
    expect(Deem.evaluate('oneOf(Apple, Banana, Cherry)')).toMatch(/Apple|Banana|Cherry/);
  });

  it('should handle strlit', () => {
    expect(Deem.evaluate('"Hello," + " " + "world!"')).toBe('Hello, world!');
  });
});