import { auth } from "@clerk/nextjs/server";

import { ArenaPage } from "@/features/arena/components/arena-page";
import { getRecentThreads, getThread } from "@/features/arena/server/data";
import { parseThreadId } from "@/features/arena/server/input";
import { getAvailableModels } from "@/features/model-catalog/server/get-available-models";

type HomeProps = {
  readonly searchParams: Promise<{ thread?: string | string[] }>;
};

export default async function Home({ searchParams }: HomeProps) {
  const { userId } = await auth.protect();
  const requestedThreadId = parseThreadId((await searchParams).thread);
  const [catalog, recentThreads, initialThread] = await Promise.all([
    getAvailableModels(),
    getRecentThreads(userId),
    requestedThreadId ? getThread(userId, requestedThreadId) : null,
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
    />
  );
}
