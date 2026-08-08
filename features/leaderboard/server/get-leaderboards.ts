import "server-only";

import { database } from "@/features/database/client";
import type { LeaderboardRanking } from "@/features/leaderboard/types";

type VoteWithResponses = Awaited<ReturnType<typeof loadVotes>>[number];

type RankingAccumulator = {
  durationMs: number;
  durationSamples: number;
  model: string;
  outputTokens: number;
  timeToFirstTokenMs: number;
  ttftSamples: number;
  total: number;
  wins: number;
};

const loadVotes = () =>
  database.vote.findMany({
    select: {
      responseId: true,
      userId: true,
      turn: {
        select: {
          responses: {
            where: { status: "COMPLETED" },
            select: {
              durationMs: true,
              id: true,
              modelId: true,
              modelName: true,
              outputTokens: true,
              timeToFirstTokenMs: true,
            },
          },
        },
      },
    },
  });

const initialsForModel = (model: string): string =>
  model
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase() ?? "")
    .join("");

const formatMilliseconds = (total: number, samples: number): string =>
  samples === 0 ? "—" : `${Math.round(total / samples)}ms`;

const formatSpeed = (
  outputTokens: number,
  durationMs: number,
  samples: number,
): string => {
  if (samples === 0 || durationMs <= 0) {
    return "—";
  }

  return `${Math.round((outputTokens * 1_000) / durationMs)} t/s`;
};

const aggregateRankings = (
  votes: readonly VoteWithResponses[],
): readonly LeaderboardRanking[] => {
  const models = new Map<string, RankingAccumulator>();

  for (const vote of votes) {
    for (const response of vote.turn.responses) {
      const current = models.get(response.modelId) ?? {
        durationMs: 0,
        durationSamples: 0,
        model: response.modelName,
        outputTokens: 0,
        timeToFirstTokenMs: 0,
        ttftSamples: 0,
        total: 0,
        wins: 0,
      };

      current.total += 1;
      current.wins += response.id === vote.responseId ? 1 : 0;

      if (response.timeToFirstTokenMs !== null) {
        current.timeToFirstTokenMs += response.timeToFirstTokenMs;
        current.ttftSamples += 1;
      }

      if (response.durationMs !== null && response.outputTokens !== null) {
        current.durationMs += response.durationMs;
        current.outputTokens += response.outputTokens;
        current.durationSamples += 1;
      }

      models.set(response.modelId, current);
    }
  }

  return [...models.values()]
    .sort(
      (left, right) =>
        right.wins / right.total - left.wins / left.total ||
        right.wins - left.wins ||
        right.total - left.total ||
        left.model.localeCompare(right.model),
    )
    .map((model, index) => ({
      initials: initialsForModel(model.model),
      model: model.model,
      rank: index + 1,
      speed: formatSpeed(
        model.outputTokens,
        model.durationMs,
        model.durationSamples,
      ),
      total: model.total,
      ttft: formatMilliseconds(model.timeToFirstTokenMs, model.ttftSamples),
      winRate: Math.round((model.wins / model.total) * 100),
      wins: model.wins,
    }));
};

export type LeaderboardsResult = {
  readonly error: string | null;
  readonly globalRankings: readonly LeaderboardRanking[];
  readonly personalRankings: readonly LeaderboardRanking[];
};

export async function getLeaderboards(
  userId: string,
): Promise<LeaderboardsResult> {
  try {
    const votes = await loadVotes();

    return {
      error: null,
      globalRankings: aggregateRankings(votes),
      personalRankings: aggregateRankings(
        votes.filter((vote) => vote.userId === userId),
      ),
    };
  } catch (error) {
    console.error("Unable to load leaderboard votes", {
      error,
      event: "leaderboard_load_failed",
      userId,
    });

    return {
      error: "The leaderboard could not be loaded. Please try again shortly.",
      globalRankings: [],
      personalRankings: [],
    };
  }
}
