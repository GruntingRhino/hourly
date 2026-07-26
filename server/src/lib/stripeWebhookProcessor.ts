type StripeEventTransactionClient = Record<string, any> & {
  stripeProcessedEvent: {
    create: (args: { data: { id: string } }) => Promise<unknown>;
  };
};

type StripeWebhookDatabase = {
  $transaction: <T>(work: (tx: StripeEventTransactionClient) => Promise<T>) => Promise<T>;
};

function isUniqueConstraintError(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === "P2002";
}

/**
 * Commits a Stripe event receipt and its local billing projection together.
 * A failed projection rolls back the receipt so Stripe can retry the event.
 */
export async function processStripeEventAtomically(
  db: StripeWebhookDatabase,
  eventId: string,
  applyUpdate: (tx: StripeEventTransactionClient) => Promise<void>,
): Promise<{ processed: boolean }> {
  let receiptCreated = false;
  try {
    await db.$transaction(async (tx) => {
      await tx.stripeProcessedEvent.create({ data: { id: eventId } });
      receiptCreated = true;
      await applyUpdate(tx);
    });
    return { processed: true };
  } catch (error) {
    // Only a conflict while inserting the event receipt means Stripe delivered
    // an event that already committed. A P2002 from the billing projection is a
    // real handler failure and must propagate so the webhook returns 500/retries.
    if (!receiptCreated && isUniqueConstraintError(error)) return { processed: false };
    throw error;
  }
}
