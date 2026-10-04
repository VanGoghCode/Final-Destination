"use client";
import type { QueuedJob } from "@/context/JobQueueContext";
import { isActiveJob, isClaimable } from "@/lib/queue";

interface JobQueueCardProps {
  job: QueuedJob;
  onRemove: () => unknown;
  onRetry?: () => unknown;
  onView?: () => unknown;
  onEdit?: () => unknown;
  onCancel?: () => unknown;
  isCurrentJob?: boolean;
  busy?: boolean;
}
const labels = {
  pending: "Waiting",
  researching: "Preparing",
  "tailoring-resume": "Tailoring resume",
  "tailoring-cover-letter": "Writing cover letter",
  completed: "Completed",
  failed: "Failed",
  cancelled: "Cancelled",
};
const icons = {
  view: "M2 12s3-7 10-7 10 7 10 7-3 7-10 7S2 12 2 12Z M15 12a3 3 0 1 0-6 0 3 3 0 0 0 6 0",
  edit: "m16 3 5 5-13 13H3v-5L16 3Z M14 5l5 5",
  retry: "M20 7v5h-5 M4 17v-5h5 M6 7a7 7 0 0 1 12-2l2 3 M18 17a7 7 0 0 1-12 2l-2-3",
  cancel: "M21 12a9 9 0 1 0-18 0 9 9 0 0 0 18 0 M8 8l8 8m0-8-8 8",
  remove: "M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7m4-7v7",
  link: "M14 3h7v7m0-7L10 14M10 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-5",
};
const actionClasses =
  "relative inline-flex h-10 w-10 items-center justify-center rounded-md border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-400 disabled:cursor-wait disabled:opacity-50 after:pointer-events-none after:absolute after:bottom-full after:left-0 after:z-10 after:mb-2 after:-translate-y-1 after:rounded-md after:bg-gray-900 after:px-2 after:py-1 after:text-xs after:whitespace-nowrap after:text-white after:opacity-0 after:shadow-sm after:transition-all after:duration-150 after:content-[attr(aria-label)] hover:after:translate-y-0 hover:after:opacity-100 focus-visible:after:translate-y-0 focus-visible:after:opacity-100 motion-reduce:after:transform-none motion-reduce:after:transition-none";
const actionIcon = (icon: keyof typeof icons) => (
  <svg
    aria-hidden="true"
    className="h-4 w-4"
    fill="none"
    viewBox="0 0 24 24"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d={icons[icon]} />
  </svg>
);
export default function JobQueueCard({
  job,
  onRemove,
  onRetry,
  onView,
  onEdit,
  onCancel,
  isCurrentJob,
  busy,
}: JobQueueCardProps) {
  const active = isActiveJob(job),
    interrupted = active && isClaimable(job);
  const results = !!(job.tailoredResume || job.tailoredCoverLetter);
  const link = /^https?:\/\//i.test(job.companyUrl) ? job.companyUrl : null;
  const action = (
    label: string,
    icon: keyof typeof icons,
    onClick: () => unknown,
    danger = false,
  ) => (
    <button
      type="button"
      aria-label={label}
      disabled={busy}
      onClick={() => void onClick()}
      className={`${actionClasses} ${danger ? "border-red-200 text-red-700 hover:bg-red-50" : "border-gray-200 text-gray-700 hover:bg-gray-50"}`}
    >
      {actionIcon(icon)}
    </button>
  );
  return (
    <article
      aria-label={`${job.companyName}: ${job.positionTitle}`}
      aria-busy={busy}
      className={`min-w-0 space-y-3 rounded-xl border bg-white p-4 ${job.status === "failed" ? "border-red-200" : isCurrentJob ? "border-purple-300" : "border-gray-200"}`}
    >
      <div>
        <h3 className="text-sm font-semibold break-words">
          {job.companyName || "Unknown company"}
        </h3>
        <p className="mt-1 text-xs break-words text-gray-600">{job.positionTitle}</p>
        <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
          <span
            role="status"
            className={`rounded px-2 py-1 ${job.status === "failed" ? "bg-red-50 text-red-700" : job.status === "completed" ? "bg-green-50 text-green-700" : "bg-gray-100 text-gray-700"}`}
          >
            {interrupted ? "Interrupted — ready to recover" : labels[job.status]}
          </span>
          <span>{job.profileName || "Default templates"}</span>
          {job.includeCoverLetter && <span>Resume + cover letter</span>}
          {!!job.retryCount && <span>Attempt {job.retryCount + 1}</span>}
        </div>
      </div>
      {active && !interrupted && (
        <div
          role="progressbar"
          aria-label="Processing stage"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={job.progress}
          aria-valuetext={labels[job.status]}
          className="h-1.5 overflow-hidden rounded bg-gray-100"
        >
          <div
            className="h-full bg-purple-500 transition-all"
            style={{ width: `${Math.max(0, Math.min(100, job.progress))}%` }}
          />
        </div>
      )}
      {job.error && job.status === "failed" && (
        <p role="alert" className="rounded bg-red-50 p-2 text-xs break-words text-red-700">
          {job.error}
        </p>
      )}
      {busy && (
        <p role="status" className="text-xs text-gray-500">
          Saving change…
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        {job.status === "completed" && results && onView && action("View results", "view", onView)}
        {!active && onEdit && action("Edit job", "edit", onEdit)}
        {onRetry &&
          job.status !== "pending" &&
          action(
            interrupted
              ? "Recover job"
              : active
                ? "Restart job"
                : job.status === "completed"
                  ? "Reprocess"
                  : "Retry job",
            "retry",
            onRetry,
          )}
        {(active || job.status === "pending") &&
          onCancel &&
          action("Cancel job", "cancel", onCancel, true)}
        {action("Remove job", "remove", onRemove, true)}
        {link && (
          <a
            href={link}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Open posting"
            className={`${actionClasses} border-blue-200 text-blue-700 hover:bg-blue-50`}
          >
            {actionIcon("link")}
          </a>
        )}
      </div>
    </article>
  );
}
