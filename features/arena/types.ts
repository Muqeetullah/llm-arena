import type { UIMessage } from "ai";
import { z } from "zod";

export type ResponseMetrics = Readonly<{
  durationMs: number;
  outputTokens: number;
  timeToFirstTokenMs: number;
}>;

export type ArenaMessageMetadata = Readonly<{
  metrics?: ResponseMetrics;
}>;

export type ArenaUIMessage = UIMessage<ArenaMessageMetadata>;

export const MODEL_RESPONSE_ERROR_CODES = [
  "ABORTED",
  "EMPTY_RESPONSE",
  "MODEL_UNAVAILABLE",
  "PROVIDER_ERROR",
  "RATE_LIMITED",
  "REQUEST_BLOCKED",
  "TIMEOUT",
] as const;

export type ModelResponseErrorCode =
  (typeof MODEL_RESPONSE_ERROR_CODES)[number];

const responseResultSchema = z.discriminatedUnion("status", [
  z.object({
    content: z.string(),
    metrics: z.object({
      durationMs: z.number().int().nonnegative(),
      outputTokens: z.number().int().nonnegative(),
      timeToFirstTokenMs: z.number().int().nonnegative(),
    }),
    status: z.literal("completed"),
  }),
  z.object({
    content: z.string(),
    errorCode: z.string().nullable(),
    status: z.literal("failed"),
  }),
  z.object({ status: z.literal("in_progress") }),
]);

export type ResponseResult = z.infer<typeof responseResultSchema>;

export const parseResponseResult = (value: unknown): ResponseResult | null => {
  const parsed = responseResultSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
};

export type CreatedTurn = Readonly<{
  threadId: string;
  threadTitle: string;
  threadUpdatedAt: string;
  turnId: string;
  responses: readonly Readonly<{
    id: string;
    modelId: string;
    modelName: string;
  }>[];
}>;

const createdTurnSchema = z.object({
  responses: z.array(
    z.object({
      id: z.string().min(1),
      modelId: z.string().min(1),
      modelName: z.string().min(1),
    }),
  ),
  threadId: z.string().min(1),
  threadTitle: z.string().min(1),
  threadUpdatedAt: z.string().datetime(),
  turnId: z.string().min(1),
});

export const parseCreatedTurn = (value: unknown): CreatedTurn | null => {
  const parsed = createdTurnSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
};

export type ThreadSummary = Readonly<{
  id: string;
  title: string;
  updatedAt: string;
}>;

const storedResponseSchema = z.object({
  content: z.string(),
  errorCode: z.enum(MODEL_RESPONSE_ERROR_CODES).nullable(),
  id: z.string().min(1),
  metrics: z
    .object({
      durationMs: z.number().int().nonnegative(),
      outputTokens: z.number().int().nonnegative(),
      timeToFirstTokenMs: z.number().int().nonnegative(),
    })
    .nullable(),
  modelId: z.string().min(1),
  modelName: z.string().min(1),
  status: z.enum(["pending", "streaming", "completed", "failed"]),
});

const storedThreadSchema = z.object({
  id: z.string().min(1),
  rounds: z.array(
    z.object({
      createdAt: z.string().datetime(),
      prompt: z.string(),
      responses: z.array(storedResponseSchema),
      turnId: z.string().min(1),
      winnerId: z.string().min(1).nullable(),
    }),
  ),
  title: z.string().min(1),
  updatedAt: z.string().datetime(),
});

export type StoredThread = z.infer<typeof storedThreadSchema>;

export const parseStoredThread = (value: unknown): StoredThread | null => {
  const parsed = storedThreadSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
};
