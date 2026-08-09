import "server-only";

import arcjet, {
  type ArcjetNextRequest,
  detectBot,
  detectPromptInjection,
  shield,
  slidingWindow,
  tokenBucket,
} from "@arcjet/next";
import { serverEnv } from "./env";

const arcjetClient = arcjet({
  key: serverEnv.arcjetKey,
  rules: [shield({ mode: "LIVE" })],
});

const modelRequestGuard = arcjetClient
  .withRule(detectBot({ mode: "LIVE", allow: [] }))
  .withRule(
    tokenBucket({
      mode: "LIVE",
      characteristics: ["userId"],
      refillRate: 50,
      interval: "1d",
      capacity: 50,
    }),
  )
  .withRule(detectPromptInjection({ mode: "LIVE" }));

const publicThreadReadGuard = arcjetClient
  .withRule(
    detectBot({
      mode: "LIVE",
      allow: ["CATEGORY:PREVIEW", "CATEGORY:SOCIAL", "CATEGORY:SLACK"],
    }),
  )
  .withRule(
    slidingWindow({
      mode: "LIVE",
      characteristics: ["ip.src"],
      interval: "1m",
      max: 60,
    }),
  );

type ProtectModelRequestOptions = Readonly<{
  correlationId: string;
  promptText: string;
  request: Request;
  userId: string;
}>;

export const protectModelRequest = ({
  correlationId,
  promptText,
  request,
  userId,
}: ProtectModelRequestOptions) =>
  modelRequestGuard.protect(request, {
    correlationId,
    detectPromptInjectionMessage: promptText,
    requested: 1,
    userId,
  });

export const protectPublicThreadRead = (request: ArcjetNextRequest) =>
  publicThreadReadGuard.protect(request);
