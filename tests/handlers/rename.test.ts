import { describe, expect, test } from 'bun:test';
import { makeTestDb } from '../helpers/db';
import { createMockInteraction } from '../helpers/interaction';
import { createCooldowns } from '../../src/cooldowns';
import { handleRename } from '../../src/handlers';
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

describe('handleRename', () => {
  test('rejects a missing group', async () => {
    const db = await makeTestDb();
    const { interaction, replies } = createMockInteraction({
      options: { name: 'ghost', newname: 'raid' },
    });

    await handleRename(makeCtx(db), interaction);

    expect(replies[0]?.content).toContain("doesn't exist");
    expect(replies[0]?.ephemeral).toBe(true);
  });

  test('rejects users who are neither creator nor admin', async () => {
    const db = await makeTestDb();
    await createGroup(db, 'raid', 'guild-1', 'u1');
    const { interaction, replies } = createMockInteraction({
      options: { name: 'raid', newname: 'raid-night' },
      userId: 'u2',
      isAdmin: false,
    });

    await handleRename(makeCtx(db), interaction);

    expect(replies[0]?.content).toContain('creator');
    expect(replies[0]?.ephemeral).toBe(true);
    expect(await getGroupByName(db, 'raid', 'guild-1')).toBeDefined();
  });

  test('lets the creator rename, keeping members', async () => {
    const db = await makeTestDb();
    const group = await createGroup(db, 'raid', 'guild-1', 'u1');
    await addMemberToGroup(db, group.id, 'u2');
    const { interaction, replies } = createMockInteraction({
      options: { name: 'raid', newname: 'raid night' },
      userId: 'u1',
    });

    await handleRename(makeCtx(db), interaction);

    expect(await getGroupByName(db, 'raid', 'guild-1')).toBeUndefined();
    const renamed = await getGroupByName(db, 'raid night', 'guild-1');
    expect(renamed?.id).toBe(group.id);
    expect((await getGroupMembers(db, group.id)).sort()).toEqual(['u1', 'u2']);
    expect(replies[0]?.content).toContain(
      '**raid** was renamed to **raid night**'
    );
  });

  test('lets an admin rename a group they did not create', async () => {
    const db = await makeTestDb();
    await createGroup(db, 'raid', 'guild-1', 'u1');
    const { interaction, replies } = createMockInteraction({
      options: { name: 'raid', newname: 'better-raid' },
      userId: 'admin-user',
      isAdmin: true,
    });

    await handleRename(makeCtx(db), interaction);

    expect(await getGroupByName(db, 'better-raid', 'guild-1')).toBeDefined();
    expect(replies[0]?.content).toContain('renamed');
  });

  test('rejects a name already taken, case-insensitively', async () => {
    const db = await makeTestDb();
    await createGroup(db, 'raid', 'guild-1', 'u1');
    await createGroup(db, 'chill', 'guild-1', 'u1');
    const { interaction, replies } = createMockInteraction({
      options: { name: 'chill', newname: 'RAID' },
      userId: 'u1',
    });

    await handleRename(makeCtx(db), interaction);

    expect(replies[0]?.content).toContain('already exists');
    expect(await getGroupByName(db, 'chill', 'guild-1')).toBeDefined();
  });

  test('allows changing only the casing of the same group', async () => {
    const db = await makeTestDb();
    await createGroup(db, 'raid', 'guild-1', 'u1');
    const { interaction, replies } = createMockInteraction({
      options: { name: 'raid', newname: 'Raid' },
      userId: 'u1',
    });

    await handleRename(makeCtx(db), interaction);

    expect(replies[0]?.content).toContain('renamed');
    expect((await getGroupByName(db, 'raid', 'guild-1'))?.name).toBe('Raid');
  });

  test('surfaces the validation reason and trims the new name', async () => {
    const db = await makeTestDb();
    await createGroup(db, 'raid', 'guild-1', 'u1');
    const bad = createMockInteraction({
      options: { name: 'raid', newname: '!!' },
      userId: 'u1',
    });
    await handleRename(makeCtx(db), bad.interaction);
    expect(bad.replies[0]?.content).toContain('can only contain');

    const padded = createMockInteraction({
      options: { name: 'raid', newname: '  raid two  ' },
      userId: 'u1',
    });
    await handleRename(makeCtx(db), padded.interaction);
    expect((await getGroupByName(db, 'raid two', 'guild-1'))?.name).toBe(
      'raid two'
    );
  });
});
