import { drizzle } from 'drizzle-orm/libsql';
import { migrate } from 'drizzle-orm/libsql/migrator';
import { createClient } from '@libsql/client';
import { fileURLToPath } from 'url';
import * as schema from './schema';
import { getDbPath } from './utils';

export function createDb(url: string = getDbPath()) {
  const client = createClient({ url });
  return drizzle(client, { schema });
}

export type Db = ReturnType<typeof createDb>;

export async function runMigrations(db: Db): Promise<void> {
  await migrate(db, {
    migrationsFolder: fileURLToPath(new URL('../../drizzle', import.meta.url)),
  });
}
