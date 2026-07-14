FROM oven/bun:latest AS base

WORKDIR /app

COPY . .

RUN bun install --frozen-lockfile

# The SQLite database lives in /db (mounted as a volume); run as UID 1000
RUN mkdir -p /db && chown -R 1000:1000 /app /db

USER 1000

CMD ["bun", "run", "src/index.ts"]
