import { Prisma } from "@prisma/client";
import prisma from "./prisma";

const MAX_RETRIES = 3;

export function isRetryableSerializationError(err: unknown): boolean {
  if (!err || typeof err !== "object" || !("code" in err)) return false;
  const prismaError = err as { code?: string; meta?: { code?: string } };
  if (prismaError.code === "P2034") return true;
  if (prismaError.code === "P2010" && prismaError.meta?.code === "40001") {
    return true;
  }
  return false;
}

export async function runSerializableTransaction<T>(
  fn: (tx: Prisma.TransactionClient) => Promise<T>,
): Promise<T> {
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt += 1) {
    try {
      return await prisma.$transaction(fn, {
        isolationLevel: "Serializable",
      });
    } catch (err) {
      if (isRetryableSerializationError(err) && attempt < MAX_RETRIES) {
        continue;
      }
      throw err;
    }
  }

  throw new Error("Unreachable");
}
