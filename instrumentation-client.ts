import posthog from "posthog-js";

const projectToken = process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN;
const apiHost = process.env.NEXT_PUBLIC_POSTHOG_HOST;

if (!projectToken) {
  throw new Error("Missing environment variable: NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN");
}

if (!apiHost) {
  throw new Error("Missing environment variable: NEXT_PUBLIC_POSTHOG_HOST");
}

posthog.init(projectToken, {
  api_host: apiHost,
  capture_heatmaps: true,
  defaults: "2026-05-30",
  disable_session_recording: false,
  tracing_headers: [window.location.hostname],
});
