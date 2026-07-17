import { eq, and, desc, count, exists, inArray, sql } from 'drizzle-orm';
import { DrizzleQueryError } from 'drizzle-orm/errors';
import { alias } from 'drizzle-orm/sqlite-core';
import { groupsTable, groupMembersTable, type Group } from './schema';
import type { Db } from './client';

export { createDb, runMigrations, type Db } from './client';

// Query errors are not caught here; they propagate to the interaction
// router's error handler. An undefined/empty result always means "not found".

/**
 * Detects a UNIQUE constraint violation. drizzle-orm wraps driver errors in
 * DrizzleQueryError, so the LibsqlError has to be read from `cause`.
 */
export function isUniqueViolation(error: unknown): boolean {
  if (!(error instanceof DrizzleQueryError)) return false;
  const cause = error.cause as { code?: string; message?: string } | undefined;
  return (
    (cause?.code?.startsWith('SQLITE_CONSTRAINT') ?? false) &&
    (cause?.message?.includes('UNIQUE constraint failed') ?? false)
  );
}

/**
 * Creates a group with its creator as the first member. Throws a unique
 * violation if the name is already taken in the guild (case-insensitive).
 */
export async function createGroup(
  db: Db,
  name: string,
  guildId: string,
  creatorId: string
): Promise<Group> {
  return db.transaction(async (tx) => {
    const [group] = await tx
      .insert(groupsTable)
      .values({ name, guildId, creatorId, lastUsed: Date.now() })
      .returning();
    if (!group) throw new Error('Insert returned no row');
    await tx
      .insert(groupMembersTable)
      .values({ groupId: group.id, userId: creatorId });
    return group;
  });
}

/** Case-insensitive lookup, matching the unique index's collation. */
export async function getGroupByName(
  db: Db,
  name: string,
  guildId: string
): Promise<Group | undefined> {
  const rows = await db
    .select()
    .from(groupsTable)
    .where(
      and(
        eq(groupsTable.guildId, guildId),
        sql`${groupsTable.name} = ${name} COLLATE NOCASE`
      )
    )
    .limit(1);
  return rows[0];
}

export async function getGuildGroups(db: Db, guildId: string): Promise<Group[]> {
  return db
    .select()
    .from(groupsTable)
    .where(eq(groupsTable.guildId, guildId))
    .orderBy(desc(groupsTable.lastUsed));
}

export async function getUserGuildGroups(
  db: Db,
  guildId: string,
  userId: string
): Promise<Group[]> {
  const rows = await db
    .select({ group: groupsTable })
    .from(groupsTable)
    .innerJoin(
      groupMembersTable,
      eq(groupsTable.id, groupMembersTable.groupId)
    )
    .where(
      and(
        eq(groupsTable.guildId, guildId),
        eq(groupMembersTable.userId, userId)
      )
    )
    .orderBy(desc(groupsTable.lastUsed));
  return rows.map((r) => r.group);
}

export type GroupWithCount = Group & { memberCount: number };

/**
 * Groups of a guild with their member counts in one query. When `memberId`
 * is given, only groups that user belongs to are returned.
 */
export async function getGuildGroupsWithCounts(
  db: Db,
  guildId: string,
  memberId?: string
): Promise<GroupWithCount[]> {
  const membership = alias(groupMembersTable, 'membership');
  const conditions = [eq(groupsTable.guildId, guildId)];
  if (memberId !== undefined) {
    conditions.push(
      exists(
        db
          .select({ one: sql`1` })
          .from(membership)
          .where(
            and(
              eq(membership.groupId, groupsTable.id),
              eq(membership.userId, memberId)
            )
          )
      )
    );
  }

  const rows = await db
    .select({ group: groupsTable, memberCount: count(groupMembersTable.userId) })
    .from(groupsTable)
    .leftJoin(
      groupMembersTable,
      eq(groupsTable.id, groupMembersTable.groupId)
    )
    .where(and(...conditions))
    .groupBy(groupsTable.id)
    .orderBy(desc(groupsTable.lastUsed));
  return rows.map((r) => ({ ...r.group, memberCount: r.memberCount }));
}

/**
 * Renames a group. Throws a unique violation if the new name is already
 * taken in the guild (case-insensitive).
 */
export async function renameGroup(
  db: Db,
  groupId: number,
  newName: string
): Promise<void> {
  await db
    .update(groupsTable)
    .set({ name: newName })
    .where(eq(groupsTable.id, groupId));
}

export async function updateGroupLastUsed(
  db: Db,
  groupId: number
): Promise<void> {
  await db
    .update(groupsTable)
    .set({ lastUsed: Date.now() })
    .where(eq(groupsTable.id, groupId));
}

export async function deleteGroup(db: Db, groupId: number): Promise<void> {
  await db.transaction(async (tx) => {
    await tx
      .delete(groupMembersTable)
      .where(eq(groupMembersTable.groupId, groupId));
    await tx.delete(groupsTable).where(eq(groupsTable.id, groupId));
  });
}

export async function getGroupMembers(
  db: Db,
  groupId: number
): Promise<string[]> {
  const members = await db
    .select({ userId: groupMembersTable.userId })
    .from(groupMembersTable)
    .where(eq(groupMembersTable.groupId, groupId));
  return members.map((m) => m.userId);
}

export async function addMemberToGroup(
  db: Db,
  groupId: number,
  userId: string
): Promise<void> {
  await db
    .insert(groupMembersTable)
    .values({ groupId, userId })
    .onConflictDoNothing();
}

export async function isMemberInGroup(
  db: Db,
  groupId: number,
  userId: string
): Promise<boolean> {
  const member = await db
    .select({ userId: groupMembersTable.userId })
    .from(groupMembersTable)
    .where(
      and(
        eq(groupMembersTable.groupId, groupId),
        eq(groupMembersTable.userId, userId)
      )
    )
    .limit(1);
  return member.length > 0;
}

export async function removeMembersFromGroup(
  db: Db,
  groupId: number,
  userIds: string[]
): Promise<void> {
  if (userIds.length === 0) return;
  await db
    .delete(groupMembersTable)
    .where(
      and(
        eq(groupMembersTable.groupId, groupId),
        inArray(groupMembersTable.userId, userIds)
      )
    );
}

/**
 * Deletes a group only if it has no members. The recount happens inside the
 * transaction so a concurrent join can't be wiped out.
 */
export async function deleteGroupIfEmpty(
  db: Db,
  groupId: number
): Promise<{ deleted: boolean }> {
  return db.transaction(async (tx) => {
    const [row] = await tx
      .select({ n: count() })
      .from(groupMembersTable)
      .where(eq(groupMembersTable.groupId, groupId));
    if ((row?.n ?? 0) > 0) {
      return { deleted: false };
    }
    await tx.delete(groupsTable).where(eq(groupsTable.id, groupId));
    return { deleted: true };
  });
}

/**
 * Removes a member and deletes the group if nobody is left. Done in one
 * transaction so concurrent leaves can't leave an empty group behind.
 */
export async function removeMemberAndDeleteGroupIfEmpty(
  db: Db,
  groupId: number,
  userId: string
): Promise<{ groupDeleted: boolean }> {
  return db.transaction(async (tx) => {
    await tx
      .delete(groupMembersTable)
      .where(
        and(
          eq(groupMembersTable.groupId, groupId),
          eq(groupMembersTable.userId, userId)
        )
      );
    const [row] = await tx
      .select({ n: count() })
      .from(groupMembersTable)
      .where(eq(groupMembersTable.groupId, groupId));
    if ((row?.n ?? 0) === 0) {
      await tx.delete(groupsTable).where(eq(groupsTable.id, groupId));
      return { groupDeleted: true };
    }
    return { groupDeleted: false };
  });
}

/**
 * Drops all of a user's memberships in a guild and deletes any groups left
 * empty. Used when a member leaves the Discord server.
 */
export async function removeUserFromGuildGroups(
  db: Db,
  guildId: string,
  userId: string
): Promise<void> {
  await db.transaction(async (tx) => {
    const rows = await tx
      .select({ id: groupsTable.id })
      .from(groupsTable)
      .innerJoin(
        groupMembersTable,
        eq(groupsTable.id, groupMembersTable.groupId)
      )
      .where(
        and(
          eq(groupsTable.guildId, guildId),
          eq(groupMembersTable.userId, userId)
        )
      );
    const groupIds = rows.map((r) => r.id);
    if (groupIds.length === 0) return;

    await tx
      .delete(groupMembersTable)
      .where(
        and(
          inArray(groupMembersTable.groupId, groupIds),
          eq(groupMembersTable.userId, userId)
        )
      );

    const remaining = await tx
      .select({ groupId: groupMembersTable.groupId })
      .from(groupMembersTable)
      .where(inArray(groupMembersTable.groupId, groupIds));
    const nonEmpty = new Set(remaining.map((r) => r.groupId));
    const emptyIds = groupIds.filter((id) => !nonEmpty.has(id));
    if (emptyIds.length > 0) {
      await tx.delete(groupsTable).where(inArray(groupsTable.id, emptyIds));
    }
  });
}

/** Purges everything for a guild. Used when the bot is removed from it. */
export async function deleteGuildData(db: Db, guildId: string): Promise<void> {
  await db.transaction(async (tx) => {
    const rows = await tx
      .select({ id: groupsTable.id })
      .from(groupsTable)
      .where(eq(groupsTable.guildId, guildId));
    const groupIds = rows.map((r) => r.id);
    if (groupIds.length === 0) return;
    await tx
      .delete(groupMembersTable)
      .where(inArray(groupMembersTable.groupId, groupIds));
    await tx.delete(groupsTable).where(inArray(groupsTable.id, groupIds));
  });
}
