import fs from "fs";
import path from "path";
import prisma from "./prisma";

const UPLOAD_DIR = path.join(__dirname, "../../../uploads/beneficiary-attachments");
const ORPHAN_MAX_AGE_MS = 24 * 60 * 60 * 1000; // 24 hours

async function cleanOrphanedDiskFiles(): Promise<void> {
  if (!fs.existsSync(UPLOAD_DIR)) return;
  const files = fs.readdirSync(UPLOAD_DIR);
  if (files.length === 0) return;

  const cutoff = new Date(Date.now() - ORPHAN_MAX_AGE_MS);
  const candidates: string[] = [];
  for (const file of files) {
    try {
      const stat = fs.statSync(path.join(UPLOAD_DIR, file));
      if (stat.mtimeMs < cutoff.getTime()) candidates.push(file);
    } catch {}
  }
  if (candidates.length === 0) return;

  // Keep any filename that still has a DB record.
  const referenced = await prisma.beneficiaryOpportunityAttachment.findMany({
    where: { filename: { in: candidates } },
    select: { filename: true },
  });
  const referencedSet = new Set(referenced.map((r) => r.filename));

  let deleted = 0;
  for (const file of candidates) {
    if (!referencedSet.has(file)) {
      try {
        fs.unlinkSync(path.join(UPLOAD_DIR, file));
        deleted++;
      } catch {}
    }
  }
  if (deleted > 0) {
    console.log(`[uploadCleanup] Removed ${deleted} orphaned disk file(s).`);
  }
}

async function cleanCancelledOpportunityAttachments(): Promise<void> {
  const cutoff = new Date(Date.now() - ORPHAN_MAX_AGE_MS);

  // Find attachments whose opportunity has been CANCELLED for > 24 h.
  const stale = await prisma.beneficiaryOpportunityAttachment.findMany({
    where: {
      opportunity: { status: "CANCELLED", updatedAt: { lt: cutoff } },
    },
    select: { id: true, filename: true },
  });
  if (stale.length === 0) return;

  const ids = stale.map((a) => a.id);
  const filenames = stale.map((a) => a.filename);

  await prisma.beneficiaryOpportunityAttachment.deleteMany({ where: { id: { in: ids } } });

  // Only delete a physical file if no remaining DB record references it.
  const stillReferenced = await prisma.beneficiaryOpportunityAttachment.findMany({
    where: { filename: { in: filenames } },
    select: { filename: true },
  });
  const stillReferencedSet = new Set(stillReferenced.map((r) => r.filename));

  let deleted = 0;
  for (const filename of filenames) {
    if (!stillReferencedSet.has(filename)) {
      try {
        fs.unlinkSync(path.join(UPLOAD_DIR, filename));
        deleted++;
      } catch {}
    }
  }

  console.log(`[uploadCleanup] Cleaned ${ids.length} attachment record(s), removed ${deleted} file(s) for cancelled opportunities.`);
}

export async function runUploadCleanupCycle(): Promise<void> {
  await cleanOrphanedDiskFiles();
  await cleanCancelledOpportunityAttachments();
}

export function startUploadCleanupJob(): void {
  const run = async () => {
    try {
      await runUploadCleanupCycle();
    } catch (err) {
      console.error("[uploadCleanup] Error during cleanup:", err);
    }
  };

  // Run once at startup (after a short delay to let the server fully initialise).
  setTimeout(() => void run(), 60_000);
  // Then every hour.
  setInterval(() => void run(), 60 * 60 * 1000);
}
