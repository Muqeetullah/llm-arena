import { request as arcjetRequest } from "@arcjet/next";
import { auth } from "@clerk/nextjs/server";
import { notFound } from "next/navigation";

import { ArenaPage } from "@/features/arena/components/arena-page";
import { getRecentThreads, getThread } from "@/features/arena/server/data";
import { parseThreadId } from "@/features/arena/server/input";
import { getAvailableModels } from "@/features/model-catalog/server/get-available-models";
import { protectPublicThreadRead } from "@/features/model-connection/server/security";

type HomeProps = {
  readonly searchParams: Promise<{ thread?: string | string[] }>;
};

export default async function Home({ searchParams }: HomeProps) {
  const rawThreadId = (await searchParams).thread;
  if (rawThreadId !== undefined) {
    let decision: Awaited<ReturnType<typeof protectPublicThreadRead>>;
    try {
      decision = await protectPublicThreadRead(await arcjetRequest());
    } catch (error) {
      console.error("Arcjet public thread protection could not run", {
        error,
        event: "arcjet_public_thread_protection_failed",
        surface: "page",
      });
      notFound();
    }

    if (decision.isDenied()) {
      console.warn("Arcjet blocked a public thread page read", {
        event: "arcjet_public_thread_read_denied",
        reason: decision.reason.type,
        requestId: decision.id,
        surface: "page",
      });
      notFound();
    }
    if (decision.isErrored()) {
      console.error("Arcjet public thread protection failed", {
        event: "arcjet_public_thread_protection_error",
        reason: decision.reason.message,
        requestId: decision.id,
        surface: "page",
      });
      notFound();
    }
  }

  const requestedThreadId = parseThreadId(rawThreadId);
  if (rawThreadId !== undefined && !requestedThreadId) notFound();

  const { userId } = await auth();

  const initialThread = requestedThreadId
    ? await getThread(userId, requestedThreadId)
    : null;
  if (requestedThreadId && !initialThread) notFound();

  const [catalog, recentThreads] = await Promise.all([
    getAvailableModels(),
    userId ? getRecentThreads(userId) : [],
  ]);
  const modelOptions = catalog.models.map(
    ({ id, name, author, contextLength }) => ({
      id,
      name,
      author,
      contextLength,
    }),
  );

  return (
    <ArenaPage
      models={modelOptions}
      catalogError={catalog.error}
      initialThread={initialThread}
      initialThreads={recentThreads}
      isSignedIn={Boolean(userId)}
    />
  );
}
