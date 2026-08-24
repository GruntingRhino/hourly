export interface ImportRecord { key: string; values: Record<string, string>; }
export interface ImportBatch { id: string; before: ImportRecord[]; after: ImportRecord[]; status: "PREVIEW" | "APPLIED" | "ROLLED_BACK"; }
export function previewImport(existing: ImportRecord[], incoming: ImportRecord[]): { creates: ImportRecord[]; updates: ImportRecord[]; duplicates: ImportRecord[] } {
  const byKey = new Map(existing.map((record) => [record.key.toLowerCase(), record]));
  const seen = new Set<string>(); const creates: ImportRecord[] = []; const updates: ImportRecord[] = []; const duplicates: ImportRecord[] = [];
  for (const record of incoming) { const key = record.key.trim().toLowerCase(); if (!key || seen.has(key)) { duplicates.push(record); continue; } seen.add(key); const prior = byKey.get(key); if (prior) updates.push(record); else creates.push(record); }
  return { creates, updates, duplicates };
}
export function applyImport(id: string, existing: ImportRecord[], incoming: ImportRecord[]): ImportBatch {
  const preview = previewImport(existing, incoming); const byKey = new Map(existing.map((record) => [record.key.toLowerCase(), record]));
  [...preview.creates, ...preview.updates].forEach((record) => byKey.set(record.key.toLowerCase(), record));
  return { id, before: structuredClone(existing), after: [...byKey.values()], status: "APPLIED" };
}
export function rollbackImport(batch: ImportBatch): ImportRecord[] { if (batch.status !== "APPLIED") throw new Error("Import batch is not applied"); batch.status = "ROLLED_BACK"; return structuredClone(batch.before); }
