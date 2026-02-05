"use client";

import { JobStatus, QueuedJob } from "@/context/JobQueueContext";

interface JobQueueCardProps {
  job: QueuedJob;
  onRemove: () => void;
  onRetry?: () => void;
  onView?: () => void;
  isCurrentJob?: boolean;
}

const STATUS_CONFIG: Record<JobStatus, { label: string; color: string; bgColor: string; icon: React.ReactNode }> = {
  pending: {
    label: "Pending",
    color: "text-gray-600",
    bgColor: "bg-gray-100",
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <circle cx="12" cy="12" r="10" strokeWidth="2" />
        <path strokeWidth="2" d="M12 6v6l4 2" />
      </svg>
    ),
  },
  researching: {
    label: "Researching",
    color: "text-blue-600",
    bgColor: "bg-blue-50",
    icon: (
      <svg className="w-4 h-4 animate-pulse" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <circle cx="11" cy="11" r="8" strokeWidth="2" />
        <path strokeWidth="2" d="M21 21l-4.35-4.35" />
      </svg>
    ),
  },
  "tailoring-resume": {
    label: "Tailoring Resume",
    color: "text-purple-600",
    bgColor: "bg-purple-50",
    icon: (
      <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
      </svg>
    ),
  },
  "tailoring-cover-letter": {
    label: "Tailoring Cover Letter",
    color: "text-indigo-600",
    bgColor: "bg-indigo-50",
    icon: (
      <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
      </svg>
    ),
  },
  completed: {
    label: "Completed",
    color: "text-green-600",
    bgColor: "bg-green-50",
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
      </svg>
    ),
  },
  failed: {
    label: "Failed",
    color: "text-red-600",
    bgColor: "bg-red-50",
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
      </svg>
    ),
  },
};

export default function JobQueueCard({ job, onRemove, onRetry, onView, isCurrentJob }: JobQueueCardProps) {
  const config = STATUS_CONFIG[job.status];
  const isProcessing = ["researching", "tailoring-resume", "tailoring-cover-letter"].includes(job.status);

  return (
    <div
      className={`relative p-4 rounded-xl border transition-all duration-300 ${
        isCurrentJob
          ? "border-primary bg-white shadow-lg ring-2 ring-primary/20"
          : "border-card-border bg-white/80 hover:shadow-md hover:border-gray-300"
      }`}
    >
      {/* Progress bar overlay */}
      {isProcessing && (
        <div className="absolute inset-0 rounded-xl overflow-hidden pointer-events-none">
          <div
            className="absolute bottom-0 left-0 h-1 bg-linear-to-r from-primary/60 to-primary transition-all duration-500"
            style={{ width: `${job.progress}%` }}
          />
        </div>
      )}

      <div className="flex items-start justify-between gap-3">
        {/* Job info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="font-semibold text-sm truncate">{job.companyName || "Unknown Company"}</h3>
            {isCurrentJob && (
              <span className="px-2 py-0.5 text-[10px] font-medium bg-primary text-white rounded-full">
                PROCESSING
              </span>
            )}
          </div>
          <p className="text-xs text-muted truncate">{job.positionTitle || "Position"}</p>
          
          {/* Status badge */}
          <div className="flex items-center gap-2 mt-2">
            <span className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium ${config.bgColor} ${config.color}`}>
              {config.icon}
              {config.label}
              {isProcessing && <span className="ml-1">({job.progress}%)</span>}
            </span>
          </div>

          {/* Error message */}
          {job.status === "failed" && job.error && (
            <p className="mt-2 text-xs text-red-600 bg-red-50 px-2 py-1 rounded">{job.error}</p>
          )}

          {/* Time info */}
          <div className="mt-2 text-[10px] text-muted">
            {job.completedAt ? (
              <span>Completed in {Math.round((job.completedAt - (job.startedAt || job.addedAt)) / 1000)}s</span>
            ) : job.startedAt ? (
              <span>Processing...</span>
            ) : (
              <span>Queued {formatTimeAgo(job.addedAt)}</span>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-col gap-1">
          {job.status === "completed" && onView && (
            <button
              onClick={onView}
              className="p-1.5 rounded-lg hover:bg-green-50 text-green-600 transition-colors"
              title="View results"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </svg>
            </button>
          )}
          {job.status === "failed" && onRetry && (
            <button
              onClick={onRetry}
              className="p-1.5 rounded-lg hover:bg-yellow-50 text-yellow-600 transition-colors"
              title="Retry"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </button>
          )}
          {!isProcessing && (
            <button
              onClick={onRemove}
              className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-600 transition-colors"
              title="Remove"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function formatTimeAgo(timestamp: number): string {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ago`;
}
