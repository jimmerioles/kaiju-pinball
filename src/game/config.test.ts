import { describe, expect, it } from 'vitest';
import { BALL, GAME, TABLE } from './config';

describe('table configuration', () => {
  it('orders the table from the top wall to the drain', () => {
    expect(TABLE.topZ).toBeLessThan(TABLE.bottomZ);
    expect(TABLE.bottomZ).toBeLessThan(TABLE.drainZ);
  });

  it('fits the city grid inside the table walls', () => {
    expect(TABLE.cityXStart).toBeGreaterThan(-TABLE.halfWidth);
    expect(TABLE.cityXStart + (TABLE.columns - 1) * TABLE.cell).toBeLessThan(TABLE.halfWidth);
    expect(TABLE.cityZStart).toBeGreaterThan(TABLE.topZ);
    expect(TABLE.cityZStart + (TABLE.rows - 1) * TABLE.cell).toBeLessThan(TABLE.bottomZ);
    expect(TABLE.cell).toBeGreaterThan(BALL.radius * 2);
  });

  it('keeps the launch point inside the table', () => {
    const launchZ = TABLE.topZ + 1.8;

    expect(GAME.launchHeight).toBeGreaterThan(BALL.radius);
    expect(launchZ).toBeGreaterThan(TABLE.topZ + BALL.radius);
    expect(launchZ).toBeLessThan(TABLE.bottomZ);
  });

  it('keeps the run tuning usable', () => {
    expect(GAME.duration).toBeGreaterThan(0);
    expect(GAME.balls).toBeGreaterThanOrEqual(1);
    expect(GAME.comboWindow).toBeGreaterThan(0);
    expect(GAME.maxMultiplier).toBeGreaterThanOrEqual(1);
    expect(GAME.ballSaveDuration).toBeGreaterThan(0);
    expect(BALL.maxSpeed).toBeGreaterThan(0);
    expect(BALL.steerForce).toBeGreaterThan(0);
  });
});
