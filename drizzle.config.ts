import { defineConfig } from 'drizzle-kit';
import { getDbPath } from './src/db/utils';

export default defineConfig({
  out: './drizzle',
  schema: './src/db/schema.ts',
  dialect: 'sqlite',
  dbCredentials: {
    url: getDbPath(),
  },
});
