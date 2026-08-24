"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function SeedResearchButton({
  label = "Load research seed",
  className = "btn",
}: {
  label?: string;
  className?: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function onClick() {
    if (busy) return;
    setBusy(true);
    try {
      const res = await fetch("/api/admin/seed-research", {
        method: "POST",
        credentials: "include",
      });
      const data = (await res.json()) as {
        error?: string;
        created?: string[];
        updated?: string[];
        errors?: Array<{ slug: string; error: string }>;
        count?: number;
      };

      if (!res.ok) {
        window.alert(data.error ?? `Seed failed (${res.status})`);
        return;
      }

      const created = data.created?.length ?? 0;
      const updated = data.updated?.length ?? 0;
      const failed = data.errors?.length ?? 0;
      const missing = data.errors?.map((e) => e.slug).join(", ");
      window.alert(
        `Research seed done.\nCreated: ${created}\nUpdated: ${updated}\nFailed: ${failed}` +
          (missing ? `\nFailed slugs: ${missing}` : "") +
          `\nExpected total: ${data.count ?? 17}`,
      );
      router.refresh();
    } catch (e) {
      window.alert(e instanceof Error ? e.message : "Seed request failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <button type="button" className={className} onClick={onClick} disabled={busy}>
      {busy ? "Seeding…" : label}
    </button>
  );
}
