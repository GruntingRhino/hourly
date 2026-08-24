type AvailableSlotForRanking = {
  date: Date | string;
  startTime: string;
};

/**
 * Preserve chronological relevance without paid ranking preference.
 */
export function compareAvailableSlots(a: AvailableSlotForRanking, b: AvailableSlotForRanking): number {
  const dateDifference = new Date(a.date).getTime() - new Date(b.date).getTime();
  if (dateDifference) return dateDifference;
  const timeDifference = a.startTime.localeCompare(b.startTime);
  if (timeDifference) return timeDifference;
  return 0;
}
