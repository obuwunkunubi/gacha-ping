import { SlashCommandBuilder } from 'discord.js';

/**
 * Defines the available slash commands for the bot.
 * This array contains all command definitions that will be registered with Discord.
 */
export const commands = [
  /**
   * Command to create a new group.
   * Users can create a group with a unique name, and they'll automatically be added as the first member.
   */
  new SlashCommandBuilder()
    .setName('create')
    .setDescription('Create a new group')
    .addStringOption((option) =>
      option
        .setName('name')
        .setDescription('The name of the group')
        .setRequired(true)
    )
    .toJSON(),

  /**
   * Command to join an existing group.
   * Users can join a group if they aren't already a member.
   */
  new SlashCommandBuilder()
    .setName('join')
    .setDescription('Join an existing group')
    .addStringOption((option) =>
      option
        .setName('name')
        .setDescription('The name of the group')
        .setRequired(true)
        .setAutocomplete(true)
    )
    .toJSON(),

  /**
   * Command to leave a group.
   * If the last member leaves, the group will be automatically deleted.
   */
  new SlashCommandBuilder()
    .setName('leave')
    .setDescription('Leave a group')
    .addStringOption((option) =>
      option
        .setName('name')
        .setDescription('The name of the group')
        .setRequired(true)
        .setAutocomplete(true)
    )
    .toJSON(),

  /**
   * Command to list all available groups in the server.
   * Shows a formatted list of all groups.
   */
  new SlashCommandBuilder()
    .setName('list')
    .setDescription('List all available groups in the server')
    .toJSON(),

  /**
   * Command to list all members in a specific group.
   * Shows a list of users in the group without pinging them.
   */
  new SlashCommandBuilder()
    .setName('members')
    .setDescription('List all members in a group without pinging them')
    .addStringOption((option) =>
      option
        .setName('name')
        .setDescription('The name of the group')
        .setRequired(true)
        .setAutocomplete(true)
    )
    .toJSON(),

  /**
   * Command to ping all members of a group.
   * Users can include an optional message with the ping notification.
   */
  new SlashCommandBuilder()
    .setName('ping')
    .setDescription('Ping all members of a group')
    .addStringOption((option) =>
      option
        .setName('name')
        .setDescription('The name of the group')
        .setRequired(true)
        .setAutocomplete(true)
    )
    .addStringOption((option) =>
      option
        .setName('message')
        .setDescription('Optional message to send with the ping')
    )
    .toJSON(),

  /**
   * Command to delete a group (restricted to server administrators).
   * This allows for forced deletion of any group, regardless of membership.
   */
  new SlashCommandBuilder()
    .setName('delete')
    .setDescription('Force delete a group (server administrators only)')
    .addStringOption((option) =>
      option
        .setName('name')
        .setDescription('The name of the group')
        .setRequired(true)
        .setAutocomplete(true)
    )
    .toJSON(),
];
