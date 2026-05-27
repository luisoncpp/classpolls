export interface DbContext {
  db: D1Database;
}

export async function resetClient(): Promise<void> {
  return Promise.resolve();
}
