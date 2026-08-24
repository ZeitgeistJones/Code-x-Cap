"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useTransition } from "react";

type Tag = { id: string; slug: string; name: string; group: string };

export function FilterBar({
  tags,
  chains,
  statuses,
  categories,
  tokenStatuses,
}: {
  tags: Tag[];
  chains: ReadonlyArray<{ id: number; slug: string; name: string }>;
  statuses: readonly string[];
  categories: readonly string[];
  tokenStatuses: readonly string[];
}) {
  const router = useRouter();
  const sp = useSearchParams();
  const [pending, start] = useTransition();

  const set = useCallback(
    (key: string, value: string) => {
      const next = new URLSearchParams(sp.toString());
      if (!value || value === "0") next.delete(key);
      else next.set(key, value);
      start(() => router.push(`/?${next.toString()}`));
    },
    [router, sp],
  );

  const toggle = (key: string) => {
    const next = new URLSearchParams(sp.toString());
    if (next.get(key) === "1") next.delete(key);
    else next.set(key, "1");
    start(() => router.push(`/?${next.toString()}`));
  };

  return (
    <div className={`panel space-y-3 p-3 ${pending ? "opacity-70" : ""}`}>
      <div className="flex flex-wrap gap-2">
        <input
          className="input max-w-xs"
          placeholder="Search name, slug, site…"
          defaultValue={sp.get("q") ?? ""}
          onKeyDown={(e) => {
            if (e.key === "Enter") set("q", (e.target as HTMLInputElement).value);
          }}
        />
        <Select label="Status" value={sp.get("status") ?? ""} onChange={(v) => set("status", v)} options={statuses} />
        <Select
          label="Category"
          value={sp.get("category") ?? ""}
          onChange={(v) => set("category", v)}
          options={categories}
        />
        <select
          className="input w-auto"
          value={sp.get("chain") ?? ""}
          onChange={(e) => set("chain", e.target.value)}
        >
          <option value="">Chain</option>
          {chains.map((c) => (
            <option key={c.slug} value={c.slug}>
              {c.name}
            </option>
          ))}
        </select>
        <Select
          label="Token status"
          value={sp.get("tokenStatus") ?? ""}
          onChange={(v) => set("tokenStatus", v)}
          options={tokenStatuses}
        />
        <select className="input w-auto" value={sp.get("tag") ?? ""} onChange={(e) => set("tag", e.target.value)}>
          <option value="">Tag</option>
          {tags.map((t) => (
            <option key={t.id} value={t.slug}>
              {t.group}/{t.name}
            </option>
          ))}
        </select>
        <select
          className="input w-auto"
          value={sp.get("codeRecency") ?? ""}
          onChange={(e) => set("codeRecency", e.target.value)}
        >
          <option value="">Code recency</option>
          <option value="hot">HOT</option>
          <option value="active">ACTIVE</option>
          <option value="cooling">COOLING</option>
          <option value="dormant">DORMANT</option>
          <option value="unknown">UNKNOWN</option>
        </select>
        <input
          className="input w-24"
          type="number"
          min={0}
          max={10}
          placeholder="ID ≥"
          title="Min identity confidence"
          defaultValue={sp.get("identityMin") ?? ""}
          onBlur={(e) => set("identityMin", e.target.value)}
        />
      </div>
      <div className="flex flex-wrap gap-2 font-mono text-[10px] uppercase tracking-wider">
        <Toggle active={sp.get("preToken") === "1"} onClick={() => toggle("preToken")}>
          Pre-token
        </Toggle>
        <Toggle active={sp.get("migration") === "1"} onClick={() => toggle("migration")}>
          Migration
        </Toggle>
        <Toggle active={sp.get("watchlist") === "1"} onClick={() => toggle("watchlist")}>
          Watchlist
        </Toggle>
        <span className="ml-auto self-center text-ink-600 normal-case tracking-normal">
          Mcap / liquidity filters → Phase 3
        </span>
      </div>
    </div>
  );
}

function Select({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: readonly string[];
}) {
  return (
    <select className="input w-auto" value={value} onChange={(e) => onChange(e.target.value)}>
      <option value="">{label}</option>
      {options.map((o) => (
        <option key={o} value={o}>
          {o.replace(/_/g, " ")}
        </option>
      ))}
    </select>
  );
}

function Toggle({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-sm border px-2 py-1 ${
        active ? "border-accent-dim bg-accent-muted text-accent" : "border-ink-700 text-ink-400"
      }`}
    >
      {children}
    </button>
  );
}
