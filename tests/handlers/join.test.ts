import { describe, expect, test } from 'bun:test';
import { makeTestDb } from '../helpers/db';
import { createMockInteraction } from '../helpers/interaction';
import { createCooldowns } from '../../src/cooldowns';
import { handleJoin } from '../../src/handlers';
import { createGroup, getGroupMembers, type Db } from '../../src/db';

function makeCtx(db: Db) {
  return { db, cooldowns: createCooldowns({ create: 300, ping: 60 }) };
}

describe('handleJoin', () => {
  test('adds the user to an existing group', async () => {
    const db = await makeTestDb();
    const group = await createGroup(db, 'raid', 'g1', 'u1');
    const { interaction, replies } = createMockInteraction({
      options: { name: 'raid' },
      userId: 'u2',
      guildId: 'g1',
    });

    await handleJoin(makeCtx(db), interaction);

    expect((await getGroupMembers(db, group.id)).sort()).toEqual(['u1', 'u2']);
    expect(replies[0]?.content).toContain('joined group **raid**');
  });

  test('finds the group case-insensitively and replies with the stored name', async () => {
    const db = await makeTestDb();
    await createGroup(db, 'Raid Night', 'g1', 'u1');
    const { interaction, replies } = createMockInteraction({
      options: { name: 'raid night' },
      userId: 'u2',
      guildId: 'g1',
    });

    await handleJoin(makeCtx(db), interaction);

    expect(replies[0]?.content).toContain('**Raid Night**');
  });

  test('rejects a missing group', async () => {
    const db = await makeTestDb();
    const { interaction, replies } = createMockInteraction({
      options: { name: 'ghost' },
    });

    await handleJoin(makeCtx(db), interaction);

    expect(replies[0]?.content).toContain("doesn't exist");
    expect(replies[0]?.ephemeral).toBe(true);
  });

  test('rejects joining twice', async () => {
    const db = await makeTestDb();
    await createGroup(db, 'raid', 'g1', 'u1');
    const { interaction, replies } = createMockInteraction({
      options: { name: 'raid' },
      userId: 'u1',
      guildId: 'g1',
    });

    await handleJoin(makeCtx(db), interaction);

    expect(replies[0]?.content).toContain('already in this group');
    expect(replies[0]?.ephemeral).toBe(true);
  });
});
