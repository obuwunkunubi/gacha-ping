import { drizzle } from 'drizzle-orm/libsql';
import { createClient } from '@libsql/client';
import { eq, and } from 'drizzle-orm';
import { groupsTable, groupMembersTable, type Group } from './schema';
import * as schema from './schema';
import { getDbPath } from './utils';

/**
 * Initialize the database client with the connection URL.
 */
const client = createClient({
  url: getDbPath(),
});

/**
 * Create the database instance with the schema.
 */
const db = drizzle(client, { schema });

/**
 * Validates a group name.
 *
 * @param name The name to validate.
 * @returns An object indicating if the name is valid and the reason if invalid.
 */
export function validateGroupName(name: string): {
  valid: boolean;
  reason?: string;
} {
  // Check length (between 2 and 32 characters)
  if (name.length < 2 || name.length > 32) {
    return {
      valid: false,
      reason: 'Group name must be between 2 and 32 characters long',
    };
  }

  // Allow only alphanumeric characters, spaces, hyphens, and underscores
  const validNameRegex = /^[a-zA-Z0-9\s\-_]+$/;
  if (!validNameRegex.test(name)) {
    return {
      valid: false,
      reason:
        'Group name can only contain letters, numbers, spaces, hyphens, and underscores',
    };
  }

  return { valid: true };
}

/**
 * Creates a new group in the database.
 *
 * @param name The name of the group.
 * @param guildId The Discord guild ID where the group belongs.
 * @param creatorId The ID of the user creating the group.
 * @returns The created group or undefined if creation failed.
 */
export async function createGroup(
  name: string,
  guildId: string,
  creatorId: string
): Promise<Group | undefined> {
  // Trim the name before validation
  const trimmedName = name.trim();

  const validation = validateGroupName(trimmedName);
  if (!validation.valid) {
    console.error('Invalid group name:', validation.reason);
    return undefined;
  }

  try {
    const [group] = await db
      .insert(groupsTable)
      .values({
        name: trimmedName,
        guildId,
        creatorId,
        lastUsed: Date.now(),
      })
      .returning();

    if (group) {
      // Add creator as first member
      await db.insert(groupMembersTable).values({
        groupId: group.id,
        userId: creatorId,
      });
    }

    return group;
  } catch (error) {
    console.error('Error creating group:', error);
    return undefined;
  }
}

/**
 * Retrieves a group by its name and guild ID.
 *
 * @param name The name of the group.
 * @param guildId The Discord guild ID.
 * @returns The group if found, otherwise undefined.
 */
export async function getGroupByName(
  name: string,
  guildId: string
): Promise<Group | undefined> {
  try {
    return await db.query.groupsTable.findFirst({
      where: and(eq(groupsTable.name, name), eq(groupsTable.guildId, guildId)),
    });
  } catch (error) {
    console.error('Error getting group:', error);
    return undefined;
  }
}

/**
 * Retrieves all groups for a specific guild.
 *
 * @param guildId The Discord guild ID.
 * @returns Array of groups in the guild sorted by last used timestamp.
 */
export async function getGuildGroups(guildId: string): Promise<Group[]> {
  try {
    return await db
      .select()
      .from(groupsTable)
      .where(eq(groupsTable.guildId, guildId))
      .orderBy(groupsTable.lastUsed);
  } catch (error) {
    console.error('Error getting guild groups:', error);
    return [];
  }
}

/**
 * Retrieves groups for a specific user in a specific guild.
 *
 * @param guildId The Discord guild ID.
 * @param userId The Discord user ID.
 * @returns Array of groups the user is in, sorted by last used timestamp.
 */
export async function getUserGuildGroups(guildId: string, userId: string): Promise<Group[]> {
  try {
    const result = await db
      .select({
        id: groupsTable.id,
        name: groupsTable.name,
        guildId: groupsTable.guildId,
        creatorId: groupsTable.creatorId,
        lastUsed: groupsTable.lastUsed,
      })
      .from(groupsTable)
      .innerJoin(groupMembersTable, eq(groupsTable.id, groupMembersTable.groupId)) // Join groups with group members
      .where(
        and(
          eq(groupsTable.guildId, guildId), // Filter by guild ID
          eq(groupMembersTable.userId, userId) // Filter by user ID
        )
      )
      .orderBy(groupsTable.lastUsed); // Sort by last used timestamp

    // Map the result to an array of Group objects
    return result.map(row => ({
      id: row.id,
      name: row.name,
      guildId: row.guildId,
      creatorId: row.creatorId,
      lastUsed: row.lastUsed,
    }));
  } catch (error) {
    console.error('Error getting user guild groups:', error);
    return [];
  }
}

/**
 * Updates the last used timestamp for a group.
 *
 * @param groupId The ID of the group to update.
 * @returns A boolean indicating success or failure.
 */
export async function updateGroupLastUsed(groupId: number): Promise<boolean> {
  try {
    await db
      .update(groupsTable)
      .set({ lastUsed: Date.now() })
      .where(eq(groupsTable.id, groupId));
    return true;
  } catch (error) {
    console.error('Error updating group last used:', error);
    return false;
  }
}

/**
 * Deletes a group from the database.
 *
 * @param groupId The ID of the group to delete.
 * @returns A boolean indicating success or failure.
 */
export async function deleteGroup(groupId: number): Promise<boolean> {
  try {
    // Delete members first due to foreign key constraint
    await db
      .delete(groupMembersTable)
      .where(eq(groupMembersTable.groupId, groupId));

    await db.delete(groupsTable).where(eq(groupsTable.id, groupId));
    return true;
  } catch (error) {
    console.error('Error deleting group:', error);
    return false;
  }
}

/**
 * Retrieves all members of a specific group.
 *
 * @param groupId The ID of the group.
 * @returns An array of user IDs who are members of the group.
 */
export async function getGroupMembers(groupId: number): Promise<string[]> {
  try {
    const members = await db
      .select({ userId: groupMembersTable.userId })
      .from(groupMembersTable)
      .where(eq(groupMembersTable.groupId, groupId));
    return members.map((m) => m.userId);
  } catch (error) {
    console.error('Error getting group members:', error);
    return [];
  }
}

/**
 * Adds a user as a member to a group.
 *
 * @param groupId The ID of the group.
 * @param userId The ID of the user to add.
 * @returns A boolean indicating success or failure.
 */
export async function addMemberToGroup(
  groupId: number,
  userId: string
): Promise<boolean> {
  try {
    await db
      .insert(groupMembersTable)
      .values({ groupId, userId })
      .onConflictDoNothing();
    return true;
  } catch (error) {
    console.error('Error adding member to group:', error);
    return false;
  }
}

/**
 * Checks if a user is a member of a specific group.
 *
 * @param groupId The ID of the group.
 * @param userId The ID of the user to check.
 * @returns A boolean indicating if the user is a member.
 */
export async function isMemberInGroup(
  groupId: number,
  userId: string
): Promise<boolean> {
  try {
    const member = await db
      .select()
      .from(groupMembersTable)
      .where(
        and(
          eq(groupMembersTable.groupId, groupId),
          eq(groupMembersTable.userId, userId)
        )
      )
      .limit(1);
    return member.length > 0;
  } catch (error) {
    console.error('Error checking group membership:', error);
    return false;
  }
}

/**
 * Removes a user from a group.
 *
 * @param groupId The ID of the group.
 * @param userId The ID of the user to remove.
 * @returns A boolean indicating success or failure.
 */
export async function removeMemberFromGroup(
  groupId: number,
  userId: string
): Promise<boolean> {
  try {
    await db
      .delete(groupMembersTable)
      .where(
        and(
          eq(groupMembersTable.groupId, groupId),
          eq(groupMembersTable.userId, userId)
        )
      );
    return true;
  } catch (error) {
    console.error('Error removing member from group:', error);
    return false;
  }
}
