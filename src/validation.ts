export function validateGroupName(name: string): {
  valid: boolean;
  reason?: string;
} {
  if (name.length < 2 || name.length > 32) {
    return {
      valid: false,
      reason: 'Group name must be between 2 and 32 characters long',
    };
  }

  if (!/^[a-zA-Z0-9\s\-_]+$/.test(name)) {
    return {
      valid: false,
      reason:
        'Group name can only contain letters, numbers, spaces, hyphens, and underscores',
    };
  }

  return { valid: true };
}
