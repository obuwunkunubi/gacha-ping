import { relations, sql } from 'drizzle-orm';
import {
  integer,
  sqliteTable,
  text,
  uniqueIndex,
} from 'drizzle-orm/sqlite-core';

export const groupsTable = sqliteTable(
  'groups',
  {
    id: integer('id').primaryKey(),
    name: text('name').notNull(),
    guildId: text('guild_id').notNull(),
    creatorId: text('creator_id').notNull(),
    lastUsed: integer('last_used').notNull(),
  },
  (t) => [
    // Names are unique per guild, ignoring case
    uniqueIndex('groups_guild_name_unique').on(
      t.guildId,
      sql`${t.name} COLLATE NOCASE`
    ),
  ]
);

export const groupMembersTable = sqliteTable(
  'group_members',
  {
    groupId: integer('group_id')
      .notNull()
      .references(() => groupsTable.id),
    userId: text('user_id').notNull(),
  },
  (t) => [
    uniqueIndex('group_members_group_user_unique').on(t.groupId, t.userId),
  ]
);

export const groupRelations = relations(groupsTable, ({ many }) => ({
  members: many(groupMembersTable),
}));

export const memberRelations = relations(groupMembersTable, ({ one }) => ({
  group: one(groupsTable, {
    fields: [groupMembersTable.groupId],
    references: [groupsTable.id],
  }),
}));

export type Group = typeof groupsTable.$inferSelect;
export type InsertGroup = typeof groupsTable.$inferInsert;
export type GroupMember = typeof groupMembersTable.$inferSelect;
export type InsertGroupMember = typeof groupMembersTable.$inferInsert;
