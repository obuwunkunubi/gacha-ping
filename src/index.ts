import {
  ActivityType,
  Client,
  Events,
  GatewayIntentBits,
  MessageFlags,
  PermissionFlagsBits,
  REST,
  Routes,
} from 'discord.js';
import {
  createDb,
  getGuildGroups,
  getUserGuildGroups,
  runMigrations,
} from './db';
import type { Group } from './db/schema';
import { commands } from './commands';
import { createCooldowns, parseCooldownSeconds } from './cooldowns';
import {
  handleCreate,
  handleJoin,
  handleLeave,
  handleList,
  handleMembers,
  handlePing,
  handleDelete,
  type BotContext,
} from './handlers';

const db = createDb();

const cooldowns = createCooldowns({
  create: parseCooldownSeconds(process.env.CREATE_TIMEOUT, 300),
  ping: parseCooldownSeconds(process.env.PING_TIMEOUT, 60),
});

const ctx: BotContext = { db, cooldowns };

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMembers,
  ],
});

const rest = new REST().setToken(process.env.DISCORD_BOT_TOKEN!);

client.once(Events.ClientReady, async (readyClient) => {
  console.log(`Logged in as ${readyClient.user.tag}`);

  setPresence();

  const inviteLink = `https://discord.com/api/oauth2/authorize?client_id=${readyClient.user.id}&permissions=2048&scope=bot%20applications.commands`;
  console.log('Add bot to server:', inviteLink);

  // Always re-register: a diff against the deployed commands would have to
  // compare every option to be correct, and one idempotent PUT per boot is
  // well within rate limits.
  try {
    await rest.put(Routes.applicationCommands(readyClient.user.id), {
      body: commands,
    });
    console.log('Registered application commands.');
  } catch (error) {
    console.error('Error registering slash commands:', error);
  }
});

client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isChatInputCommand() && !interaction.isAutocomplete())
    return;

  if (!interaction.inCachedGuild()) {
    if (interaction.isChatInputCommand()) {
      await interaction
        .reply({
          content: '❌ This bot only works in servers.',
          flags: MessageFlags.Ephemeral,
        })
        .catch(() => {});
    } else {
      await interaction.respond([]).catch(() => {});
    }
    return;
  }

  if (interaction.isAutocomplete()) {
    try {
      const focusedValue = interaction.options.getFocused().toLowerCase();
      const commandName = interaction.commandName;

      let groups: Group[];

      if (commandName === 'join') {
        // Only suggest groups the user is not in yet
        groups = await getGuildGroups(db, interaction.guildId);
        if (groups.length > 0) {
          const userGroupIds = new Set(
            (
              await getUserGuildGroups(
                db,
                interaction.guildId,
                interaction.user.id
              )
            ).map((g) => g.id)
          );
          groups = groups.filter((g) => !userGroupIds.has(g.id));
        }
      } else if (
        commandName === 'delete' &&
        !interaction.memberPermissions.has(PermissionFlagsBits.Administrator)
      ) {
        groups = [];
      } else if (commandName === 'ping' || commandName === 'leave') {
        // Only suggest groups the user is in
        groups = await getUserGuildGroups(
          db,
          interaction.guildId,
          interaction.user.id
        );
      } else {
        groups = await getGuildGroups(db, interaction.guildId);
      }

      const filtered = groups
        .filter((g) => g.name.toLowerCase().startsWith(focusedValue))
        .slice(0, 25)
        .map((g) => ({ name: g.name, value: g.name }));

      await interaction.respond(filtered);
    } catch (error) {
      console.error('Error handling autocomplete:', error);
      await interaction.respond([]).catch(() => {});
    }
    return;
  }

  try {
    switch (interaction.commandName) {
      case 'create':
        await handleCreate(ctx, interaction);
        break;
      case 'join':
        await handleJoin(ctx, interaction);
        break;
      case 'leave':
        await handleLeave(ctx, interaction);
        break;
      case 'list':
        await handleList(ctx, interaction);
        break;
      case 'members':
        await handleMembers(ctx, interaction);
        break;
      case 'ping':
        await handlePing(ctx, interaction);
        break;
      case 'delete':
        await handleDelete(ctx, interaction);
        break;
    }
  } catch (error) {
    console.error(`Error handling command ${interaction.commandName}:`, error);
    const content =
      '❌ An unexpected error occurred while processing your command.';
    try {
      if (interaction.deferred) {
        await interaction.editReply({ content });
      } else if (interaction.replied) {
        await interaction.followUp({
          content,
          flags: MessageFlags.Ephemeral,
        });
      } else {
        await interaction.reply({
          content,
          flags: MessageFlags.Ephemeral,
        });
      }
    } catch {
      // The interaction is gone (expired or already acknowledged elsewhere).
    }
  }
});

function setPresence(): void {
  const status = (process.env.BOT_STATUS || 'online') as
    | 'online'
    | 'idle'
    | 'dnd'
    | 'invisible';
  const activityType = getActivityType(process.env.BOT_ACTIVITY_TYPE);
  const activityName = process.env.BOT_ACTIVITY_NAME;
  const activityUrl = process.env.BOT_ACTIVITY_URL;

  if (process.env.BOT_ACTIVITY_TYPE && activityType === undefined) {
    console.log(
      `Invalid BOT_ACTIVITY_TYPE: ${process.env.BOT_ACTIVITY_TYPE}. Activity not set.`
    );
  } else if (!!process.env.BOT_ACTIVITY_TYPE !== !!activityName) {
    console.log(
      'Both BOT_ACTIVITY_TYPE and BOT_ACTIVITY_NAME must be set to enable an activity.'
    );
  }

  if (activityType !== undefined && activityName) {
    // Discord requires a URL for streaming activities
    if (activityType === ActivityType.Streaming && !activityUrl) {
      console.log(
        'Streaming activity requires BOT_ACTIVITY_URL. Activity not set.'
      );
      client.user?.setPresence({ status });
    } else {
      const activity: { name: string; type: ActivityType; url?: string } = {
        name: activityName,
        type: activityType,
      };
      if (activityType === ActivityType.Streaming && activityUrl) {
        activity.url = activityUrl;
      }
      client.user?.setPresence({ status, activities: [activity] });
    }
  } else {
    client.user?.setPresence({ status });
  }
  console.log(`Bot status set to: ${status}`);
}

function getActivityType(type: string | undefined): ActivityType | undefined {
  switch (type?.toLowerCase()) {
    case 'playing':
      return ActivityType.Playing;
    case 'streaming':
      return ActivityType.Streaming;
    case 'listening':
      return ActivityType.Listening;
    case 'watching':
      return ActivityType.Watching;
    case 'competing':
      return ActivityType.Competing;
    default:
      return undefined;
  }
}

await runMigrations(db);
console.log('Database migrations applied.');

client.login(process.env.DISCORD_BOT_TOKEN);
