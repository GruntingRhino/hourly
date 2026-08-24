export interface AvailabilityWindow { weekday: number; start: string; end: string; }
function parseTime(value: string): number {
  const match = /^(\d{2}):(\d{2})$/.exec(value);
  if (!match || Number(match[2]) > 59 || Number(match[1]) > 23) throw new Error("Availability time must be HH:MM");
  return Number(match[1]) * 60 + Number(match[2]);
}
export function isOpportunityAvailable(params: { start: Date; end: Date; timezone: string; windows: AvailabilityWindow[] }): boolean {
  if (!Intl.supportedValuesOf("timeZone").includes(params.timezone)) throw new Error("Invalid availability timezone");
  const format = new Intl.DateTimeFormat("en-US", { timeZone: params.timezone, weekday: "short", hour: "2-digit", minute: "2-digit", hour12: false });
  const weekday = new Map([["Sun", 0], ["Mon", 1], ["Tue", 2], ["Wed", 3], ["Thu", 4], ["Fri", 5], ["Sat", 6]]);
  const parts = Object.fromEntries(format.formatToParts(params.start).map((part) => [part.type, part.value]));
  const day = weekday.get(parts.weekday);
  if (day == null) return false;
  const start = Number(parts.hour) * 60 + Number(parts.minute);
  const endParts = Object.fromEntries(format.formatToParts(params.end).map((part) => [part.type, part.value]));
  const end = Number(endParts.hour) * 60 + Number(endParts.minute);
  return params.windows.some((window) => window.weekday === day && start >= parseTime(window.start) && end <= parseTime(window.end));
}
