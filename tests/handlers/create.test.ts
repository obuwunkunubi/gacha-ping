import { describe, expect, test } from 'bun:test';
import { makeTestDb } from '../helpers/db';
import { createMockInteraction } from '../helpers/interaction';
import { createCooldowns } from '../../src/cooldowns';
import { handleCreate } from '../../src/handlers';
import { getGroupByName, getGroupMembers, type Db } from '../../src/db';

function makeCtx(db: Db, durations = { create: 300, ping: 60 }) {
  return { db, cooldowns: createCooldowns(durations) };
}

describe('handleCreate', () => {
  test('creates a group and adds the creator', async () => {
    const db = await makeTestDb();
    const { interaction, replies } = createMockInteraction({
      options: { name: 'raid' },
      userId: 'u1',
      guildId: 'g1',
    });

    await handleCreate(makeCtx(db), interaction);

    const group = await getGroupByName(db, 'raid', 'g1');
    expect(group).toBeDefined();
    expect(await getGroupMembers(db, group!.id)).toEqual(['u1']);
    expect(replies[0]?.content).toContain('Created group **raid**');
    expect(replies[0]?.ephemeral).toBe(false);
  });

  test('trims the name before validating and creating', async () => {
    const db = await makeTestDb();
    const { interaction } = createMockInteraction({
      options: { name: '  raid  ' },
      guildId: 'g1',
    });

    await handleCreate(makeCtx(db), interaction);

    const group = await getGroupByName(db, 'raid', 'g1');
    expect(group?.name).toBe('raid');
  });

  test('surfaces the validation reason', async () => {
    const db = await makeTestDb();
    const { interaction, replies } = createMockInteraction({
      options: { name: 'a' },
    });

    await handleCreate(makeCtx(db), interaction);

    expect(replies[0]?.content).toContain('between 2 and 32 characters');
    expect(replies[0]?.ephemeral).toBe(true);
    expect(await getGroupByName(db, 'a', 'guild-1')).toBeUndefined();
  });

  test('rejects duplicate names case-insensitively', async () => {
    const db = await makeTestDb();
    const first = createMockInteraction({
      options: { name: 'raid' },
      userId: 'u1',
    });
    await handleCreate(makeCtx(db), first.interaction);

    const second = createMockInteraction({
      options: { name: 'RAID' },
      userId: 'u2',
    });
    await handleCreate(makeCtx(db), second.interaction);

    expect(second.replies[0]?.content).toContain('already exists');
    expect(second.replies[0]?.ephemeral).toBe(true);
  });

  test('blocks while on cooldown, and only starts the cooldown on success', async () => {
    const db = await makeTestDb();
    const ctx = makeCtx(db);

    // A failed create (invalid name) must not burn the cooldown
    const invalid = createMockInteraction({ options: { name: '!' } });
    await handleCreate(ctx, invalid.interaction);

    const ok = createMockInteraction({ options: { name: 'raid' } });
    await handleCreate(ctx, ok.interaction);
    expect(ok.replies[0]?.content).toContain('Created group');

    const blocked = createMockInteraction({ options: { name: 'other' } });
    await handleCreate(ctx, blocked.interaction);
    expect(blocked.replies[0]?.content).toContain('must wait');
    expect(blocked.replies[0]?.ephemeral).toBe(true);
  });

  test('cooldown of zero never blocks', async () => {
    const db = await makeTestDb();
    const ctx = makeCtx(db, { create: 0, ping: 60 });

    const first = createMockInteraction({ options: { name: 'one' } });
    await handleCreate(ctx, first.interaction);
    const second = createMockInteraction({ options: { name: 'two' } });
    await handleCreate(ctx, second.interaction);

    expect(second.replies[0]?.content).toContain('Created group');
  });
});
