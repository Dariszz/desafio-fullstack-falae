ALTER TYPE "OutboxEventType" ADD VALUE 'REVIEW_REPROCESS_REQUESTED';

DROP INDEX "outbox_events_review_id_type_key";

CREATE INDEX "outbox_events_review_id_type_idx"
ON "outbox_events"("review_id", "type");
