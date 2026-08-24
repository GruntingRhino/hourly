export interface ReliabilityEvent { at: Date; responseMinutes?: number; attendanceAccurate?: boolean; cancelled?: boolean; verificationMinutes?: number; }
export interface ReliabilityScore { sampleSize: number; score: number; responseTimeScore: number; attendanceAccuracyScore: number; cancellationScore: number; verificationSpeedScore: number; }
export function calculateReliability(events: ReliabilityEvent[], params: { now: Date; windowDays: number; minimumSamples: number }): ReliabilityScore | null {
  const cutoff = params.now.getTime() - params.windowDays * 86400000;
  const recent = events.filter((event) => event.at.getTime() >= cutoff && event.at.getTime() <= params.now.getTime());
  if (recent.length < params.minimumSamples) return null;
  const average = (values: number[]) => values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
  const responseTimeScore = Math.max(0, Math.min(100, 100 - average(recent.filter((e) => e.responseMinutes != null).map((e) => e.responseMinutes!))));
  const attendance = recent.filter((e) => e.attendanceAccurate != null);
  const attendanceAccuracyScore = attendance.length ? attendance.filter((e) => e.attendanceAccurate).length / attendance.length * 100 : 100;
  const cancellationScore = Math.max(0, 100 - recent.filter((e) => e.cancelled).length / recent.length * 100);
  const verificationSpeedScore = Math.max(0, Math.min(100, 100 - average(recent.filter((e) => e.verificationMinutes != null).map((e) => e.verificationMinutes!))));
  return { sampleSize: recent.length, score: Math.round((responseTimeScore + attendanceAccuracyScore + cancellationScore + verificationSpeedScore) / 4), responseTimeScore: Math.round(responseTimeScore), attendanceAccuracyScore: Math.round(attendanceAccuracyScore), cancellationScore: Math.round(cancellationScore), verificationSpeedScore: Math.round(verificationSpeedScore) };
}
