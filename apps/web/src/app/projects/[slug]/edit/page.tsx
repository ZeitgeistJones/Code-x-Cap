import { notFound } from "next/navigation";
import { CHAINS, DISCOVERY_TIERS, PRIMARY_CATEGORIES, PROJECT_STATUSES } from "@codexcap/core";
import { updateProjectAction } from "@/app/actions/projects";
import { getProjectBySlug, listAllTags } from "@/lib/queries";

export const dynamic = "force-dynamic";

export default async function EditProjectPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const [project, tags] = await Promise.all([
    getProjectBySlug(slug).catch(() => null),
    listAllTags().catch(() => []),
  ]);
  if (!project) notFound();

  const selected = new Set(project.tags.map((t) => t.id));

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <h1 className="font-display text-2xl text-ink-100">Edit · {project.name}</h1>
      <form action={updateProjectAction} className="panel space-y-4 p-5">
        <input type="hidden" name="id" value={project.id} />
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label">Name</label>
            <input className="input" name="name" defaultValue={project.name} required />
          </div>
          <div>
            <label className="label">Slug</label>
            <input className="input" name="slug" defaultValue={project.slug} required />
          </div>
          <div className="sm:col-span-2">
            <label className="label">Short description</label>
            <input className="input" name="shortDescription" defaultValue={project.shortDescription ?? ""} />
          </div>
          <div className="sm:col-span-2">
            <label className="label">Long description</label>
            <textarea
              className="input min-h-[80px]"
              name="longDescription"
              defaultValue={project.longDescription ?? ""}
            />
          </div>
          <div>
            <label className="label">Status</label>
            <select className="input" name="projectStatus" defaultValue={project.projectStatus}>
              {PROJECT_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s.replace(/_/g, " ")}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Discovery tier</label>
            <select
              className="input"
              name="discoveryTier"
              defaultValue={project.discoveryTier ?? "under_the_radar"}
            >
              {DISCOVERY_TIERS.map((t) => (
                <option key={t} value={t}>
                  {t.replace(/_/g, " ")}
                </option>
              ))}
            </select>
          </div>
          <div className="sm:col-span-2">
            <label className="label">Why on this list (short)</label>
            <textarea
              className="input min-h-[72px]"
              name="trackingReason"
              defaultValue={project.trackingReason ?? ""}
              placeholder="One-line tracking reason…"
            />
          </div>
          <div className="sm:col-span-2">
            <label className="label">Why it&apos;s interesting (write-up)</label>
            <textarea
              className="input min-h-[120px]"
              name="writeup"
              defaultValue={project.writeup ?? ""}
              placeholder="Full research write-up…"
            />
          </div>
          <div className="sm:col-span-2">
            <label className="label">What&apos;s holding it back</label>
            <textarea
              className="input min-h-[100px]"
              name="whatsHoldingBack"
              defaultValue={project.whatsHoldingBack ?? ""}
              placeholder="Risks, gaps, caveats…"
            />
          </div>
          <div className="sm:col-span-2">
            <label className="label">What to watch</label>
            <textarea
              className="input min-h-[88px]"
              name="whatToWatch"
              defaultValue={project.whatToWatch ?? ""}
              placeholder="Monitoring triggers / events…"
            />
          </div>
          <div className="sm:col-span-2">
            <label className="label">Research framing</label>
            <textarea
              className="input min-h-[72px]"
              name="researchContext"
              defaultValue={project.researchContext ?? ""}
              placeholder="How to interpret this project (benchmark vs discovery, caveats)…"
            />
          </div>
          <div>
            <label className="label">Category</label>
            <select className="input" name="primaryCategory" defaultValue={project.primaryCategory ?? ""}>
              {PRIMARY_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c.replace(/_/g, " ")}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Website</label>
            <input className="input" name="websiteUrl" defaultValue={project.websiteUrl ?? ""} />
          </div>
          <div>
            <label className="label">Twitter</label>
            <input className="input" name="twitterUrl" defaultValue={project.twitterUrl ?? ""} />
          </div>
          <div>
            <label className="label">Chain</label>
            <select className="input" name="chain" defaultValue={project.primaryChain ?? "base"}>
              {CHAINS.map((c) => (
                <option key={c.slug} value={c.slug}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Chain ID</label>
            <input className="input" name="chainId" defaultValue={String(project.primaryChainId ?? 8453)} />
          </div>
          <div>
            <label className="label">Identity confidence</label>
            <input
              className="input"
              name="identityConfidence"
              type="number"
              min={0}
              max={10}
              defaultValue={String(project.identityConfidence ?? 0)}
            />
          </div>
        </div>
        <div>
          <label className="label">Tags</label>
          <div className="grid max-h-48 grid-cols-2 gap-1 overflow-y-auto border border-ink-800 p-2 sm:grid-cols-3">
            {tags.map((t) => (
              <label key={t.id} className="flex items-center gap-2 text-xs">
                <input type="checkbox" name="tagIds" value={t.id} defaultChecked={selected.has(t.id)} />
                {t.name}
              </label>
            ))}
          </div>
        </div>
        <button type="submit" className="btn btn-primary">
          Save
        </button>
      </form>
    </div>
  );
}
