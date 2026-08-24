import { TAG_GROUPS } from "@codexcap/core";
import { createTagAction } from "@/app/actions/projects";
import { listAllTags } from "@/lib/queries";

export const dynamic = "force-dynamic";

export default async function TagsPage() {
  const tags = await listAllTags().catch(() => []);
  const byGroup = TAG_GROUPS.map((g) => ({
    group: g,
    items: tags.filter((t) => t.group === g),
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl text-ink-100">Tags</h1>
        <p className="mt-1 text-sm text-ink-400">Extensible taxonomy — add tags from here.</p>
      </div>

      <form action={createTagAction} className="panel flex flex-wrap gap-2 p-3">
        <input className="input w-40" name="name" placeholder="Name" required />
        <input className="input w-40" name="slug" placeholder="slug (optional)" />
        <select className="input w-auto" name="group" defaultValue="situation">
          {TAG_GROUPS.map((g) => (
            <option key={g} value={g}>
              {g}
            </option>
          ))}
        </select>
        <button type="submit" className="btn btn-primary">
          Add tag
        </button>
      </form>

      <div className="grid gap-4 lg:grid-cols-2">
        {byGroup.map(({ group, items }) => (
          <div key={group} className="panel p-4">
            <h2 className="section-title">{group.replace(/_/g, " ")}</h2>
            <ul className="mt-3 space-y-1">
              {items.map((t) => (
                <li key={t.id} className="font-mono text-xs text-ink-300">
                  {t.name} <span className="text-ink-600">({t.slug})</span>
                </li>
              ))}
              {items.length === 0 ? <li className="text-xs text-ink-600">Empty — run seed</li> : null}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}
