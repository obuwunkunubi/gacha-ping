import { afterEach, describe, expect, test, setSystemTime } from 'bun:test';
import { makeTestDb } from '../helpers/db';
import { createMockInteraction } from '../helpers/interaction';
import { createCooldowns } from '../../src/cooldowns';
import { handleList, handleMyGroups } from '../../src/handlers';
import { addMemberToGroup, createGroup, type Db } from '../../src/db';

function makeCtx(db: Db) {
  return { db, cooldowns: createCooldowns({ create: 300, ping: 60 }) };
}

afterEach(() => {
  setSystemTime();
});

describe('handleList', () => {
  test('reports when there are no groups', async () => {
    const db = await makeTestDb();
    const { interaction, replies } = createMockInteraction();

    await handleList(makeCtx(db), interaction);

    expect(replies[0]?.content).toContain('no groups in this server');
    expect(replies[0]?.ephemeral).toBe(true);
  });

  test('lists groups with member counts, most recently used first', async () => {
    const db = await makeTestDb();
    setSystemTime(new Date('2026-01-01T00:00:00Z'));
    const raid = await createGroup(db, 'raid', 'guild-1', 'u1');
    await addMemberToGroup(db, raid.id, 'u2');
    setSystemTime(new Date('2026-01-02T00:00:00Z'));
    await createGroup(db, 'chill', 'guild-1', 'u1');

    const { interaction, replies } = createMockInteraction();
    await handleList(makeCtx(db), interaction);

    expect(replies[0]?.content).toBe(
      '**Available Groups**:\n• **chill** (1 member)\n• **raid** (2 members)'
    );
    expect(replies[0]?.ephemeral).toBe(true);
  });

  test('does not include groups from other guilds', async () => {
    const db = await makeTestDb();
    await createGroup(db, 'other', 'g2', 'u1');
    const { interaction, replies } = createMockInteraction({
      guildId: 'guild-1',
    });

    await handleList(makeCtx(db), interaction);

    expect(replies[0]?.content).toContain('no groups in this server');
  });
});

describe('handleMyGroups', () => {
  test('reports when the user is in no groups', async () => {
    const db = await makeTestDb();
    await createGroup(db, 'raid', 'guild-1', 'someone-else');
    const { interaction, replies } = createMockInteraction({ userId: 'u1' });

    await handleMyGroups(makeCtx(db), interaction);

    expect(replies[0]?.content).toContain("not in any groups");
    expect(replies[0]?.ephemeral).toBe(true);
  });

  test('lists only the groups the user belongs to', async () => {
    const db = await makeTestDb();
    const raid = await createGroup(db, 'raid', 'guild-1', 'u1');
    await addMemberToGroup(db, raid.id, 'u2');
    await createGroup(db, 'chill', 'guild-1', 'u2');

    const { interaction, replies } = createMockInteraction({ userId: 'u1' });
    await handleMyGroups(makeCtx(db), interaction);

    expect(replies[0]?.content).toContain('**raid** (2 members)');
    expect(replies[0]?.content).not.toContain('chill');
    expect(replies[0]?.ephemeral).toBe(true);
  });
});
