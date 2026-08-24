import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema/index";

export type Db = ReturnType<typeof createDb>;

export function createDb(connectionString: string) {
  const client = postgres(connectionString, { prepare: false, max: 10 });
  return drizzle(client, { schema });
}

let cached: Db | null = null;

/** Singleton for serverless / Next.js — uses DATABASE_URL. */
export function getDb(): Db {
  if (cached) return cached;
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL is not set");
  }
  cached = createDb(url);
  return cached;
}

export { schema };
