import { describe, expect, test } from 'bun:test';
import { validateGroupName } from '../src/validation';

describe('validateGroupName', () => {
  test('accepts letters, numbers, spaces, hyphens, underscores', () => {
    expect(validateGroupName('Raid Night_2-electric').valid).toBe(true);
  });

  test('enforces the 2-character minimum', () => {
    expect(validateGroupName('a').valid).toBe(false);
    expect(validateGroupName('ab').valid).toBe(true);
  });

  test('enforces the 32-character maximum', () => {
    expect(validateGroupName('a'.repeat(32)).valid).toBe(true);
    expect(validateGroupName('a'.repeat(33)).valid).toBe(false);
  });

  test('rejects the empty string', () => {
    expect(validateGroupName('').valid).toBe(false);
  });

  test('rejects special characters', () => {
    for (const name of ['group!', 'a@b', 'raid#1', 'héllo', '<@123>']) {
      const result = validateGroupName(name);
      expect(result.valid).toBe(false);
      expect(result.reason).toContain('can only contain');
    }
  });

  test('returns a reason for invalid names', () => {
    expect(validateGroupName('a').reason).toContain('between 2 and 32');
  });
});
