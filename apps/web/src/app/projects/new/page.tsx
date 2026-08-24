import {
  CHAINS,
  PRIMARY_CATEGORIES,
  PROJECT_STATUSES,
  TOKEN_ROLES,
  TOKEN_STATUSES,
} from "@codexcap/core";
import { createProjectAction } from "@/app/actions/projects";
import { listAllTags } from "@/lib/queries";

export const dynamic = "force-dynamic";

export default async function NewProjectPage() {
  const tags = await listAllTags().catch(() => []);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="font-display text-2xl text-ink-100">Add project</h1>
        <p className="mt-1 text-sm text-ink-400">
          Enter what you know. Attach a contract only with a source URL — otherwise status becomes{" "}
          <span className="font-mono text-warn">unverified</span>.
        </p>
      </div>

      <form action={createProjectAction} className="panel space-y-6 p-5">
        <section className="grid gap-4 sm:grid-cols-2">
          <Field label="Name" name="name" required />
          <Field label="Slug (optional)" name="slug" placeholder="auto from name" />
          <div className="sm:col-span-2">
            <label className="label">Short description</label>
            <input className="input" name="shortDescription" />
          </div>
          <div className="sm:col-span-2">
            <label className="label">Long description</label>
            <textarea className="input min-h-[80px]" name="longDescription" />
          </div>
          <div>
            <label className="label">Status</label>
            <select className="input" name="projectStatus" defaultValue="researching">
              {PROJECT_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s.replace(/_/g, " ")}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Primary category</label>
            <select className="input" name="primaryCategory" defaultValue="agent_infrastructure">
              {PRIMARY_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c.replace(/_/g, " ")}
                </option>
              ))}
            </select>
          </div>
          <Field label="Website" name="websiteUrl" placeholder="https://" />
          <Field label="X / Twitter" name="twitterUrl" placeholder="https://x.com/…" />
          <div>
            <label className="label">Primary chain</label>
            <select className="input" name="chain" defaultValue="base" id="chain-select">
              {CHAINS.map((c) => (
                <option key={c.slug} value={c.slug}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <Field label="Chain ID" name="chainId" defaultValue="8453" />
          <Field
            label="Identity confidence 0–10"
            name="identityConfidence"
            type="number"
            defaultValue="0"
          />
        </section>

        <section>
          <h2 className="mb-2 font-mono text-[11px] uppercase tracking-wider text-ink-400">Tags</h2>
          <div className="grid max-h-48 grid-cols-2 gap-1 overflow-y-auto border border-ink-800 p-2 sm:grid-cols-3">
            {tags.map((t) => (
              <label key={t.id} className="flex items-center gap-2 text-xs text-ink-300">
                <input type="checkbox" name="tagIds" value={t.id} />
                <span>
                  <span className="text-ink-600">{t.group}/</span>
                  {t.name}
                </span>
              </label>
            ))}
          </div>
        </section>

        <section className="space-y-3">
          <h2 className="font-mono text-[11px] uppercase tracking-wider text-ink-400">
            GitHub repos (one per line: owner/repo or URL, optional |role)
          </h2>
          <textarea
            className="input min-h-[72px] font-mono text-xs"
            name="repositories"
            placeholder={"acme/agent-core|core\nacme/agent-sdk|sdk"}
          />
        </section>

        <section className="grid gap-4 border-t border-ink-800 pt-4 sm:grid-cols-2">
          <h2 className="sm:col-span-2 font-mono text-[11px] uppercase tracking-wider text-ink-400">
            Token (optional — requires source URL if CA set)
          </h2>
          <Field label="Symbol" name="tokenSymbol" />
          <Field label="Token name" name="tokenName" />
          <Field label="Contract address" name="contractAddress" placeholder="0x…" />
          <Field label="Token source URL" name="tokenSourceUrl" placeholder="Official page / explorer / tweet" />
          <div>
            <label className="label">Token status</label>
            <select className="input" name="tokenStatus" defaultValue="unknown">
              {TOKEN_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s.replace(/_/g, " ")}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Token role</label>
            <select className="input" name="tokenRole" defaultValue="primary">
              {TOKEN_ROLES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
        </section>

        <section className="grid gap-4 border-t border-ink-800 pt-4 sm:grid-cols-2">
          <h2 className="sm:col-span-2 font-mono text-[11px] uppercase tracking-wider text-ink-400">
            Manual code signal (optional)
          </h2>
          <Field label="Last meaningful code (date)" name="codeLatestAt" type="date" />
          <Field label="Code summary" name="codeSummary" />
        </section>

        <div>
          <label className="label">Initial research note</label>
          <textarea className="input min-h-[72px]" name="note" />
        </div>

        <button type="submit" className="btn btn-primary">
          Create project
        </button>
      </form>
    </div>
  );
}

function Field({
  label,
  name,
  required,
  placeholder,
  type = "text",
  defaultValue,
}: {
  label: string;
  name: string;
  required?: boolean;
  placeholder?: string;
  type?: string;
  defaultValue?: string;
}) {
  return (
    <div>
      <label className="label" htmlFor={name}>
        {label}
      </label>
      <input
        className="input"
        id={name}
        name={name}
        required={required}
        placeholder={placeholder}
        type={type}
        defaultValue={defaultValue}
      />
    </div>
  );
}
