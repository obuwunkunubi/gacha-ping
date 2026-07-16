import { describe, expect, test } from 'bun:test';
import { makeTestDb } from '../helpers/db';
import { createMockInteraction } from '../helpers/interaction';
import { createCooldowns } from '../../src/cooldowns';
import { handlePing } from '../../src/handlers';
import {
  addMemberToGroup,
  createGroup,
  getGroupByName,
  type Db,
} from '../../src/db';

function makeCtx(db: Db, durations = { create: 300, ping: 60 }) {
  return { db, cooldowns: createCooldowns(durations) };
}

describe('handlePing', () => {
  test('rejects a missing group', async () => {
    const db = await makeTestDb();
    const { interaction, replies } = createMockInteraction({
      options: { name: 'ghost' },
    });

    await handlePing(makeCtx(db), interaction);

    expect(replies[0]?.content).toContain("doesn't exist");
    expect(replies[0]?.ephemeral).toBe(true);
  });

  test('rejects non-members', async () => {
    const db = await makeTestDb();
    await createGroup(db, 'raid', 'guild-1', 'u1');
    const { interaction, replies } = createMockInteraction({
      options: { name: 'raid' },
      userId: 'stranger',
    });

    await handlePing(makeCtx(db), interaction);

    expect(replies[0]?.content).toContain('must be a member');
    expect(replies[0]?.ephemeral).toBe(true);
  });

  test('defers, mentions every member, and restricts allowed mentions to users', async () => {
    const db = await makeTestDb();
    const group = await createGroup(db, 'raid', 'guild-1', 'u1');
    await addMemberToGroup(db, group.id, 'u2');
    const { interaction, replies } = createMockInteraction({
      options: { name: 'raid', message: 'we ball' },
      userId: 'u1',
    });

    await handlePing(makeCtx(db), interaction);

    expect(replies[0]?.kind).toBe('deferReply');
    const sent = replies[1];
    expect(sent?.kind).toBe('editReply');
    expect(sent?.content).toContain('<@u1>');
    expect(sent?.content).toContain('<@u2>');
    expect(sent?.content).toContain('we ball');
    expect(sent?.allowedMentions).toEqual({ parse: ['users'] });
  });

  test('updates lastUsed and starts the cooldown only after a successful ping', async () => {
    const db = await makeTestDb();
    const group = await createGroup(db, 'raid', 'guild-1', 'u1');
    const before = group.lastUsed;
    const ctx = makeCtx(db);

    // A rejected ping (not a member) must not burn the cooldown
    const rejected = createMockInteraction({
      options: { name: 'raid' },
      userId: 'stranger',
    });
    await handlePing(ctx, rejected.interaction);
    expect(ctx.cooldowns.check('stranger', 'ping').onCooldown).toBe(false);

    const ok = createMockInteraction({
      options: { name: 'raid' },
      userId: 'u1',
    });
    await handlePing(ctx, ok.interaction);

    expect(ctx.cooldowns.check('u1', 'ping').onCooldown).toBe(true);
    const after = await getGroupByName(db, 'raid', 'guild-1');
    expect(after!.lastUsed).toBeGreaterThanOrEqual(before);

    const blocked = createMockInteraction({
      options: { name: 'raid' },
      userId: 'u1',
    });
    await handlePing(ctx, blocked.interaction);
    expect(blocked.replies[0]?.content).toContain('must wait');
  });

  test('reports instead of pinging when every member left the server', async () => {
    const db = await makeTestDb();
    await createGroup(db, 'raid', 'guild-1', 'u1');
    const ctx = makeCtx(db);
    const { interaction, replies } = createMockInteraction({
      options: { name: 'raid' },
      userId: 'u1',
      guildMemberIds: [],
    });

    await handlePing(ctx, interaction);

    expect(replies[1]?.content).toContain('no members left');
    expect(replies[1]?.content).not.toContain('<@');
    // No ping went out, so no cooldown either
    expect(ctx.cooldowns.check('u1', 'ping').onCooldown).toBe(false);
    expect(await getGroupByName(db, 'raid', 'guild-1')).toBeUndefined();
  });

  test('splits mentions over follow-ups when they exceed the message limit', async () => {
    const db = await makeTestDb();
    // Long ids make each mention ~40 chars, so 100 members overflow 2000 chars
    const ids = Array.from(
      { length: 100 },
      (_, i) => `${String(i).padStart(3, '0')}${'0'.repeat(30)}`
    );
    const group = await createGroup(db, 'raid', 'guild-1', ids[0]!);
    for (const id of ids.slice(1)) {
      await addMemberToGroup(db, group.id, id);
    }
    const { interaction, replies } = createMockInteraction({
      options: { name: 'raid', message: 'big raid' },
      userId: ids[0]!,
    });

    await handlePing(makeCtx(db), interaction);

    const sent = replies.filter((r) => r.kind !== 'deferReply');
    expect(sent.length).toBeGreaterThan(1);
    for (const message of sent) {
      expect(message.content!.length).toBeLessThanOrEqual(2000);
    }
    const combined = sent.map((r) => r.content).join(' ');
    for (const id of ids) {
      expect(combined).toContain(`<@${id}>`);
    }
    expect(combined).toContain('big raid');
  });
});
