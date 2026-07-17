import { existsSync } from 'fs';
import { join } from 'path';

// In Docker the database lives in /db (mounted as a volume); locally it sits
// in the project root.
export const getDbPath = (): string => {
  const basePath = existsSync('/db') ? '/db' : '.';
  return `file:${join(basePath, 'gacha-ping.db')}`;
};
