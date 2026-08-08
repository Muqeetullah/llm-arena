-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "ModelResponseStatus" AS ENUM ('PENDING', 'STREAMING', 'COMPLETED', 'FAILED', 'CANCELLED');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "threads" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "threads_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "turns" (
    "id" TEXT NOT NULL,
    "threadId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "prompt" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "turns_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "model_responses" (
    "id" TEXT NOT NULL,
    "turnId" TEXT NOT NULL,
    "modelId" TEXT NOT NULL,
    "modelName" TEXT NOT NULL,
    "status" "ModelResponseStatus" NOT NULL DEFAULT 'PENDING',
    "content" TEXT NOT NULL DEFAULT '',
    "errorCode" TEXT,
    "inputTokens" INTEGER,
    "outputTokens" INTEGER,
    "timeToFirstTokenMs" INTEGER,
    "durationMs" INTEGER,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "firstTokenAt" TIMESTAMPTZ(3),
    "completedAt" TIMESTAMPTZ(3),

    CONSTRAINT "model_responses_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "model_responses_inputTokens_check" CHECK ("inputTokens" IS NULL OR "inputTokens" >= 0),
    CONSTRAINT "model_responses_outputTokens_check" CHECK ("outputTokens" IS NULL OR "outputTokens" >= 0),
    CONSTRAINT "model_responses_timeToFirstTokenMs_check" CHECK ("timeToFirstTokenMs" IS NULL OR "timeToFirstTokenMs" >= 0),
    CONSTRAINT "model_responses_durationMs_check" CHECK ("durationMs" IS NULL OR "durationMs" >= 0)
);

-- CreateTable
CREATE TABLE "votes" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "turnId" TEXT NOT NULL,
    "responseId" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "votes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "threads_ownerId_updatedAt_idx" ON "threads"("ownerId", "updatedAt" DESC);

-- CreateIndex
CREATE INDEX "turns_threadId_createdAt_idx" ON "turns"("threadId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "turns_threadId_position_key" ON "turns"("threadId", "position");

-- CreateIndex
CREATE INDEX "model_responses_modelId_status_idx" ON "model_responses"("modelId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "model_responses_turnId_modelId_key" ON "model_responses"("turnId", "modelId");

-- CreateIndex
CREATE UNIQUE INDEX "model_responses_id_turnId_key" ON "model_responses"("id", "turnId");

-- CreateIndex
CREATE UNIQUE INDEX "votes_turnId_key" ON "votes"("turnId");

-- CreateIndex
CREATE UNIQUE INDEX "votes_responseId_key" ON "votes"("responseId");

-- CreateIndex
CREATE INDEX "votes_userId_createdAt_idx" ON "votes"("userId", "createdAt");

-- AddForeignKey
ALTER TABLE "threads" ADD CONSTRAINT "threads_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "turns" ADD CONSTRAINT "turns_threadId_fkey" FOREIGN KEY ("threadId") REFERENCES "threads"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "model_responses" ADD CONSTRAINT "model_responses_turnId_fkey" FOREIGN KEY ("turnId") REFERENCES "turns"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "votes" ADD CONSTRAINT "votes_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "votes" ADD CONSTRAINT "votes_turnId_fkey" FOREIGN KEY ("turnId") REFERENCES "turns"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "votes" ADD CONSTRAINT "votes_responseId_turnId_fkey" FOREIGN KEY ("responseId", "turnId") REFERENCES "model_responses"("id", "turnId") ON DELETE CASCADE ON UPDATE CASCADE;

-- Enforce voting rules that depend on related rows and cannot be represented in
-- the Prisma schema. The composite foreign key above separately guarantees that
-- the chosen response belongs to the voted turn.
CREATE FUNCTION "validate_vote"() RETURNS TRIGGER AS $$
DECLARE
    "completedResponseCount" INTEGER;
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM "model_responses"
        WHERE "id" = NEW."responseId"
          AND "turnId" = NEW."turnId"
          AND "status" = 'COMPLETED'
    ) THEN
        RAISE EXCEPTION 'A vote must select a completed response.'
            USING ERRCODE = 'check_violation';
    END IF;

    SELECT COUNT(*)
    INTO "completedResponseCount"
    FROM "model_responses"
    WHERE "turnId" = NEW."turnId"
      AND "status" = 'COMPLETED';

    IF "completedResponseCount" < 2 THEN
        RAISE EXCEPTION 'A vote requires at least two completed responses.'
            USING ERRCODE = 'check_violation';
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM "turns"
        INNER JOIN "threads" ON "threads"."id" = "turns"."threadId"
        WHERE "turns"."id" = NEW."turnId"
          AND "threads"."ownerId" = NEW."userId"
    ) THEN
        RAISE EXCEPTION 'Only the thread owner can vote on its turns.'
            USING ERRCODE = 'check_violation';
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "votes_validate_before_write"
BEFORE INSERT OR UPDATE OF "userId", "turnId", "responseId" ON "votes"
FOR EACH ROW EXECUTE FUNCTION "validate_vote"();
