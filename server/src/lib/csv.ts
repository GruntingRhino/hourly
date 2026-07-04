/**
 * Safe CSV serialization.
 *
 * Every cell is quoted with embedded quotes doubled (RFC 4180), and cells that
 * begin with a formula trigger character (= + - @, tab, CR) are prefixed with
 * a single quote so spreadsheet apps render them as text instead of executing
 * them. User-controlled values (names, org titles) flow into exports opened by
 * school staff — without this an org named `=HYPERLINK(...)` becomes a live
 * formula in Excel (CSV injection).
 */

export function csvCell(value: string | number | null | undefined): string {
  let text = value == null ? "" : String(value);
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
}

export function buildCsv(rows: Array<Array<string | number | null | undefined>>): string {
  return rows.map((row) => row.map(csvCell).join(",")).join("\n");
}
