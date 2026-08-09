"use client";

import { Check, Copy, TriangleAlert } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { MessageResponse } from "@/components/ai-elements/message";

type ModelResponseProps = {
  readonly content: string;
  readonly isStreaming: boolean;
};

type CopyStatus = "idle" | "copied" | "failed";

export function ModelResponse({ content, isStreaming }: ModelResponseProps) {
  const [copyStatus, setCopyStatus] = useState<CopyStatus>("idle");
  const resetTimeoutRef = useRef<number | null>(null);

  useEffect(
    () => () => {
      if (resetTimeoutRef.current !== null) {
        window.clearTimeout(resetTimeoutRef.current);
      }
    },
    [],
  );

  async function copyResponse() {
    if (!navigator.clipboard?.writeText) {
      setCopyStatus("failed");
      scheduleStatusReset();
      return;
    }

    try {
      await navigator.clipboard.writeText(content);
      setCopyStatus("copied");
      scheduleStatusReset();
    } catch (error) {
      console.error("Unable to copy model response", { error });
      setCopyStatus("failed");
      scheduleStatusReset();
    }
  }

  function scheduleStatusReset() {
    if (resetTimeoutRef.current !== null) {
      window.clearTimeout(resetTimeoutRef.current);
    }

    resetTimeoutRef.current = window.setTimeout(
      () => setCopyStatus("idle"),
      2_000,
    );
  }

  const copyLabel =
    copyStatus === "copied"
      ? "Copied"
      : copyStatus === "failed"
        ? "Copy unavailable"
        : "Copy response";

  return (
    <div className="response-content">
      <div className="response-toolbar">
        <span>Response</span>
        <button
          className={`copy-response-button is-${copyStatus}`}
          type="button"
          aria-label={copyLabel}
          disabled={!content}
          onClick={copyResponse}
        >
          {copyStatus === "copied" ? (
            <Check size={13} aria-hidden="true" />
          ) : copyStatus === "failed" ? (
            <TriangleAlert size={13} aria-hidden="true" />
          ) : (
            <Copy size={13} aria-hidden="true" />
          )}
          <span aria-live="polite">{copyLabel}</span>
        </button>
      </div>

      <div
        className="response-scroll"
        role="region"
        aria-label="Model response"
        tabIndex={0}
      >
        <MessageResponse
          className="ai-response"
          controls={{
            code: { copy: true, download: false },
            mermaid: { copy: true, download: false, fullscreen: true },
            table: { copy: true, download: false, fullscreen: true },
          }}
          isAnimating={isStreaming}
          lineNumbers={false}
          mode={isStreaming ? "streaming" : "static"}
        >
          {content}
        </MessageResponse>
      </div>
    </div>
  );
}
