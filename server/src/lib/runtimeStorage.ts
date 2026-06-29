import fs from "fs";
import os from "os";
import path from "path";

export function resolveWritableUploadDir(...segments: string[]): string {
  const baseDir = process.env.VERCEL
    ? os.tmpdir()
    : path.join(__dirname, "../../../uploads");

  const dir = path.join(baseDir, ...segments);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}
