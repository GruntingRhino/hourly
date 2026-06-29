import { Prisma } from "@prisma/client";
import prisma from "./prisma";

type LeaseHandle = {
  release: (markRan?: boolean) => Promise<void>;
};

export async function acquireJobLease(
  jobName: string,
  leaseMs: number
): Promise<LeaseHandle | null> {
  const leaseUntil = new Date(Date.now() + leaseMs);
  const now = new Date();

  const updated = await prisma.$executeRaw(
    Prisma.sql`
      UPDATE "ScheduledJobLease"
      SET "leaseUntil" = ${leaseUntil}, "updatedAt" = NOW()
      WHERE "jobName" = ${jobName}
        AND "leaseUntil" <= ${now}
    `
  );

  if (updated === 0) {
    try {
      await prisma.scheduledJobLease.create({
        data: {
          jobName,
          leaseUntil,
        },
      });
    } catch (err) {
      if (!(err instanceof Prisma.PrismaClientKnownRequestError) || err.code !== "P2002") {
        throw err;
      }

      const retry = await prisma.$executeRaw(
        Prisma.sql`
          UPDATE "ScheduledJobLease"
          SET "leaseUntil" = ${leaseUntil}, "updatedAt" = NOW()
          WHERE "jobName" = ${jobName}
            AND "leaseUntil" <= ${now}
        `
      );

      if (retry === 0) {
        return null;
      }
    }
  }

  return {
    async release(markRan = false) {
      await prisma.scheduledJobLease.update({
        where: { jobName },
        data: {
          leaseUntil: new Date(0),
          lastRunAt: markRan ? new Date() : undefined,
        },
      });
    },
  };
}

export async function shouldRunJob(
  jobName: string,
  cadenceMs: number
): Promise<boolean> {
  const lease = await prisma.scheduledJobLease.findUnique({
    where: { jobName },
    select: { lastRunAt: true },
  });

  if (!lease?.lastRunAt) return true;
  return Date.now() - lease.lastRunAt.getTime() >= cadenceMs;
}
