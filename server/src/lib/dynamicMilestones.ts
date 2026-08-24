export interface Milestone {
  percent: number;
  label: string;
}

export interface MilestoneProgress {
  percentComplete: number;
  reached: Milestone[];
  next: Milestone | null;
}

const DEFAULT_MILESTONES: Milestone[] = [
  { percent: 25, label: "Started" },
  { percent: 50, label: "Halfway" },
  { percent: 75, label: "Nearly there" },
  { percent: 100, label: "Complete" },
];

export function parseMilestoneThresholds(raw: string | null | undefined): Milestone[] {
  if (!raw) return DEFAULT_MILESTONES;
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const values = Object.entries(parsed)
      .map(([percent, label]) => ({ percent: Number(percent), label: typeof label === "string" ? label.trim() : "" }))
      .filter((item) => Number.isInteger(item.percent) && item.percent > 0 && item.percent <= 100 && item.label.length > 0)
      .sort((a, b) => a.percent - b.percent);
    return values.length > 0 ? values : DEFAULT_MILESTONES;
  } catch {
    return DEFAULT_MILESTONES;
  }
}

export function deriveMilestones(params: {
  approvedHours: number;
  requiredHours?: number;
  thresholds: Milestone[];
}): MilestoneProgress {
  const required = Number.isFinite(params.requiredHours) && (params.requiredHours ?? 0) > 0 ? params.requiredHours! : 40;
  const approved = Number.isFinite(params.approvedHours) ? Math.max(0, params.approvedHours) : 0;
  const percentComplete = Math.min(100, Math.max(0, Math.round((approved / required) * 100)));
  const thresholds = [...params.thresholds].sort((a, b) => a.percent - b.percent);
  const reached = thresholds.filter((milestone) => percentComplete >= milestone.percent);
  return { percentComplete, reached, next: thresholds.find((milestone) => percentComplete < milestone.percent) ?? null };
}
