import {
  Collection,
  MessageFlags,
  type ChatInputCommandInteraction,
} from 'discord.js';

export interface RecordedReply {
  kind: 'reply' | 'deferReply' | 'editReply' | 'followUp';
  content: string | undefined;
  ephemeral: boolean;
  allowedMentions: unknown;
}

export interface MockInteractionOptions {
  options?: Record<string, string | null>;
  userId?: string;
  guildId?: string;
  /** Ids resolvable via guild.members.fetch. Omit to resolve every id. */
  guildMemberIds?: string[];
  isAdmin?: boolean;
}

export interface MockInteraction {
  interaction: ChatInputCommandInteraction<'cached'>;
  replies: RecordedReply[];
  fetchCalls: string[][];
}

export function createMockInteraction(
  opts: MockInteractionOptions = {}
): MockInteraction {
  const {
    options = {},
    userId = 'user-1',
    guildId = 'guild-1',
    guildMemberIds,
    isAdmin = false,
  } = opts;

  const replies: RecordedReply[] = [];
  const fetchCalls: string[][] = [];
  const memberSet =
    guildMemberIds === undefined ? undefined : new Set(guildMemberIds);

  const record = (
    kind: RecordedReply['kind'],
    payload: string | { content?: string; flags?: number; allowedMentions?: unknown } | undefined
  ) => {
    if (typeof payload === 'string') {
      replies.push({
        kind,
        content: payload,
        ephemeral: false,
        allowedMentions: undefined,
      });
    } else {
      replies.push({
        kind,
        content: payload?.content,
        ephemeral:
          ((payload?.flags ?? 0) & Number(MessageFlags.Ephemeral)) !== 0,
        allowedMentions: payload?.allowedMentions,
      });
    }
  };

  const interaction = {
    user: { id: userId, toString: () => `<@${userId}>` },
    guildId,
    memberPermissions: { has: () => isAdmin },
    deferred: false,
    replied: false,
    inCachedGuild: () => true,
    guild: {
      id: guildId,
      members: {
        fetch: async (query: { user: string[] }) => {
          fetchCalls.push(query.user);
          const found = new Collection<string, unknown>();
          for (const id of query.user) {
            if (memberSet === undefined || memberSet.has(id)) {
              found.set(id, { id, user: { id, username: `user-${id}` } });
            }
          }
          return found;
        },
      },
    },
    options: {
      getString: (name: string, required?: boolean) => {
        const value = options[name] ?? null;
        if (required && value === null) {
          throw new Error(`Missing required option: ${name}`);
        }
        return value;
      },
    },
    reply: async (payload: never) => {
      record('reply', payload);
      interaction.replied = true;
    },
    deferReply: async (payload: never) => {
      record('deferReply', payload);
      interaction.deferred = true;
    },
    editReply: async (payload: never) => {
      record('editReply', payload);
    },
    followUp: async (payload: never) => {
      record('followUp', payload);
    },
  };

  return {
    interaction: interaction as unknown as ChatInputCommandInteraction<'cached'>,
    replies,
    fetchCalls,
  };
}
