# 🎲 Gacha Ping

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Discord.js](https://img.shields.io/badge/discord.js-v14-blue.svg)](https://discord.js.org)
[![Bun](https://img.shields.io/badge/Bun-v1.0+-orange.svg)](https://bun.sh)

> Because it's a gamble whether or not your friends are going to show up

A Discord bot that lets you create and manage groups of people for easy pinging, without the need to create roles on your server. Create a group, let your friends join, and ping everyone with a single command.

## ✨ Features

- 📋 **Create Groups**: Create groups for your favorite games, movie nights, or any other group activities
- 👋 **Join/Leave**: Easily join or leave groups
- 🔔 **Ping Everyone**: Send alerts to all group members with a single command
- ⚙️ **Admin Controls**: Server admins can forcefully delete groups when needed
- 🔎 **Autocomplete**: Group names autocomplete for easy access

## 📝 Commands

### `/create`

Create a new group that people can join and be pinged in.

**Parameters:**

- `name`: The name of the group (2-32 characters, alphanumeric with spaces/hyphens/underscores)

**Example:**

```
/create name:group-name
```

### `/join`

Join an existing group to receive pings.

**Parameters:**

- `name`: The name of the group to join (with autocomplete)

**Example:**

```
/join name:group-name
```

### `/leave`

Leave a group you're currently in.

**Parameters:**

- `name`: The name of the group to leave (with autocomplete)

**Example:**

```
/leave name:group-name
```

### `/list`

List all available groups in the server.

**Example:**

```
/list
```

### `/members`

List all members in a specific group without pinging them.

**Parameters:**

- `name`: The name of the group to view members (with autocomplete)

**Example:**

```
/members name:group-name
```

### `/ping`

Ping all members of a group with an optional message.

**Parameters:**

- `name`: The name of the group to ping (with autocomplete)
- `message` (optional): The message to send with the ping

**Example:**

```
/ping name:group-name message:Anyone up for some games tonight?
```

### `/delete` (Admin only)

Delete a group. This command is only available to server administrators.

**Parameters:**

- `name`: The name of the group to delete (with autocomplete)

**Example:**

```
/delete name:group-name
```

## 🚀 Getting Started

### Prerequisites

- [Bun](https://bun.sh) (v1.0.0+) or [Docker](https://www.docker.com/)
- A Discord Bot Token (from the [Discord Developer Portal](https://discord.com/developers/applications))

### Installation

#### Local Installation (with Bun)

1. Clone the repository:

```bash
git clone https://github.com/obuwunkunubi/gacha-ping.git
```

```bash
cd gacha-ping
```

2. Install dependencies:

```bash
bun install
```

3. Copy the sample environment file:

```bash
cp .env.sample .env
```

4. Open the .env file using a text editor (e.g., nano) and configure the environment variables according to your preferences.

```bash
nano .env
```

5. Initialize the database:

```bash
bunx drizzle-kit push
```

6. Run the bot:

```bash
bun run src/index.ts
```

#### Docker Installation

The easiest way to run the bot is using Docker:

1. Create a new directory for the bot:

```bash
mkdir gacha-ping && cd gacha-ping
```

2. Create a `compose.yaml` file with the following content:

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

3. Create an `.env` file with your Discord bot token:

```
# === Discord Bot Configuration ===
DISCORD_BOT_TOKEN="your_discord_bot_token_here"

# === Command Timeouts (in seconds) ===
# Timeout for create group command: 300 seconds = 5 minutes
CREATE_TIMEOUT=300
# Timeout for ping command: 60 seconds = 1 minute
PING_TIMEOUT=60

# === Bot Status & Activity Configuration (Optional) ===
# Set bot status options: online, idle, dnd, invisible
# BOT_STATUS=online

# Set activity type options: playing, watching, listening, streaming, competing
# BOT_ACTIVITY_TYPE=playing

# Set activity name, e.g., "with dice"
# BOT_ACTIVITY_NAME=with dice

# For streaming activity, provide a valid Twitch or YouTube URL.
# If streaming is selected but no URL is provided, bot will fallback to just showing the status.
# BOT_ACTIVITY_URL=https://www.twitch.tv/username
```

4. Create a data directory for the database and start the bot:

```bash
mkdir -p data
```

By default, Gacha Ping runs as user 1000 inside the container. To ensure it has the necessary permissions to access the database folder, set the correct ownership:

```bash
sudo chown -R 1000:1000 ./data
```

```bash
docker compose up -d
```

5. View logs:

```bash
docker compose logs -f
```

6. Stop the bot:

```bash
docker compose down
```

You can also use a specific version by changing the image tag to a version number like `ghcr.io/obuwunkunubi/gacha-ping:1.0.0`.

**Updating the bot:**

To update to the latest version when a new release is available:

```bash
# Pull the latest image
docker pull ghcr.io/obuwunkunubi/gacha-ping:latest

# Restart your container
docker compose down && docker compose up -d
```

**Data Persistence:**

The database is stored in the `./data` volume on your host machine to ensure persistence between container restarts and updates.

## ⚙️ Configuration

The bot can be configured through environment variables:

| Variable            | Description                            | Default         |
| ------------------- | -------------------------------------- | --------------- |
| `DISCORD_BOT_TOKEN` | Your Discord bot authentication token  | Required        |
| `CREATE_TIMEOUT`    | Cooldown for creating groups (seconds) | 300 (5 minutes) |
| `PING_TIMEOUT`      | Cooldown for pinging groups (seconds)  | 60 (1 minute)   |
| `BOT_STATUS`        | Bot's online status                    | "online"        |
| `BOT_ACTIVITY_TYPE` | Bot's activity type                    | None            |
| `BOT_ACTIVITY_NAME` | Text displayed for bot's activity      | None            |
| `BOT_ACTIVITY_URL`  | URL for streaming activity type        | None            |

### Bot Status Options

The `BOT_STATUS` variable can be set to one of the following values:

- `online` - Shows the bot as online (green dot)
- `idle` - Shows the bot as idle (yellow/orange moon)
- `dnd` - Shows the bot as Do Not Disturb (red dot)
- `invisible` - Makes the bot appear offline

### Bot Activity Options

When both `BOT_ACTIVITY_TYPE` and `BOT_ACTIVITY_NAME` are set, the bot will display an activity status. The `BOT_ACTIVITY_TYPE` can be one of:

- `playing` - "Playing [BOT_ACTIVITY_NAME]"
- `watching` - "Watching [BOT_ACTIVITY_NAME]"
- `listening` - "Listening to [BOT_ACTIVITY_NAME]"
- `streaming` - "Streaming [BOT_ACTIVITY_NAME]" (requires `BOT_ACTIVITY_URL` to be set)
- `competing` - "Competing in [BOT_ACTIVITY_NAME]"

**Important:** If `BOT_ACTIVITY_TYPE` is set to `streaming`, you **must** also set `BOT_ACTIVITY_URL` to a valid Twitch or YouTube URL. If streaming is selected but no URL is provided, the bot will fall back to showing only the status without any activity.

**Example:**

```
BOT_STATUS=dnd
BOT_ACTIVITY_TYPE=playing
BOT_ACTIVITY_NAME=with dice
```

This will show the bot as Do Not Disturb with the status "Playing with dice".

## 💻 Development

This project uses:

- [Discord.js](https://discord.js.org/) for Discord API integration
- [DrizzleORM](https://orm.drizzle.team/) with SQLite for database operations
- [Bun](https://bun.sh) as the JavaScript/TypeScript runtime

### Database Management

You can view and manage the database using Drizzle Kit Studio. The tool is already included in the project dependencies:

```bash
# Start the Drizzle Kit Studio UI (web interface for the database)
bunx drizzle-kit studio
```

This will open a web interface where you can browse tables, run queries, and inspect data in your SQLite database.

### Project Structure

```
gacha-ping/
├── src/
│   ├── commands.ts             # Discord slash command definitions
│   ├── handlers.ts             # Command handler functions
│   ├── index.ts                # Main entry point
│   ├── timeouts.ts             # Timeout management
│   └── db/
│       ├── index.ts            # Database operations
│       ├── schema.ts           # Database schema definitions
│       └── utils.ts            # Database utilities
├── .github/
│   └── workflows/
│       └── docker-publish.yml  # Workflow for publishing Docker images
├── .dockerignore               # Files to ignore in Docker builds
├── .env.sample                 # Sample environment variables
├── .gitignore                  # Files to ignore in Git
├── .prettierrc                 # Prettier configuration
├── bun.lock                    # Bun package lockfile
├── compose.yaml                # Docker Compose configuration
├── Dockerfile                  # Docker build instructions
├── drizzle.config.ts           # Drizzle ORM configuration
├── LICENSE                     # Project license (MIT)
├── package.json                # Dependencies
├── README.md                   # Project documentation (this file)
├── start.sh                    # Startup script for Docker container
└── tsconfig.json               # TypeScript configuration
```

## 📜 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🙏 Acknowledgements

- [Discord.js](https://discord.js.org/) for making Discord bot development accessible
- [DrizzleORM](https://orm.drizzle.team/) for a great TypeScript ORM
- [Bun](https://bun.sh) for a fast JavaScript runtime
