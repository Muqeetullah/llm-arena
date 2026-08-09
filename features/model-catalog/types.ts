export type AvailableModel = {
  readonly id: string;
  readonly name: string;
  readonly author: string;
  readonly description: string;
  readonly contextLength: number;
  readonly inputModalities: readonly string[];
  readonly capabilities: readonly string[];
};

export type ModelOption = Pick<
  AvailableModel,
  "id" | "name" | "author" | "contextLength"
>;

export const isFreeModelId = (modelId: string): boolean =>
  modelId === "openrouter/free" || modelId.endsWith(":free");

export function formatContextWindow(tokens: number): string {
  if (tokens >= 1_000_000) {
    return `${new Intl.NumberFormat("en", { maximumFractionDigits: 1 }).format(tokens / 1_000_000)}M`;
  }

  if (tokens >= 1_000) {
    return `${new Intl.NumberFormat("en", { maximumFractionDigits: 0 }).format(tokens / 1_000)}K`;
  }

  return new Intl.NumberFormat("en").format(tokens);
}

export function providerName(author: string): string {
  return author
    .split(/[-_]/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

export function modelInitials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0])
    .join("")
    .toUpperCase();
}
