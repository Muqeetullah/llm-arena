import "server-only";

import type { ModelMessage } from "ai";

import { database } from "@/features/database/client";
import {
  MODEL_RESPONSE_ERROR_CODES,
  type ModelResponseErrorCode,
} from "@/features/arena/types";

import type { CastVoteInput, CreateTurnInput } from "./input";

const THREAD_TITLE_LENGTH = 80;
const RECENT_THREAD_LIMIT = 20;
const STALE_RESPONSE_ATTEMPT_MS = 90_000;

const threadTitle = (prompt: string): string =>
  prompt.length <= THREAD_TITLE_LENGTH
    ? prompt
    : `${prompt.slice(0, THREAD_TITLE_LENGTH - 1).trimEnd()}…`;

export async function createTurn(userId: string, input: CreateTurnInput) {
  return database.$transaction(
    async (transaction) => {
      await transaction.user.upsert({
        create: { id: userId },
        update: {},
        where: { id: userId },
      });

      const thread = input.threadId
        ? await transaction.thread.findFirst({
            select: { id: true, title: true },
            where: { id: input.threadId, ownerId: userId },
          })
        : await transaction.thread.create({
            data: { ownerId: userId, title: threadTitle(input.prompt) },
            select: { id: true, title: true },
          });

      if (!thread) {
        return null;
      }

      const latestTurn = await transaction.turn.findFirst({
        orderBy: { position: "desc" },
        select: { position: true },
        where: { threadId: thread.id },
      });
      const turn = await transaction.turn.create({
        data: {
          position: (latestTurn?.position ?? 0) + 1,
          prompt: input.prompt,
          responses: {
            create: input.models.map((model) => ({
              modelId: model.id,
              modelName: model.name,
            })),
          },
          threadId: thread.id,
        },
        select: {
          id: true,
          responses: {
            select: { id: true, modelId: true, modelName: true },
          },
        },
      });

      const updatedThread = await transaction.thread.update({
        data: { updatedAt: new Date() },
        select: { updatedAt: true },
        where: { id: thread.id },
      });

      return {
        threadId: thread.id,
        threadTitle: thread.title,
        threadUpdatedAt: updatedThread.updatedAt.toISOString(),
        turnId: turn.id,
        responses: turn.responses,
      };
    },
    { isolationLevel: "Serializable" },
  );
}

export async function claimResponse(userId: string, responseId: string) {
  return database.$transaction(async (transaction) => {
    const staleBefore = new Date(Date.now() - STALE_RESPONSE_ATTEMPT_MS);
    const response = await transaction.modelResponse.findFirst({
      select: {
        id: true,
        modelId: true,
        turn: {
          select: {
            position: true,
            prompt: true,
            thread: { select: { id: true, ownerId: true } },
          },
        },
      },
      where: {
        id: responseId,
        OR: [
          { status: { in: ["PENDING", "FAILED", "CANCELLED"] } },
          { status: "STREAMING", startedAt: { lt: staleBefore } },
          { status: "STREAMING", startedAt: null },
        ],
        turn: { thread: { ownerId: userId } },
      },
    });

    if (!response || response.turn.thread.ownerId !== userId) {
      return null;
    }

    const attemptStartedAt = new Date();
    const claimed = await transaction.modelResponse.updateMany({
      data: {
        completedAt: null,
        content: "",
        durationMs: null,
        errorCode: null,
        firstTokenAt: null,
        inputTokens: null,
        outputTokens: null,
        startedAt: attemptStartedAt,
        status: "STREAMING",
        timeToFirstTokenMs: null,
      },
      where: {
        id: response.id,
        OR: [
          { status: { in: ["PENDING", "FAILED", "CANCELLED"] } },
          { status: "STREAMING", startedAt: { lt: staleBefore } },
          { status: "STREAMING", startedAt: null },
        ],
      },
    });

    if (claimed.count !== 1) {
      return null;
    }

    const history = await transaction.turn.findMany({
      orderBy: { position: "asc" },
      select: {
        position: true,
        prompt: true,
        responses: {
          select: { content: true },
          where: { modelId: response.modelId, status: "COMPLETED" },
        },
      },
      where: {
        threadId: response.turn.thread.id,
        position: { lt: response.turn.position },
      },
    });

    const messages: ModelMessage[] = [];
    for (const turn of history) {
      const completedResponse = turn.responses[0];
      if (completedResponse) {
        messages.push(
          { role: "user", content: turn.prompt },
          { role: "assistant", content: completedResponse.content },
        );
      }
    }
    messages.push({ role: "user", content: response.turn.prompt });

    return {
      messages,
      modelId: response.modelId,
      promptText: response.turn.prompt,
      responseId: response.id,
      attemptStartedAt,
      threadId: response.turn.thread.id,
    };
  });
}

export async function finishResponse(
  responseId: string,
  attemptStartedAt: Date,
  values: Readonly<{
    content: string;
    durationMs: number;
    inputTokens: number | undefined;
    outputTokens: number | undefined;
    timeToFirstTokenMs: number;
  }>,
) {
  return database.modelResponse.updateMany({
    data: {
      completedAt: new Date(),
      content: values.content,
      durationMs: values.durationMs,
      firstTokenAt: new Date(
        Date.now() - values.durationMs + values.timeToFirstTokenMs,
      ),
      inputTokens: values.inputTokens,
      outputTokens: values.outputTokens,
      status: "COMPLETED",
      timeToFirstTokenMs: values.timeToFirstTokenMs,
    },
    where: { id: responseId, startedAt: attemptStartedAt, status: "STREAMING" },
  });
}

export async function failResponse(
  responseId: string,
  attemptStartedAt: Date,
  values: Readonly<{
    content: string;
    durationMs: number;
    errorCode: ModelResponseErrorCode;
    timeToFirstTokenMs: number | null;
  }>,
) {
  return database.modelResponse.updateMany({
    data: {
      content: values.content,
      durationMs: values.durationMs,
      errorCode: values.errorCode,
      status: values.errorCode === "ABORTED" ? "CANCELLED" : "FAILED",
      timeToFirstTokenMs: values.timeToFirstTokenMs,
    },
    where: { id: responseId, startedAt: attemptStartedAt, status: "STREAMING" },
  });
}

export async function getRecentThreads(userId: string) {
  const threads = await database.thread.findMany({
    orderBy: { updatedAt: "desc" },
    select: { id: true, title: true, updatedAt: true },
    take: RECENT_THREAD_LIMIT,
    where: { ownerId: userId },
  });

  return threads.map((thread) => ({
    id: thread.id,
    title: thread.title,
    updatedAt: thread.updatedAt.toISOString(),
  }));
}

const storedErrorCode = (
  value: string | null,
): ModelResponseErrorCode | null =>
  value && MODEL_RESPONSE_ERROR_CODES.some((code) => code === value)
    ? (value as ModelResponseErrorCode)
    : value
      ? "PROVIDER_ERROR"
      : null;

export async function getThread(userId: string, threadId: string) {
  const thread = await database.thread.findFirst({
    select: {
      id: true,
      title: true,
      updatedAt: true,
      turns: {
        orderBy: { position: "asc" },
        select: {
          createdAt: true,
          id: true,
          prompt: true,
          responses: {
            orderBy: { createdAt: "asc" },
            select: {
              content: true,
              durationMs: true,
              errorCode: true,
              id: true,
              modelId: true,
              modelName: true,
              outputTokens: true,
              status: true,
              timeToFirstTokenMs: true,
            },
          },
          vote: {
            select: { response: { select: { modelId: true } } },
          },
        },
      },
    },
    where: { id: threadId, ownerId: userId },
  });

  if (!thread) return null;

  return {
    id: thread.id,
    rounds: thread.turns.map((turn) => ({
      createdAt: turn.createdAt.toISOString(),
      prompt: turn.prompt,
      responses: turn.responses.map((response) => ({
        content: response.content,
        errorCode: storedErrorCode(response.errorCode),
        id: response.id,
        metrics:
          response.durationMs !== null &&
          response.outputTokens !== null &&
          response.timeToFirstTokenMs !== null
            ? {
                durationMs: response.durationMs,
                outputTokens: response.outputTokens,
                timeToFirstTokenMs: response.timeToFirstTokenMs,
              }
            : null,
        modelId: response.modelId,
        modelName: response.modelName,
        status:
          response.status === "COMPLETED"
            ? ("completed" as const)
            : response.status === "FAILED" || response.status === "CANCELLED"
              ? ("failed" as const)
              : response.status === "STREAMING"
                ? ("streaming" as const)
                : ("pending" as const),
      })),
      turnId: turn.id,
      winnerId: turn.vote?.response.modelId ?? null,
    })),
    title: thread.title,
    updatedAt: thread.updatedAt.toISOString(),
  };
}

export async function getResponseResult(userId: string, responseId: string) {
  const response = await database.modelResponse.findFirst({
    select: {
      content: true,
      durationMs: true,
      errorCode: true,
      outputTokens: true,
      status: true,
      timeToFirstTokenMs: true,
    },
    where: { id: responseId, turn: { thread: { ownerId: userId } } },
  });

  if (!response) return null;
  if (
    response.status === "COMPLETED" &&
    response.durationMs !== null &&
    response.outputTokens !== null &&
    response.timeToFirstTokenMs !== null
  ) {
    return {
      content: response.content,
      metrics: {
        durationMs: response.durationMs,
        outputTokens: response.outputTokens,
        timeToFirstTokenMs: response.timeToFirstTokenMs,
      },
      status: "completed" as const,
    };
  }

  if (response.status === "FAILED" || response.status === "CANCELLED") {
    return {
      content: response.content,
      errorCode: response.errorCode,
      status: "failed" as const,
    };
  }

  return { status: "in_progress" as const };
}

export async function castVote(userId: string, input: CastVoteInput) {
  const turn = await database.turn.findFirst({
    select: {
      id: true,
      responses: {
        select: { id: true },
        where: { status: "COMPLETED" },
      },
    },
    where: { id: input.turnId, thread: { ownerId: userId } },
  });

  if (!turn) {
    return null;
  }

  if (
    turn.responses.length < 2 ||
    !turn.responses.some((response) => response.id === input.responseId)
  ) {
    throw new Error("A vote needs at least two completed answers.");
  }

  return database.vote.upsert({
    create: { responseId: input.responseId, turnId: input.turnId, userId },
    update: { responseId: input.responseId, userId },
    where: { turnId: input.turnId },
  });
}
