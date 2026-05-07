import { Prisma } from "@prisma/client";
import prisma from "./prisma";

const MAX_RETRIES = 3;

function isRetryableSerializationError(err: unknown): boolean {
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === "P2034") return true;
    if (err.code === "P2010" && (err.meta as { code?: string } | undefined)?.code === "40001") {
      return true;
    }
  }
  return false;
}

export async function runSerializableTransaction<T>(
  fn: (tx: Prisma.TransactionClient) => Promise<T>,
): Promise<T> {
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt += 1) {
    try {
      return await prisma.$transaction(fn, {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
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
