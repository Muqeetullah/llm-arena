"use client";

import {
  ArrowUp,
  Award,
  Bot,
  Check,
  ChevronDown,
  Database,
  LayoutGrid,
  Menu,
  Plus,
  Share2,
  Swords,
  Trophy,
  X,
} from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import {
  DefaultChatTransport,
  isTextUIPart,
  readUIMessageStream,
  type UIMessage,
} from "ai";

import { AccountMenu } from "@/features/auth/components/account-menu";

type ModelResponse = {
  readonly id: string;
  readonly initials: string;
  readonly name: string;
  readonly shortName: string;
  readonly paragraphs: readonly string[];
  readonly metrics: {
    readonly ttft: string;
    readonly speed: string;
    readonly tokens: string;
  };
};

type ResponseStatus = "pending" | "streaming" | "completed" | "failed";

type RoundResponse = {
  readonly content: string;
  readonly error: string | null;
  readonly modelId: string;
  readonly status: ResponseStatus;
};

type ComparisonRound = {
  readonly id: string;
  readonly prompt: string;
  readonly responses: readonly RoundResponse[];
  readonly winnerId: string | null;
};

const MODEL_RESPONSES: readonly ModelResponse[] = [
  {
    id: "meta-llama/llama-3.3-70b-instruct:free",
    initials: "L3",
    name: "Llama 3.3 70B",
    shortName: "Llama 3.3",
    paragraphs: [
      "Imagine two magical coins created as a pair. You give one to a friend who travels to Mars while you keep the other on Earth. Whenever you check yours and find heads, your friend’s coin is guaranteed to show tails—even though neither coin had chosen a side before either of you looked.",
      "Entangled particles behave a little like that pair. Their properties are described together, so measuring one lets you predict the matching result for the other. The connection is immediate, but it cannot be used to send a message faster than light.",
    ],
    metrics: { ttft: "240ms", speed: "82 t/s", tokens: "158" },
  },
  {
    id: "google/gemma-3-27b-it:free",
    initials: "G3",
    name: "Gemma 3 27B",
    shortName: "Gemma 3",
    paragraphs: [
      "Picture a pair of dancers who have rehearsed one shared routine so perfectly that, even in different theaters, their moves always fit together. If one spins clockwise when the curtain rises, you know the other will spin counterclockwise.",
      "Quantum entanglement is a shared state between particles. Before measurement, physics does not assign each particle its own definite answer. When one is measured, the pair produces linked results—no matter how far apart the particles have traveled.",
    ],
    metrics: { ttft: "180ms", speed: "110 t/s", tokens: "142" },
  },
  {
    id: "mistralai/mistral-small-3.1-24b-instruct:free",
    initials: "MS",
    name: "Mistral Small 3.1",
    shortName: "Mistral Small",
    paragraphs: [
      "Think of two sealed mystery boxes prepared by the same strange rule. You take one across the world. When you open it and discover a red ball, you instantly know the other box will reveal blue—not because a signal raced between them, but because the pair must be described as one system.",
      "That is the heart of entanglement: two particles can share a single quantum description. Their measurements are more strongly correlated than ordinary hidden instructions can explain, which is why Einstein called it ‘spooky action at a distance.’",
    ],
    metrics: { ttft: "310ms", speed: "68 t/s", tokens: "164" },
  },
];

const INITIAL_PROMPT =
  "Explain quantum entanglement like I’m a curious high-school student. Use one analogy and avoid equations.";

const INITIAL_ROUND: ComparisonRound = {
  id: "initial-round",
  prompt: INITIAL_PROMPT,
  responses: MODEL_RESPONSES.map((model) => ({
    content: model.paragraphs.join("\n\n"),
    error: null,
    modelId: model.id,
    status: "completed",
  })),
  winnerId: null,
};

const RECENT_THREADS = [
  "Quantum entanglement basics",
  "React Server Components",
  "The perfect carbonara",
] as const;

function ModelCard({
  model,
  response,
  showMetrics,
  winnerId,
  onVote,
}: {
  model: ModelResponse;
  response: RoundResponse;
  showMetrics: boolean;
  winnerId: string | null;
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
            {model.initials}
          </span>
          <div>
            <h3>{model.name}</h3>
            <span className="model-subtitle">OpenRouter free tier</span>
          </div>
        </div>
        <div className={`model-status${isWinner ? " is-winner" : ""}`}>
          {isWinner ? (
            <Award size={15} />
          ) : response.status === "failed" ? (
            <X size={15} />
          ) : (
            <Check size={15} />
          )}
          <span>{statusLabel}</span>
        </div>
      </header>

      <div className="model-answer">
        {response.error ? (
          <p className="model-error" role="alert">
            {response.error}
          </p>
        ) : response.content ? (
          response.content
            .split(/\n{2,}/)
            .map((paragraph) => <p key={paragraph}>{paragraph}</p>)
        ) : (
          <p className="model-placeholder" aria-live="polite">
            {response.status === "pending"
              ? "Waiting for this model…"
              : "Generating an answer…"}
          </p>
        )}
      </div>

      <footer className="model-footer">
        <button
          className={isWinner ? "vote-button winner-button" : "vote-button"}
          type="button"
          disabled={!isComplete}
          onClick={() => onVote(model.id)}
        >
          {isWinner ? (
            <>
              <Award size={16} /> Selected winner
            </>
          ) : (
            <>{hasWinner ? "Change vote" : "Vote for this model"}</>
          )}
        </button>

        {showMetrics ? (
          <details className="metrics">
            <summary>
              <ChevronDown size={14} aria-hidden="true" />
              Metrics
            </summary>
            <dl>
              <div>
                <dt>TTFT</dt>
                <dd>{model.metrics.ttft}</dd>
              </div>
              <div>
                <dt>Speed</dt>
                <dd>{model.metrics.speed}</dd>
              </div>
              <div>
                <dt>Tokens</dt>
                <dd>{model.metrics.tokens}</dd>
              </div>
            </dl>
          </details>
        ) : null}
      </footer>
    </article>
  );
}

export function ArenaPage() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [rounds, setRounds] = useState<readonly ComparisonRound[]>([
    INITIAL_ROUND,
  ]);
  const [selectedModelIds, setSelectedModelIds] = useState(
    MODEL_RESPONSES.map((model) => model.id),
  );
  const [prompt, setPrompt] = useState("");
  const isSubmitting = rounds.some((round) =>
    round.responses.some(
      (response) =>
        response.status === "pending" || response.status === "streaming",
    ),
  );

  const selectedModels = MODEL_RESPONSES.filter((model) =>
    selectedModelIds.includes(model.id),
  );

  function removeModel(modelId: string) {
    setSelectedModelIds((currentIds) =>
      currentIds.length === 1
        ? currentIds
        : currentIds.filter((id) => id !== modelId),
    );
  }

  function addModel() {
    const removedModel = MODEL_RESPONSES.find(
      (model) => !selectedModelIds.includes(model.id),
    );

    if (removedModel) {
      setSelectedModelIds((currentIds) => [...currentIds, removedModel.id]);
    }
  }

  function updateRoundResponse(
    roundId: string,
    modelId: string,
    update: (response: RoundResponse) => RoundResponse,
  ) {
    setRounds((currentRounds) =>
      currentRounds.map((round) =>
        round.id === roundId
          ? {
              ...round,
              responses: round.responses.map((response) =>
                response.modelId === modelId ? update(response) : response,
              ),
            }
          : round,
      ),
    );
  }

  function selectWinner(roundId: string, modelId: string) {
    setRounds((currentRounds) =>
      currentRounds.map((round) =>
        round.id === roundId ? { ...round, winnerId: modelId } : round,
      ),
    );
  }

  function conversationForModel(modelId: string, nextPrompt: string) {
    const messages: UIMessage[] = [];

    for (const round of rounds) {
      const response = round.responses.find(
        (candidate) => candidate.modelId === modelId,
      );

      if (response?.status === "completed") {
        messages.push(
          {
            id: `${round.id}-user`,
            role: "user",
            parts: [{ type: "text", text: round.prompt }],
          },
          {
            id: `${round.id}-${modelId}`,
            role: "assistant",
            parts: [{ type: "text", text: response.content }],
          },
        );
      }
    }

    messages.push({
      id: crypto.randomUUID(),
      role: "user",
      parts: [{ type: "text", text: nextPrompt }],
    });

    return messages;
  }

  async function requestModelResponse(
    roundId: string,
    modelId: string,
    messages: UIMessage[],
  ) {
    try {
      const transport = new DefaultChatTransport({
        api: "/api/model-responses",
        prepareSendMessagesRequest: ({ messages: requestMessages }) => ({
          body: { messages: requestMessages, model: modelId },
        }),
      });
      const stream = await transport.sendMessages({
        abortSignal: undefined,
        chatId: `${roundId}-${modelId}`,
        messageId: undefined,
        messages,
        trigger: "submit-message",
      });

      updateRoundResponse(roundId, modelId, (response) => ({
        ...response,
        status: "streaming",
      }));

      for await (const message of readUIMessageStream({
        stream,
        terminateOnError: true,
      })) {
        const content = message.parts
          .filter(isTextUIPart)
          .map((part) => part.text)
          .join("");

        updateRoundResponse(roundId, modelId, (response) => ({
          ...response,
          content,
          status: "streaming",
        }));
      }

      updateRoundResponse(roundId, modelId, (response) => ({
        ...response,
        status: "completed",
      }));
    } catch (error) {
      console.error("Unable to generate model response", { error, modelId });
      updateRoundResponse(roundId, modelId, (response) => ({
        ...response,
        error: "That model could not finish its answer. Please try again.",
        status: "failed",
      }));
    }
  }

  function submitPrompt() {
    const nextPrompt = prompt.trim();

    if (!nextPrompt || isSubmitting) {
      return;
    }

    const roundId = crypto.randomUUID();
    const modelRequests = selectedModelIds.map((modelId) => ({
      messages: conversationForModel(modelId, nextPrompt),
      modelId,
    }));
    const nextRound: ComparisonRound = {
      id: roundId,
      prompt: nextPrompt,
      responses: selectedModelIds.map((modelId) => ({
        content: "",
        error: null,
        modelId,
        status: "pending",
      })),
      winnerId: null,
    };

    setRounds((currentRounds) => [...currentRounds, nextRound]);
    setPrompt("");
    void Promise.allSettled(
      modelRequests.map(({ messages, modelId }) =>
        requestModelResponse(roundId, modelId, messages),
      ),
    );
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
            {RECENT_THREADS.map((thread, index) => (
              <button
                className={
                  index === 0 ? "thread-link is-current" : "thread-link"
                }
                type="button"
                key={thread}
              >
                <span>{thread}</span>
                {index === 0 && (
                  <span className="thread-dot" aria-hidden="true" />
                )}
              </button>
            ))}
          </div>
        </div>

        <div className="sidebar-footer">
          <button className="new-comparison" type="button">
            <Plus size={17} />
            New comparison
          </button>
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
              <span className="breadcrumb">Arena / Thread 1</span>
              <h1>Explain quantum entanglement simply</h1>
            </div>
          </div>

          <div className="topbar-actions">
            <button
              className="icon-button"
              type="button"
              aria-label="Share thread"
            >
              <Share2 size={18} />
            </button>
          </div>
        </header>

        <main className="conversation">
          {rounds.map((round, roundIndex) => {
            const completedResponses = round.responses.filter(
              (response) => response.status === "completed",
            ).length;

            return (
              <section className="comparison-round" key={round.id}>
                <div className="user-message-wrap">
                  <div className="user-message">{round.prompt}</div>
                  <span className="message-meta">You · Just now</span>
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
                    const model = MODEL_RESPONSES.find(
                      (candidate) => candidate.id === response.modelId,
                    );

                    return model ? (
                      <ModelCard
                        key={model.id}
                        model={model}
                        response={response}
                        showMetrics={round.id === INITIAL_ROUND.id}
                        winnerId={round.winnerId}
                        onVote={(modelId) => selectWinner(round.id, modelId)}
                      />
                    ) : null;
                  })}
                </div>
              </section>
            );
          })}
        </main>

        <div className="composer-dock">
          <div className="composer">
            <div className="model-chips" aria-label="Selected models">
              {selectedModels.map((model) => (
                <span className="model-chip" key={model.id}>
                  <Bot size={13} aria-hidden="true" />
                  {model.shortName}
                  <button
                    type="button"
                    aria-label={`Remove ${model.name}`}
                    onClick={() => removeModel(model.id)}
                  >
                    <X size={13} />
                  </button>
                </span>
              ))}
              <button
                className="add-model"
                type="button"
                disabled={selectedModelIds.length === MODEL_RESPONSES.length}
                onClick={addModel}
              >
                <Plus size={14} />
                Add model
              </button>
            </div>

            <div className="prompt-row">
              <label className="sr-only" htmlFor="prompt-input">
                Send a follow-up prompt
              </label>
              <textarea
                id="prompt-input"
                value={prompt}
                rows={1}
                placeholder="Ask a follow-up…"
                onChange={(event) => setPrompt(event.target.value)}
                onKeyDown={(event) => {
                  if (
                    event.key === "Enter" &&
                    (event.metaKey || event.ctrlKey)
                  ) {
                    event.preventDefault();
                    submitPrompt();
                  }
                }}
              />
              <div className="send-group">
                <span>⌘ Enter</span>
                <button
                  className="send-button"
                  type="button"
                  aria-label="Send prompt"
                  disabled={!prompt.trim() || isSubmitting}
                  onClick={submitPrompt}
                >
                  <ArrowUp size={20} />
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
