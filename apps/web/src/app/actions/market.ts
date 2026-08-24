"use server";

import { revalidatePath } from "next/cache";
import { isAuthenticated } from "@/lib/auth";
import { refreshAllCurrentTokenMarkets, refreshTokenMarket } from "@/lib/market";
import { tokens } from "@codexcap/db/schema";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";

export async function refreshAllMarketsAction() {
  if (!(await isAuthenticated())) throw new Error("Unauthorized");
  const results = await refreshAllCurrentTokenMarkets();
  revalidatePath("/");
  revalidatePath("/watchlist");
  // Server Actions used as form actions should return void / redirect
  void results;
}

export async function refreshProjectMarketsAction(formData: FormData) {
  if (!(await isAuthenticated())) throw new Error("Unauthorized");
  const projectId = String(formData.get("projectId") ?? "");
  const slug = String(formData.get("slug") ?? "");
  if (!projectId) throw new Error("projectId required");

  const rows = await db().select().from(tokens).where(eq(tokens.projectId, projectId));
  for (const t of rows) {
    if (t.contractAddress) await refreshTokenMarket(t.id);
  }
  revalidatePath("/");
  revalidatePath(`/projects/${slug}`);
}
