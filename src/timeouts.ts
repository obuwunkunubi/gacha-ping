/**
 * Timeout management for user commands to prevent spam.
 * Timeout durations in seconds (fallback to default values if not set).
 */
const CREATE_TIMEOUT = parseInt(process.env.CREATE_TIMEOUT!) || 300; // 5 minutes default
const PING_TIMEOUT = parseInt(process.env.PING_TIMEOUT!) || 60;      // 1 minute default

/**
 * In-memory map to track user command timeouts.
 * Keys follow the format "userId-command".
 */
type TimeoutKey = `${string}-${string}`;
const userTimeouts = new Map<TimeoutKey, number>();

/**
 * Checks if a user is on a timeout for a specific command.
 *
 * @param userId The ID of the user.
 * @param command The command being checked.
 * @returns An object indicating if the user is on timeout and the remaining seconds.
 */
export function isOnTimeout(
  userId: string,
  command: string
): { onTimeout: boolean; remainingSeconds: number } {
  const key: TimeoutKey = `${userId}-${command}`;
  const lastUsed = userTimeouts.get(key);

  if (!lastUsed) {
    return { onTimeout: false, remainingSeconds: 0 }; // User not on timeout
  }

  const now = Date.now();
  const timeoutSeconds = command === 'create' ? CREATE_TIMEOUT : PING_TIMEOUT;
  const timePassed = (now - lastUsed) / 1000;
  const remainingSeconds = Math.ceil(timeoutSeconds - timePassed);

  if (remainingSeconds <= 0) {
    userTimeouts.delete(key); // Remove expired timeout
    return { onTimeout: false, remainingSeconds: 0 }; // User not on timeout
  }

  return { onTimeout: true, remainingSeconds }; // User is on timeout
}

/**
 * Sets a timeout for a specific user command.
 *
 * @param userId The ID of the user.
 * @param command The command to set the timeout for.
 */
export function setTimeout(userId: string, command: string): void {
  const key: TimeoutKey = `${userId}-${command}`;
  userTimeouts.set(key, Date.now());
}
