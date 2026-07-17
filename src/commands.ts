import {
  InteractionContextType,
  PermissionFlagsBits,
  SlashCommandBuilder,
} from 'discord.js';

// Name length limits match validateGroupName so Discord rejects most bad
// input before it ever reaches a handler.

export const commands = [
  new SlashCommandBuilder()
    .setName('create')
    .setDescription('Create a new group')
    .setContexts(InteractionContextType.Guild)
    .addStringOption((option) =>
      option
        .setName('name')
        .setDescription('The name of the group')
        .setRequired(true)
        .setMinLength(2)
        .setMaxLength(32)
    )
    .toJSON(),

  new SlashCommandBuilder()
    .setName('join')
    .setDescription('Join an existing group')
    .setContexts(InteractionContextType.Guild)
    .addStringOption((option) =>
      option
        .setName('name')
        .setDescription('The name of the group')
        .setRequired(true)
        .setMaxLength(32)
        .setAutocomplete(true)
    )
    .toJSON(),

  new SlashCommandBuilder()
    .setName('leave')
    .setDescription('Leave a group')
    .setContexts(InteractionContextType.Guild)
    .addStringOption((option) =>
      option
        .setName('name')
        .setDescription('The name of the group')
        .setRequired(true)
        .setMaxLength(32)
        .setAutocomplete(true)
    )
    .toJSON(),

  new SlashCommandBuilder()
    .setName('list')
    .setDescription('List all available groups in the server')
    .setContexts(InteractionContextType.Guild)
    .toJSON(),

  new SlashCommandBuilder()
    .setName('mygroups')
    .setDescription("List the groups you're a member of")
    .setContexts(InteractionContextType.Guild)
    .toJSON(),

  new SlashCommandBuilder()
    .setName('members')
    .setDescription('List all members in a group without pinging them')
    .setContexts(InteractionContextType.Guild)
    .addStringOption((option) =>
      option
        .setName('name')
        .setDescription('The name of the group')
        .setRequired(true)
        .setMaxLength(32)
        .setAutocomplete(true)
    )
    .toJSON(),

  new SlashCommandBuilder()
    .setName('ping')
    .setDescription('Ping all members of a group')
    .setContexts(InteractionContextType.Guild)
    .addStringOption((option) =>
      option
        .setName('name')
        .setDescription('The name of the group')
        .setRequired(true)
        .setMaxLength(32)
        .setAutocomplete(true)
    )
    .addStringOption((option) =>
      option
        .setName('message')
        .setDescription('Optional message to send with the ping')
        .setMaxLength(1500)
    )
    .toJSON(),

  new SlashCommandBuilder()
    .setName('rename')
    .setDescription('Rename a group (its creator or a server administrator)')
    .setContexts(InteractionContextType.Guild)
    .addStringOption((option) =>
      option
        .setName('name')
        .setDescription('The current name of the group')
        .setRequired(true)
        .setMaxLength(32)
        .setAutocomplete(true)
    )
    .addStringOption((option) =>
      option
        .setName('newname')
        .setDescription('The new name for the group')
        .setRequired(true)
        .setMinLength(2)
        .setMaxLength(32)
    )
    .toJSON(),

  new SlashCommandBuilder()
    .setName('delete')
    .setDescription('Force delete a group (server administrators only)')
    .setContexts(InteractionContextType.Guild)
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addStringOption((option) =>
      option
        .setName('name')
        .setDescription('The name of the group')
        .setRequired(true)
        .setMaxLength(32)
        .setAutocomplete(true)
    )
    .toJSON(),
];
