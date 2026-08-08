"use client";

import {
  AlertCircle,
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
import { useMemo, useState } from "react";

import { AccountMenu } from "@/features/auth/components/account-menu";
import type { AvailableModel } from "@/features/model-catalog/server/get-available-models";

type ModelsCatalogProps = {
  readonly models: readonly AvailableModel[];
  readonly error: string | null;
};

const capabilityLabels: Record<string, string> = {
  tools: "Tools",
  tool_choice: "Tool choice",
  reasoning: "Reasoning",
  structured_outputs: "Structured output",
  response_format: "JSON output",
};

function formatContextWindow(tokens: number): string {
  if (tokens >= 1_000_000) {
    return `${new Intl.NumberFormat("en", { maximumFractionDigits: 1 }).format(tokens / 1_000_000)}M`;
  }

  if (tokens >= 1_000) {
    return `${new Intl.NumberFormat("en", { maximumFractionDigits: 0 }).format(tokens / 1_000)}K`;
  }

  return new Intl.NumberFormat("en").format(tokens);
}

function providerName(author: string): string {
  return author
    .split(/[-_]/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function modelInitials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0])
    .join("")
    .toUpperCase();
}

export function ModelsCatalog({ models, error }: ModelsCatalogProps) {
  const [query, setQuery] = useState("");
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const normalizedQuery = query.trim().toLowerCase();

  const filteredModels = useMemo(() => {
    if (!normalizedQuery) {
      return models;
    }

    return models.filter((model) =>
      [model.name, model.id, model.author, ...model.inputModalities]
        .join(" ")
        .toLowerCase()
        .includes(normalizedQuery),
    );
  }, [models, normalizedQuery]);

  return (
    <div className="arena-app models-app">
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
          <Link className="nav-link" href="/leaderboard">
            <Trophy size={18} />
            Leaderboard
          </Link>
          <Link className="nav-link is-active" href="/models">
            <Database size={18} />
            Models
          </Link>
        </nav>

        <div className="models-sidebar-note">
          <p className="eyebrow">About this catalog</p>
          <p>
            Every listed model is currently available for free text generation
            through OpenRouter.
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
              <span className="breadcrumb">LLM Arena / Catalog</span>
              <h1>Models</h1>
            </div>
          </div>
          <span className="catalog-live-status">
            <span aria-hidden="true" />
            Live from OpenRouter
          </span>
        </header>

        <main className="models-main">
          <div className="models-intro">
            <div>
              <span className="eyebrow">Free model catalog</span>
              <h2>Every model available in the Arena</h2>
              <p>
                Browse free text models, ordered by the largest context window
                first.
              </p>
            </div>
            <div className="catalog-count" aria-live="polite">
              <strong>{filteredModels.length}</strong>
              <span>{normalizedQuery ? "matching" : "available"}</span>
            </div>
          </div>

          <div className="catalog-toolbar">
            <label className="catalog-search">
              <Search size={18} aria-hidden="true" />
              <span className="sr-only">Search models</span>
              <input
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search by model, provider, or ID"
              />
              {query ? (
                <button
                  type="button"
                  aria-label="Clear search"
                  onClick={() => setQuery("")}
                >
                  <X size={16} />
                </button>
              ) : null}
            </label>
            <span className="catalog-sort">Context: high to low</span>
          </div>

          {error ? (
            <section className="catalog-state catalog-error" role="alert">
              <AlertCircle size={24} />
              <div>
                <h3>Models could not be loaded</h3>
                <p>{error}</p>
              </div>
            </section>
          ) : filteredModels.length === 0 ? (
            <section className="catalog-state">
              <Search size={24} />
              <div>
                <h3>No models match “{query.trim()}”</h3>
                <p>Try a model family, provider name, or exact model ID.</p>
              </div>
            </section>
          ) : (
            <section className="model-catalog" aria-label="Available models">
              <div className="catalog-header" aria-hidden="true">
                <span>Model</span>
                <span>Capabilities</span>
                <span>Context</span>
                <span>Price</span>
              </div>
              {filteredModels.map((model) => {
                const tags = [
                  ...model.inputModalities.map((modality) =>
                    modality === "text" ? "Text input" : `${modality} input`,
                  ),
                  ...model.capabilities.map(
                    (capability) => capabilityLabels[capability] ?? capability,
                  ),
                ];

                return (
                  <article className="catalog-row" key={model.id}>
                    <div className="catalog-model-identity">
                      <span className="catalog-model-avatar" aria-hidden="true">
                        {modelInitials(model.name)}
                      </span>
                      <div>
                        <div className="catalog-model-title">
                          <h3>{model.name}</h3>
                          <span>{providerName(model.author)}</span>
                        </div>
                        <code>{model.id}</code>
                        {model.description ? <p>{model.description}</p> : null}
                      </div>
                    </div>
                    <div className="catalog-tags">
                      {tags.slice(0, 5).map((tag) => (
                        <span key={tag}>{tag}</span>
                      ))}
                    </div>
                    <div className="catalog-context">
                      <strong>
                        {formatContextWindow(model.contextLength)}
                      </strong>
                      <span>tokens</span>
                    </div>
                    <div className="catalog-free">Free</div>
                  </article>
                );
              })}
            </section>
          )}
        </main>
      </section>
    </div>
  );
}
