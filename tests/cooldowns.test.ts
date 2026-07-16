import { afterEach, describe, expect, test, setSystemTime } from 'bun:test';
import { createCooldowns, parseCooldownSeconds } from '../src/cooldowns';

afterEach(() => {
  setSystemTime();
});

describe('parseCooldownSeconds', () => {
  test('parses valid values including zero', () => {
    expect(parseCooldownSeconds('120', 300)).toBe(120);
    expect(parseCooldownSeconds('0', 300)).toBe(0);
  });

  test('falls back on missing or invalid values', () => {
    expect(parseCooldownSeconds(undefined, 300)).toBe(300);
    expect(parseCooldownSeconds('', 300)).toBe(300);
    expect(parseCooldownSeconds('abc', 300)).toBe(300);
    expect(parseCooldownSeconds('-5', 300)).toBe(300);
  });
});

describe('createCooldowns', () => {
  test('blocks within the window and reports remaining seconds', () => {
    const cooldowns = createCooldowns({ create: 300, ping: 60 });
    setSystemTime(new Date('2026-01-01T00:00:00Z'));

    cooldowns.start('u1', 'ping');
    setSystemTime(new Date('2026-01-01T00:00:30Z'));

    const result = cooldowns.check('u1', 'ping');
    expect(result.onCooldown).toBe(true);
    expect(result.remainingSeconds).toBe(30);
  });

  test('expires after the window', () => {
    const cooldowns = createCooldowns({ create: 300, ping: 60 });
    setSystemTime(new Date('2026-01-01T00:00:00Z'));

    cooldowns.start('u1', 'ping');
    setSystemTime(new Date('2026-01-01T00:01:00Z'));

    expect(cooldowns.check('u1', 'ping').onCooldown).toBe(false);
  });

  test('tracks users and commands independently', () => {
    const cooldowns = createCooldowns({ create: 300, ping: 60 });
    setSystemTime(new Date('2026-01-01T00:00:00Z'));

    cooldowns.start('u1', 'ping');

    expect(cooldowns.check('u2', 'ping').onCooldown).toBe(false);
    expect(cooldowns.check('u1', 'create').onCooldown).toBe(false);
    expect(cooldowns.check('u1', 'ping').onCooldown).toBe(true);
  });

  test('a duration of zero disables the cooldown', () => {
    const cooldowns = createCooldowns({ create: 0, ping: 0 });

    cooldowns.start('u1', 'ping');

    expect(cooldowns.check('u1', 'ping').onCooldown).toBe(false);
  });
});
