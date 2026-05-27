import { z } from "zod";

export const trimmedString = (max: number, min = 0) =>
  z
    .string()
    .trim()
    .min(min)
    .max(max);

export const optionalTrimmedString = (max: number, min = 0) =>
  trimmedString(max, min).optional();

export const tokenSchema = z
  .string()
  .trim()
  .min(16)
  .max(512)
  .regex(/^[A-Za-z0-9._~+/=-]+$/, "Invalid token format");

export const opaqueIdSchema = z.string().trim().min(1).max(191);

export function strictObject<T extends z.ZodRawShape>(shape: T) {
  return z.strictObject(shape);
}

export function firstZodError(error: z.ZodError, fallback = "Validation failed"): string {
  return error.issues[0]?.message ?? fallback;
}
