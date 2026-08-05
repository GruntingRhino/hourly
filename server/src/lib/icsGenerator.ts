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

// ICS line folding: lines > 75 octets must be folded at 75 with CRLF + SPACE.
// We walk back from the chunk boundary to avoid splitting multi-byte UTF-8 sequences
// (continuation bytes have the bit pattern 10xxxxxx = 0x80..0xBF).
function foldLine(line: string): string {
  const bytes = Buffer.from(line, "utf8");
  if (bytes.length <= 75) return line;

  const parts: string[] = [];
  let offset = 0;
  let first = true;
  while (offset < bytes.length) {
    const limit = offset + (first ? 75 : 74);
    first = false;
    if (limit >= bytes.length) {
      parts.push(bytes.slice(offset).toString("utf8"));
      break;
    }
    // Walk back to the start of a UTF-8 code point
    let end = limit;
    while (end > offset && (bytes[end]! & 0xc0) === 0x80) end--;
    parts.push(bytes.slice(offset, end).toString("utf8"));
    offset = end;
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
// `timezone` is an IANA timezone name (e.g. "America/New_York"). When provided, the
// time string is interpreted as wall-clock time in that zone and converted to UTC
// correctly, including DST transitions. Defaults to "UTC" so existing callers that
// store times as UTC continue to work unchanged.
export function slotDateTime(slotDate: Date, timeStr: string, timezone = "UTC"): Date {
  const { hours, minutes } = parseTimeString(timeStr);

  // `slotDate` is a plain calendar date (no meaningful time-of-day) stored
  // as a UTC-midnight Date — e.g. `new Date("2026-09-05")`. Read its
  // calendar fields directly with the UTC getters. Do NOT re-derive the
  // date by reformatting slotDate through the target timezone (the
  // previous implementation's bug): UTC midnight, viewed in any timezone
  // behind UTC (west of it — every US zone, and the only timezone this
  // app's data has ever actually used, America/New_York), always lands on
  // the *previous* calendar day, silently shifting every event a day
  // early. Confirmed live in production: every existing Beneficiary row's
  // timezone is the schema default, America/New_York.
  const localDateStr = `${slotDate.getUTCFullYear()}-${String(slotDate.getUTCMonth() + 1).padStart(2, "0")}-${String(slotDate.getUTCDate()).padStart(2, "0")}`;

  const hh = String(hours).padStart(2, "0");
  const mm = String(minutes).padStart(2, "0");

  // Treat the wall-clock time as UTC first (a reference point), then measure how
  // far it drifts when viewed through the target timezone — that drift is the UTC
  // offset — and compensate for it.
  const nominalUTC = new Date(`${localDateStr}T${hh}:${mm}:00Z`);

  // Re-read what that UTC moment looks like in the target timezone
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
    hour12: false,
  }).formatToParts(nominalUTC);
  const p = Object.fromEntries(parts.map((x) => [x.type, x.value]));
  const tzDate = new Date(`${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}:${p.second}Z`);

  // offsetMs = how many ms we need to ADD to the nominal UTC to get the true UTC moment
  return new Date(nominalUTC.getTime() + (nominalUTC.getTime() - tzDate.getTime()));
}

/**
 * §7 canonical event-time model: compute the precomputed startsAt/endsAt
 * pair every BeneficiaryTimeSlot write path should populate. Thin wrapper
 * around slotDateTime so both the start and end conversion always happen
 * together, from the same inputs, at every call site.
 */
export function computeSlotTimestamps(
  date: Date,
  startTime: string,
  endTime: string,
  timezone: string
): { startsAt: Date; endsAt: Date } {
  return {
    startsAt: slotDateTime(date, startTime, timezone),
    endsAt: slotDateTime(date, endTime, timezone),
  };
}
