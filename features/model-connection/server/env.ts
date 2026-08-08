import "server-only";

const requireEnvironmentVariable = (
  name: string,
  value: string | undefined,
): string => {
  const normalizedValue = value?.trim();

  if (!normalizedValue) {
    throw new Error(`Missing environment variable: ${name}`);
  }

  return normalizedValue;
};

export const serverEnv = Object.freeze({
  arcjetKey: requireEnvironmentVariable("ARCJET_KEY", process.env.ARCJET_KEY),
  databaseUrl: requireEnvironmentVariable(
    "DATABASE_URL",
    process.env.DATABASE_URL,
  ),
  openRouterApiKey: requireEnvironmentVariable(
    "OPENROUTER_API_KEY",
    process.env.OPENROUTER_API_KEY,
  ),
  postHogHost: requireEnvironmentVariable(
    "NEXT_PUBLIC_POSTHOG_HOST",
    process.env.NEXT_PUBLIC_POSTHOG_HOST,
  ),
  postHogProjectToken: requireEnvironmentVariable(
    "NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN",
    process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN,
  ),
});
