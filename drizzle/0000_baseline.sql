-- Baseline migration. Existing deployments were created with `drizzle-kit push`
-- and have no migration history, so table creation must be a no-op there
-- (IF NOT EXISTS) while the dedupe + unique indexes still apply.
CREATE TABLE IF NOT EXISTS `group_members` (
	`group_id` integer NOT NULL,
	`user_id` text NOT NULL,
	FOREIGN KEY (`group_id`) REFERENCES `groups`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `groups` (
	`id` integer PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`guild_id` text NOT NULL,
	`creator_id` text NOT NULL,
	`last_used` integer NOT NULL
);
--> statement-breakpoint
-- Drop duplicate memberships before the unique index can be created.
DELETE FROM `group_members` WHERE rowid NOT IN (
	SELECT MIN(rowid) FROM `group_members` GROUP BY `group_id`, `user_id`
);
--> statement-breakpoint
-- Group names become unique per guild, case-insensitively. The oldest group
-- keeps its name; newer duplicates get "-<id>" appended so no group or its
-- members are lost.
UPDATE `groups` SET `name` = `name` || '-' || `id` WHERE `id` NOT IN (
	SELECT MIN(`id`) FROM `groups` GROUP BY `guild_id`, lower(`name`)
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `group_members_group_user_unique` ON `group_members` (`group_id`,`user_id`);--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `groups_guild_name_unique` ON `groups` (`guild_id`,"name" COLLATE NOCASE);
