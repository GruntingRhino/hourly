export default function MetricCard({ label, value, subtext }: { label: string; value: string; subtext?: string }) {
  return <div className="rounded-[3px] border border-[var(--border)] bg-[var(--surface)] p-4"><div className="text-sm text-[var(--text-sec)]">{label}</div><div className="mt-1 text-2xl font-semibold text-[var(--text)]">{value}</div>{subtext && <div className="mt-1 text-xs text-[var(--text-faint)]">{subtext}</div>}</div>;
}
