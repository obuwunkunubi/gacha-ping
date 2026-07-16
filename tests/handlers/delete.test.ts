import { describe, expect, test } from 'bun:test';
import { makeTestDb } from '../helpers/db';
import { createMockInteraction } from '../helpers/interaction';
import { createCooldowns } from '../../src/cooldowns';
import { handleDelete } from '../../src/handlers';
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

describe('handleDelete', () => {
  test('rejects non-administrators', async () => {
    const db = await makeTestDb();
    await createGroup(db, 'raid', 'guild-1', 'u1');
    const { interaction, replies } = createMockInteraction({
      options: { name: 'raid' },
      isAdmin: false,
    });

    await handleDelete(makeCtx(db), interaction);

    expect(replies[0]?.content).toContain('administrators');
    expect(replies[0]?.ephemeral).toBe(true);
    expect(await getGroupByName(db, 'raid', 'guild-1')).toBeDefined();
  });

  test('rejects a missing group', async () => {
    const db = await makeTestDb();
    const { interaction, replies } = createMockInteraction({
      options: { name: 'ghost' },
      isAdmin: true,
    });

    await handleDelete(makeCtx(db), interaction);

    expect(replies[0]?.content).toContain("doesn't exist");
  });

  test('deletes the group and its memberships', async () => {
    const db = await makeTestDb();
    const group = await createGroup(db, 'raid', 'guild-1', 'u1');
    await addMemberToGroup(db, group.id, 'u2');
    const { interaction, replies } = createMockInteraction({
      options: { name: 'raid' },
      isAdmin: true,
    });

    await handleDelete(makeCtx(db), interaction);

    expect(await getGroupByName(db, 'raid', 'guild-1')).toBeUndefined();
    expect(await getGroupMembers(db, group.id)).toEqual([]);
    expect(replies[0]?.content).toContain('has been deleted');
  });
});
