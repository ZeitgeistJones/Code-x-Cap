/**
 * GitHub REST API provider (commits + repo metadata).
 * Uses GITHUB_TOKEN when set (higher rate limit).
 */

import type { GitHubProvider, GitHubRepoMeta, Provenance } from "./types";

const API = "https://api.github.com";

export type GitHubCommitDetail = {
  sha: string;
  message: string;
  authorLogin: string | null;
  authorName: string | null;
  committedAt: Date;
  additions: number;
  deletions: number;
  changedPaths: string[];
  htmlUrl: string;
};

function headers(): HeadersInit {
  const h: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": "code-x-cap",
  };
  const token = process.env.GITHUB_TOKEN;
  if (token) h.Authorization = `Bearer ${token}`;
  return h;
}

async function ghJson<T>(url: string): Promise<{ ok: true; data: T } | { ok: false; status: number }> {
  const res = await fetch(url, { headers: headers(), cache: "no-store" });
  if (res.status === 404) return { ok: false, status: 404 };
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`GitHub ${res.status}: ${body.slice(0, 200)}`);
  }
  return { ok: true, data: (await res.json()) as T };
}

export class GitHubApiProvider implements GitHubProvider {
  readonly name = "github_api";

  async getRepository(
    owner: string,
    repo: string,
  ): Promise<(GitHubRepoMeta & { provenance: Provenance }) | null> {
    const url = `${API}/repos/${owner}/${repo}`;
    const result = await ghJson<{
      default_branch: string;
      stargazers_count: number;
      forks_count: number;
      open_issues_count: number;
      archived: boolean;
      pushed_at: string | null;
      private: boolean;
    }>(url);

    if (!result.ok) {
      return {
        owner,
        repo,
        defaultBranch: "main",
        stars: 0,
        forks: 0,
        openIssues: 0,
        latestCommitAt: null,
        archived: false,
        privateOrMissing: true,
        provenance: { provider: this.name, sourceUrl: url, fetchedAt: new Date() },
      };
    }

    const d = result.data;
    return {
      owner,
      repo,
      defaultBranch: d.default_branch,
      stars: d.stargazers_count,
      forks: d.forks_count,
      openIssues: d.open_issues_count,
      latestCommitAt: d.pushed_at ? new Date(d.pushed_at) : null,
      archived: d.archived,
      privateOrMissing: d.private,
      provenance: {
        provider: this.name,
        sourceUrl: `https://github.com/${owner}/${repo}`,
        fetchedAt: new Date(),
      },
    };
  }

  /**
   * List recent commits on default branch, then hydrate file stats for the newest N.
   */
  async listRecentCommits(
    owner: string,
    repo: string,
    opts: { perPage?: number; hydrateMax?: number } = {},
  ): Promise<GitHubCommitDetail[]> {
    const perPage = opts.perPage ?? 30;
    const hydrateMax = opts.hydrateMax ?? 15;
    const listUrl = `${API}/repos/${owner}/${repo}/commits?per_page=${perPage}`;
    const list = await ghJson<
      Array<{
        sha: string;
        html_url: string;
        commit: {
          message: string;
          author: { name?: string; date?: string } | null;
        };
        author: { login?: string } | null;
      }>
    >(listUrl);

    if (!list.ok) return [];

    const out: GitHubCommitDetail[] = [];
    for (let i = 0; i < list.data.length; i++) {
      const c = list.data[i];
      const base: GitHubCommitDetail = {
        sha: c.sha,
        message: c.commit.message.split("\n")[0] ?? "",
        authorLogin: c.author?.login ?? null,
        authorName: c.commit.author?.name ?? null,
        committedAt: c.commit.author?.date ? new Date(c.commit.author.date) : new Date(),
        additions: 0,
        deletions: 0,
        changedPaths: [],
        htmlUrl: c.html_url,
      };

      if (i < hydrateMax) {
        const detail = await ghJson<{
          stats?: { additions?: number; deletions?: number };
          files?: Array<{ filename: string }>;
          html_url: string;
          commit: { message: string; author: { name?: string; date?: string } | null };
          author: { login?: string } | null;
          sha: string;
        }>(`${API}/repos/${owner}/${repo}/commits/${c.sha}`);

        if (detail.ok) {
          base.additions = detail.data.stats?.additions ?? 0;
          base.deletions = detail.data.stats?.deletions ?? 0;
          base.changedPaths = (detail.data.files ?? []).map((f) => f.filename);
        }
        // gentle pacing
        await new Promise((r) => setTimeout(r, 120));
      }

      out.push(base);
    }

    return out;
  }
}

export const githubApi = new GitHubApiProvider();
