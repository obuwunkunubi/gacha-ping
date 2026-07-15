export type CooldownCommand = 'create' | 'ping';

/** A duration of 0 disables the cooldown entirely. */
export function parseCooldownSeconds(
  raw: string | undefined,
  fallback: number
): number {
  const parsed = Number.parseInt(raw ?? '', 10);
  return Number.isNaN(parsed) || parsed < 0 ? fallback : parsed;
}

export function createCooldowns(durations: Record<CooldownCommand, number>) {
  const lastUsed = new Map<string, number>();

  return {
    check(
      userId: string,
      command: CooldownCommand
    ): { onCooldown: boolean; remainingSeconds: number } {
      const key = `${userId}-${command}`;
      const last = lastUsed.get(key);
      if (last === undefined) {
        return { onCooldown: false, remainingSeconds: 0 };
      }

      const elapsed = (Date.now() - last) / 1000;
      const remainingSeconds = Math.ceil(durations[command] - elapsed);
      if (remainingSeconds <= 0) {
        lastUsed.delete(key);
        return { onCooldown: false, remainingSeconds: 0 };
      }
      return { onCooldown: true, remainingSeconds };
    },

    start(userId: string, command: CooldownCommand): void {
      if (durations[command] <= 0) return;
      lastUsed.set(`${userId}-${command}`, Date.now());
    },
  };
}

export type Cooldowns = ReturnType<typeof createCooldowns>;
