-- Two-factor authentication (TOTP) and backup codes
ALTER TABLE "User" ADD COLUMN "totpSecret" TEXT,
ADD COLUMN "totpEnabledAt" TIMESTAMP(3),
ADD COLUMN "totpLastStep" INTEGER,
ADD COLUMN "backupCodes" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- HMAC signing secret for outgoing webhooks
ALTER TABLE "AlertChannel" ADD COLUMN "secret" TEXT;
