import crypto from "crypto";
import prisma from "./prisma";
import { generateToken, hashToken } from "./tokenHash";

export const OAUTH_STATE_COOKIE = "gh_oauth_state_binding";
export const OAUTH_STATE_TTL_MS = 15 * 60 * 1000;

type StateModel = "canvasOAuthState" | "googleClassroomOAuthState";

type StateData = {
  schoolId: string;
  actorId: string;
  browserBindingHash: string;
  expiresAt: Date;
  [key: string]: unknown;
};

export function createOAuthState(): { state: string; browserBinding: string } {
  return { state: generateToken(), browserBinding: generateToken() };
}

export async function storeOAuthState(model: StateModel, state: string, browserBinding: string, data: Omit<StateData, "browserBindingHash" | "expiresAt">, client: any = prisma) {
  const expiresAt = new Date(Date.now() + OAUTH_STATE_TTL_MS);
  await (client[model] as any).create({
    data: {
      ...data,
      stateHash: hashToken(state),
      browserBindingHash: hashToken(browserBinding),
      expiresAt,
    },
  });
  return expiresAt;
}

export async function claimOAuthState<T extends object>(model: StateModel, state: string, browserBinding: string, client: any = prisma): Promise<T> {
  const stateHash = hashToken(state);
  const row = await (client[model] as any).findUnique({ where: { stateHash } });
  if (!row || row.consumedAt || row.expiresAt.getTime() <= Date.now()) throw new Error("Invalid or expired OAuth state.");
  if (!row.browserBindingHash || !crypto.timingSafeEqual(Buffer.from(row.browserBindingHash), Buffer.from(hashToken(browserBinding)))) {
    throw new Error("OAuth state browser mismatch.");
  }
  const claimed = await (client[model] as any).updateMany({
    where: { id: row.id, consumedAt: null, expiresAt: { gt: new Date() } },
    data: { consumedAt: new Date() },
  });
  if (claimed.count !== 1) throw new Error("Invalid or expired OAuth state.");
  return row as T;
}

export async function assertOAuthAdministrator(actorId: string, schoolId: string, client: any = prisma): Promise<void> {
  const actor = await client.user.findUnique({
    where: { id: actorId },
    select: { role: true, status: true, schoolId: true },
  });
  if (!actor || actor.role !== "SCHOOL_ADMIN" || actor.status !== "ACTIVE" || actor.schoolId !== schoolId) {
    throw new Error("OAuth administrator is no longer authorized.");
  }
}
