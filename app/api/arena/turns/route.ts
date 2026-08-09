import { auth } from "@clerk/nextjs/server";

import { createTurn } from "@/features/arena/server/data";
import { parseCreateTurn } from "@/features/arena/server/input";
import { getAvailableModels } from "@/features/model-catalog/server/get-available-models";
import { postHogServer } from "@/features/model-connection/server/posthog";

const jsonError = (error: string, status: number): Response =>
  Response.json({ error }, { status });

export async function POST(request: Request) {
  const { userId } = await auth();
  if (!userId) return jsonError("Sign in to send a prompt.", 401);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError("The prompt request was not valid.", 400);
  }

  const input = parseCreateTurn(body);
  if (!input)
    return jsonError(
      "Choose up to three free models and enter a valid prompt.",
      400,
    );

  try {
    const catalog = await getAvailableModels();
    const liveModelById = new Map(
      catalog.models.map((model) => [model.id, model]),
    );
    if (
      !catalog.error &&
      input.models.some((model) => !liveModelById.has(model.id))
    ) {
      return jsonError("One of those free models is no longer available.", 400);
    }
    const trustedInput = {
      ...input,
      models: input.models.map((model) => ({
        id: model.id,
        name: liveModelById.get(model.id)?.name ?? model.name,
      })),
    };
    const turn = await createTurn(userId, trustedInput);
    if (!turn) return jsonError("That thread was not found.", 404);

    postHogServer.capture({
      distinctId: userId,
      event: "prompt_sent",
      properties: {
        model_count: turn.responses.length,
        model_ids: turn.responses.map((response) => response.modelId),
        thread_id: turn.threadId,
        turn_id: turn.turnId,
      },
    });

    return Response.json(turn, { status: 201 });
  } catch (error) {
    console.error("Unable to create comparison turn", { error, userId });
    return jsonError(
      "The comparison could not be started. Please try again.",
      409,
    );
  }
}
