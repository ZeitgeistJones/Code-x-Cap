import { unlockAction } from "@/app/actions/auth";
import { isAuthenticated } from "@/lib/auth";
import { redirect } from "next/navigation";

export default async function UnlockPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  if (await isAuthenticated()) redirect("/");
  const sp = await searchParams;

  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4">
      <div className="w-full max-w-md panel p-8">
        <h1 className="font-display text-3xl text-ink-100">CODE × CAP</h1>
        <p className="mt-2 text-sm text-ink-400">
          Private research tool. Enter your admin key to continue.
        </p>
        {sp.error ? (
          <p className="mt-4 font-mono text-xs text-danger">Invalid key.</p>
        ) : null}
        <form action={unlockAction} className="mt-6 space-y-4">
          <div>
            <label className="label" htmlFor="adminKey">
              Admin key
            </label>
            <input
              id="adminKey"
              name="adminKey"
              type="password"
              className="input"
              autoComplete="current-password"
              required
            />
          </div>
          <button type="submit" className="btn btn-primary w-full">
            Unlock
          </button>
        </form>
        <p className="mt-6 font-mono text-[10px] leading-relaxed text-ink-600">
          Set ADMIN_KEY in Vercel → Settings → Environment Variables. Phase 1: manual research
          database only — no automated market or GitHub ingestion yet.
        </p>
      </div>
    </div>
  );
}
