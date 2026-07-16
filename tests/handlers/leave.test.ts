import { describe, expect, test } from 'bun:test';
import { makeTestDb } from '../helpers/db';
import { createMockInteraction } from '../helpers/interaction';
import { createCooldowns } from '../../src/cooldowns';
import { handleLeave } from '../../src/handlers';
import {
  addMemberToGroup,
  createGroup,
  getGroupByName,
  getGroupMembers,
  type Db,
} from '../../src/db';

function makeCtx(db: Db) {
  return { db, cooldowns: createCooldowns({ create: 300, ping: 60 }) };
}

describe('handleLeave', () => {
  test('removes the user from the group', async () => {
    const db = await makeTestDb();
    const group = await createGroup(db, 'raid', 'g1', 'u1');
    await addMemberToGroup(db, group.id, 'u2');
    const { interaction, replies } = createMockInteraction({
      options: { name: 'raid' },
      userId: 'u2',
      guildId: 'g1',
    });

    await handleLeave(makeCtx(db), interaction);

    expect(await getGroupMembers(db, group.id)).toEqual(['u1']);
    expect(replies[0]?.content).toContain('left group **raid**');
  });

  test('deletes the group when the last member leaves', async () => {
    const db = await makeTestDb();
    await createGroup(db, 'raid', 'g1', 'u1');
    const { interaction, replies } = createMockInteraction({
      options: { name: 'raid' },
      userId: 'u1',
      guildId: 'g1',
    });

    await handleLeave(makeCtx(db), interaction);

    expect(await getGroupByName(db, 'raid', 'g1')).toBeUndefined();
    expect(replies[0]?.content).toContain('was deleted');
  });

  test('rejects a missing group', async () => {
    const db = await makeTestDb();
    const { interaction, replies } = createMockInteraction({
      options: { name: 'ghost' },
    });

    await handleLeave(makeCtx(db), interaction);

    expect(replies[0]?.content).toContain("doesn't exist");
    expect(replies[0]?.ephemeral).toBe(true);
  });

  test('rejects leaving a group the user is not in', async () => {
    const db = await makeTestDb();
    await createGroup(db, 'raid', 'g1', 'u1');
    const { interaction, replies } = createMockInteraction({
      options: { name: 'raid' },
      userId: 'stranger',
      guildId: 'g1',
    });

    await handleLeave(makeCtx(db), interaction);

    expect(replies[0]?.content).toContain('not a member');
    expect(replies[0]?.ephemeral).toBe(true);
  });
});
