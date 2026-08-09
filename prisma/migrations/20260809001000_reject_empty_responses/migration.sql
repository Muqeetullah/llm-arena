-- A reasoning-only generation is not a visible answer and must never be
-- voteable as a completed response.
UPDATE "model_responses"
SET
    "status" = 'FAILED',
    "errorCode" = 'EMPTY_RESPONSE',
    "completedAt" = NULL
WHERE "status" = 'COMPLETED'
  AND BTRIM("content") = '';

ALTER TABLE "model_responses"
ADD CONSTRAINT "model_responses_completed_content_check"
CHECK ("status" <> 'COMPLETED' OR BTRIM("content") <> '');
