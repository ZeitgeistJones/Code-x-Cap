import Link from "next/link";
import { listProjects } from "@/lib/queries";
import { RecencyPill, StatusPill } from "@/components/Badges";

export const dynamic = "force-dynamic";

export default async function WatchlistPage() {
  const projects = await listProjects({ watchlist: true }).catch(() => []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl text-ink-100">Watchlist</h1>
        <p className="mt-1 text-sm text-ink-400">Projects you marked for close attention.</p>
      </div>
      <div className="panel overflow-x-auto">
        <table className="table-dense">
          <thead>
            <tr>
              <th>Project</th>
              <th>Status</th>
              <th>Code</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {projects.length === 0 ? (
              <tr>
                <td colSpan={4} className="py-8 text-center text-ink-500">
                  Watchlist empty — open a project and click Watch.
                </td>
              </tr>
            ) : (
              projects.map((p) => (
                <tr key={p.id}>
                  <td>
                    <Link href={`/projects/${p.slug}`} className="text-ink-100 hover:text-accent">
                      {p.name}
                    </Link>
                  </td>
                  <td>
                    <StatusPill status={p.projectStatus} />
                  </td>
                  <td>
                    <RecencyPill badge={p.codeRecency} />
                  </td>
                  <td>
                    <Link href={`/projects/${p.slug}`} className="font-mono text-[10px] uppercase text-accent">
                      Open
                    </Link>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
