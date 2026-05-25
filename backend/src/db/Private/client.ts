import { EventEmitter, setMaxListeners } from 'node:events';
import { Db, MongoClient } from 'mongodb';

export interface DbContext {
  database: string;
  noCache?: boolean;
  uri: string;
}

let state: { client: MongoClient } | null = null;

// The Mongo driver adds many timeout listeners in Workers local dev.
// This warning is noisy in Miniflare and does not indicate a leak by itself.
EventEmitter.defaultMaxListeners = 100;
setMaxListeners(100);

function createClient(uri: string): MongoClient {
  return new MongoClient(uri, {
    connectTimeoutMS: 5000,
    maxIdleTimeMS: 30000,
    serverSelectionTimeoutMS: 5000,
    socketTimeoutMS: 5000,
  });
}

async function getClient(ctx: DbContext): Promise<MongoClient> {
  if (ctx.noCache) {
    const client = createClient(ctx.uri);
    await client.connect();
    return client;
  }
  if (state) return state.client;
  const client = createClient(ctx.uri);
  try {
    await client.connect();
    state = { client };
    return client;
  } catch (err) {
    await client.close().catch(() => {});
    throw err;
  }
}

export async function getDatabase(ctx: DbContext): Promise<Db> {
  return (await getClient(ctx)).db(ctx.database);
}

export async function withDatabase<T>(ctx: DbContext, work: (db: Db) => Promise<T>): Promise<T> {
  const client = await getClient(ctx);
  try {
    return await work(client.db(ctx.database));
  } finally {
    if (ctx.noCache) {
      await client.close().catch(() => {});
    }
  }
}

export async function resetClient(): Promise<void> {
  const client = state?.client;
  state = null;
  await client?.close().catch(() => {});
}
