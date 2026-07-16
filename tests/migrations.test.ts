import { describe, expect, test } from 'bun:test';
import { sql } from 'drizzle-orm';
import { runMigrations } from '../src/db';
import { makeRawTestDb } from './helpers/db';

// Reproduces a database as the old `drizzle-kit push` setup created it:
// tables without unique indexes, no migration history, duplicate data.
async function makeLegacyDb() {
  const db = makeRawTestDb();
  await db.run(sql`
    CREATE TABLE groups (
      id integer PRIMARY KEY NOT NULL,
      name text NOT NULL,
      guild_id text NOT NULL,
      creator_id text NOT NULL,
      last_used integer NOT NULL
    )`);
  await db.run(sql`
    CREATE TABLE group_members (
      group_id integer NOT NULL,
      user_id text NOT NULL,
      FOREIGN KEY (group_id) REFERENCES groups(id)
    )`);
  await db.run(sql`
    INSERT INTO groups (id, name, guild_id, creator_id, last_used) VALUES
      (1, 'raid', 'g1', 'u1', 100),
      (2, 'Raid', 'g1', 'u2', 200),
      (3, 'raid', 'g2', 'u3', 300),
      (4, 'chill', 'g1', 'u1', 400)`);
  await db.run(sql`
    INSERT INTO group_members (group_id, user_id) VALUES
      (1, 'u1'), (1, 'u1'), (1, 'u2'),
      (2, 'u2'),
      (3, 'u3'),
      (4, 'u1'), (4, 'u1')`);
  return db;
}

describe('baseline migration on a legacy database', () => {
  test('renames case-insensitive duplicate group names, keeping the oldest', async () => {
    const db = await makeLegacyDb();
    await runMigrations(db);

    const rows = await db.all<{ id: number; name: string; guild_id: string }>(
      sql`SELECT id, name, guild_id FROM groups ORDER BY id`
    );

    expect(rows).toEqual([
      { id: 1, name: 'raid', guild_id: 'g1' },
      { id: 2, name: 'Raid-2', guild_id: 'g1' },
      // Same name in a different guild is not a duplicate
      { id: 3, name: 'raid', guild_id: 'g2' },
      { id: 4, name: 'chill', guild_id: 'g1' },
    ]);
  });

  test('deduplicates memberships', async () => {
    const db = await makeLegacyDb();
    await runMigrations(db);

    const rows = await db.all<{ group_id: number; user_id: string }>(
      sql`SELECT group_id, user_id FROM group_members ORDER BY group_id, user_id`
    );

    expect(rows).toEqual([
      { group_id: 1, user_id: 'u1' },
      { group_id: 1, user_id: 'u2' },
      { group_id: 2, user_id: 'u2' },
      { group_id: 3, user_id: 'u3' },
      { group_id: 4, user_id: 'u1' },
    ]);
  });

  test('creates the unique indexes and records the migration', async () => {
    const db = await makeLegacyDb();
    await runMigrations(db);

    const indexes = await db.all<{ name: string }>(
      sql`SELECT name FROM sqlite_master WHERE type = 'index' AND name LIKE '%unique%' ORDER BY name`
    );
    expect(indexes.map((i) => i.name)).toEqual([
      'group_members_group_user_unique',
      'groups_guild_name_unique',
    ]);

    const migrations = await db.all<{ n: number }>(
      sql`SELECT count(*) AS n FROM __drizzle_migrations`
    );
    expect(migrations[0]?.n).toBe(1);
  });

  test('is not re-applied on a second run', async () => {
    const db = await makeLegacyDb();
    await runMigrations(db);
    await runMigrations(db);

    const migrations = await db.all<{ n: number }>(
      sql`SELECT count(*) AS n FROM __drizzle_migrations`
    );
    expect(migrations[0]?.n).toBe(1);
  });
});
