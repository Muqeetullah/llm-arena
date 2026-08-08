"use client";

import {
  Database,
  LayoutGrid,
  Menu,
  Plus,
  Search,
  Swords,
  Trophy,
  X,
} from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { AccountMenu } from "@/features/auth/components/account-menu";

type Board = "global" | "personal";

const GLOBAL_RANKINGS = [
  {
    rank: 1,
    initials: "L3",
    model: "Llama 3.3 70B",
    wins: 507,
    total: 700,
    winRate: 72,
    ttft: "240ms",
    speed: "82 t/s",
  },
  {
    rank: 2,
    initials: "G3",
    model: "Gemma 3 27B",
    wins: 438,
    total: 682,
    winRate: 64,
    ttft: "180ms",
    speed: "110 t/s",
  },
  {
    rank: 3,
    initials: "MS",
    model: "Mistral Small 3.1",
    wins: 391,
    total: 665,
    winRate: 59,
    ttft: "310ms",
    speed: "68 t/s",
  },
] as const;

const PERSONAL_RANKINGS = [
  { ...GLOBAL_RANKINGS[0], wins: 2, total: 4, winRate: 50 },
  { ...GLOBAL_RANKINGS[1], wins: 1, total: 4, winRate: 25 },
  { ...GLOBAL_RANKINGS[2], wins: 1, total: 4, winRate: 25 },
] as const;

export function LeaderboardPage() {
  const [board, setBoard] = useState<Board>("global");
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const rankings = board === "global" ? GLOBAL_RANKINGS : PERSONAL_RANKINGS;

  return (
    <div className="arena-app leaderboard-app">
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
          <Link className="nav-link" href="/">
            <LayoutGrid size={18} />
            Arena
          </Link>
          <Link className="nav-link is-active" href="/leaderboard">
            <Trophy size={18} />
            Leaderboard
          </Link>
          <Link className="nav-link" href="/models">
            <Database size={18} />
            Models
          </Link>
        </nav>

        <div className="leaderboard-sidebar-note">
          <p className="eyebrow">How ranking works</p>
          <p>
            Models are ordered by real head-to-head votes, never a made-up
            score.
          </p>
        </div>

        <div className="sidebar-footer">
          <Link className="new-comparison" href="/">
            <Plus size={17} />
            New comparison
          </Link>
          <AccountMenu />
        </div>
      </aside>

      <section className="arena-shell">
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
              <span className="breadcrumb">LLM Arena / Rankings</span>
              <h1>Leaderboard</h1>
            </div>
          </div>
          <button
            className="icon-button"
            type="button"
            aria-label="Search models"
          >
            <Search size={18} />
          </button>
        </header>

        <main className="leaderboard-main">
          <div className="leaderboard-intro">
            <div>
              <span className="eyebrow">Model performance</span>
              <h2>Results from real head-to-head votes</h2>
              <p>
                Clear records, measured response speed, and no mystery scores.
              </p>
            </div>
            <div className="board-toggle" aria-label="Leaderboard scope">
              <button
                className={board === "global" ? "is-active" : ""}
                type="button"
                onClick={() => setBoard("global")}
              >
                Global
              </button>
              <button
                className={board === "personal" ? "is-active" : ""}
                type="button"
                onClick={() => setBoard("personal")}
              >
                Personal
              </button>
            </div>
          </div>

          <section
            className="ranking-table"
            aria-label={`${board} model rankings`}
          >
            <div className="ranking-header" aria-hidden="true">
              <span>Rank</span>
              <span>Model</span>
              <span>Win record</span>
              <span>Avg. first token</span>
              <span>Avg. speed</span>
            </div>
            {rankings.map((ranking) => (
              <article
                className={`ranking-row${ranking.rank === 1 ? " is-first" : ""}`}
                key={ranking.model}
              >
                <div className="ranking-position">
                  <span>#{ranking.rank}</span>
                  {ranking.rank === 1 ? (
                    <>
                      <Trophy size={15} aria-hidden="true" />
                      <span className="sr-only">First place</span>
                    </>
                  ) : null}
                </div>
                <div className="ranking-model">
                  <span className="model-avatar" aria-hidden="true">
                    {ranking.initials}
                  </span>
                  <div>
                    <strong>{ranking.model}</strong>
                    <small>OpenRouter free tier</small>
                  </div>
                </div>
                <div className="ranking-record">
                  <strong>{ranking.winRate}%</strong>
                  <span>
                    won {ranking.wins} of {ranking.total}
                  </span>
                  <span className="win-bar" aria-hidden="true">
                    <span style={{ width: `${ranking.winRate}%` }} />
                  </span>
                </div>
                <div className="ranking-metric">
                  <small>Avg. first token</small>
                  <strong>{ranking.ttft}</strong>
                </div>
                <div className="ranking-metric">
                  <small>Avg. speed</small>
                  <strong>{ranking.speed}</strong>
                </div>
              </article>
            ))}
          </section>

          <p className="leaderboard-footnote">
            Rankings update as new completed comparisons receive votes.
          </p>
        </main>
      </section>
    </div>
  );
}
