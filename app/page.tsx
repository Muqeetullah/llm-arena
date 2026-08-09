import { auth } from "@clerk/nextjs/server";
import { notFound } from "next/navigation";

import { ArenaPage } from "@/features/arena/components/arena-page";
import { getRecentThreads, getThread } from "@/features/arena/server/data";
import { parseThreadId } from "@/features/arena/server/input";
import { getAvailableModels } from "@/features/model-catalog/server/get-available-models";

type HomeProps = {
  readonly searchParams: Promise<{ thread?: string | string[] }>;
};

export default async function Home({ searchParams }: HomeProps) {
  const { userId } = await auth();
  const rawThreadId = (await searchParams).thread;
  const requestedThreadId = parseThreadId(rawThreadId);
  if (rawThreadId !== undefined && !requestedThreadId) notFound();

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
