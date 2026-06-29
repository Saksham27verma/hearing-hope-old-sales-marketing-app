export function formatDbError(e: unknown): string {
  const msg = e instanceof Error ? e.message : String(e);
  const lower = msg.toLowerCase();
  if (lower.includes('401') || lower.includes('unauthorized')) {
    return (
      'Turso auth failed (401). Create a database token (not org token): ' +
      '`turso db tokens create <your-database-name>` then set TURSO_AUTH_TOKEN in .env.local and restart the dev server.'
    );
  }
  if (lower.includes('fetch failed') || lower.includes('enotfound')) {
    return 'Cannot reach Turso. Check TURSO_DATABASE_URL and your network connection.';
  }
  return msg || 'Database error';
}
