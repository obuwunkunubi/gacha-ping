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
  removeMemberAndDeleteGroupIfEmpty,
  getGuildGroupsWithCounts,
  isUniqueViolation,
  type Db,
} from './db';
import { validateGroupName } from './validation';
import { isOnTimeout, setTimeout } from './timeouts';

export async function handleCreate(
  db: Db,
  interaction: ChatInputCommandInteraction
): Promise<void> {
  const timeout = isOnTimeout(interaction.user.id, 'create');
  if (timeout.onTimeout) {
    await interaction.reply({
      content: `❌ You must wait ${timeout.remainingSeconds} seconds before creating another group.`,
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const groupName = interaction.options.getString('name', true).trim();

  const validation = validateGroupName(groupName);
  if (!validation.valid) {
    await interaction.reply({
      content: `❌ ${validation.reason}`,
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  // No existence pre-check: the unique index is the source of truth, so a
  // concurrent create can't slip past it.
  try {
    await createGroup(db, groupName, interaction.guildId!, interaction.user.id);
  } catch (error) {
    if (isUniqueViolation(error)) {
      await interaction.reply({
        content: '❌ A group with this name already exists!',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }
    throw error;
  }

  setTimeout(interaction.user.id, 'create');

  await interaction.reply(
    `✅ Created group **${groupName}** with ${interaction.user} as the first member!`
  );
}

export async function handleJoin(
  db: Db,
  interaction: ChatInputCommandInteraction
): Promise<void> {
  const groupName = interaction.options.getString('name', true);
  const group = await getGroupByName(db, groupName, interaction.guildId!);

  if (!group) {
    await interaction.reply({
      content: "❌ This group doesn't exist!",
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  if (await isMemberInGroup(db, group.id, interaction.user.id)) {
    await interaction.reply({
      content: "❌ You're already in this group!",
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  await addMemberToGroup(db, group.id, interaction.user.id);

  await interaction.reply(
    `✅ ${interaction.user} joined group **${group.name}**!`
  );
}

export async function handleLeave(
  db: Db,
  interaction: ChatInputCommandInteraction
): Promise<void> {
  const groupName = interaction.options.getString('name', true);
  const group = await getGroupByName(db, groupName, interaction.guildId!);

  if (!group) {
    await interaction.reply({
      content: "❌ This group doesn't exist!",
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  if (!(await isMemberInGroup(db, group.id, interaction.user.id))) {
    await interaction.reply({
      content: "❌ You're not a member of this group!",
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const { groupDeleted } = await removeMemberAndDeleteGroupIfEmpty(
    db,
    group.id,
    interaction.user.id
  );

  if (groupDeleted) {
    await interaction.reply(
      `✅ ${interaction.user} left and group **${group.name}** was deleted as it has no more members!`
    );
    return;
  }

  await interaction.reply(
    `✅ ${interaction.user} left group **${group.name}**!`
  );
}

export async function handleList(
  db: Db,
  interaction: ChatInputCommandInteraction
): Promise<void> {
  const groups = await getGuildGroupsWithCounts(db, interaction.guildId!);

  if (groups.length === 0) {
    await interaction.reply({
      content: '❌ There are no groups in this server yet!',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const groupList = groups.map(
    (group) =>
      `• **${group.name}** (${group.memberCount} member${group.memberCount !== 1 ? 's' : ''})`
  );

  await interaction.reply({
    content: `**Available Groups**:\n${groupList.join('\n')}`,
    flags: MessageFlags.Ephemeral,
  });
}

export async function handleMembers(
  db: Db,
  interaction: ChatInputCommandInteraction
): Promise<void> {
  const groupName = interaction.options.getString('name', true);
  const group = await getGroupByName(db, groupName, interaction.guildId!);

  if (!group) {
    await interaction.reply({
      content: "❌ This group doesn't exist!",
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const memberIds = await getGroupMembers(db, group.id);

  if (memberIds.length === 0) {
    await interaction.reply({
      content: `❌ Group **${group.name}** has no members!`,
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const members = [];
  for (const userId of memberIds) {
    try {
      const member = await interaction.guild?.members.fetch(userId);
      if (member) {
        members.push(member);
      }
    } catch (error) {
      console.error(`Failed to fetch member ${userId}:`, error);
    }
  }

  members.sort((a, b) => a.user.username.localeCompare(b.user.username));

  let content: string;
  if (members.length <= 20) {
    content =
      `**Members in ${group.name}**:\n` +
      members.map((m) => `• ${m.user.username}`).join('\n');
  } else {
    content =
      `**Members in ${group.name}**:\n` +
      members.map((m) => m.user.username).join(', ');
  }

  await interaction.reply({
    content,
    flags: MessageFlags.Ephemeral,
  });
}

export async function handlePing(
  db: Db,
  interaction: ChatInputCommandInteraction
): Promise<void> {
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
  const group = await getGroupByName(db, groupName, interaction.guildId!);

  if (!group) {
    await interaction.reply({
      content: "❌ This group doesn't exist!",
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  if (!(await isMemberInGroup(db, group.id, interaction.user.id))) {
    await interaction.reply({
      content: '❌ You must be a member of this group to ping it!',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  await updateGroupLastUsed(db, group.id);

  const memberIds = await getGroupMembers(db, group.id);
  const members = [];

  for (const id of memberIds) {
    try {
      const member = await interaction.guild?.members.fetch(id);
      if (member) {
        members.push({ id: member.id, username: member.user.username });
      }
    } catch (error) {
      console.error(`Failed to fetch member ${id}:`, error);
    }
  }

  members.sort((a, b) => a.username.localeCompare(b.username));

  const mentions = members.map((m) => `<@${m.id}>`).join(' ');

  setTimeout(interaction.user.id, 'ping');

  const response = `🔔 **Group ${group.name} Alert!** 🔔\n${mentions}\n${message ? `\n${message}` : ''}`;
  await interaction.reply(response);
}

export async function handleDelete(
  db: Db,
  interaction: ChatInputCommandInteraction
): Promise<void> {
  if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
    await interaction.reply({
      content: '❌ Only server administrators can use this command!',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const groupName = interaction.options.getString('name', true);
  const group = await getGroupByName(db, groupName, interaction.guildId!);

  if (!group) {
    await interaction.reply({
      content: "❌ This group doesn't exist!",
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  await deleteGroup(db, group.id);

  await interaction.reply(`✅ Group **${group.name}** has been deleted!`);
}
