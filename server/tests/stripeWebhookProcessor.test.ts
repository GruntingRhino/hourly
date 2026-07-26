import test from "node:test";
import assert from "node:assert/strict";
import { processStripeEventAtomically } from "../src/lib/stripeWebhookProcessor";

test("does not retain an event receipt when the subscription update fails", async () => {
  const receipts = new Set<string>();
  const db = {
    async $transaction<T>(work: (tx: any) => Promise<T>): Promise<T> {
      const stagedReceipts = new Set(receipts);
      const tx = {
        stripeProcessedEvent: {
          create: async ({ data }: { data: { id: string } }) => {
            if (stagedReceipts.has(data.id)) {
              const error = Object.assign(new Error("duplicate receipt"), { code: "P2002" });
              throw error;
            }
            stagedReceipts.add(data.id);
          },
        },
      };
      try {
        const result = await work(tx);
        receipts.clear();
        for (const id of stagedReceipts) receipts.add(id);
        return result;
      } catch (error) {
        throw error;
      }
    },
  };

  await assert.rejects(
    processStripeEventAtomically(db, "evt_failed_update", async () => {
      throw new Error("database update failed");
    }),
    /database update failed/
  );
  assert.equal(receipts.has("evt_failed_update"), false);
});

test("deduplicates an event only after its update commits", async () => {
  const receipts = new Set<string>();
  const db = {
    async $transaction<T>(work: (tx: any) => Promise<T>): Promise<T> {
      const stagedReceipts = new Set(receipts);
      const tx = {
        stripeProcessedEvent: {
          create: async ({ data }: { data: { id: string } }) => {
            if (stagedReceipts.has(data.id)) {
              throw Object.assign(new Error("duplicate receipt"), { code: "P2002" });
            }
            stagedReceipts.add(data.id);
          },
        },
      };
      const result = await work(tx);
      receipts.clear();
      for (const id of stagedReceipts) receipts.add(id);
      return result;
    },
  };
  let updates = 0;
  const update = async () => { updates += 1; };

  assert.deepEqual(await processStripeEventAtomically(db, "evt_once", update), { processed: true });
  assert.deepEqual(await processStripeEventAtomically(db, "evt_once", update), { processed: false });
  assert.equal(updates, 1);
});

test("does not mistake a reducer unique-constraint failure for a duplicate event", async () => {
  const db = {
    async $transaction<T>(work: (tx: any) => Promise<T>): Promise<T> {
      return work({ stripeProcessedEvent: { create: async () => undefined } });
    },
  };

  await assert.rejects(
    processStripeEventAtomically(db, "evt_projection_conflict", async () => {
      throw Object.assign(new Error("subscription projection conflict"), { code: "P2002" });
    }),
    /subscription projection conflict/,
  );
});
