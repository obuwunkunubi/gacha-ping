import { describe, expect, test, setSystemTime, afterEach } from 'bun:test';
import { makeTestDb } from './helpers/db';
import {
  addMemberToGroup,
  createGroup,
  deleteGroup,
  deleteGroupIfEmpty,
  deleteGuildData,
  getGroupByName,
  getGroupMembers,
  getGuildGroups,
  getGuildGroupsWithCounts,
  getUserGuildGroups,
  isMemberInGroup,
  isUniqueViolation,
  removeMemberAndDeleteGroupIfEmpty,
  removeMembersFromGroup,
  removeUserFromGuildGroups,
  updateGroupLastUsed,
} from '../src/db';

afterEach(() => {
  setSystemTime();
});

describe('createGroup', () => {
  test('creates the group with the creator as first member', async () => {
    const db = await makeTestDb();
    const group = await createGroup(db, 'raid', 'g1', 'u1');

    expect(group.name).toBe('raid');
    expect(group.guildId).toBe('g1');
    expect(group.creatorId).toBe('u1');
    expect(await getGroupMembers(db, group.id)).toEqual(['u1']);
  });

  test('rejects a duplicate name in the same guild', async () => {
    const db = await makeTestDb();
    await createGroup(db, 'raid', 'g1', 'u1');

    const error = await createGroup(db, 'raid', 'g1', 'u2').catch((e) => e);
    expect(isUniqueViolation(error)).toBe(true);
  });

  test('rejects a duplicate name differing only in case', async () => {
    const db = await makeTestDb();
    await createGroup(db, 'raid', 'g1', 'u1');

    const error = await createGroup(db, 'RAID', 'g1', 'u2').catch((e) => e);
    expect(isUniqueViolation(error)).toBe(true);
  });

  test('allows the same name in another guild', async () => {
    const db = await makeTestDb();
    await createGroup(db, 'raid', 'g1', 'u1');
    const other = await createGroup(db, 'raid', 'g2', 'u2');

    expect(other.name).toBe('raid');
  });
});

describe('isUniqueViolation', () => {
  test('is false for unrelated errors', () => {
    expect(isUniqueViolation(new Error('boom'))).toBe(false);
    expect(isUniqueViolation(undefined)).toBe(false);
  });
});

describe('getGroupByName', () => {
  test('matches case-insensitively', async () => {
    const db = await makeTestDb();
    const group = await createGroup(db, 'Raid Night', 'g1', 'u1');

    const found = await getGroupByName(db, 'raid night', 'g1');
    expect(found?.id).toBe(group.id);
  });

  test('does not match groups from other guilds', async () => {
    const db = await makeTestDb();
    await createGroup(db, 'raid', 'g1', 'u1');

    expect(await getGroupByName(db, 'raid', 'g2')).toBeUndefined();
  });
});

describe('membership', () => {
  test('addMemberToGroup is idempotent', async () => {
    const db = await makeTestDb();
    const group = await createGroup(db, 'raid', 'g1', 'u1');

    await addMemberToGroup(db, group.id, 'u2');
    await addMemberToGroup(db, group.id, 'u2');

    expect((await getGroupMembers(db, group.id)).sort()).toEqual(['u1', 'u2']);
  });

  test('isMemberInGroup reflects membership', async () => {
    const db = await makeTestDb();
    const group = await createGroup(db, 'raid', 'g1', 'u1');

    expect(await isMemberInGroup(db, group.id, 'u1')).toBe(true);
    expect(await isMemberInGroup(db, group.id, 'u2')).toBe(false);
  });

  test('removeMembersFromGroup removes only the given users', async () => {
    const db = await makeTestDb();
    const group = await createGroup(db, 'raid', 'g1', 'u1');
    await addMemberToGroup(db, group.id, 'u2');
    await addMemberToGroup(db, group.id, 'u3');

    await removeMembersFromGroup(db, group.id, ['u1', 'u3']);

    expect(await getGroupMembers(db, group.id)).toEqual(['u2']);
  });
});

describe('removeMemberAndDeleteGroupIfEmpty', () => {
  test('keeps the group while members remain', async () => {
    const db = await makeTestDb();
    const group = await createGroup(db, 'raid', 'g1', 'u1');
    await addMemberToGroup(db, group.id, 'u2');

    const { groupDeleted } = await removeMemberAndDeleteGroupIfEmpty(
      db,
      group.id,
      'u1'
    );

    expect(groupDeleted).toBe(false);
    expect(await getGroupByName(db, 'raid', 'g1')).toBeDefined();
  });

  test('deletes the group when the last member leaves', async () => {
    const db = await makeTestDb();
    const group = await createGroup(db, 'raid', 'g1', 'u1');

    const { groupDeleted } = await removeMemberAndDeleteGroupIfEmpty(
      db,
      group.id,
      'u1'
    );

    expect(groupDeleted).toBe(true);
    expect(await getGroupByName(db, 'raid', 'g1')).toBeUndefined();
  });
});

describe('deleteGroupIfEmpty', () => {
  test('only deletes empty groups', async () => {
    const db = await makeTestDb();
    const group = await createGroup(db, 'raid', 'g1', 'u1');

    expect((await deleteGroupIfEmpty(db, group.id)).deleted).toBe(false);

    await removeMembersFromGroup(db, group.id, ['u1']);
    expect((await deleteGroupIfEmpty(db, group.id)).deleted).toBe(true);
    expect(await getGroupByName(db, 'raid', 'g1')).toBeUndefined();
  });
});

describe('deleteGroup', () => {
  test('removes the group and its memberships', async () => {
    const db = await makeTestDb();
    const group = await createGroup(db, 'raid', 'g1', 'u1');
    await addMemberToGroup(db, group.id, 'u2');

    await deleteGroup(db, group.id);

    expect(await getGroupByName(db, 'raid', 'g1')).toBeUndefined();
    expect(await getGroupMembers(db, group.id)).toEqual([]);
  });
});

describe('removeUserFromGuildGroups', () => {
  test('removes the user everywhere in the guild and drops emptied groups', async () => {
    const db = await makeTestDb();
    const solo = await createGroup(db, 'solo', 'g1', 'u1');
    const shared = await createGroup(db, 'shared', 'g1', 'u1');
    await addMemberToGroup(db, shared.id, 'u2');
    const otherGuild = await createGroup(db, 'other', 'g2', 'u1');

    await removeUserFromGuildGroups(db, 'g1', 'u1');

    // The group u1 was alone in disappears, the shared one stays
    expect(await getGroupByName(db, 'solo', 'g1')).toBeUndefined();
    expect(await getGroupMembers(db, shared.id)).toEqual(['u2']);
    // Other guilds are untouched
    expect(await getGroupMembers(db, otherGuild.id)).toEqual(['u1']);
  });

  test('is a no-op for users without memberships', async () => {
    const db = await makeTestDb();
    await createGroup(db, 'raid', 'g1', 'u1');

    await removeUserFromGuildGroups(db, 'g1', 'stranger');

    expect(await getGroupMembers(db, (await getGroupByName(db, 'raid', 'g1'))!.id)).toEqual(['u1']);
  });
});

describe('deleteGuildData', () => {
  test('purges only the given guild', async () => {
    const db = await makeTestDb();
    await createGroup(db, 'a', 'g1', 'u1');
    await createGroup(db, 'b', 'g1', 'u2');
    await createGroup(db, 'keep', 'g2', 'u1');

    await deleteGuildData(db, 'g1');

    expect(await getGuildGroups(db, 'g1')).toEqual([]);
    expect((await getGuildGroups(db, 'g2')).map((g) => g.name)).toEqual([
      'keep',
    ]);
  });
});

describe('ordering', () => {
  test('getGuildGroups returns most recently used first', async () => {
    const db = await makeTestDb();
    setSystemTime(new Date('2026-01-01T00:00:00Z'));
    const oldest = await createGroup(db, 'oldest', 'g1', 'u1');
    setSystemTime(new Date('2026-01-02T00:00:00Z'));
    await createGroup(db, 'newest', 'g1', 'u1');

    expect((await getGuildGroups(db, 'g1')).map((g) => g.name)).toEqual([
      'newest',
      'oldest',
    ]);

    setSystemTime(new Date('2026-01-03T00:00:00Z'));
    await updateGroupLastUsed(db, oldest.id);

    expect((await getGuildGroups(db, 'g1')).map((g) => g.name)).toEqual([
      'oldest',
      'newest',
    ]);
  });

  test('getUserGuildGroups only returns the user\'s groups, most recent first', async () => {
    const db = await makeTestDb();
    setSystemTime(new Date('2026-01-01T00:00:00Z'));
    await createGroup(db, 'mine-old', 'g1', 'u1');
    setSystemTime(new Date('2026-01-02T00:00:00Z'));
    await createGroup(db, 'theirs', 'g1', 'u2');
    setSystemTime(new Date('2026-01-03T00:00:00Z'));
    await createGroup(db, 'mine-new', 'g1', 'u1');

    expect(
      (await getUserGuildGroups(db, 'g1', 'u1')).map((g) => g.name)
    ).toEqual(['mine-new', 'mine-old']);
  });
});

describe('getGuildGroupsWithCounts', () => {
  test('returns member counts', async () => {
    const db = await makeTestDb();
    const raid = await createGroup(db, 'raid', 'g1', 'u1');
    await addMemberToGroup(db, raid.id, 'u2');
    await createGroup(db, 'solo', 'g1', 'u3');

    const groups = await getGuildGroupsWithCounts(db, 'g1');
    const counts = Object.fromEntries(
      groups.map((g) => [g.name, g.memberCount])
    );

    expect(counts).toEqual({ raid: 2, solo: 1 });
  });

  test('filters by member when given', async () => {
    const db = await makeTestDb();
    const raid = await createGroup(db, 'raid', 'g1', 'u1');
    await addMemberToGroup(db, raid.id, 'u2');
    await createGroup(db, 'solo', 'g1', 'u3');

    const groups = await getGuildGroupsWithCounts(db, 'g1', 'u2');

    expect(groups.map((g) => g.name)).toEqual(['raid']);
    expect(groups[0]?.memberCount).toBe(2);
  });
});
