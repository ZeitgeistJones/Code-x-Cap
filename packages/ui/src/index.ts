/** Shared UI class helpers — keep thin; most styling lives in apps/web. */

export function cx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}
