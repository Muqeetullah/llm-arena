import { isTextUIPart, safeValidateUIMessages, type UIMessage } from "ai";
import { z } from "zod";

import { isFreeModelId } from "@/features/model-catalog/types";

const MAX_MESSAGE_COUNT = 50;
const MAX_PROMPT_CHARACTERS = 32_000;

const requestBodySchema = z
  .object({
    messages: z.unknown(),
    model: z.string().trim().min(1).max(200),
  })
  .strict();

export type ModelRequestInput = Readonly<{
  messages: readonly UIMessage[];
  model: string;
  promptText: string;
}>;

const textFromMessage = (message: UIMessage): string =>
  message.parts
    .filter(isTextUIPart)
    .map((part) => part.text)
    .join(" ");

const latestUserPrompt = (messages: readonly UIMessage[]): string =>
  [...messages]
    .reverse()
    .find((message) => message.role === "user")
    ?.parts.filter(isTextUIPart)
    .map((part) => part.text)
    .join(" ")
    .trim() ?? "";

export async function parseModelRequest(
  value: unknown,
): Promise<ModelRequestInput | null> {
  const body = requestBodySchema.safeParse(value);

  if (!body.success || !isFreeModelId(body.data.model)) {
    return null;
  }

  const validation = await safeValidateUIMessages({
    messages: body.data.messages,
  });

  if (!validation.success || validation.data.length > MAX_MESSAGE_COUNT) {
    return null;
  }

  const promptCharacters = validation.data
    .map(textFromMessage)
    .reduce((total, text) => total + text.length, 0);
  const promptText = latestUserPrompt(validation.data);

  if (!promptText || promptCharacters > MAX_PROMPT_CHARACTERS) {
    return null;
  }

  return Object.freeze({
    messages: validation.data,
    model: body.data.model,
    promptText,
  });
}
