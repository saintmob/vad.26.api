export function createIdFragment() {
  const uuid = globalThis.crypto?.randomUUID?.();
  if (uuid) return uuid.replace(/-/g, "").slice(0, 12);
  return Math.random().toString(36).slice(2, 14);
}

