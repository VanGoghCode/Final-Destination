"use client";

import { useState } from "react";
import CopyButton from "./CopyButton";

interface CodeBlockProps {
  code: string;
  title: string;
  showCopy?: boolean;
  onRegenerate?: (comment: string) => Promise<void>;
  isRegenerating?: boolean;
}

export default function CodeBlock({
  code,
  title,
  showCopy = true,
  onRegenerate,
  isRegenerating = false,
}: CodeBlockProps) {
  const [showFeedback, setShowFeedback] = useState(false);
  const [comment, setComment] = useState("");

  const handleRegenerate = async () => {
    if (!comment.trim() || !onRegenerate) return;
    await onRegenerate(comment);
    setComment("");
    setShowFeedback(false);
  };

  return (
    <div className="glass-card fade-in">
      <div className="flex items-center justify-between px-5 py-4 border-b border-card-border">
        <div className="flex items-center gap-4">
          {/* Mac-style window controls */}
          <div className="flex gap-1.5">
            <div className="w-3 h-3 rounded-full bg-red-400/80" />
            <div className="w-3 h-3 rounded-full bg-amber-400/80" />
            <div className="w-3 h-3 rounded-full bg-green-400/80" />
          </div>
          <h3 className="text-sm font-medium text-foreground/80 truncate ml-2">
            {title}
          </h3>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {showCopy && code && <CopyButton text={code} label="Copy" />}
          {onRegenerate && code && (
            <button
              onClick={() => setShowFeedback(!showFeedback)}
              className="copy-btn"
              title="Add feedback and regenerate"
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
                <path d="M3 3v5h5" />
                <path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16" />
                <path d="M16 21h5v-5" />
              </svg>
              <span className="hidden sm:inline">Regenerate</span>
            </button>
          )}
        </div>
      </div>

      <div className="code-block max-h-72 sm:max-h-96 overflow-y-auto border-t-0 rounded-t-none">
        {code || (
          <span className="text-muted-light">No content generated yet...</span>
        )}
      </div>

      {/* Regenerate feedback section */}
      {showFeedback && onRegenerate && (
        <div className="regenerate-section fade-in">
          <label className="text-xs font-medium text-muted mb-2 block">
            What changes would you like?
          </label>
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="e.g., Make the summary more concise, add more keywords, emphasize leadership experience..."
            className="regenerate-input mb-3"
            rows={2}
          />
          <div className="flex gap-2 justify-end">
            <button
              onClick={() => {
                setShowFeedback(false);
                setComment("");
              }}
              className="btn-secondary text-xs py-2 px-3"
            >
              Cancel
            </button>
            <button
              onClick={handleRegenerate}
              disabled={!comment.trim() || isRegenerating}
              className="btn-regenerate"
            >
              {isRegenerating ? (
                <>
                  <span className="spinner-small" />
                  Regenerating...
                </>
              ) : (
                <>
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
                    <path d="M3 3v5h5" />
                  </svg>
                  Apply Changes
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
