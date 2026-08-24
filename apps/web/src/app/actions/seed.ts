"use server";

import { revalidatePath } from "next/cache";
import { seedResearchProjects } from "@codexcap/db";
import { isAuthenticated } from "@/lib/auth";
import { ensureSchemaReady } from "@/lib/schema-ready";

export async function seedResearchAction() {
  if (!(await isAuthenticated())) throw new Error("Unauthorized — unlock with ADMIN_KEY first");
  await ensureSchemaReady();
  const result = await seedResearchProjects();
  revalidatePath("/");
  revalidatePath("/watchlist");
  revalidatePath("/tags");
  return result;
}
