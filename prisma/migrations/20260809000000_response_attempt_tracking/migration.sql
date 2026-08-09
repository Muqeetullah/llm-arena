-- Track the active generation attempt independently from row creation. This
-- lets abandoned streams be reclaimed without allowing an older request to
-- overwrite a newer retry.
ALTER TABLE "model_responses" ADD COLUMN "startedAt" TIMESTAMPTZ(3);

UPDATE "model_responses"
SET "startedAt" = "createdAt"
WHERE "status" = 'STREAMING';
