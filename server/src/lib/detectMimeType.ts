import fs from "fs";
import path from "path";

// Magic-byte signatures for formats we accept.
// Each entry: [byteOffset, bytes, mimeType]
const MAGIC: Array<[number, number[], string]> = [
  [0,  [0x25, 0x50, 0x44, 0x46],                         "application/pdf"],          // %PDF
  [0,  [0xff, 0xd8, 0xff],                                "image/jpeg"],
  [0,  [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], "image/png"],
  [0,  [0x47, 0x49, 0x46, 0x38],                          "image/gif"],               // GIF8
  [0,  [0x52, 0x49, 0x46, 0x46],                          "image/webp"],              // RIFF (need extra check)
  [0,  [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1], "application/msword"],     // OLE2 (DOC/XLS)
  [0,  [0x50, 0x4b, 0x03, 0x04],                          "application/zip"],         // ZIP (DOCX/XLSX are ZIP)
];

const ALLOWED_MIME_TYPES = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "text/plain",
  "text/csv",
  "image/tiff",
]);

const TEXT_EXTENSIONS = new Set([".txt", ".csv"]);

// Office Open XML formats are ZIP archives — peek inside to tell DOCX from XLSX.
function sniffOfficeZip(filePath: string): string {
  try {
    const buf = Buffer.alloc(512);
    const fd = fs.openSync(filePath, "r");
    const n = fs.readSync(fd, buf, 0, 512, 0);
    fs.closeSync(fd);
    const snippet = buf.slice(0, n).toString("binary");
    if (snippet.includes("word/")) return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
    if (snippet.includes("xl/"))   return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
    return "application/zip";
  } catch {
    return "application/zip";
  }
}

// For RIFF containers, check bytes 8-11 for "WEBP".
function isWebp(buf: Buffer): boolean {
  return buf.length >= 12 && buf.slice(8, 12).toString("ascii") === "WEBP";
}

// TIFF: little-endian "II" or big-endian "MM" magic.
function isTiff(buf: Buffer): boolean {
  if (buf.length < 4) return false;
  return (buf[0] === 0x49 && buf[1] === 0x49 && buf[2] === 0x2a && buf[3] === 0x00) ||
         (buf[0] === 0x4d && buf[1] === 0x4d && buf[2] === 0x00 && buf[3] === 0x2a);
}

function looksLikeText(filePath: string): boolean {
  try {
    const fd = fs.openSync(filePath, "r");
    const buf = Buffer.alloc(4096);
    const bytesRead = fs.readSync(fd, buf, 0, 4096, 0);
    fs.closeSync(fd);
    const sample = buf.slice(0, bytesRead);
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

export function detectMimeType(filePath: string, originalName: string): MimeDetectResult {
  try {
    const fd = fs.openSync(filePath, "r");
    const buf = Buffer.alloc(16);
    const n = fs.readSync(fd, buf, 0, 16, 0);
    fs.closeSync(fd);
    const head = buf.slice(0, n);

    if (isTiff(head)) {
      return { mimeType: "image/tiff", allowed: true };
    }

    for (const [offset, bytes, mime] of MAGIC) {
      if (head.length < offset + bytes.length) continue;
      if (bytes.every((b, i) => head[offset + i] === b)) {
        if (mime === "image/webp" && !isWebp(head)) continue;
        if (mime === "application/zip") {
          const resolved = sniffOfficeZip(filePath);
          return { mimeType: resolved, allowed: ALLOWED_MIME_TYPES.has(resolved) };
        }
        return { mimeType: mime, allowed: ALLOWED_MIME_TYPES.has(mime) };
      }
    }
  } catch {
    // fall through to text check
  }

  const ext = originalName.includes(".")
    ? originalName.slice(originalName.lastIndexOf(".")).toLowerCase()
    : "";

  if (TEXT_EXTENSIONS.has(ext) && looksLikeText(filePath)) {
    return { mimeType: ext === ".csv" ? "text/csv" : "text/plain", allowed: true };
  }

  return { mimeType: "application/octet-stream", allowed: false };
}
