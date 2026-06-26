// Generates a minimal RFC 5545 iCalendar file as a string.
// No external package required — the format is simple and stable.

export interface ICSEvent {
  uid: string;
  title: string;
  startUtc: Date;
  endUtc: Date;
  location?: string;
  description?: string;
  organizerName?: string;
}

function icsDate(d: Date): string {
  return d.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
}

function icsEscape(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");
}

// ICS line folding: lines > 75 octets must be folded at 75 with CRLF + SPACE
function foldLine(line: string): string {
  const bytes = Buffer.from(line, "utf8");
  if (bytes.length <= 75) return line;

  const parts: string[] = [];
  let offset = 0;
  let first = true;
  while (offset < bytes.length) {
    const chunkLen = first ? 75 : 74;
    parts.push(bytes.slice(offset, offset + chunkLen).toString("utf8"));
    offset += chunkLen;
    first = false;
  }
  return parts.join("\r\n ");
}

export function generateICS(event: ICSEvent): string {
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//GoodHours//GoodHours Calendar//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:REQUEST",
    "BEGIN:VEVENT",
    `UID:${icsEscape(event.uid)}@goodhours.app`,
    `DTSTAMP:${icsDate(new Date())}`,
    `DTSTART:${icsDate(event.startUtc)}`,
    `DTEND:${icsDate(event.endUtc)}`,
    `SUMMARY:${icsEscape(event.title)}`,
    ...(event.location ? [`LOCATION:${icsEscape(event.location)}`] : []),
    ...(event.description ? [`DESCRIPTION:${icsEscape(event.description)}`] : []),
    ...(event.organizerName ? [`ORGANIZER;CN=${icsEscape(event.organizerName)}:mailto:noreply@goodhours.app`] : []),
    "END:VEVENT",
    "END:VCALENDAR",
  ];
  return lines.map(foldLine).join("\r\n");
}

// Parse a "10:00 AM" string into { hours, minutes } (24h)
export function parseTimeString(t: string): { hours: number; minutes: number } {
  const match = t.trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)?$/i);
  if (!match) return { hours: 0, minutes: 0 };
  let h = parseInt(match[1], 10);
  const m = parseInt(match[2], 10);
  const ampm = match[3]?.toUpperCase();
  if (ampm === "PM" && h < 12) h += 12;
  if (ampm === "AM" && h === 12) h = 0;
  return { hours: h, minutes: m };
}

// Build UTC Date from a date field (just the calendar date part) + a time string.
// The stored `date` is stored in UTC midnight; we interpret startTime as local wall-clock
// and approximate UTC by treating the slot date as the day reference.
export function slotDateTime(slotDate: Date, timeStr: string): Date {
  const { hours, minutes } = parseTimeString(timeStr);
  const d = new Date(slotDate);
  d.setUTCHours(hours, minutes, 0, 0);
  return d;
}
