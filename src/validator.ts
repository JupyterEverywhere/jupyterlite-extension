export function hasRequiredKeys<T extends object, K extends keyof T>(
  value: unknown,
  keys: K[]
): value is T {
  if (!value || typeof value !== 'object' || value === null) {
    return false;
  }

  return keys.every(key => key in value);
}
