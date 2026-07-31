import type { LaunchWorkspace } from "./types";

export function formatDate(value: string | null): string { return value ? new Date(value).toLocaleString() : "—"; }
export function summaryClasses(readiness: LaunchWorkspace["summary"]["readiness"]): string {
  switch (readiness) { case "LIVE": return "border-[var(--ok-b)] bg-[var(--ok-bg)] text-green-900"; case "ATTENTION": return "border-[var(--er-b)] bg-[var(--er-bg)] text-red-900"; case "PILOTING": return "border-[var(--wn-b)] bg-[var(--wn-bg)] text-amber-900"; default: return "border-[var(--in-b)] bg-[var(--in-bg)] text-blue-900"; }
}
export function badgeClasses(value: string): string {
  switch (value) { case "CRITICAL": case "BLOCKED": return "bg-[var(--er-bg)] text-[var(--er-t)]"; case "HIGH": case "OPEN": case "ATTENTION": return "bg-[var(--wn-bg)] text-[var(--wn-t)]"; case "FIXED": case "LIVE": return "bg-[var(--ok-bg)] text-[var(--ok-t)]"; case "MONITORING": case "INVESTIGATING": case "PILOTING": case "NOT_READY": return "bg-[var(--in-bg)] text-[var(--action)]"; default: return "bg-[var(--surface-alt)] text-[var(--text)]"; }
}
