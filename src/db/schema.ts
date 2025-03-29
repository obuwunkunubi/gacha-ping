import { relations } from 'drizzle-orm';
import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

/**
 * Database schema for managing groups and their members in SQLite using Drizzle ORM.
 * Defines tables and relationships for the group management system.
 */

/**
 * Table for storing group information.
 * Each group belongs to a specific Discord guild (server).
 */
export const groupsTable = sqliteTable('groups', {
  id: integer('id').primaryKey(),           // Unique identifier for each group
  name: text('name').notNull(),             // Name of the group (must be unique per guild)
  guildId: text('guild_id').notNull(),      // Discord guild (server) ID where the group belongs
  creatorId: text('creator_id').notNull(),  // ID of the user who created the group
  lastUsed: integer('last_used').notNull(), // Timestamp of the last time the group was used (used for sorting)
});

/**
 * Table for storing group members.
 * Links users to the groups they have joined.
 */
export const groupMembersTable = sqliteTable('group_members', {
  groupId: integer('group_id')
    .notNull()
    .references(() => groupsTable.id), // Foreign key linking to the groups table
  userId: text('user_id').notNull(), // ID of the user who is a member of the group
});

/**
 * Relationship: A group can have many members.
 * Defines a one-to-many relationship between groups and members.
 */
export const groupRelations = relations(groupsTable, ({ many }) => ({
  members: many(groupMembersTable), // Collection of all members belonging to this group
}));

/**
 * Relationship: Each group member belongs to one group.
 * Defines the inverse relationship from members to their group.
 */
export const memberRelations = relations(groupMembersTable, ({ one }) => ({
  /** The group this member belongs to */
  group: one(groupsTable, {
    fields: [groupMembersTable.groupId], // Foreign key field in group_membersTable
    references: [groupsTable.id], // References the ID in groupsTable
  }),
}));

/**
 * Type definitions for database entities.
 * These provide type safety when working with the database.
 */
export type Group = typeof groupsTable.$inferSelect;                   // Type for selecting group data
export type InsertGroup = typeof groupsTable.$inferInsert;             // Type for inserting a new group
export type GroupMember = typeof groupMembersTable.$inferSelect;       // Type for selecting group member data
export type InsertGroupMember = typeof groupMembersTable.$inferInsert; // Type for inserting a new group member
