export function envToEntries(env: Record<string, string>): [string, string][] {
  return Object.entries(env).sort((a, b) => a[0].localeCompare(b[0]));
}

export function entriesToEnv(entries: [string, string][]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of entries) {
    if (k.trim() !== "") out[k.trim()] = v;
  }
  return out;
}
