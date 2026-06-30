"use client";

import { JobStatus, QueuedJob } from "@/context/JobQueueContext";
import { useEffect, useState, useRef } from "react";

interface JobQueueCardProps {
  job: QueuedJob;
  onRemove: () => void;
  onRetry?: () => void;
  onView?: () => void;
  onEdit?: () => void;
  isCurrentJob?: boolean;
}

// Progress ranges for each phase
const PROGRESS_RANGES = {
  "tailoring-resume": { start: 1, end: 65 },
  "tailoring-cover-letter": { start: 66, end: 95 },
} as const;

// Live status messages for processing jobs
const PROCESSING_MESSAGES: Record<string, string[]> = {
  "tailoring-resume": [
    "Tailoring resume...",
    "Optimizing content...",
    "Matching keywords...",
    "Refining bullets...",
  ],
  "tailoring-cover-letter": [
    "Writing cover letter...",
    "Personalizing content...",
    "Adding details...",
    "Polishing draft...",
  ],
};

const STATUS_CONFIG: Record<
  JobStatus,
  { label: string; color: string; bgColor: string; icon: React.ReactNode }
> = {
  pending: {
    label: "Pending",
    color: "text-gray-600",
    bgColor: "bg-gray-100",
    icon: (
      <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <circle cx="12" cy="12" r="10" strokeWidth="2" />
        <path strokeWidth="2" d="M12 6v6l4 2" />
      </svg>
    ),
  },
  "tailoring-resume": {
    label: "Tailoring",
    color: "text-purple-700",
    bgColor: "bg-purple-50",
    icon: (
      <svg
        className="h-3.5 w-3.5 animate-spin"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
      >
        <path
          strokeWidth="2"
          d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
        />
      </svg>
    ),
  },
  "tailoring-cover-letter": {
    label: "Cover Letter",
    color: "text-indigo-700",
    bgColor: "bg-indigo-50",
    icon: (
      <svg
        className="h-3.5 w-3.5 animate-spin"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
      >
        <path
          strokeWidth="2"
          d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
        />
      </svg>
    ),
  },
  completed: {
    label: "Done",
    color: "text-green-700",
    bgColor: "bg-green-50",
    icon: (
      <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
      </svg>
    ),
  },
  failed: {
    label: "Failed",
    color: "text-red-700",
    bgColor: "bg-red-50",
    icon: (
      <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M6 18L18 6M6 6l12 12"
        />
      </svg>
    ),
  },
  cancelled: {
    label: "Cancelled",
    color: "text-orange-700",
    bgColor: "bg-orange-50",
    icon: (
      <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636"
        />
      </svg>
    ),
  },
};

export default function JobQueueCard({
  job,
  onRemove,
  onRetry,
  onView,
  onEdit,
  isCurrentJob,
}: JobQueueCardProps) {
  const config = STATUS_CONFIG[job.status];
  const isProcessing = ["researching", "tailoring-resume", "tailoring-cover-letter"].includes(
    job.status,
  );
  const [messageIndex, setMessageIndex] = useState(0);

  // Animated progress state — only updated via interval callback (async)
  const [animatedProgress, setAnimatedProgress] = useState(job.progress);
  const lastStatusRef = useRef(job.status);
  const pendingResetRef = useRef<number | null>(null);

  // Derive display: animate during processing, use real progress otherwise
  const displayProgress = isProcessing ? animatedProgress : job.progress;

  // Animate progress during processing
  useEffect(() => {
    if (!isProcessing) return;

    const range = PROGRESS_RANGES[job.status as keyof typeof PROGRESS_RANGES];
    if (!range) return;

    // Defer status-change reset to interval callback (avoids sync setState)
    if (lastStatusRef.current !== job.status) {
      lastStatusRef.current = job.status;
      pendingResetRef.current = range.start;
    }

    const interval = setInterval(() => {
      setAnimatedProgress((prev) => {
        if (pendingResetRef.current !== null) {
          const reset = pendingResetRef.current;
          pendingResetRef.current = null;
          return reset;
        }
        if (prev >= range.end) return range.end;
        return prev + 1;
      });
    }, 500);

    return () => clearInterval(interval);
  }, [isProcessing, job.status]);

  // Cycle through status messages for processing jobs
  useEffect(() => {
    if (!isProcessing) return;

    const messages = PROCESSING_MESSAGES[job.status] || [];
    if (messages.length === 0) return;

    const interval = setInterval(() => {
      setMessageIndex((prev) => (prev + 1) % messages.length);
    }, 2000);

    return () => clearInterval(interval);
  }, [isProcessing, job.status]);

  const currentMessage = isProcessing
    ? (PROCESSING_MESSAGES[job.status] || [])[messageIndex] || config.label
    : config.label;

  return (
    <div
      className={`relative overflow-hidden rounded-lg border p-3 transition-all ${
        job.status === "failed"
          ? "border-red-200 bg-red-50/30"
          : isCurrentJob
            ? "border-gray-400 bg-white shadow-sm"
            : "border-gray-200 bg-white hover:border-gray-300"
      }`}
    >
      {/* Animated shimmer overlay for processing cards */}
      {isProcessing && (
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div
            className="absolute inset-0 -translate-x-full animate-[shimmer_2s_infinite]"
            style={{
              background:
                "linear-gradient(90deg, transparent, rgba(156, 163, 175, 0.1), transparent)",
            }}
          />
        </div>
      )}

      {/* Animated progress bar */}
      {isProcessing && (
        <div className="absolute right-0 bottom-0 left-0 h-1 overflow-hidden bg-gray-100">
          <div
            className="absolute h-full bg-gradient-to-r from-gray-400 via-gray-600 to-gray-400 transition-all duration-500"
            style={{
              width: `${displayProgress}%`,
              backgroundSize: "200% 100%",
              animation: "gradient-shift 1.5s ease infinite",
            }}
          />
          {/* Pulsing dot at the end */}
          <div
            className="absolute top-0 h-full w-2 animate-pulse rounded-full bg-gray-700"
            style={{ left: `${Math.max(0, displayProgress - 1)}%` }}
          />
        </div>
      )}

      <div className="flex items-start justify-between gap-2">
        {/* Job info */}
        <div className="min-w-0 flex-1">
          <div className="mb-0.5 flex items-center gap-2">
            <h3 className="truncate text-sm font-medium">{job.companyName || "Unknown Company"}</h3>
            {isCurrentJob && (
              <span className="animate-pulse rounded bg-gray-900 px-1.5 py-0.5 text-[9px] font-medium text-white">
                ACTIVE
              </span>
            )}
          </div>
          <p className="text-muted truncate text-xs">{job.positionTitle || "Position"}</p>

          {/* Status badge and Profile tag */}
          <div className="mt-1.5 flex flex-wrap items-center gap-2">
            <span
              className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-medium ${config.bgColor} ${config.color}`}
            >
              {config.icon}
              {isProcessing ? (
                <span className="inline-flex items-center gap-1">
                  <span className="transition-opacity duration-300">{currentMessage}</span>
                  <span className="ml-0.5 font-bold">{displayProgress}%</span>
                </span>
              ) : (
                config.label
              )}
            </span>
            {job.profileName && (
              <span
                className={`inline-flex items-center gap-1 rounded bg-gray-100 px-1.5 py-0.5 text-[10px] font-medium text-gray-600`}
              >
                <span
                  className={`h-3 w-3 rounded-full bg-linear-to-br ${job.profileColor || "from-gray-400 to-gray-500"} flex items-center justify-center text-[6px] font-bold text-white`}
                >
                  {job.profileName[0]}
                </span>
                {job.profileName}
              </span>
            )}
          </div>

          {/* Error message with retry */}
          {job.status === "failed" && job.error && (
            <div className="mt-2 space-y-1.5">
              <p className="rounded bg-red-100 px-2 py-1 text-[10px] text-red-600">
                {job.error}
                {job.retryCount && job.retryCount > 0 && (
                  <span className="ml-1 text-red-500">(Retry #{job.retryCount})</span>
                )}
              </p>
              {onRetry && (
                <button
                  onClick={onRetry}
                  className="flex items-center gap-1 rounded bg-red-500 px-2 py-1 text-[10px] font-medium text-white transition-colors hover:bg-red-600"
                >
                  <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path
                      strokeWidth="2"
                      d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                    />
                  </svg>
                  Retry
                </button>
              )}
            </div>
          )}

          {/* Cancelled message with retry option */}
          {job.status === "cancelled" && (
            <div className="mt-2">
              <p className="rounded bg-orange-100 px-2 py-1 text-[10px] text-orange-600">
                Processing was cancelled
              </p>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex gap-1">
          {job.status === "completed" && onView && (
            <button
              onClick={onView}
              className="rounded p-1.5 text-gray-600 transition-colors hover:bg-gray-100"
              title="View results"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path
                  strokeWidth="2"
                  d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                />
              </svg>
            </button>
          )}
          {onEdit && (
            <button
              onClick={onEdit}
              className="rounded p-1.5 text-gray-600 transition-colors hover:bg-gray-100"
              title="Edit job"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                />
              </svg>
            </button>
          )}
          {job.status === "failed" && onRetry && (
            <button
              onClick={onRetry}
              className="rounded p-1.5 text-gray-600 transition-colors hover:bg-gray-100"
              title="Retry"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeWidth="2"
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                />
              </svg>
            </button>
          )}
          {job.status === "cancelled" && onRetry && (
            <button
              onClick={onRetry}
              className="rounded p-1.5 text-orange-600 transition-colors hover:bg-gray-100"
              title="Retry cancelled job"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeWidth="2"
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                />
              </svg>
            </button>
          )}
          {/* Restart button shown during processing */}
          {isProcessing && onRetry && (
            <button
              onClick={onRetry}
              className="inline-flex items-center gap-1.5 rounded-lg border border-blue-600 bg-blue-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:border-blue-700 hover:bg-blue-700"
              title="Restart job"
            >
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeWidth="2"
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                />
              </svg>
              Restart
            </button>
          )}
          {!isProcessing && (
            <button
              onClick={onRemove}
              className="rounded p-1.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
              title="Remove"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* Add keyframes for shimmer animation */}
      <style jsx>{`
        @keyframes shimmer {
          100% {
            transform: translateX(100%);
          }
        }
        @keyframes gradient-shift {
          0%,
          100% {
            background-position: 0% 50%;
          }
          50% {
            background-position: 100% 50%;
          }
        }
      `}</style>
    </div>
  );
}
