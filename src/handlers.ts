import {
  ChatInputCommandInteraction,
  MessageFlags,
  PermissionFlagsBits,
} from 'discord.js';
import {
  createGroup,
  getGroupByName,
  getGroupMembers,
  addMemberToGroup,
  deleteGroup,
  updateGroupLastUsed,
  isMemberInGroup,
  removeMemberFromGroup,
} from './db';
import { isOnTimeout, setTimeout } from './timeouts';

/**
 * Create a new group.
 *
 * @param interaction The Discord command interaction.
 * @returns A promise that resolves when the reply has been sent.
 */
export async function handleCreate(
  interaction: ChatInputCommandInteraction
): Promise<void> {
  // Check if the user is on a timeout before allowing them to create a group
  const timeout = isOnTimeout(interaction.user.id, 'create');
  if (timeout.onTimeout) {
    await interaction.reply({
      content: `❌ You must wait ${timeout.remainingSeconds} seconds before creating another group.`,
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  // Get the group name from user input
  const groupName = interaction.options.getString('name', true);

  // Check if a group with this name already exists
  const existingGroup = await getGroupByName(groupName, interaction.guildId!);
  if (existingGroup) {
    await interaction.reply({
      content: '❌ A group with this name already exists!',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  // Create the group and add the user as the first member
  const group = await createGroup(
    groupName,
    interaction.guildId!,
    interaction.user.id
  );
  if (!group) {
    await interaction.reply({
      content: '❌ Failed to create group!',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  // Set a timeout to prevent spamming group creation
  setTimeout(interaction.user.id, 'create');

  await interaction.reply(
    `✅ Created group **${groupName}** with ${interaction.user} as the first member!`
  );
}

/**
 * Join an existing group.
 *
 * @param interaction The Discord command interaction.
 * @returns A promise that resolves when the reply has been sent.
 */
export async function handleJoin(
  interaction: ChatInputCommandInteraction
): Promise<void> {
  const groupName = interaction.options.getString('name', true);
  const group = await getGroupByName(groupName, interaction.guildId!);

  // Check if the group exists
  if (!group) {
    await interaction.reply({
      content: "❌ This group doesn't exist!",
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  // Check if the user is already a member of the group
  if (await isMemberInGroup(group.id, interaction.user.id)) {
    await interaction.reply({
      content: "❌ You're already in this group!",
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  // Add the user to the group
  const success = await addMemberToGroup(group.id, interaction.user.id);
  if (!success) {
    await interaction.reply({
      content: '❌ Failed to join group!',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  await interaction.reply(
    `✅ ${interaction.user} joined group **${groupName}**!`
  );
}

/**
 * Leave a group.
 *
 * @param interaction The Discord command interaction.
 * @returns A promise that resolves when the reply has been sent.
 */
export async function handleLeave(
  interaction: ChatInputCommandInteraction
): Promise<void> {
  const groupName = interaction.options.getString('name', true);
  const group = await getGroupByName(groupName, interaction.guildId!);

  // Check if the group exists
  if (!group) {
    await interaction.reply({
      content: "❌ This group doesn't exist!",
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  // Check if the user is a member of the group
  if (!(await isMemberInGroup(group.id, interaction.user.id))) {
    await interaction.reply({
      content: "❌ You're not a member of this group!",
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  // Get current members before removing the user
  const currentMembers = await getGroupMembers(group.id);

  // Remove the user from the group
  const success = await removeMemberFromGroup(group.id, interaction.user.id);
  if (!success) {
    await interaction.reply({
      content: '❌ Failed to leave group!',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  // If the last member left, delete the group
  if (currentMembers.length === 1) {
    await deleteGroup(group.id);
    await interaction.reply(
      `✅ ${interaction.user} left and group **${groupName}** was deleted as it has no more members!`
    );
    return;
  }

  await interaction.reply(
    `✅ ${interaction.user} left group **${groupName}**!`
  );
}

/**
 * Ping all members of a group.
 *
 * @param interaction The Discord command interaction.
 * @returns A promise that resolves when the reply has been sent.
 */
export async function handlePing(
  interaction: ChatInputCommandInteraction
): Promise<void> {
  // Check if the user is on a timeout before allowing another ping
  const timeout = isOnTimeout(interaction.user.id, 'ping');
  if (timeout.onTimeout) {
    await interaction.reply({
      content: `❌ You must wait ${timeout.remainingSeconds} seconds before pinging another group.`,
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const groupName = interaction.options.getString('name', true);
  const message = interaction.options.getString('message');
  const group = await getGroupByName(groupName, interaction.guildId!);

  // Check if the group exists
  if (!group) {
    await interaction.reply({
      content: "❌ This group doesn't exist!",
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  // Update last used timestamp for the group
  await updateGroupLastUsed(group.id);

  // Get all group members and format them into a list of @mentions
  const memberIds = await getGroupMembers(group.id);
  const mentions = memberIds.map((id) => `<@${id}>`).join(' ');

  // Set a timeout to prevent spamming pings
  setTimeout(interaction.user.id, 'ping');

  // Send the ping message
  const response = `🔔 **Group ${groupName} Alert!** 🔔\n${mentions}\n${
    message ? `\n${message}` : ''
  }`;
  await interaction.reply(response);
}

/**
 * Delete a group (server administrators only).
 *
 * @param interaction The Discord command interaction.
 * @returns A promise that resolves when the reply has been sent.
 */
export async function handleDelete(
  interaction: ChatInputCommandInteraction
): Promise<void> {
  // Only server administrators can use this command
  const isAdmin = interaction.memberPermissions?.has(
    PermissionFlagsBits.Administrator
  );
  if (!isAdmin) {
    await interaction.reply({
      content: '❌ Only server administrators can forcefully delete groups!',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const groupName = interaction.options.getString('name', true);
  const group = await getGroupByName(groupName, interaction.guildId!);

  // Check if the group exists
  if (!group) {
    await interaction.reply({
      content: "❌ This group doesn't exist!",
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  // Delete the group from the database
  const success = await deleteGroup(group.id);
  if (!success) {
    await interaction.reply({
      content: '❌ Failed to delete group!',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  await interaction.reply(
    `✅ Administrator ${interaction.user} deleted group **${groupName}**!`
  );
}
