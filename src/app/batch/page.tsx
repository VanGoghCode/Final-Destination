"use client";

import { apiJSON } from "@/lib/client-api";
import { isActiveJob } from "@/lib/queue";

import { useState, useEffect, useCallback, useMemo, type ComponentProps } from "react";
import { useRouter } from "next/navigation";
import { useJobQueue, QueuedJob } from "@/context/JobQueueContext";
import Button from "@/components/Button";
import JobQueueCard from "@/components/JobQueueCard";
import QueueProgress from "@/components/QueueProgress";
import {
  getDefaultResumeTemplate,
  getDefaultCoverLetterTemplate,
  Template,
  Profile,
} from "@/lib/storage";
import JobForm from "@/components/JobForm";
import ModelSelector from "@/components/ModelSelector";

interface Activity {
  id: string;
  message: string;
  timestamp: number;
}

function QueueJobModal({
  job,
  onClose,
  onSubmit,
  profiles,
}: {
  job?: QueuedJob;
  onClose: () => void;
  onSubmit: ComponentProps<typeof JobForm>["onSubmit"];
  profiles: Profile[];
}) {
  const active = !!job && isActiveJob(job);
  useEffect(() => {
    if (active) onClose();
  }, [active, onClose]);
  if (active) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={job ? "Edit job" : "Add job to queue"}
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="border-b border-gray-100 p-6">
          <h2 className="text-lg font-semibold">{job ? "Edit Job" : "Add Job to Queue"}</h2>
          <p className="text-muted mt-1 text-sm">
            {job
              ? "Saving clears previous results and requeues this job. Resume the queue when ready."
              : "Added jobs wait if the queue is paused"}
          </p>
        </div>
        <JobForm
          profiles={profiles}
          initialValues={job ? { ...job, profileId: job.profileId || "" } : undefined}
          onCancel={onClose}
          onSubmit={async (data) => {
            const saved = await onSubmit(data);
            if (saved !== false) onClose();
            return saved;
          }}
          submitLabel={job ? "Save & requeue" : "Add to queue"}
        />
      </div>
    </div>
  );
}

const activityColors = [
  { prefixes: ["Research", "Context"], classes: "border-l-blue-500 text-blue-700" },
  { prefixes: ["Tailor", "Resume"], classes: "border-l-purple-500 text-purple-700" },
  { prefixes: ["Cover"], classes: "border-l-indigo-500 text-indigo-700" },
  { prefixes: ["Complete", "Done"], classes: "border-l-green-500 text-green-700" },
  { prefixes: ["Error", "Failed"], classes: "border-l-red-500 text-red-600" },
  { prefixes: ["Paused", "Cancelled"], classes: "border-l-orange-500 text-orange-600" },
];
function ActivityFeed({
  currentJob,
  recentActivities,
}: {
  currentJob: QueuedJob | null;
  recentActivities: Activity[];
}) {
  const entries = currentJob
    ? [
        {
          id: currentJob.id,
          timestamp: currentJob.startedAt || currentJob.addedAt,
          message: `[Resume] Processing: ${currentJob.companyName} (${currentJob.progress}%)`,
        },
        ...recentActivities,
      ]
    : recentActivities;
  return (
    <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 font-mono text-xs">
      <p className="mb-2 border-b border-gray-200 pb-2 font-medium text-gray-700">Activity Log</p>
      <div className="max-h-32 space-y-1 overflow-y-auto" aria-live="polite">
        {entries.map((activity) => (
          <div
            key={activity.id}
            className={`flex gap-2 border-l-2 py-0.5 pl-2 ${activityColors.find(({ prefixes }) => prefixes.some((prefix) => activity.message.startsWith(`[${prefix}]`)))?.classes || "border-l-gray-400 text-gray-600"}`}
          >
            <span className="shrink-0 text-gray-400">
              [{new Date(activity.timestamp).toLocaleTimeString()}]
            </span>
            <span>{activity.message}</span>
          </div>
        ))}
        {!entries.length && <p className="text-gray-400 italic">Waiting for jobs...</p>}
      </div>
    </div>
  );
}

export default function BatchProcessPage() {
  const router = useRouter();
  const {
    queue,
    isProcessing,
    currentJobId,
    addJob,
    removeJob,
    updateJob,
    clearQueue,
    clearCompleted,
    startProcessing,
    stopProcessing,
    retryJob,
    completedCount,
    failedCount,
    pendingCount,
    cancelledCount,
    totalCount,
    setPollingEnabled,
    processingPaused,
    activeCount,
    cancelJob,
    busyIds,
    queueError,
    loading,
    retryConnection,
  } = useJobQueue();

  const [showAddModal, setShowAddModal] = useState(false);
  const [editingJob, setEditingJob] = useState<QueuedJob | null>(null);
  const [recentActivities, setRecentActivities] = useState<Activity[]>([]);
  const [resumeTemplate, setResumeTemplate] = useState<Template | null>(null);
  const [coverLetterTemplate, setCoverLetterTemplate] = useState<Template | null>(null);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileControlsOpen, setMobileControlsOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState<
    "all" | "pending" | "processing" | "completed" | "failed" | "cancelled"
  >("all");
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    const close = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMobileControlsOpen(false);
    };
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, []);

  // Enable queue polling only on this page
  useEffect(() => {
    setPollingEnabled(true);
    return () => setPollingEnabled(false);
  }, [setPollingEnabled]);

  useEffect(() => {
    let active = true;
    const load = () => {
      void Promise.all([
        getDefaultResumeTemplate(),
        getDefaultCoverLetterTemplate(),
        apiJSON<Profile[]>("/api/profiles"),
      ])
        .then(([resume, cover, savedProfiles]) => {
          if (active) {
            setResumeTemplate(resume);
            setCoverLetterTemplate(cover);
            setProfiles(savedProfiles);
          }
        })
        .catch(() => {
          /* The queue connection banner handles connection errors. */
        });
    };
    load();
    window.addEventListener("focus", load);
    return () => {
      active = false;
      window.removeEventListener("focus", load);
    };
  }, []);

  // Add activity log
  const addActivity = useCallback((message: string) => {
    setRecentActivities((prev) => [
      {
        id: Math.random().toString(36).substr(2, 9),
        message,
        timestamp: Date.now(),
      },
      ...prev.slice(0, 19),
    ]);
  }, []);

  const handleStopProcessing = async () => {
    if (await stopProcessing())
      addActivity("[Paused] Queue paused; the current job will finish. New jobs will wait.");
  };
  const handleAddJob = async (jobData: Parameters<typeof addJob>[0]) => {
    const id = await addJob(jobData);
    if (id) addActivity(`[Added] ${jobData.companyName} - ${jobData.positionTitle}`);
    return !!id;
  };

  const handleViewResults = (job: QueuedJob) => {
    const slug =
      job.companyName
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)/g, "") || "job";
    router.push(`/tailored/${slug}?jobId=${encodeURIComponent(job.id)}`);
  };

  const handleEditJob = async (updates: Parameters<typeof updateJob>[1]) => {
    if (!editingJob) return false;
    const saved = await updateJob(editingJob.id, updates, true);
    if (saved) addActivity(`[Added] Updated and requeued: ${updates.companyName}`);
    return saved;
  };

  // Handle export all completed jobs as CSV
  const handleExportAll = useCallback(() => {
    const completed = queue.filter((j) => j.status === "completed");
    if (completed.length === 0) return;
    const csv = [
      ["Company", "Position", "Country", "Work Mode"],
      ...completed.map((j) => [
        j.companyName,
        j.positionTitle,
        j.jobCountry || "",
        j.jobWorkMode || "",
      ]),
    ]
      .map((row) => row.map((c) => `"${c.replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `batch-export-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [queue]);

  // Derive current processing job from context's currentJobId
  // This is the single source of truth — only one job processes at a time
  const currentJob = currentJobId ? queue.find((j) => j.id === currentJobId) : null;

  const filteredQueue = useMemo(() => {
    const query = searchQuery.toLowerCase();
    return queue.filter(
      (job) =>
        (job.companyName.toLowerCase().includes(query) ||
          job.positionTitle.toLowerCase().includes(query)) &&
        (statusFilter === "all" ||
          (statusFilter === "processing" ? isActiveJob(job) : job.status === statusFilter)),
    );
  }, [queue, searchQuery, statusFilter]);

  return (
    <div className="flex h-screen overflow-hidden">
      {mobileControlsOpen && (
        <button
          aria-label="Close queue controls"
          onClick={() => setMobileControlsOpen(false)}
          className="fixed inset-0 z-30 bg-black/30 md:hidden"
        />
      )}
      {/* Smart Sidebar */}
      <div
        className={`${mobileControlsOpen ? "fixed inset-y-0 left-0 z-40 block w-80 max-w-[90vw]" : "hidden"} h-screen shrink-0 overflow-y-auto bg-white transition-all duration-300 md:relative md:block ${sidebarCollapsed ? "md:w-16" : "md:w-80"}`}
      >
        <div className="flex min-h-full flex-col border-r border-gray-200 bg-white">
          {/* Header */}
          <div className="flex h-14 items-center justify-between border-b border-gray-100 px-3">
            <div className={`flex items-center gap-2 ${sidebarCollapsed ? "hidden" : ""}`}>
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gray-900">
                <svg
                  className="h-4 w-4 text-white"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <rect x="3" y="3" width="7" height="7" rx="1" strokeWidth="2" />
                  <rect x="14" y="3" width="7" height="7" rx="1" strokeWidth="2" />
                  <rect x="3" y="14" width="7" height="7" rx="1" strokeWidth="2" />
                  <rect x="14" y="14" width="7" height="7" rx="1" strokeWidth="2" />
                </svg>
              </div>
              <div>
                <span className="text-sm font-bold">Batch Mode</span>
                <p className="text-muted text-[10px]">
                  {loading
                    ? "Connecting"
                    : queueError
                      ? "Needs attention"
                      : processingPaused
                        ? "Paused"
                        : isProcessing
                          ? "Processing"
                          : "Ready"}
                </p>
              </div>
            </div>
            <button
              aria-label="Toggle queue controls"
              onClick={() => {
                if (mobileControlsOpen) setMobileControlsOpen(false);
                else setSidebarCollapsed(!sidebarCollapsed);
              }}
              className="flex h-7 w-7 items-center justify-center rounded-md border border-gray-200 bg-white shadow-sm hover:bg-gray-50"
            >
              <svg
                className={`h-4 w-4 text-gray-600 transition-transform ${sidebarCollapsed ? "rotate-180" : ""}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 19l-7-7 7-7"
                />
              </svg>
            </button>
          </div>

          {/* Collapsed View */}
          {sidebarCollapsed ? (
            <div className="flex flex-1 flex-col items-center gap-3 py-4">
              <button
                onClick={() => router.push("/")}
                className="text-muted flex h-10 w-10 items-center justify-center rounded-lg hover:bg-gray-100"
                title="Back to Single Mode"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                </svg>
              </button>
              <button
                onClick={() => {
                  setSidebarCollapsed(false);
                  setShowAddModal(true);
                }}
                className="flex h-10 w-10 items-center justify-center rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200"
                title="Add Job"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M12 4v16m8-8H4"
                  />
                </svg>
              </button>
              <div className="flex-1" />
              {/* Mini Stats */}
              <div className="space-y-2">
                <div
                  className="flex h-10 w-10 items-center justify-center rounded-lg bg-gray-100 text-xs font-bold"
                  title={`${pendingCount} pending`}
                >
                  {pendingCount}
                </div>
                <div
                  className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-100 text-xs font-bold text-green-700"
                  title={`${completedCount} completed`}
                >
                  {completedCount}
                </div>
              </div>
            </div>
          ) : (
            <>
              <div className="border-b border-gray-100 p-3">
                <ModelSelector />
              </div>
              {/* Navigation */}
              <div className="border-b border-gray-100 p-3">
                <button
                  onClick={() => router.push("/")}
                  className="hover:bg-surface-hover text-muted hover:text-foreground flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors"
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                  </svg>
                  Single Mode
                </button>
              </div>

              {/* Queue Stats */}
              <div className="border-b border-gray-100 p-4">
                <QueueProgress
                  total={totalCount}
                  completed={completedCount}
                  failed={failedCount}
                  pending={pendingCount}
                  cancelled={cancelledCount}
                  isProcessing={isProcessing}
                />
              </div>

              {/* Templates Status - Compact */}
              <div className="border-b border-gray-100 px-4 py-3">
                <p className="mb-2 text-[10px] text-gray-500">
                  Default templates; assigned profile and imported templates take priority.
                </p>
                <div className="flex items-center gap-2 text-xs">
                  <div
                    className={`h-2 w-2 rounded-full ${resumeTemplate ? "bg-green-500" : "bg-red-500"}`}
                  />
                  <span className="text-muted">Resume:</span>
                  <span className="truncate font-medium">{resumeTemplate?.name || "Not set"}</span>
                </div>
                <div className="mt-1 flex items-center gap-2 text-xs">
                  <div
                    className={`h-2 w-2 rounded-full ${coverLetterTemplate ? "bg-green-500" : "bg-yellow-500"}`}
                  />
                  <span className="text-muted">Cover:</span>
                  <span className="truncate font-medium">
                    {coverLetterTemplate?.name || "Optional"}
                  </span>
                </div>
                {!resumeTemplate && (
                  <button
                    onClick={() => router.push("/")}
                    className="text-primary mt-2 text-xs hover:underline"
                  >
                    Manage default templates →
                  </button>
                )}
              </div>

              {/* Actions */}
              <div className="flex-1 space-y-2 p-4">
                <Button
                  onClick={() => setShowAddModal(true)}
                  variant="primary"
                  className="w-full justify-center"
                >
                  Add Job
                </Button>

                <a
                  href="/batch/import"
                  className="text-muted hover:text-foreground flex w-full items-center gap-2 rounded-lg border border-gray-200 px-3 py-2 text-sm transition-colors hover:bg-gray-50"
                >
                  Import from AI
                </a>

                <Button
                  onClick={processingPaused ? () => void startProcessing() : handleStopProcessing}
                  disabled={loading || busyIds.includes("queue")}
                  variant="secondary"
                  className="w-full justify-center"
                >
                  {processingPaused ? "Resume queue" : "Pause queue"}
                </Button>

                {/* Quick Actions */}
                <div className="flex flex-col gap-2 pt-2">
                  <div className="flex gap-2">
                    {completedCount > 0 && (
                      <button
                        onClick={() => {
                          if (window.confirm("Remove all completed jobs and their saved results?"))
                            void clearCompleted();
                        }}
                        disabled={busyIds.length > 0}
                        className="text-muted hover:text-foreground flex-1 rounded-lg py-2 text-xs transition-colors hover:bg-gray-50"
                      >
                        Remove completed ({completedCount})
                      </button>
                    )}
                    {completedCount > 0 && (
                      <button
                        onClick={handleExportAll}
                        className="text-muted hover:text-foreground flex-1 rounded-lg py-2 text-xs transition-colors hover:bg-gray-50"
                      >
                        Export completed CSV ({completedCount})
                      </button>
                    )}
                  </div>
                  <div className="flex gap-2">
                    {failedCount > 0 && (
                      <button
                        onClick={() => {
                          void Promise.all(
                            queue.filter((j) => j.status === "failed").map((j) => retryJob(j.id)),
                          );
                        }}
                        disabled={busyIds.length > 0}
                        className="flex-1 rounded-lg py-2 text-xs text-red-500 transition-colors hover:bg-red-50 hover:text-red-700"
                      >
                        Retry all failed ({failedCount})
                      </button>
                    )}
                    {totalCount > 0 && activeCount === 0 && (
                      <button
                        onClick={() => {
                          if (
                            window.confirm("Remove every job and its saved results from the queue?")
                          )
                            void clearQueue();
                        }}
                        disabled={busyIds.length > 0}
                        className="flex-1 rounded-lg py-2 text-xs text-red-500 transition-colors hover:bg-red-50 hover:text-red-700"
                      >
                        Remove all jobs
                      </button>
                    )}
                  </div>
                </div>

                {/* Processing Status */}
                {isProcessing && (
                  <div className="mt-4 rounded-lg bg-gray-100 p-3">
                    <div className="flex items-center gap-2">
                      <div className="h-2 w-2 animate-pulse rounded-full bg-gray-700" />
                      <span className="text-xs font-medium text-gray-700">Processing active</span>
                    </div>
                    <p className="mt-1 text-[10px] text-gray-500">Add more jobs anytime</p>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Main Content */}
      <main className="min-w-0 flex-1 overflow-y-auto bg-gray-50/50 p-3 sm:p-6">
        <div className="mx-auto max-w-4xl space-y-6">
          <button
            onClick={() => {
              setSidebarCollapsed(false);
              setMobileControlsOpen(true);
            }}
            className="rounded-lg border bg-white px-3 py-2 text-sm md:hidden"
          >
            Queue controls
          </button>
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold">Batch Processing</h1>
              <p className="text-muted mt-1 text-sm">
                Jobs process automatically while this page is open. Pausing keeps new jobs waiting.
              </p>
            </div>
            {isProcessing && currentJob && (
              <div className="flex items-center gap-2 rounded-full bg-gray-100 px-3 py-1.5">
                <div className="h-2 w-2 animate-pulse rounded-full bg-gray-700" />
                <span className="text-sm font-medium text-gray-700">{currentJob.companyName}</span>
                <span className="text-xs text-gray-500">{currentJob.progress}%</span>
              </div>
            )}
          </div>

          <details className="rounded-xl border border-blue-200 bg-blue-50 p-4">
            <summary className="cursor-pointer text-sm font-bold text-blue-800">
              Use the Chrome Extension for faster batch processing
            </summary>
            <ol className="mt-3 space-y-3 text-xs text-gray-700">
              <li>
                <strong>1. Install the extension.</strong> Open <code>chrome://extensions</code>,
                enable Developer mode, choose Load unpacked and select the <code>extension/</code>{" "}
                folder.
              </li>
              <li>
                <strong>2. Connect your app.</strong> Enter this app&apos;s server URL in the
                extension. The green dot confirms the connection. Your AI key belongs in the
                app&apos;s model settings.
              </li>
              <li>
                <strong>3. Add jobs.</strong> Open a job listing, select a profile or default
                templates, check the details and choose Add to queue. Jobs process here while the
                queue is resumed.
              </li>
            </ol>
            <details className="mt-3 text-xs text-gray-600">
              <summary className="cursor-pointer font-medium text-blue-700">Tips</summary>
              <ul className="mt-2 list-disc space-y-1 pl-4">
                <li>The extension detects company and job title from the URL.</li>
                <li>Select text before opening the extension to fill the description.</li>
                <li>Copy/Paste transfers company data between tabs.</li>
                <li>A red connection dot means check the server URL and connection.</li>
                <li>Both local and deployed servers are supported.</li>
              </ul>
            </details>
          </details>

          {queueError && (
            <div
              role="alert"
              className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700"
            >
              {queueError}{" "}
              <button onClick={() => void retryConnection()} className="ml-2 underline">
                Reconnect / retry
              </button>
            </div>
          )}
          {processingPaused && (
            <p
              role="status"
              className="rounded-lg border border-orange-200 bg-orange-50 p-3 text-sm"
            >
              Queue paused.{" "}
              {isProcessing
                ? "The current job is finishing; waiting jobs stay queued."
                : "New and waiting jobs stay queued until you resume."}
            </p>
          )}
          {/* Activity Feed */}
          <ActivityFeed currentJob={currentJob || null} recentActivities={recentActivities} />

          {/* Queue List */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold">Job Queue</h2>
              <span className="text-muted text-xs">
                {totalCount} job{totalCount !== 1 ? "s" : ""}
              </span>
            </div>

            {/* Status Filter Tabs */}
            <div className="flex flex-wrap gap-1.5">
              {[
                { id: "all", label: "All", count: totalCount },
                { id: "pending", label: "Pending", count: pendingCount },
                {
                  id: "processing",
                  label: "Processing",
                  count: activeCount,
                },
                { id: "completed", label: "Done", count: completedCount },
                { id: "failed", label: "Failed", count: failedCount },
                { id: "cancelled", label: "Cancelled", count: cancelledCount },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setStatusFilter(tab.id as typeof statusFilter)}
                  className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-all ${
                    statusFilter === tab.id
                      ? "bg-gray-900 text-white"
                      : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                  }`}
                >
                  <span>{tab.label}</span>
                  <span
                    className={`rounded px-1.5 py-0.5 text-[10px] ${
                      statusFilter === tab.id ? "bg-white/20" : "bg-gray-200"
                    }`}
                  >
                    {tab.count}
                  </span>
                </button>
              ))}
            </div>

            {queue.length > 0 && (
              <input
                type="text"
                placeholder="Search jobs by company or position..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="mb-4 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-gray-400 focus:outline-none"
              />
            )}

            {loading ? (
              <p role="status">Loading queue...</p>
            ) : queue.length === 0 ? (
              <div className="rounded-xl border border-gray-200 bg-white py-12 text-center">
                <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-gray-100">
                  <svg
                    className="h-6 w-6 text-gray-400"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeWidth="1.5"
                      d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
                    />
                  </svg>
                </div>
                <h3 className="mb-1 text-sm font-medium text-gray-600">No jobs in queue</h3>
                <p className="text-muted mb-3 text-xs">Add a job to start processing</p>
                <Button onClick={() => setShowAddModal(true)} variant="primary">
                  Add Job
                </Button>
              </div>
            ) : filteredQueue.length === 0 ? (
              <p role="status" className="rounded-lg border bg-white p-6 text-sm">
                No jobs match this filter.{" "}
                <button
                  className="underline"
                  onClick={() => {
                    setStatusFilter("all");
                    setSearchQuery("");
                  }}
                >
                  Show all jobs
                </button>
              </p>
            ) : (
              <div className="grid gap-3 md:grid-cols-2">
                {filteredQueue.map((job) => (
                  <JobQueueCard
                    key={job.id}
                    job={job}
                    onRemove={() => {
                      if (
                        !isActiveJob(job) ||
                        window.confirm("Cancel processing and remove this job and its results?")
                      )
                        return removeJob(job.id);
                      return false;
                    }}
                    onRetry={() => {
                      if (
                        ["failed", "cancelled"].includes(job.status) ||
                        window.confirm("Clear previous results and process this job again?")
                      )
                        return retryJob(job.id);
                      return false;
                    }}
                    onView={() => handleViewResults(job)}
                    onEdit={
                      !isActiveJob(job)
                        ? () => {
                            void stopProcessing().then((saved) => {
                              if (saved) setEditingJob(job);
                            });
                          }
                        : undefined
                    }
                    onCancel={() => cancelJob(job.id)}
                    busy={busyIds.includes(job.id) || busyIds.includes("queue")}
                    isCurrentJob={currentJob?.id === job.id}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </main>

      {showAddModal && (
        <QueueJobModal
          onClose={() => setShowAddModal(false)}
          onSubmit={handleAddJob}
          profiles={profiles}
        />
      )}
      {editingJob && (
        <QueueJobModal
          job={queue.find((job) => job.id === editingJob.id) || editingJob}
          onClose={() => setEditingJob(null)}
          onSubmit={handleEditJob}
          profiles={profiles}
        />
      )}
    </div>
  );
}
