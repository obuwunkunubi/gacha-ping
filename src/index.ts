import {
  Client,
  Events,
  GatewayIntentBits,
  REST,
  Routes,
  MessageFlags,
  PermissionFlagsBits,
  ActivityType,
} from 'discord.js';
import { getGuildGroups, getUserGuildGroups } from './db';
import type { Group } from './db/schema';
import { commands } from './commands';
import {
  handleCreate,
  handleJoin,
  handleLeave,
  handleList,
  handleMembers,
  handlePing,
  handleDelete,
} from './handlers';

/**
 * Initialize the Discord client with the necessary intents.
 */
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMembers,
  ],
});

/**
 * Initialize the REST client with the bot token.
 */
const rest = new REST().setToken(process.env.DISCORD_BOT_TOKEN!);

/**
 * Event listener for when the bot is ready.
 * Sets up presence status and activity, registers slash commands, and generates an invite link.
 *
 * @param readyClient The Discord client instance that is ready.
 */
client.once(Events.ClientReady, async (readyClient) => {
  console.log(`Logged in as ${readyClient.user.tag}`);

  // Set bot's status and activity based on environment variables if provided
  const presenceStatus = (process.env.BOT_STATUS || 'online') as 'online' | 'idle' | 'dnd' | 'invisible';
  const activityType = process.env.BOT_ACTIVITY_TYPE;
  const activityName = process.env.BOT_ACTIVITY_NAME;
  const activityUrl = process.env.BOT_ACTIVITY_URL;

  // Both activity type and name must be provided in order to set an activity
  if (activityType && activityName) {
    const type = getActivityType(activityType);

    if (type !== undefined) {
      // Check if activity is streaming, but URL is not provided
      if (type === ActivityType.Streaming && !activityUrl) {
        // Fall back to just setting status without activity
        console.log(`Streaming activity requires a URL but none was provided. Activity not set.`);
        console.log(`Bot status set to: ${presenceStatus}`);
        client.user?.setPresence({ status: presenceStatus });
      } else {
        // Create activity object
        const activity: { name: string; type: ActivityType; url?: string } = {
          name: activityName,
          type: type
        };

        // Add URL if streaming and URL is provided
        if (type === ActivityType.Streaming && activityUrl) {
          activity.url = activityUrl;
        }

        // Set the presence with the activity
        client.user?.setPresence({
          status: presenceStatus,
          activities: [activity]
        });

        const preposition = activityType === 'listening' ? 'to' : activityType === 'competing' ? 'in' : '';
        console.log(`Bot status set to: ${presenceStatus} | ${activityType} ${preposition ? preposition + ' ' : ''}${activityName}${activityUrl ? ` | URL: ${activityUrl}` : ''}`);
      }
    } else {
      // Invalid activity type provided
      console.log(`Invalid BOT_ACTIVITY_TYPE provided: ${activityType}. Activity not set.`);
      console.log(`Bot status set to: ${presenceStatus}`);
      client.user?.setPresence({ status: presenceStatus });
    }
  } else {
    // No activity provided, only set status
    if (activityType && !activityName || !activityType && activityName) {
      console.log(`Both BOT_ACTIVITY_TYPE and BOT_ACTIVITY_NAME must be provided to set an activity.`)
    }
    client.user?.setPresence({ status: presenceStatus });
    console.log(`Bot status set to: ${presenceStatus} | No activity set.`);
  }

  // Generate bot invite link and write to console
  const inviteLink = `https://discord.com/api/oauth2/authorize?client_id=${readyClient.user.id}&permissions=2048&scope=bot%20applications.commands`;
  console.log('Add bot to server:', inviteLink);

  try {
    // Fetch existing commands
    const existingCommands = (await rest.get(
      Routes.applicationCommands(readyClient.user.id)
    )) as Array<{ name: string; description: string }>;

    // Check if commands need to be updated
    const needsUpdate =
      commands.length !== existingCommands.length ||
      commands.some((cmd) => {
        const existingCmd = existingCommands.find((c) => c.name === cmd.name);
        return !existingCmd || existingCmd.description !== cmd.description;
      });

    if (needsUpdate) {
      console.log('Updating application commands...');
      await rest.put(Routes.applicationCommands(readyClient.user.id), {
        body: commands,
      });
      console.log('Successfully updated application commands.');
    } else {
      console.log('Commands are up to date.');
    }
  } catch (error) {
    console.error('Error managing slash commands:', error);
  }
});

/**
 * Event listener for when an interaction is created.
 * Handles both slash commands and autocomplete interactions.
 *
 * @param interaction The Discord interaction object.
 */
client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isChatInputCommand() && !interaction.isAutocomplete())
    return;

  /**
   * Handle autocomplete for group names by filtering groups
   * that match the user's input.
   */
  if (interaction.isAutocomplete()) {
    const focusedValue = interaction.options.getFocused().toString();
    const commandName = interaction.commandName;

    let groups: Group[];

    if (commandName === 'join') {
      // For join command, get all guild groups
      groups = await getGuildGroups(interaction.guildId!);

      // Filter out groups the user is already in (users need to see groups they're not in)
      if (groups.length > 0) {
        const userGroups = await getUserGuildGroups(
          interaction.guildId!,
          interaction.user.id
        );
        const userGroupIds = userGroups.map((g) => g.id);
        groups = groups.filter((g) => !userGroupIds.includes(g.id));
      }
    } else if (
      commandName === 'delete' &&
      !interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)
    ) {
      // For delete command (if not admin), show no groups
      groups = [];
    } else if (commandName === 'ping' || commandName === 'leave') {
      // For ping and leave commands, show only groups the user is in
      groups = await getUserGuildGroups(
        interaction.guildId!,
        interaction.user.id
      );
    } else {
      // For any other command, show all groups
      groups = await getGuildGroups(interaction.guildId!);
    }

    // Filter groups based on the focused value (autocomplete search)
    const filtered = groups
      .filter((g) =>
        g.name.toLowerCase().startsWith(focusedValue.toLowerCase())
      )
      .map((g) => ({ name: g.name, value: g.name }));

    // Send the filtered results to autocomplete response
    await interaction.respond(filtered);
    return;
  }

  /**
   * Route the received slash command to the appropriate handler function.
   */
  try {
    switch (interaction.commandName) {
      case 'create':
        await handleCreate(interaction);
        break;
      case 'join':
        await handleJoin(interaction);
        break;
      case 'leave':
        await handleLeave(interaction);
        break;
      case 'list':
        await handleList(interaction);
        break;
      case 'members':
        await handleMembers(interaction);
        break;
      case 'ping':
        await handlePing(interaction);
        break;
      case 'delete':
        await handleDelete(interaction);
        break;
    }
  } catch (error) {
    console.error(`Error handling command ${interaction.commandName}:`, error);
    await interaction
      .reply({
        content:
          '❌ An unexpected error occurred while processing your command.',
        flags: MessageFlags.Ephemeral,
      })
      .catch(() => { });
  }
});

/**
 * Converts a string activity type to the corresponding Discord.js ActivityType enum value.
 * 
 * @param type The activity type string ('playing', 'watching', etc.)
 * @returns The corresponding ActivityType enum value
 */
function getActivityType(type: string | undefined): ActivityType | undefined {
  switch (type?.toLowerCase()) {
    case 'playing': return ActivityType.Playing;
    case 'streaming': return ActivityType.Streaming;
    case 'listening': return ActivityType.Listening;
    case 'watching': return ActivityType.Watching;
    case 'competing': return ActivityType.Competing;
    default:
      return undefined;
  }
}

/**
 * Login to Discord using the bot token.
 */
client.login(process.env.DISCORD_BOT_TOKEN);
