"use server";

import { revalidatePath } from "next/cache";
import { isAuthenticated } from "@/lib/auth";
import { refreshAllGithub, refreshProjectGithub } from "@/lib/github";

export async function refreshAllGithubAction() {
  if (!(await isAuthenticated())) throw new Error("Unauthorized");
  await refreshAllGithub();
  revalidatePath("/");
  revalidatePath("/watchlist");
}

export async function refreshProjectGithubAction(formData: FormData) {
  if (!(await isAuthenticated())) throw new Error("Unauthorized");
  const projectId = String(formData.get("projectId") ?? "");
  const slug = String(formData.get("slug") ?? "");
  if (!projectId) throw new Error("projectId required");
  await refreshProjectGithub(projectId);
  revalidatePath("/");
  revalidatePath(`/projects/${slug}`);
}
