/**
 * Idempotent schema patches for research fields.
 * Neon often lags code deploys — run before project queries so missing columns self-heal.
 */
import { ensureDiscoveryColumns } from "@codexcap/db";
import { db } from "@/lib/db";

let ready: Promise<void> | null = null;

export function ensureSchemaReady(): Promise<void> {
  if (!ready) {
    ready = ensureDiscoveryColumns(db()).catch((err) => {
      ready = null;
      throw err;
    });
  }
  return ready;
}
