import { auth } from "@clerk/nextjs/server";
import { connection } from "next/server";

import { ModelsCatalog } from "@/features/model-catalog/components/models-catalog";
import { getAvailableModels } from "@/features/model-catalog/server/get-available-models";

export default async function ModelsPage() {
  await auth.protect();
  await connection();
  const catalog = await getAvailableModels();

  return <ModelsCatalog models={catalog.models} error={catalog.error} />;
}
