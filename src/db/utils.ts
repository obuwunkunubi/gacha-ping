import { existsSync, mkdirSync } from 'fs';
import { join } from 'path';

/**
 * Get the database file path, ensuring the directory exists.
 * For Docker containers, DB files will be stored in /db/.
 * For local development, DB files will be stored in the project root.
 */
export const getDbPath = (): string => {
  // Check if the /db directory exists (will exist in Docker setup)
  const dockerDbPath = '/db';
  const localDbPath = '.';

  const basePath = existsSync(dockerDbPath) ? dockerDbPath : localDbPath;

  // Ensure the directory exists
  if (!existsSync(basePath)) {
    mkdirSync(basePath, { recursive: true });
  }

  return `file:${join(basePath, 'gacha-ping.db')}`;
};
