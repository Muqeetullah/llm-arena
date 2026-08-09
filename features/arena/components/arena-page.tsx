"use client";

import { SignInButton } from "@clerk/nextjs";
import {
  ArrowUp,
  Award,
  Bot,
  Check,
  ChevronDown,
  CircleAlert,
  Database,
  Eye,
  FileText,
  LayoutGrid,
  Lightbulb,
  ListChecks,
  LogIn,
  Menu,
  Plus,
  RefreshCw,
  Share2,
  Sparkles,
  Swords,
  Trophy,
  Waypoints,
  X,
} from "lucide-react";
import Link from "next/link";
import posthog from "posthog-js";
import { useEffect, useMemo, useRef, useState } from "react";
import { DefaultChatTransport, isTextUIPart, readUIMessageStream } from "ai";

import { AccountMenu } from "@/features/auth/components/account-menu";
import { ModelResponse } from "@/features/arena/components/model-response";
import {
  parseCreatedTurn,
  parseResponseResult,
  parseStoredThread,
  type ArenaUIMessage,
  type ModelResponseErrorCode,
  type ResponseMetrics,
  type StoredThread,
  type ThreadSummary,
} from "@/features/arena/types";
import { ModelPicker } from "@/features/model-catalog/components/model-picker";
import {
  modelInitials,
  type ModelOption,
} from "@/features/model-catalog/types";

type ResponseStatus = "pending" | "streaming" | "completed" | "failed";

type ResponseFailure = {
  readonly description: string;
  readonly title: string;
};

type RoundResponse = {
  readonly content: string;
  readonly error: ResponseFailure | null;
  readonly id: string;
  readonly metrics: ResponseMetrics | null;
  readonly modelId: string;
  readonly modelName: string;
  readonly status: ResponseStatus;
};

type ComparisonRound = {
  readonly createdAt: string;
  readonly prompt: string;
  readonly responses: readonly RoundResponse[];
  readonly turnId: string;
  readonly voteError: string | null;
  readonly voteStatus: "idle" | "saving";
  readonly winnerId: string | null;
};

const MAX_SELECTED_MODELS = 3;
const MAX_RECENT_THREADS = 20;
const PERSISTENCE_POLL_INTERVAL_MS = 150;
const PERSISTENCE_CONFIRMATION_TIMEOUT_MS = 5_000;

type HistoryUpdate = "none" | "push" | "replace";

const threadUrl = (threadId: string | null): string =>
  threadId ? `/?thread=${encodeURIComponent(threadId)}` : "/";

const signInUrl = (threadId: string | null): string =>
  `/sign-in?redirect_url=${encodeURIComponent(threadUrl(threadId))}`;

function updateBrowserHistory(
  threadId: string | null,
  historyUpdate: HistoryUpdate,
) {
  if (historyUpdate === "none") return;

  window.history[historyUpdate === "push" ? "pushState" : "replaceState"](
    null,
    "",
    threadUrl(threadId),
  );
}

function relativeTime(isoDate: string): string {
  const elapsedMs = Date.now() - new Date(isoDate).getTime();
  if (!Number.isFinite(elapsedMs) || elapsedMs < 60_000) return "Just now";

  const elapsedMinutes = Math.floor(elapsedMs / 60_000);
  if (elapsedMinutes < 60) return `${elapsedMinutes}m ago`;

  const elapsedHours = Math.floor(elapsedMinutes / 60);
  if (elapsedHours < 24) return `${elapsedHours}h ago`;

  const elapsedDays = Math.floor(elapsedHours / 24);
  return elapsedDays < 7
    ? `${elapsedDays}d ago`
    : new Intl.DateTimeFormat(undefined, {
        day: "numeric",
        month: "short",
      }).format(new Date(isoDate));
}

function modelFailure(
  error: unknown,
  hasPartialResponse: boolean,
): ResponseFailure {
  const message = error instanceof Error ? error.message.toLowerCase() : "";

  if (hasPartialResponse) {
    return {
      title: "Response interrupted",
      description:
        "The model stopped before it finished. Retry to generate a fresh response.",
    };
  }

  if (message.includes("without a text answer")) {
    return {
      title: "No text answer",
      description:
        "The model used its generation budget without producing a visible answer. Retry it or choose another model.",
    };
  }

  if (
    message.includes("timeout") ||
    message.includes("timed out") ||
    message.includes("abort")
  ) {
    return {
      title: "Response timed out",
      description:
        "The model took too long to answer. Retry this response when you’re ready.",
    };
  }

  if (
    error instanceof TypeError ||
    message.includes("fetch") ||
    message.includes("network") ||
    message.includes("connect")
  ) {
    return {
      title: "Connection problem",
      description:
        "We couldn’t reach this model. Check your connection and try again.",
    };
  }

  return {
    title: "Model unavailable",
    description:
      "This model couldn’t complete the request right now. You can retry just this response.",
  };
}

function storedModelFailure(
  errorCode: string | null,
  hasPartialResponse: boolean,
): ResponseFailure {
  if (hasPartialResponse) {
    return modelFailure(new Error("interrupted"), true);
  }

  switch (errorCode as ModelResponseErrorCode | null) {
    case "EMPTY_RESPONSE":
      return modelFailure(new Error("without a text answer"), false);
    case "TIMEOUT":
    case "ABORTED":
      return modelFailure(new Error("timed out"), false);
    case "RATE_LIMITED":
      return {
        title: "Model rate-limited",
        description:
          "This free provider is busy right now. Retry this response shortly or choose another model.",
      };
    case "MODEL_UNAVAILABLE":
      return {
        title: "Model unavailable",
        description:
          "OpenRouter could not find a healthy endpoint for this model. Retry it or choose another model.",
      };
    case "REQUEST_BLOCKED":
      return {
        title: "Request blocked",
        description:
          "The request did not pass the safety or usage check. Rephrase it or try again later.",
      };
    default:
      return modelFailure(new Error("provider error"), false);
  }
}

async function responseError(response: Response): Promise<string> {
  try {
    const payload: unknown = await response.json();
    if (
      typeof payload === "object" &&
      payload !== null &&
      "error" in payload &&
      typeof payload.error === "string"
    ) {
      return payload.error;
    }
  } catch {
    // Use the stable fallback below when the server did not return JSON.
  }

  return "The request could not be completed. Please try again.";
}

function initialSelectedModelIds(models: readonly ModelOption[]): string[] {
  return models.slice(0, MAX_SELECTED_MODELS).map((model) => model.id);
}

function comparisonRounds(storedThread: StoredThread): ComparisonRound[] {
  return storedThread.rounds.map((round) => ({
    createdAt: round.createdAt,
    prompt: round.prompt,
    responses: round.responses.map((storedResponse) => {
      const wasInterrupted =
        storedResponse.status === "pending" ||
        storedResponse.status === "streaming";
      return {
        content: storedResponse.content,
        error:
          storedResponse.status === "failed"
            ? storedModelFailure(
                storedResponse.errorCode,
                storedResponse.content.length > 0,
              )
            : wasInterrupted
              ? {
                  title: "Response interrupted",
                  description:
                    "This saved generation did not finish. Retry just this response.",
                }
              : null,
        id: storedResponse.id,
        metrics: storedResponse.metrics,
        modelId: storedResponse.modelId,
        modelName: storedResponse.modelName,
        status: wasInterrupted ? ("failed" as const) : storedResponse.status,
      };
    }),
    turnId: round.turnId,
    voteError: null,
    voteStatus: "idle" as const,
    winnerId: round.winnerId,
  }));
}

function ModelCard({
  canInteract,
  canVote,
  model,
  response,
  isVoteSaving,
  winnerId,
  onRetry,
  onVote,
}: {
  canInteract: boolean;
  canVote: boolean;
  model: ModelOption;
  response: RoundResponse;
  isVoteSaving: boolean;
  winnerId: string | null;
  onRetry: () => void;
  onVote: (modelId: string) => void;
}) {
  const isWinner = winnerId === model.id;
  const hasWinner = winnerId !== null;
  const isComplete = response.status === "completed";
  const statusLabel =
    response.status === "pending"
      ? "Waiting"
      : response.status === "streaming"
        ? "Streaming"
        : response.status === "failed"
          ? "Failed"
          : isWinner
            ? "Winner"
            : "Complete";

  return (
    <article className={`model-card${isWinner ? " is-winner" : ""}`}>
      <header className="model-header">
        <div className="model-identity">
          <span className="model-avatar" aria-hidden="true">
            {modelInitials(model.name)}
          </span>
          <div>
            <h3>{model.name}</h3>
            <span className="model-subtitle">OpenRouter free tier</span>
          </div>
        </div>
        <div className="model-header-actions">
          <div className={`model-status${isWinner ? " is-winner" : ""}`}>
            {isWinner ? (
              <Award size={14} />
            ) : response.status === "failed" ? (
              <X size={14} />
            ) : (
              <Check size={14} />
            )}
            <span>{statusLabel}</span>
          </div>
          {canInteract ? (
            <button
              className={isWinner ? "vote-button winner-button" : "vote-button"}
              type="button"
              disabled={!isComplete || !canVote || isVoteSaving}
              onClick={() => onVote(model.id)}
            >
              {isWinner ? (
                <>
                  <Check size={13} aria-hidden="true" /> Selected
                </>
              ) : (
                <>
                  <Sparkles size={13} aria-hidden="true" />
                  {hasWinner ? "Pick instead" : "Pick this one"}
                </>
              )}
            </button>
          ) : null}
        </div>
      </header>

      <div className="model-answer">
        {response.error ? (
          <div className="response-fallback" role="alert">
            <span className="response-fallback-icon" aria-hidden="true">
              <CircleAlert size={19} />
            </span>
            <div>
              <h4>{response.error.title}</h4>
              <p>{response.error.description}</p>
            </div>
            {canInteract ? (
              <button
                className="retry-response-button"
                type="button"
                onClick={onRetry}
              >
                <RefreshCw size={13} aria-hidden="true" />
                Retry response
              </button>
            ) : null}
          </div>
        ) : response.content ? (
          <ModelResponse
            content={response.content}
            isStreaming={response.status === "streaming"}
          />
        ) : (
          <p className="model-placeholder" aria-live="polite">
            {response.status === "pending"
              ? "Waiting for this model…"
              : "Generating an answer…"}
          </p>
        )}
      </div>

      {response.metrics ? (
        <footer className="model-footer">
          <details className="metrics">
            <summary>
              <ChevronDown size={14} aria-hidden="true" />
              Metrics
            </summary>
            <dl>
              <div>
                <dt>TTFT</dt>
                <dd>{response.metrics.timeToFirstTokenMs}ms</dd>
              </div>
              <div>
                <dt>Speed</dt>
                <dd>
                  {response.metrics.durationMs > 0
                    ? `${((response.metrics.outputTokens * 1_000) / Math.max(1, response.metrics.durationMs - response.metrics.timeToFirstTokenMs)).toFixed(1)} t/s`
                    : "—"}
                </dd>
              </div>
              <div>
                <dt>Tokens</dt>
                <dd>{response.metrics.outputTokens}</dd>
              </div>
            </dl>
          </details>
        </footer>
      ) : null}
    </article>
  );
}

function NewComparisonEmptyState({ isSignedIn }: { isSignedIn: boolean }) {
  const guidance = [
    {
      description: "Add the context and constraints every model should use.",
      icon: Lightbulb,
      title: "Be specific",
    },
    {
      description: "Ask for a format so the answers are easy to compare.",
      icon: ListChecks,
      title: "Shape the answer",
    },
    {
      description: "Try explanations, trade-offs, or reasoning-heavy tasks.",
      icon: Waypoints,
      title: "Create contrast",
    },
  ] as const;

  return (
    <section className="new-thread-empty" aria-labelledby="new-thread-title">
      <div className="new-thread-heading">
        <span className="new-thread-icon" aria-hidden="true">
          <Sparkles size={21} />
        </span>
        <p className="eyebrow">New chat</p>
        <h2 id="new-thread-title">Start a fresh comparison</h2>
        <p>
          One thoughtful prompt can reveal how differently each model reasons,
          explains, and communicates.
        </p>
      </div>

      <div className="new-thread-guidance" aria-label="Prompt writing tips">
        {guidance.map(({ description, icon: Icon, title }) => (
          <div className="new-thread-tip" key={title}>
            <span aria-hidden="true">
              <Icon size={17} />
            </span>
            <div>
              <strong>{title}</strong>
              <p>{description}</p>
            </div>
          </div>
        ))}
      </div>

      {isSignedIn ? (
        <p className="new-thread-footnote">
          Choose up to three models below, then send your first prompt.
        </p>
      ) : (
        <div className="new-thread-signin">
          <div>
            <strong>Ready to compare?</strong>
            <span>Sign in to send prompts, vote, and keep your history.</span>
          </div>
          <Link href={signInUrl(null)}>Sign in to start</Link>
        </div>
      )}
    </section>
  );
}

function UnavailableThreadState({ error }: { error: string }) {
  return (
    <section
      className="new-thread-empty"
      aria-labelledby="unavailable-thread-title"
      role="alert"
    >
      <div className="new-thread-heading">
        <span className="new-thread-icon" aria-hidden="true">
          <CircleAlert size={21} />
        </span>
        <p className="eyebrow">Unavailable comparison</p>
        <h2 id="unavailable-thread-title">This thread could not be opened</h2>
        <p>{error}</p>
      </div>

      <div className="new-thread-signin">
        <div>
          <strong>The link may no longer be available</strong>
          <span>
            The comparison may have been deleted, or the link may be invalid.
          </span>
        </div>
        <Link href="/">Back to the arena</Link>
      </div>
    </section>
  );
}

function PublicThreadNotice({
  isSignedIn,
  threadId,
}: {
  isSignedIn: boolean;
  threadId: string;
}) {
  return (
    <section className="public-thread-notice" aria-label="Public thread access">
      <span className="public-thread-icon" aria-hidden="true">
        <Eye size={20} />
      </span>
      <div className="public-thread-copy">
        <div>
          <span className="public-thread-badge">Public view</span>
          <strong>Reading a shared comparison</strong>
        </div>
        <p>
          Anyone with this link can read the prompt, responses, result, and
          metrics. Only the thread owner can continue it or vote.
        </p>
      </div>
      <Link href={isSignedIn ? "/" : signInUrl(threadId)}>
        {isSignedIn ? "Start your own" : "Sign in to interact"}
      </Link>
    </section>
  );
}

type ArenaPageProps = {
  readonly catalogError: string | null;
  readonly initialThread: StoredThread | null;
  readonly initialThreads: readonly ThreadSummary[];
  readonly isSignedIn: boolean;
  readonly models: readonly ModelOption[];
};

export function ArenaPage({
  models,
  catalogError,
  initialThread,
  initialThreads,
  isSignedIn,
}: ArenaPageProps) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [rounds, setRounds] = useState<readonly ComparisonRound[]>(() =>
    initialThread ? comparisonRounds(initialThread) : [],
  );
  const [threads, setThreads] =
    useState<readonly ThreadSummary[]>(initialThreads);
  const [selectedModelIds, setSelectedModelIds] = useState(() => {
    const storedModelIds = initialThread?.rounds
      .at(-1)
      ?.responses.map((response) => response.modelId)
      .filter((modelId) => models.some((model) => model.id === modelId));
    return storedModelIds?.length
      ? storedModelIds.slice(0, MAX_SELECTED_MODELS)
      : initialSelectedModelIds(models);
  });
  const [prompt, setPrompt] = useState("");
  const [threadId, setThreadId] = useState<string | null>(
    initialThread?.id ?? null,
  );
  const [threadTitle, setThreadTitle] = useState<string | null>(
    initialThread?.title ?? null,
  );
  const [canInteract, setCanInteract] = useState(
    initialThread?.canInteract ?? isSignedIn,
  );
  const [isCreatingTurn, setIsCreatingTurn] = useState(false);
  const [isLoadingThread, setIsLoadingThread] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [threadLoadError, setThreadLoadError] = useState<string | null>(null);
  const [isAuthenticationRequired, setIsAuthenticationRequired] =
    useState(false);
  const [shareStatus, setShareStatus] = useState<"idle" | "copied" | "error">(
    "idle",
  );
  const isCreatingTurnRef = useRef(false);
  const runningResponseIdsRef = useRef(new Set<string>());
  const savingVoteTurnIdsRef = useRef(new Set<string>());
  const historyNavigationRef = useRef<(nextThreadId: string | null) => void>(
    () => undefined,
  );
  const modelById = useMemo(
    () => new Map(models.map((model) => [model.id, model])),
    [models],
  );
  const isSubmitting =
    isCreatingTurn ||
    isLoadingThread ||
    rounds.some((round) =>
      round.responses.some(
        (response) =>
          response.status === "pending" || response.status === "streaming",
      ),
    );

  const selectedModels = selectedModelIds
    .map((modelId) => modelById.get(modelId))
    .filter((model): model is ModelOption => Boolean(model));

  function removeModel(modelId: string) {
    setSelectedModelIds((currentIds) =>
      currentIds.length === 1
        ? currentIds
        : currentIds.filter((id) => id !== modelId),
    );
  }

  function addModel(modelId: string) {
    setSelectedModelIds((currentIds) => {
      if (
        currentIds.length >= MAX_SELECTED_MODELS ||
        currentIds.includes(modelId) ||
        !models.some((model) => model.id === modelId)
      ) {
        return currentIds;
      }

      return [...currentIds, modelId];
    });
  }

  function updateRoundResponse(
    turnIdToUpdate: string,
    responseId: string,
    update: (response: RoundResponse) => RoundResponse,
  ) {
    setRounds((currentRounds) =>
      currentRounds.map((round) =>
        round.turnId === turnIdToUpdate
          ? {
              ...round,
              responses: round.responses.map((response) =>
                response.id === responseId ? update(response) : response,
              ),
            }
          : round,
      ),
    );
  }

  function startNewComparison(historyUpdate: HistoryUpdate = "push") {
    if (isSubmitting) return;

    setRounds([]);
    setThreadId(null);
    setThreadTitle(null);
    setCanInteract(isSignedIn);
    setPrompt("");
    setSubmitError(null);
    setThreadLoadError(null);
    setIsAuthenticationRequired(false);
    setIsSidebarOpen(false);
    updateBrowserHistory(null, historyUpdate);
  }

  async function loadThread(
    nextThreadId: string,
    historyUpdate: HistoryUpdate = "push",
  ) {
    if (nextThreadId === threadId || isSubmitting) return;

    setIsLoadingThread(true);
    setSubmitError(null);
    setThreadLoadError(null);
    setIsAuthenticationRequired(false);
    try {
      const response = await fetch(
        `/api/arena/threads?id=${encodeURIComponent(nextThreadId)}`,
        { cache: "no-store" },
      );
      if (!response.ok) throw new Error(await responseError(response));

      const storedThread = parseStoredThread(await response.json());
      if (!storedThread) {
        throw new Error("The server returned an invalid comparison thread.");
      }

      const nextRounds = comparisonRounds(storedThread);

      const latestModelIds = nextRounds
        .at(-1)
        ?.responses.map((response) => response.modelId)
        .filter((modelId) => modelById.has(modelId));
      if (latestModelIds?.length) {
        setSelectedModelIds(latestModelIds.slice(0, MAX_SELECTED_MODELS));
      }
      setRounds(nextRounds);
      setThreadId(storedThread.id);
      setThreadTitle(storedThread.title);
      setCanInteract(storedThread.canInteract);
      setPrompt("");
      setIsSidebarOpen(false);
      updateBrowserHistory(storedThread.id, historyUpdate);
    } catch (error) {
      setRounds([]);
      setThreadId(null);
      setThreadTitle(null);
      setCanInteract(isSignedIn);
      setPrompt("");
      setIsSidebarOpen(false);
      setThreadLoadError(
        error instanceof Error
          ? error.message
          : "The comparison could not be loaded.",
      );
    } finally {
      setIsLoadingThread(false);
    }
  }

  historyNavigationRef.current = (nextThreadId) => {
    if (isSubmitting) {
      updateBrowserHistory(threadId, "replace");
      return;
    }

    if (nextThreadId) {
      void loadThread(nextThreadId, "none");
    } else {
      startNewComparison("none");
    }
  };

  useEffect(() => {
    const handlePopState = () => {
      historyNavigationRef.current(
        new URL(window.location.href).searchParams.get("thread"),
      );
    };

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  async function selectWinner(turnIdToUpdate: string, modelId: string) {
    const round = rounds.find(
      (candidate) => candidate.turnId === turnIdToUpdate,
    );
    const response = round?.responses.find(
      (candidate) => candidate.modelId === modelId,
    );
    if (
      !canInteract ||
      !round ||
      !response ||
      savingVoteTurnIdsRef.current.has(turnIdToUpdate) ||
      round.responses.filter((candidate) => candidate.status === "completed")
        .length < 2
    ) {
      return;
    }

    savingVoteTurnIdsRef.current.add(turnIdToUpdate);

    setRounds((currentRounds) =>
      currentRounds.map((round) =>
        round.turnId === turnIdToUpdate
          ? { ...round, voteError: null, voteStatus: "saving" }
          : round,
      ),
    );
    try {
      const result = await fetch("/api/arena/votes", {
        body: JSON.stringify({ responseId: response.id, turnId: round.turnId }),
        headers: { "Content-Type": "application/json" },
        method: "PUT",
      });
      if (!result.ok) throw new Error(await responseError(result));

      setRounds((currentRounds) =>
        currentRounds.map((candidate) =>
          candidate.turnId === turnIdToUpdate
            ? {
                ...candidate,
                voteError: null,
                voteStatus: "idle",
                winnerId: modelId,
              }
            : candidate,
        ),
      );
    } catch (error) {
      setRounds((currentRounds) =>
        currentRounds.map((candidate) =>
          candidate.turnId === turnIdToUpdate
            ? {
                ...candidate,
                voteError:
                  error instanceof Error
                    ? error.message
                    : "The vote could not be saved.",
                voteStatus: "idle",
              }
            : candidate,
        ),
      );
    } finally {
      savingVoteTurnIdsRef.current.delete(turnIdToUpdate);
    }
  }

  async function requestModelResponse(
    turnIdToUpdate: string,
    responseId: string,
    modelId: string,
  ) {
    if (!canInteract || runningResponseIdsRef.current.has(responseId)) return;
    runningResponseIdsRef.current.add(responseId);

    updateRoundResponse(turnIdToUpdate, responseId, (response) => ({
      ...response,
      content: "",
      error: null,
      metrics: null,
      status: "pending",
    }));

    let streamedContent = "";
    let streamError: unknown;

    try {
      const transport = new DefaultChatTransport({
        api: "/api/model-responses",
        headers: () => ({
          "x-posthog-session-id": posthog.get_session_id(),
        }),
        prepareSendMessagesRequest: () => ({ body: { responseId } }),
      });
      const stream = await transport.sendMessages({
        abortSignal: undefined,
        chatId: responseId,
        messageId: undefined,
        messages: [],
        trigger: "submit-message",
      });

      updateRoundResponse(turnIdToUpdate, responseId, (response) => ({
        ...response,
        status: "streaming",
      }));

      let completedMetrics: ResponseMetrics | null = null;
      for await (const message of readUIMessageStream<ArenaUIMessage>({
        stream,
        onError: (error) => {
          streamError = error;
        },
      })) {
        streamedContent = message.parts
          .filter(isTextUIPart)
          .map((part) => part.text)
          .join("");
        completedMetrics = message.metadata?.metrics ?? completedMetrics;

        updateRoundResponse(turnIdToUpdate, responseId, (response) => ({
          ...response,
          content: streamedContent,
          metrics: completedMetrics,
          status: "streaming",
        }));
      }

      let confirmedResponse = null;
      const persistenceDeadline =
        Date.now() + PERSISTENCE_CONFIRMATION_TIMEOUT_MS;
      while (true) {
        const persistedResult = await fetch(
          `/api/model-responses?id=${encodeURIComponent(responseId)}`,
          { cache: "no-store" },
        );
        if (!persistedResult.ok) {
          throw new Error(await responseError(persistedResult));
        }
        confirmedResponse = parseResponseResult(await persistedResult.json());
        if (!confirmedResponse || confirmedResponse.status !== "in_progress") {
          break;
        }

        const remainingMs = persistenceDeadline - Date.now();
        if (remainingMs <= 0) {
          break;
        }
        await new Promise((resolve) =>
          window.setTimeout(
            resolve,
            Math.min(PERSISTENCE_POLL_INTERVAL_MS, remainingMs),
          ),
        );
      }
      if (!confirmedResponse) {
        throw new Error("The server returned an invalid response status.");
      }
      if (confirmedResponse.status === "failed") {
        const failedContent = confirmedResponse.content || streamedContent;
        updateRoundResponse(turnIdToUpdate, responseId, (response) => ({
          ...response,
          content: failedContent,
          error: storedModelFailure(
            confirmedResponse.errorCode,
            failedContent.length > 0,
          ),
          status: "failed",
        }));
        return;
      }
      if (confirmedResponse.status === "in_progress") {
        throw (
          streamError ??
          new Error("The response completion could not be confirmed.")
        );
      }

      updateRoundResponse(turnIdToUpdate, responseId, (response) => ({
        ...response,
        content: confirmedResponse.content,
        metrics: confirmedResponse.metrics,
        status: "completed",
      }));
    } catch (error) {
      console.error("Unable to generate model response", { error, modelId });
      updateRoundResponse(turnIdToUpdate, responseId, (response) => ({
        ...response,
        error: modelFailure(error, response.content.length > 0),
        status: "failed",
      }));
    } finally {
      runningResponseIdsRef.current.delete(responseId);
    }
  }

  async function submitPrompt() {
    const nextPrompt = prompt.trim();

    if (
      !canInteract ||
      !nextPrompt ||
      selectedModels.length === 0 ||
      isSubmitting ||
      isCreatingTurnRef.current
    ) {
      return;
    }

    isCreatingTurnRef.current = true;
    setIsCreatingTurn(true);
    setSubmitError(null);
    setIsAuthenticationRequired(false);
    try {
      const result = await fetch("/api/arena/turns", {
        body: JSON.stringify({
          models: selectedModels.map(({ id, name }) => ({ id, name })),
          prompt: nextPrompt,
          threadId,
        }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
      if (result.status === 401) {
        setIsAuthenticationRequired(true);
        return;
      }
      if (!result.ok) throw new Error(await responseError(result));

      const createdTurn = parseCreatedTurn(await result.json());
      if (!createdTurn) {
        throw new Error("The server returned an invalid comparison.");
      }
      const nextRound: ComparisonRound = {
        createdAt: new Date().toISOString(),
        prompt: nextPrompt,
        responses: createdTurn.responses.map((response) => ({
          content: "",
          error: null,
          id: response.id,
          metrics: null,
          modelId: response.modelId,
          modelName: response.modelName,
          status: "pending",
        })),
        turnId: createdTurn.turnId,
        voteError: null,
        voteStatus: "idle",
        winnerId: null,
      };

      setThreadId(createdTurn.threadId);
      setThreadTitle(createdTurn.threadTitle);
      setThreads((currentThreads) =>
        [
          {
            id: createdTurn.threadId,
            title: createdTurn.threadTitle,
            updatedAt: createdTurn.threadUpdatedAt,
          },
          ...currentThreads.filter(
            (candidate) => candidate.id !== createdTurn.threadId,
          ),
        ].slice(0, MAX_RECENT_THREADS),
      );
      setRounds((currentRounds) => [...currentRounds, nextRound]);
      setPrompt("");
      updateBrowserHistory(createdTurn.threadId, "replace");
      void Promise.allSettled(
        createdTurn.responses.map((response) =>
          requestModelResponse(
            createdTurn.turnId,
            response.id,
            response.modelId,
          ),
        ),
      );
    } catch (error) {
      setSubmitError(
        error instanceof Error
          ? error.message
          : "The comparison could not be started.",
      );
    } finally {
      isCreatingTurnRef.current = false;
      setIsCreatingTurn(false);
    }
  }

  async function shareThread() {
    if (!threadId) return;

    try {
      const url = new URL(
        threadUrl(threadId),
        window.location.origin,
      ).toString();
      await navigator.clipboard.writeText(url);
      setShareStatus("copied");
      window.setTimeout(() => setShareStatus("idle"), 2_000);
    } catch {
      setShareStatus("error");
    }
  }

  return (
    <div className="arena-app">
      <button
        className={`sidebar-scrim${isSidebarOpen ? " is-visible" : ""}`}
        type="button"
        aria-label="Close navigation"
        onClick={() => setIsSidebarOpen(false)}
      />

      <aside className={`sidebar${isSidebarOpen ? " is-open" : ""}`}>
        <div className="brand">
          <span className="brand-mark" aria-hidden="true">
            <Swords size={19} strokeWidth={2.2} />
          </span>
          <span>LLM Arena</span>
          <button
            className="sidebar-close"
            type="button"
            aria-label="Close navigation"
            onClick={() => setIsSidebarOpen(false)}
          >
            <X size={19} />
          </button>
        </div>

        <nav className="primary-nav" aria-label="Primary navigation">
          <Link className="nav-link is-active" href="/">
            <LayoutGrid size={18} />
            Arena
          </Link>
          <Link className="nav-link" href="/leaderboard">
            <Trophy size={18} />
            Leaderboard
          </Link>
          <Link className="nav-link" href="/models">
            <Database size={18} />
            Models
          </Link>
        </nav>

        <div className="thread-section">
          <p className="eyebrow">Recent threads</p>
          <div className="thread-list">
            {threads.map((thread) => (
              <button
                className={
                  thread.id === threadId
                    ? "thread-link is-current"
                    : "thread-link"
                }
                type="button"
                disabled={isSubmitting}
                key={thread.id}
                onClick={() => void loadThread(thread.id)}
              >
                <span className="thread-link-icon" aria-hidden="true">
                  <FileText size={14} />
                </span>
                <span className="thread-link-copy">
                  <span title={thread.title}>{thread.title}</span>
                  <small>{relativeTime(thread.updatedAt)}</small>
                </span>
                {thread.id === threadId && (
                  <span className="thread-dot" aria-hidden="true" />
                )}
              </button>
            ))}
            {threads.length === 0 ? (
              <p className="thread-empty">No saved comparisons yet.</p>
            ) : null}
          </div>
        </div>

        <div className="sidebar-footer">
          {isSignedIn ? (
            <button
              className="new-comparison"
              type="button"
              disabled={isSubmitting}
              onClick={() => startNewComparison()}
            >
              <Plus size={17} />
              New comparison
            </button>
          ) : (
            <Link className="new-comparison" href="/sign-in">
              <Plus size={17} />
              New comparison
            </Link>
          )}
          <AccountMenu />
        </div>
      </aside>

      <section className="arena-shell" id="arena">
        <header className="topbar">
          <div className="thread-heading">
            <button
              className="mobile-menu"
              type="button"
              aria-label="Open navigation"
              onClick={() => setIsSidebarOpen(true)}
            >
              <Menu size={20} />
            </button>
            <div>
              <span className="breadcrumb">
                {threadLoadError
                  ? "Arena / Unavailable comparison"
                  : threadId
                    ? canInteract
                      ? "Arena / Current thread"
                      : "Arena / Public view"
                    : "Arena / New chat"}
              </span>
              <h1>
                {threadLoadError
                  ? "Comparison unavailable"
                  : (threadTitle ?? "New comparison")}
              </h1>
            </div>
          </div>

          <div className="topbar-actions">
            <button
              className="icon-button"
              type="button"
              aria-label={
                shareStatus === "copied" ? "Link copied" : "Copy thread link"
              }
              disabled={!threadId}
              title={
                !threadId
                  ? "Start a comparison before sharing"
                  : shareStatus === "copied"
                    ? "Link copied"
                    : "Copy thread link"
              }
              onClick={() => void shareThread()}
            >
              {shareStatus === "copied" ? (
                <Check size={18} />
              ) : (
                <Share2 size={18} />
              )}
            </button>
            <span className="sr-only" aria-live="polite">
              {shareStatus === "copied"
                ? "Thread link copied to clipboard."
                : shareStatus === "error"
                  ? "The thread link could not be copied."
                  : ""}
            </span>
          </div>
        </header>

        <main
          className={`conversation${rounds.length === 0 ? " is-empty" : ""}`}
        >
          {threadLoadError ? (
            <UnavailableThreadState error={threadLoadError} />
          ) : rounds.length === 0 ? (
            <NewComparisonEmptyState isSignedIn={isSignedIn} />
          ) : null}

          {threadId && !canInteract ? (
            <PublicThreadNotice isSignedIn={isSignedIn} threadId={threadId} />
          ) : null}

          {rounds.map((round, roundIndex) => {
            const completedResponses = round.responses.filter(
              (response) => response.status === "completed",
            ).length;

            return (
              <section className="comparison-round" key={round.turnId}>
                <div className="user-message-wrap">
                  <div className="user-message">{round.prompt}</div>
                  <span className="message-meta">
                    Prompt · {relativeTime(round.createdAt)}
                  </span>
                </div>

                <div className="comparison-heading">
                  <div>
                    <span className="eyebrow">Round {roundIndex + 1}</span>
                    <h2>Compare the responses</h2>
                  </div>
                  <p>
                    {completedResponses} of {round.responses.length} answers
                    complete
                  </p>
                </div>

                <div className="response-grid">
                  {round.responses.map((response) => {
                    const model = modelById.get(response.modelId) ?? {
                      author: response.modelId.split("/")[0] ?? "openrouter",
                      contextLength: 0,
                      id: response.modelId,
                      name: response.modelName,
                    };

                    return (
                      <ModelCard
                        key={response.id}
                        canInteract={canInteract}
                        canVote={canInteract && completedResponses >= 2}
                        isVoteSaving={round.voteStatus === "saving"}
                        model={model}
                        response={response}
                        winnerId={round.winnerId}
                        onRetry={() =>
                          requestModelResponse(
                            round.turnId,
                            response.id,
                            model.id,
                          )
                        }
                        onVote={(modelId) =>
                          void selectWinner(round.turnId, modelId)
                        }
                      />
                    );
                  })}
                </div>
                {round.voteError ? (
                  <p className="arena-error" role="alert">
                    {round.voteError}
                  </p>
                ) : null}
              </section>
            );
          })}
        </main>

        {canInteract && !threadLoadError ? (
          <div className="composer-dock">
            <div
              className={`composer${isAuthenticationRequired ? " is-auth-required" : ""}`}
            >
              {isAuthenticationRequired ? (
                <div className="authentication-required" role="status">
                  <span
                    className="authentication-required-icon"
                    aria-hidden="true"
                  >
                    <LogIn size={18} />
                  </span>
                  <div className="authentication-required-copy">
                    <strong>Your session ended</strong>
                    <span>
                      Sign in again to send this prompt. Your text is still
                      here.
                    </span>
                  </div>
                  <div className="authentication-required-actions">
                    <button
                      className="authentication-dismiss"
                      type="button"
                      onClick={() => setIsAuthenticationRequired(false)}
                    >
                      Dismiss
                    </button>
                    <SignInButton mode="modal">
                      <button className="authentication-signin" type="button">
                        Sign in
                      </button>
                    </SignInButton>
                  </div>
                </div>
              ) : null}

              <div className="composer-controls">
                <div className="model-chips" aria-label="Selected models">
                  {selectedModels.map((model) => (
                    <span className="model-chip" key={model.id}>
                      <Bot size={13} aria-hidden="true" />
                      <span>{model.name}</span>
                      <button
                        type="button"
                        aria-label={`Remove ${model.name}`}
                        disabled={selectedModelIds.length === 1}
                        title={
                          selectedModelIds.length === 1
                            ? "At least one model is required"
                            : undefined
                        }
                        onClick={() => removeModel(model.id)}
                      >
                        <X size={13} />
                      </button>
                    </span>
                  ))}
                  <ModelPicker
                    models={models}
                    catalogError={catalogError}
                    selectedModelIds={selectedModelIds}
                    onSelect={addModel}
                  />
                  {catalogError ? (
                    <span className="model-catalog-warning" role="status">
                      Live catalog unavailable
                    </span>
                  ) : null}
                </div>

                <div className="prompt-row">
                  <label className="sr-only" htmlFor="prompt-input">
                    Send a follow-up prompt
                  </label>
                  <textarea
                    id="prompt-input"
                    value={prompt}
                    rows={1}
                    placeholder={
                      threadId ? "Ask a follow-up…" : "Ask all selected models…"
                    }
                    onChange={(event) => setPrompt(event.target.value)}
                    onKeyDown={(event) => {
                      if (
                        event.key === "Enter" &&
                        !event.shiftKey &&
                        !event.nativeEvent.isComposing
                      ) {
                        event.preventDefault();
                        void submitPrompt();
                      }
                    }}
                  />
                  <div className="send-group">
                    <span>Enter · Shift+Enter for newline</span>
                    <button
                      className="send-button"
                      type="button"
                      aria-label="Send prompt"
                      disabled={
                        !prompt.trim() ||
                        selectedModels.length === 0 ||
                        isSubmitting
                      }
                      onClick={() => void submitPrompt()}
                    >
                      <ArrowUp size={20} />
                    </button>
                  </div>
                </div>
              </div>
              {submitError ? (
                <p className="arena-error" role="alert">
                  {submitError}
                </p>
              ) : null}
            </div>
          </div>
        ) : null}
      </section>
    </div>
  );
}
