import {
  Collection,
  MessageFlags,
  PermissionFlagsBits,
  type ChatInputCommandInteraction,
  type Guild,
  type GuildMember,
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
import type { Cooldowns } from './cooldowns';

export interface BotContext {
  db: Db;
  cooldowns: Cooldowns;
}

type GuildInteraction = ChatInputCommandInteraction<'cached'>;

const MAX_MESSAGE_LENGTH = 2000;

/**
 * Bulk-fetches guild members by id. The gateway allows at most 100 ids per
 * request; ids no longer in the guild are simply absent from the result.
 */
async function fetchMembersByIds(
  guild: Guild,
  ids: string[]
): Promise<Collection<string, GuildMember>> {
  const result = new Collection<string, GuildMember>();
  for (let i = 0; i < ids.length; i += 100) {
    const fetched = await guild.members.fetch({ user: ids.slice(i, i + 100) });
    for (const [id, member] of fetched) {
      result.set(id, member);
    }
  }
  return result;
}

export async function handleCreate(
  { db, cooldowns }: BotContext,
  interaction: GuildInteraction
): Promise<void> {
  const cooldown = cooldowns.check(interaction.user.id, 'create');
  if (cooldown.onCooldown) {
    await interaction.reply({
      content: `❌ You must wait ${cooldown.remainingSeconds} seconds before creating another group.`,
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
    await createGroup(db, groupName, interaction.guildId, interaction.user.id);
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

  cooldowns.start(interaction.user.id, 'create');

  await interaction.reply(
    `✅ Created group **${groupName}** with ${interaction.user} as the first member!`
  );
}

export async function handleJoin(
  { db }: BotContext,
  interaction: GuildInteraction
): Promise<void> {
  const groupName = interaction.options.getString('name', true);
  const group = await getGroupByName(db, groupName, interaction.guildId);

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
  { db }: BotContext,
  interaction: GuildInteraction
): Promise<void> {
  const groupName = interaction.options.getString('name', true);
  const group = await getGroupByName(db, groupName, interaction.guildId);

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
  { db }: BotContext,
  interaction: GuildInteraction
): Promise<void> {
  const groups = await getGuildGroupsWithCounts(db, interaction.guildId);

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
  { db }: BotContext,
  interaction: GuildInteraction
): Promise<void> {
  const groupName = interaction.options.getString('name', true);
  const group = await getGroupByName(db, groupName, interaction.guildId);

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

  // Fetching members can outlast the 3-second interaction window.
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  const fetched = await fetchMembersByIds(interaction.guild, memberIds);
  const members = [...fetched.values()].sort((a, b) =>
    a.user.username.localeCompare(b.user.username)
  );

  if (members.length === 0) {
    await interaction.editReply(
      `❌ Group **${group.name}** has no members left on this server.`
    );
    return;
  }

  const names = members.map((m) => m.user.username);
  const content =
    `**Members in ${group.name}**:\n` +
    (names.length <= 20 ? names.map((n) => `• ${n}`).join('\n') : names.join(', '));

  await interaction.editReply(content);
}

export async function handlePing(
  { db, cooldowns }: BotContext,
  interaction: GuildInteraction
): Promise<void> {
  const cooldown = cooldowns.check(interaction.user.id, 'ping');
  if (cooldown.onCooldown) {
    await interaction.reply({
      content: `❌ You must wait ${cooldown.remainingSeconds} seconds before pinging another group.`,
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const groupName = interaction.options.getString('name', true);
  const message = interaction.options.getString('message');
  const group = await getGroupByName(db, groupName, interaction.guildId);

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

  await interaction.deferReply();

  const memberIds = await getGroupMembers(db, group.id);
  const fetched = await fetchMembersByIds(interaction.guild, memberIds);
  const members = [...fetched.values()].sort((a, b) =>
    a.user.username.localeCompare(b.user.username)
  );

  if (members.length === 0) {
    await interaction.editReply(
      `❌ Group **${group.name}** has no members left on this server.`
    );
    return;
  }

  // Only mark the group used and burn the cooldown once the ping actually
  // goes out.
  cooldowns.start(interaction.user.id, 'ping');
  await updateGroupLastUsed(db, group.id);

  const header = `🔔 **Group ${group.name} Alert!** 🔔`;
  const suffix = message ? `\n\n${message}` : '';

  // Mentions may not fit into one message; overflow goes into follow-ups.
  const chunks: string[] = [];
  let current = header;
  for (const member of members) {
    const mention = `<@${member.id}>`;
    if (current.length + 1 + mention.length > MAX_MESSAGE_LENGTH) {
      chunks.push(current);
      current = mention;
    } else {
      current += current === header ? `\n${mention}` : ` ${mention}`;
    }
  }
  if (current.length + suffix.length <= MAX_MESSAGE_LENGTH) {
    current += suffix;
    chunks.push(current);
  } else {
    chunks.push(current);
    chunks.push(suffix.trimStart());
  }

  const allowedMentions = { parse: ['users' as const] };
  await interaction.editReply({ content: chunks[0], allowedMentions });
  for (const chunk of chunks.slice(1)) {
    await interaction.followUp({ content: chunk, allowedMentions });
  }
}

export async function handleDelete(
  { db }: BotContext,
  interaction: GuildInteraction
): Promise<void> {
  if (!interaction.memberPermissions.has(PermissionFlagsBits.Administrator)) {
    await interaction.reply({
      content: '❌ Only server administrators can use this command!',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const groupName = interaction.options.getString('name', true);
  const group = await getGroupByName(db, groupName, interaction.guildId);

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
