import { afterAll } from 'bun:test';
import { mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { createDb, runMigrations, type Db } from '../../src/db';

// The libsql client doesn't keep a single connection open for `:memory:`
// databases (a transaction ends up on a fresh, empty one), so tests use a
// throwaway file database instead.
const tempDirs: string[] = [];

afterAll(() => {
  for (const dir of tempDirs) {
    rmSync(dir, { recursive: true, force: true });
  }
});

export function makeRawTestDb(): Db {
  const dir = mkdtempSync(join(tmpdir(), 'gacha-ping-test-'));
  tempDirs.push(dir);
  return createDb(`file:${join(dir, 'test.db')}`);
}

export async function makeTestDb(): Promise<Db> {
  const db = makeRawTestDb();
  await runMigrations(db);
  return db;
}
