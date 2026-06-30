import { PrismaClientKnownRequestError } from "@prisma/client/runtime/library";

export function isPrismaKnownRequestError(err: unknown): err is PrismaClientKnownRequestError {
  return err instanceof PrismaClientKnownRequestError;
}

export function isUniqueConstraintError(err: unknown): boolean {
  return Boolean(err && typeof err === "object" && "code" in err && (err as { code?: string }).code === "P2002");
}
