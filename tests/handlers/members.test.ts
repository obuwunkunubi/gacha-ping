import { describe, expect, test } from 'bun:test';
import { makeTestDb } from '../helpers/db';
import { createMockInteraction } from '../helpers/interaction';
import { createCooldowns } from '../../src/cooldowns';
import { handleMembers } from '../../src/handlers';
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

describe('handleMembers', () => {
  test('rejects a missing group', async () => {
    const db = await makeTestDb();
    const { interaction, replies } = createMockInteraction({
      options: { name: 'ghost' },
    });

    await handleMembers(makeCtx(db), interaction);

    expect(replies[0]?.kind).toBe('reply');
    expect(replies[0]?.content).toContain("doesn't exist");
  });

  test('defers, then lists members sorted by username', async () => {
    const db = await makeTestDb();
    const group = await createGroup(db, 'raid', 'guild-1', 'ub');
    await addMemberToGroup(db, group.id, 'ua');
    const { interaction, replies } = createMockInteraction({
      options: { name: 'raid' },
    });

    await handleMembers(makeCtx(db), interaction);

    expect(replies[0]?.kind).toBe('deferReply');
    expect(replies[0]?.ephemeral).toBe(true);
    expect(replies[1]?.kind).toBe('editReply');
    expect(replies[1]?.content).toBe(
      '**Members in raid**:\n• user-ua\n• user-ub'
    );
  });

  test('uses a compact format for more than 20 members', async () => {
    const db = await makeTestDb();
    const group = await createGroup(db, 'raid', 'guild-1', 'u01');
    for (let i = 2; i <= 21; i++) {
      await addMemberToGroup(db, group.id, `u${String(i).padStart(2, '0')}`);
    }
    const { interaction, replies } = createMockInteraction({
      options: { name: 'raid' },
    });

    await handleMembers(makeCtx(db), interaction);

    expect(replies[1]?.content).toContain(', ');
    expect(replies[1]?.content).not.toContain('•');
  });

  test('prunes members who left the server', async () => {
    const db = await makeTestDb();
    const group = await createGroup(db, 'raid', 'guild-1', 'u1');
    await addMemberToGroup(db, group.id, 'departed');
    const { interaction, replies } = createMockInteraction({
      options: { name: 'raid' },
      guildMemberIds: ['u1'],
    });

    await handleMembers(makeCtx(db), interaction);

    expect(await getGroupMembers(db, group.id)).toEqual(['u1']);
    expect(replies[1]?.content).not.toContain('departed');
  });

  test('deletes the group if every member left the server', async () => {
    const db = await makeTestDb();
    await createGroup(db, 'raid', 'guild-1', 'departed');
    const { interaction, replies } = createMockInteraction({
      options: { name: 'raid' },
      guildMemberIds: [],
    });

    await handleMembers(makeCtx(db), interaction);

    expect(await getGroupByName(db, 'raid', 'guild-1')).toBeUndefined();
    expect(replies[1]?.content).toContain('was removed');
  });

  test('fetches members in chunks of at most 100', async () => {
    const db = await makeTestDb();
    const group = await createGroup(db, 'raid', 'guild-1', 'u0');
    for (let i = 1; i < 150; i++) {
      await addMemberToGroup(db, group.id, `u${i}`);
    }
    const { interaction, fetchCalls } = createMockInteraction({
      options: { name: 'raid' },
    });

    await handleMembers(makeCtx(db), interaction);

    expect(fetchCalls.length).toBe(2);
    expect(fetchCalls[0]?.length).toBe(100);
    expect(fetchCalls[1]?.length).toBe(50);
  });
});
