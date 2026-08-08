import "server-only";

import { z } from "zod";

import { serverEnv } from "@/features/model-connection/server/env";

const openRouterModelSchema = z
  .object({
    id: z.string().min(1),
    name: z.string().min(1),
    description: z.string().optional().default(""),
    context_length: z.number().int().nonnegative().optional().default(0),
    architecture: z
      .object({
        input_modalities: z.array(z.string()).optional().default([]),
        output_modalities: z.array(z.string()).optional().default([]),
      })
      .passthrough(),
    pricing: z
      .object({
        prompt: z.union([z.string(), z.number()]),
        completion: z.union([z.string(), z.number()]),
      })
      .passthrough(),
    supported_parameters: z.array(z.string()).optional().default([]),
  })
  .passthrough();

const openRouterModelsResponseSchema = z.object({
  data: z.array(openRouterModelSchema),
});

export type AvailableModel = {
  readonly id: string;
  readonly name: string;
  readonly author: string;
  readonly description: string;
  readonly contextLength: number;
  readonly inputModalities: readonly string[];
  readonly capabilities: readonly string[];
};

export type AvailableModelsResult = {
  readonly models: readonly AvailableModel[];
  readonly error: string | null;
};

const DISPLAY_CAPABILITIES = new Set([
  "tools",
  "tool_choice",
  "reasoning",
  "structured_outputs",
  "response_format",
]);

const isFreePrice = (value: string | number): boolean => Number(value) === 0;

export async function getAvailableModels(): Promise<AvailableModelsResult> {
  try {
    const response = await fetch(
      "https://openrouter.ai/api/v1/models?sort=context-high-to-low",
      {
        cache: "no-store",
        headers: {
          Authorization: `Bearer ${serverEnv.openRouterApiKey}`,
          "X-Title": "LLM Arena",
        },
        signal: AbortSignal.timeout(12_000),
      },
    );

    if (!response.ok) {
      throw new Error(`OpenRouter returned ${response.status}`);
    }

    const payload = openRouterModelsResponseSchema.parse(await response.json());
    const models = payload.data
      .filter(
        (model) =>
          isFreePrice(model.pricing.prompt) &&
          isFreePrice(model.pricing.completion) &&
          model.architecture.output_modalities.every(
            (modality) => modality === "text",
          ),
      )
      .map((model) => ({
        id: model.id,
        name: model.name,
        author: model.id.split("/")[0] ?? "openrouter",
        description: model.description,
        contextLength: model.context_length,
        inputModalities: model.architecture.input_modalities,
        capabilities: model.supported_parameters.filter((parameter) =>
          DISPLAY_CAPABILITIES.has(parameter),
        ),
      }))
      .sort(
        (left, right) =>
          right.contextLength - left.contextLength ||
          left.name.localeCompare(right.name),
      );

    return { models, error: null };
  } catch (error) {
    console.error("Unable to load the OpenRouter model catalog", error);

    return {
      models: [],
      error:
        "The live model catalog is temporarily unavailable. Please try again shortly.",
    };
  }
}
