# 🎲 Gacha Ping

> Because it's a gamble whether or not your friends are going to show up

A Discord bot for pinging groups of friends without cluttering your server
with roles. Anyone can create a group, others join it, and one command pings
everyone in it.

## Commands

| Command | Description |
| --- | --- |
| `/create name:` | Create a group. You become its first member. |
| `/join name:` | Join a group. |
| `/leave name:` | Leave a group. If you were the last member, the group is deleted. |
| `/list` | All groups on the server with member counts. |
| `/mygroups` | The groups you're a member of. |
| `/members name:` | List a group's members without pinging them. |
| `/ping name: [message:]` | Ping every member of a group, optionally with a message. Members only. |
| `/delete name:` | Delete a group. Server administrators only. |

Group names are 2-32 characters (letters, numbers, spaces, hyphens,
underscores) and unique per server, ignoring case. Name options autocomplete.
Users who leave the server are removed from their groups automatically.

## Running it

Create a bot on the [Discord developer portal](https://discord.com/developers/applications),
enable the *Server Members* intent, and grab the bot token. The invite link is
printed on startup.

### Docker

```yaml
services:
  gacha-ping:
    container_name: gacha-ping
    image: ghcr.io/obuwunkunubi/gacha-ping:latest
    restart: unless-stopped
    env_file:
      - .env
    volumes:
      - ./data:/db
```

The container runs as UID 1000, so the data directory must be writable by that
user (`chown 1000:1000 ./data`). The SQLite database is created and migrated
automatically on startup.

### Local

Needs [Bun](https://bun.sh).

```sh
bun install
cp .env.sample .env   # fill in DISCORD_BOT_TOKEN
bun start
```

The database is created as `gacha-ping.db` in the project root.

## Configuration

All via environment variables (see `.env.sample`):

| Variable | Default | |
| --- | --- | --- |
| `DISCORD_BOT_TOKEN` | — | Required. |
| `CREATE_TIMEOUT` | `300` | Per-user cooldown for `/create` in seconds. `0` disables it. |
| `PING_TIMEOUT` | `60` | Per-user cooldown for `/ping` in seconds. `0` disables it. |
| `BOT_STATUS` | `online` | `online`, `idle`, `dnd`, or `invisible`. |
| `BOT_ACTIVITY_TYPE` | — | `playing`, `watching`, `listening`, `streaming`, `competing`. |
| `BOT_ACTIVITY_NAME` | — | Activity text. Required together with the type. |
| `BOT_ACTIVITY_URL` | — | Only used (and required) for the `streaming` type. |

## Development

TypeScript on Bun, discord.js v14, Drizzle ORM on SQLite (libsql).

```sh
bun run typecheck
bun test
bun run dev           # restart on file changes
bun run db:generate   # generate a migration after schema changes
```

Migrations live in `drizzle/` and are applied by the bot at startup, so schema
changes reach existing databases on the next deploy.

## License

[MIT](LICENSE)
