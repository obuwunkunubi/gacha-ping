#!/bin/sh
set -e  # Exit immediately on error

if [ ! -f "/db/gacha-ping.db" ]; then
  echo "Initializing database..."
  bunx drizzle-kit push --config=/app/drizzle.config.ts
else
  echo "Database exists. Skipping database initialization."
fi

exec bun run src/index.ts