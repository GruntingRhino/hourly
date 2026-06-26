import { fromFile } from "file-type";
import fs from "fs";

const ALLOWED_MIME_TYPES = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "text/plain",
  "text/csv",
]);

const TEXT_EXTENSIONS = new Set([".txt", ".csv"]);

// Read up to 4 KB to decide if a file looks like valid UTF-8 text.
function looksLikeText(filePath: string): boolean {
  try {
    const fd = fs.openSync(filePath, "r");
    const buf = Buffer.alloc(4096);
    const bytesRead = fs.readSync(fd, buf, 0, 4096, 0);
    fs.closeSync(fd);
    const sample = buf.slice(0, bytesRead);
    // Null bytes are a dead giveaway of binary content.
    if (sample.includes(0x00)) return false;
    try {
      new TextDecoder("utf-8", { fatal: true }).decode(sample);
      return true;
    } catch {
      return false;
    }
  } catch {
    return false;
  }
}

export interface MimeDetectResult {
  mimeType: string;
  allowed: boolean;
}

/**
 * Detect the real MIME type of a file from its magic bytes (never trusts
 * the client-supplied Content-Type). Falls back to text/plain validation
 * for .txt / .csv files that have no magic bytes.
 */
export async function detectMimeType(
  filePath: string,
  originalName: string
): Promise<MimeDetectResult> {
  const result = await fromFile(filePath);

  if (result) {
    return { mimeType: result.mime, allowed: ALLOWED_MIME_TYPES.has(result.mime) };
  }

  // file-type returns undefined for plain text / CSV — validate content instead.
  const ext = originalName.includes(".")
    ? originalName.slice(originalName.lastIndexOf(".")).toLowerCase()
    : "";

  if (TEXT_EXTENSIONS.has(ext) && looksLikeText(filePath)) {
    return { mimeType: ext === ".csv" ? "text/csv" : "text/plain", allowed: true };
  }

  return { mimeType: "application/octet-stream", allowed: false };
}
