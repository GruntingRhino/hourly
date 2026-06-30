import prisma from "./prisma";
import { isPrismaKnownRequestError } from "./prismaErrors";

type LeaseHandle = {
  release: (markRan?: boolean) => Promise<void>;
};

export async function acquireJobLease(
  jobName: string,
  leaseMs: number
): Promise<LeaseHandle | null> {
  const leaseUntil = new Date(Date.now() + leaseMs);
  const now = new Date();

  const updated = await prisma.$executeRawUnsafe(
    `UPDATE "ScheduledJobLease"
     SET "leaseUntil" = $1, "updatedAt" = NOW()
     WHERE "jobName" = $2
       AND "leaseUntil" <= $3`,
    leaseUntil,
    jobName,
    now
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
      if (!isPrismaKnownRequestError(err) || err.code !== "P2002") {
        throw err;
      }

      const retry = await prisma.$executeRawUnsafe(
        `UPDATE "ScheduledJobLease"
         SET "leaseUntil" = $1, "updatedAt" = NOW()
         WHERE "jobName" = $2
           AND "leaseUntil" <= $3`,
        leaseUntil,
        jobName,
        now
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
