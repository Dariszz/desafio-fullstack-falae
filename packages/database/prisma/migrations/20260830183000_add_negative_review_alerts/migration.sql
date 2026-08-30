CREATE TYPE "AlertType" AS ENUM ('NEGATIVE_REVIEW');

CREATE TABLE "review_alerts" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "review_id" UUID NOT NULL,
    "type" "AlertType" NOT NULL DEFAULT 'NEGATIVE_REVIEW',
    "message" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "review_alerts_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "review_alerts_review_id_key" ON "review_alerts"("review_id");
CREATE INDEX "review_alerts_created_at_idx" ON "review_alerts"("created_at");

ALTER TABLE "review_alerts"
ADD CONSTRAINT "review_alerts_review_id_fkey"
FOREIGN KEY ("review_id") REFERENCES "reviews"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
