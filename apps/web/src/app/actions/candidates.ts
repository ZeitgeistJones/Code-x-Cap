"use server";

import { githubRepositories, notes, projects, tokens } from "@codexcap/db/schema";
import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { isAuthenticated } from "@/lib/auth";
import { db } from "@/lib/db";

async function assertAuth(): Promise<void> {
  if (!(await isAuthenticated())) throw new Error("Unauthorized");
}

function field(formData: FormData, name: string): string {
  return String(formData.get(name) ?? "").trim();
}

function returnToQueue(message: string, kind: "ok" | "error"): never {
  redirect(
    `/admin/candidates?${kind}=${encodeURIComponent(message.replace(/\s+/g, " ").slice(0, 220))}`,
  );
}

export async function promoteCandidateAction(formData: FormData): Promise<void> {
  await assertAuth();
  const projectId = field(formData, "projectId");
  if (!projectId) returnToQueue("Project ID is required.", "error");

  const database = db();
  const [project, currentTokens, repositories] = await Promise.all([
    database.select().from(projects).where(eq(projects.id, projectId)).limit(1),
    database
      .select()
      .from(tokens)
      .where(and(eq(tokens.projectId, projectId), eq(tokens.isCurrent, true))),
    database
      .select()
      .from(githubRepositories)
      .where(eq(githubRepositories.projectId, projectId)),
  ]);
  const row = project[0];
  if (!row) returnToQueue("Candidate not found.", "error");

  const reasons: string[] = [];
  if ((row.identityConfidence ?? 0) < 4) reasons.push("identity confidence must be at least 4");
  if (!repositories.some((repository) => !repository.privateOrMissing)) {
    reasons.push("a relevant public GitHub repository is required");
  }
  const currentToken = currentTokens[0];
  if (!currentToken?.sourceUrl?.trim()) {
    reasons.push("the current token needs a non-empty contract source URL");
  }
  if (reasons.length > 0) {
    returnToQueue(`Not promoted: ${reasons.join("; ")}.`, "error");
  }

  await database
    .update(projects)
    .set({ projectStatus: "watch", lastReviewedAt: new Date(), updatedAt: new Date() })
    .where(eq(projects.id, projectId));
  revalidatePath("/");
  revalidatePath("/admin/candidates");
  revalidatePath(`/projects/${row.slug}`);
  returnToQueue(`${row.name} promoted to watch.`, "ok");
}

export async function rejectCandidateAction(formData: FormData): Promise<void> {
  await assertAuth();
  const projectId = field(formData, "projectId");
  const note = field(formData, "note");
  if (!projectId) returnToQueue("Project ID is required.", "error");
  if (!note) returnToQueue("A short rejection note is required.", "error");

  const database = db();
  const [project] = await database.select().from(projects).where(eq(projects.id, projectId)).limit(1);
  if (!project) returnToQueue("Candidate not found.", "error");

  await database.transaction(async (tx) => {
    await tx
      .update(projects)
      .set({ projectStatus: "rejected", lastReviewedAt: new Date(), updatedAt: new Date() })
      .where(eq(projects.id, projectId));
    await tx.insert(notes).values({
      projectId,
      body: `Candidate rejected: ${note.slice(0, 500)}`,
      author: "admin",
    });
  });
  revalidatePath("/");
  revalidatePath("/admin/candidates");
  revalidatePath(`/projects/${project.slug}`);
  returnToQueue(`${project.name} marked rejected.`, "ok");
}

export async function moveCandidateToResearchingAction(formData: FormData): Promise<void> {
  await assertAuth();
  const projectId = field(formData, "projectId");
  if (!projectId) returnToQueue("Project ID is required.", "error");

  const database = db();
  const [project] = await database.select().from(projects).where(eq(projects.id, projectId)).limit(1);
  if (!project) returnToQueue("Candidate not found.", "error");

  await database
    .update(projects)
    .set({ projectStatus: "researching", lastReviewedAt: new Date(), updatedAt: new Date() })
    .where(eq(projects.id, projectId));
  revalidatePath("/");
  revalidatePath("/admin/candidates");
  revalidatePath(`/projects/${project.slug}`);
  returnToQueue(`${project.name} moved to researching.`, "ok");
}
