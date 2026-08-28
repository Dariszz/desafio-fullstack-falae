-- CreateEnum
CREATE TYPE "ReviewStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "OutboxEventType" AS ENUM ('REVIEW_CREATED');

-- CreateTable
CREATE TABLE "reviews" (
    "id" UUID NOT NULL,
    "external_id" VARCHAR(100) NOT NULL,
    "company_id" VARCHAR(100) NOT NULL,
    "rating" SMALLINT NOT NULL,
    "comment" TEXT NOT NULL,
    "status" "ReviewStatus" NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "last_error" TEXT,
    "analysis_sentiment" VARCHAR(20),
    "analysis_category" VARCHAR(50),
    "analysis_confidence" DECIMAL(5,4),
    "analysis_keywords" JSONB,
    "analysis_request_id" VARCHAR(100),
    "analysis_processed_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "processed_at" TIMESTAMPTZ(3),

    CONSTRAINT "reviews_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "reviews_rating_check" CHECK ("rating" BETWEEN 1 AND 5),
    CONSTRAINT "reviews_attempts_check" CHECK ("attempts" >= 0),
    CONSTRAINT "reviews_analysis_confidence_check" CHECK (
        "analysis_confidence" IS NULL
        OR "analysis_confidence" BETWEEN 0 AND 1
    )
);

-- CreateTable
CREATE TABLE "outbox_events" (
    "id" UUID NOT NULL,
    "review_id" UUID NOT NULL,
    "type" "OutboxEventType" NOT NULL,
    "payload" JSONB NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "available_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "published_at" TIMESTAMPTZ(3),
    "last_error" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "outbox_events_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "outbox_events_attempts_check" CHECK ("attempts" >= 0)
);

-- CreateIndex
CREATE INDEX "reviews_status_created_at_idx" ON "reviews"("status", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "reviews_company_id_external_id_key" ON "reviews"("company_id", "external_id");

-- CreateIndex
CREATE INDEX "outbox_events_pending_idx" ON "outbox_events"("published_at", "available_at");

-- CreateIndex
CREATE UNIQUE INDEX "outbox_events_review_id_type_key" ON "outbox_events"("review_id", "type");

-- AddForeignKey
ALTER TABLE "outbox_events" ADD CONSTRAINT "outbox_events_review_id_fkey" FOREIGN KEY ("review_id") REFERENCES "reviews"("id") ON DELETE CASCADE ON UPDATE CASCADE;
