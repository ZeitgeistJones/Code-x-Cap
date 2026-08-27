import Link from "next/link";
import { lockAction } from "@/app/actions/auth";

export function AppNav() {
  return (
    <header className="border-b border-ink-800 bg-ink-950/90 backdrop-blur">
      <div className="mx-auto flex max-w-[1400px] items-center gap-6 px-4 py-3">
        <Link href="/" className="group flex items-baseline gap-2 hover:text-ink-100">
          <span className="font-display text-xl tracking-tight text-ink-100 group-hover:text-accent">
            CODE × CAP
          </span>
          <span className="hidden font-mono text-[10px] uppercase tracking-widest text-ink-600 sm:inline">
            Build Signals
          </span>
        </Link>
        <nav className="flex flex-1 items-center gap-4 font-mono text-xs uppercase tracking-wide text-ink-400">
          <Link href="/" className="hover:text-accent">
            Projects
          </Link>
          <Link href="/projects/new" className="hover:text-accent">
            Add
          </Link>
          <Link href="/watchlist" className="hover:text-accent">
            Watchlist
          </Link>
          <Link href="/admin/candidates" className="hover:text-accent">
            Candidates
          </Link>
          <Link href="/tags" className="hover:text-accent">
            Tags
          </Link>
        </nav>
        <form action={lockAction}>
          <button type="submit" className="font-mono text-[10px] uppercase tracking-wider text-ink-600 hover:text-ink-300">
            Lock
          </button>
        </form>
      </div>
    </header>
  );
}
