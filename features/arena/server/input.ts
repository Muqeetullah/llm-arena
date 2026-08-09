import "server-only";

import { z } from "zod";

import { isFreeModelId } from "@/features/model-catalog/types";

const MAX_PROMPT_CHARACTERS = 8_000;
const MAX_SELECTED_MODELS = 3;

const modelSelectionSchema = z
  .object({
    id: z.string().trim().min(1).max(200).refine(isFreeModelId),
    name: z.string().trim().min(1).max(200),
  })
  .strict();

const createTurnSchema = z
  .object({
    models: z.array(modelSelectionSchema).min(1).max(MAX_SELECTED_MODELS),
    prompt: z.string().trim().min(1).max(MAX_PROMPT_CHARACTERS),
    threadId: z.string().trim().min(1).max(200).nullable(),
  })
  .strict()
  .refine(
    ({ models }) =>
      new Set(models.map((model) => model.id)).size === models.length,
    { message: "Models must be unique." },
  );

const streamResponseSchema = z
  .object({ responseId: z.string().trim().min(1).max(200) })
  .strict();

const threadIdSchema = z.string().trim().min(1).max(200);

const castVoteSchema = z
  .object({
    responseId: z.string().trim().min(1).max(200),
    turnId: z.string().trim().min(1).max(200),
  })
  .strict();

export type CreateTurnInput = z.infer<typeof createTurnSchema>;
export type CastVoteInput = z.infer<typeof castVoteSchema>;

export const parseCreateTurn = (value: unknown): CreateTurnInput | null => {
  const parsed = createTurnSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
};

export const parseResponseId = (value: unknown): string | null => {
  const parsed = streamResponseSchema.safeParse(value);
  return parsed.success ? parsed.data.responseId : null;
};

export const parseThreadId = (value: unknown): string | null => {
  const parsed = threadIdSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
};

export const parseVote = (value: unknown): CastVoteInput | null => {
  const parsed = castVoteSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
};
