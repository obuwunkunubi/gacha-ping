import {
  Client,
  Events,
  GatewayIntentBits,
  REST,
  Routes,
  MessageFlags,
} from 'discord.js';
import { getGuildGroups } from './db';
import { commands } from './commands';
import {
  handleCreate,
  handleJoin,
  handlePing,
  handleDelete,
  handleLeave,
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
 * Event listener for when the client is ready.
 * Sets up slash commands and generates an invite link.
 *
 * @param readyClient The Discord client that's ready.
 */
client.once(Events.ClientReady, async (readyClient) => {
  console.log(`Logged in as ${readyClient.user.tag}`);

  // Generate bot invite link and write to console
  const inviteLink = `https://discord.com/api/oauth2/authorize?client_id=${readyClient.user.id}&permissions=2048&scope=bot%20applications.commands`;
  console.log('Add to server:', inviteLink);

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
    const groups = await getGuildGroups(interaction.guildId!);
    const filtered = groups
      .filter((g) => g.name.startsWith(focusedValue))
      .map((g) => ({ name: g.name, value: g.name }));

    await interaction.respond(filtered);
    return;
  }

  /**
   * Handle slash commands by routing to the appropriate handler function.
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
      .catch(() => {});
  }
});

/**
 * Login to Discord using the bot token.
 */
client.login(process.env.DISCORD_BOT_TOKEN);
