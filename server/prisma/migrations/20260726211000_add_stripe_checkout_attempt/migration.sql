CREATE TABLE "StripeCheckoutAttempt" (
  "id" TEXT NOT NULL,
  "beneficiaryId" TEXT NOT NULL,
  "interval" TEXT NOT NULL,
  "idempotencyKey" TEXT NOT NULL,
  "stripeSessionId" TEXT,
  "checkoutUrl" TEXT,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "StripeCheckoutAttempt_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "StripeCheckoutAttempt_beneficiaryId_key" ON "StripeCheckoutAttempt"("beneficiaryId");
CREATE UNIQUE INDEX "StripeCheckoutAttempt_idempotencyKey_key" ON "StripeCheckoutAttempt"("idempotencyKey");
CREATE UNIQUE INDEX "StripeCheckoutAttempt_stripeSessionId_key" ON "StripeCheckoutAttempt"("stripeSessionId");
ALTER TABLE "StripeCheckoutAttempt" ADD CONSTRAINT "StripeCheckoutAttempt_beneficiaryId_fkey"
  FOREIGN KEY ("beneficiaryId") REFERENCES "Beneficiary"("id") ON DELETE CASCADE ON UPDATE CASCADE;
