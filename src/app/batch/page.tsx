"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { useJobQueue, QueuedJob } from "@/context/JobQueueContext";
import { useAppContext } from "@/context/AppContext";
import Button from "@/components/Button";
import JobQueueCard from "@/components/JobQueueCard";
import QueueProgress from "@/components/QueueProgress";
import {
  getDefaultResumeTemplate,
  getDefaultCoverLetterTemplate,
  getResumeTemplates,
  getCoverLetterTemplates,
  getProfiles,
  getMasterContext,
  Template,
  Profile,
} from "@/lib/storage";
import JobForm from "@/components/JobForm";

interface Activity {
  id: string;
  message: string;
  timestamp: number;
}

// Add Job Modal Component with Profile Selection
function AddJobModal({
  isOpen,
  onClose,
  onAdd,
  profiles,
}: {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (job: {
    companyName: string;
    companyUrl: string;
    positionTitle: string;
    jobDescription: string;
    personalDetails: string;
    profileId?: string;
    profileName?: string;
    profileColor?: string;
  }) => void;
  profiles: Profile[];
}) {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="border-b border-gray-100 p-6">
          <h2 className="text-lg font-semibold">Add Job to Queue</h2>
          <p className="text-muted mt-1 text-sm">Job will start processing automatically</p>
        </div>
        <JobForm
          profiles={profiles}
          onCancel={onClose}
          onSubmit={(data) => {
            onAdd(data);
            onClose();
          }}
          submitLabel={
            <>
              <svg className="mr-1 h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 4v16m8-8H4"
                />
              </svg>
              Add & Start
            </>
          }
        />
      </div>
    </div>
  );
}

// Edit Job Modal Component
function EditJobModal({
  job,
  onClose,
  onSave,
  profiles,
}: {
  job: QueuedJob;
  onClose: () => void;
  onSave: (updates: {
    companyName: string;
    companyUrl: string;
    positionTitle: string;
    jobDescription: string;
    personalDetails: string;
    profileId?: string;
    profileName?: string;
    profileColor?: string;
  }) => void;
  profiles: Profile[];
}) {
  const isProcessing = ["researching", "tailoring-resume", "tailoring-cover-letter"].includes(
    job.status,
  );

  useEffect(() => {
    if (isProcessing) {
      onClose();
    }
  }, [isProcessing, onClose]);

  if (isProcessing) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="border-b border-gray-100 p-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold">Edit Job</h2>
              <p className="text-muted mt-1 text-sm">
                {isProcessing
                  ? "Job will restart from the beginning after saving"
                  : "Update job details and restart processing"}
              </p>
            </div>
            {isProcessing && (
              <span className="rounded bg-yellow-100 px-2 py-1 text-xs font-medium text-yellow-700">
                Currently Processing
              </span>
            )}
          </div>
        </div>
        <JobForm
          profiles={profiles}
          initialValues={{
            companyName: job.companyName,
            companyUrl: job.companyUrl,
            positionTitle: job.positionTitle,
            jobDescription: job.jobDescription,
            personalDetails: job.personalDetails,
            profileId: job.profileId || "",
            includeCoverLetter: job.includeCoverLetter || false,
          }}
          onCancel={onClose}
          onSubmit={(data) => {
            onSave(data);
            onClose();
          }}
          isProcessing={isProcessing}
          submitLabel={
            <>
              <svg className="mr-1 h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M5 13l4 4L19 7"
                />
              </svg>
              Save Changes
            </>
          }
        />
      </div>
    </div>
  );
}

// Helper to get activity color based on type
function getActivityColor(activity: string): { border: string; text: string } {
  if (activity.startsWith("[Research]"))
    return { border: "border-l-blue-500", text: "text-blue-700" };
  if (activity.startsWith("[Tailor]") || activity.startsWith("[Resume]"))
    return { border: "border-l-purple-500", text: "text-purple-700" };
  if (activity.startsWith("[Cover]"))
    return { border: "border-l-indigo-500", text: "text-indigo-700" };
  if (activity.startsWith("[Complete]") || activity.startsWith("[Done]"))
    return { border: "border-l-green-500", text: "text-green-700" };
  if (activity.startsWith("[Error]") || activity.startsWith("[Failed]"))
    return { border: "border-l-red-500", text: "text-red-600" };
  if (activity.startsWith("[Paused]") || activity.startsWith("[Cancelled]"))
    return { border: "border-l-orange-500", text: "text-orange-600" };
  if (activity.startsWith("[Added]")) return { border: "border-l-gray-400", text: "text-gray-600" };
  if (activity.startsWith("[Started]") || activity.startsWith("[Profile]"))
    return { border: "border-l-gray-500", text: "text-gray-600" };
  return { border: "border-l-gray-300", text: "text-gray-500" };
}

// Live Activity Feed Component
function ActivityFeed({
  currentJob,
  recentActivities,
  currentJobStartTime,
}: {
  currentJob: QueuedJob | null;
  recentActivities: Activity[];
  currentJobStartTime: number | null;
}) {
  return (
    <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 font-mono text-xs">
      <div className="mb-2 flex items-center gap-2 border-b border-gray-200 pb-2">
        {currentJob ? (
          <div className="h-2 w-2 animate-pulse rounded-full bg-gray-900" />
        ) : (
          <div className="h-2 w-2 rounded-full bg-gray-400" />
        )}
        <span className="font-medium text-gray-700">Activity Log</span>
        {currentJob && (
          <span className="ml-auto text-[10px] text-gray-500">{currentJob.progress}%</span>
        )}
      </div>
      <div className="max-h-32 space-y-1 overflow-y-auto">
        {currentJob && (
          <div className="flex gap-2 border-l-2 border-l-purple-500 bg-purple-50/50 py-0.5 pl-2 text-gray-700">
            <span className="text-gray-400">
              [
              {currentJobStartTime
                ? new Date(currentJobStartTime).toLocaleTimeString()
                : "--:--:--"}
              ]
            </span>
            <span className="text-purple-700">Processing: {currentJob.companyName}</span>
          </div>
        )}
        {recentActivities.map((activity) => {
          const colors = getActivityColor(activity.message);
          return (
            <div key={activity.id} className={`flex gap-2 border-l-2 pl-2 ${colors.border} py-0.5`}>
              <span className="shrink-0 text-gray-400">
                [{new Date(activity.timestamp).toLocaleTimeString()}]
              </span>
              <span className={colors.text}>{activity.message}</span>
            </div>
          );
        })}
        {!currentJob && recentActivities.length === 0 && (
          <div className="text-gray-400 italic">Waiting for jobs...</div>
        )}
      </div>
    </div>
  );
}

export default function BatchProcessPage() {
  const router = useRouter();
  const {
    queue,
    isProcessing,
    addJob,
    removeJob,
    updateJob,
    clearQueue,
    clearCompleted,
    startProcessing,
    stopProcessing,
    cancelJob,
    retryJob,
    updateJobStatus,
    updateJobResults,
    setJobError,
    completedCount,
    failedCount,
    pendingCount,
    cancelledCount,
    totalCount,
    setPollingEnabled,
    setProcessingPaused,
  } = useJobQueue();

  const { personalDetails: globalPersonalDetails } = useAppContext();

  const [showAddModal, setShowAddModal] = useState(false);
  const [editingJob, setEditingJob] = useState<QueuedJob | null>(null);
  const [recentActivities, setRecentActivities] = useState<Activity[]>([]);
  const [currentJobStartTime, setCurrentJobStartTime] = useState<number | null>(null);
  const [resumeTemplate, setResumeTemplate] = useState<Template | null>(null);
  const [coverLetterTemplate, setCoverLetterTemplate] = useState<Template | null>(null);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [extensionOpen, setExtensionOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState<
    "all" | "pending" | "processing" | "completed" | "failed"
  >("all");

  const processingRef = useRef(false);
  const abortControllerRef = useRef<AbortController | null>(null);
  const queueRef = useRef<QueuedJob[]>([]);
  const intentionalCancelRef = useRef(false);

  // Keep queueRef in sync
  useEffect(() => {
    queueRef.current = queue;
  }, [queue]);

  // Enable queue polling only on this page
  useEffect(() => {
    setPollingEnabled(true);
    return () => setPollingEnabled(false);
  }, [setPollingEnabled]);

  // Load templates and profiles on mount
  useEffect(() => {
    const loadData = async () => {
      const defaultResume = await getDefaultResumeTemplate();
      const defaultCoverLetter = await getDefaultCoverLetterTemplate();
      if (defaultResume) setResumeTemplate(defaultResume);
      if (defaultCoverLetter) setCoverLetterTemplate(defaultCoverLetter);

      // Get profiles and sync to server
      const localProfiles = await getProfiles();
      setProfiles(localProfiles);

      // Sync profiles to server so extension can access them
      if (localProfiles.length > 0) {
        fetch("/api/profiles", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(localProfiles),
        }).catch((err) => console.error("Failed to sync profiles:", err));
      }
    };
    loadData();
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

  // Process a single job
  const processJob = useCallback(
    async (job: QueuedJob, signal: AbortSignal) => {
      // Resolve the correct template based on job's profile
      let jobResumeTemplate: Template | null = resumeTemplate;
      let jobCoverLetterTemplate: Template | null = coverLetterTemplate;

      if (job.profileId) {
        const profile = profiles.find((p) => p.id === job.profileId);
        if (profile) {
          // Use profile-specific templates if available
          if (profile.defaultResumeId) {
            const allResumeTemplates = await getResumeTemplates();
            const profileResume = allResumeTemplates.find((t) => t.id === profile.defaultResumeId);
            if (profileResume) {
              jobResumeTemplate = profileResume;
              addActivity(`[Profile] Using "${profile.name}" resume template`);
            }
          }
          if (profile.defaultCoverLetterId) {
            const allCoverLetterTemplates = await getCoverLetterTemplates();
            const profileCoverLetter = allCoverLetterTemplates.find(
              (t) => t.id === profile.defaultCoverLetterId,
            );
            if (profileCoverLetter) {
              jobCoverLetterTemplate = profileCoverLetter;
            }
          }
        }
      }

      if (!jobResumeTemplate) {
        setJobError(job.id, "No resume template found for this job's profile");
        return;
      }

      // Load master context for this job's profile
      let jobMasterContext = "";
      if (job.profileId) {
        try {
          const profileContext = await getMasterContext(job.profileId);
          if (profileContext) {
            jobMasterContext = profileContext;
            addActivity(`[Context] Loaded master context for profile`);
          }
        } catch {
          // Non-critical — proceed without master context if fetch fails
        }
      }
      // Fallback: legacy localStorage key (no profile) — matches single-job page behavior
      if (!jobMasterContext) {
        try {
          const saved = localStorage.getItem("fd_master_context");
          if (saved) {
            jobMasterContext = saved;
            addActivity(`[Context] Loaded master context from legacy storage`);
          }
        } catch {
          // Non-critical
        }
      }

      try {
        // Step 0: Research phase
        updateJobStatus(job.id, "researching", 5);
        addActivity(`[Research] Analyzing job for ${job.companyName}...`);

        // Step 1: Tailor resume
        updateJobStatus(job.id, "tailoring-resume", 30);
        addActivity(`[Tailor] Tailoring resume for ${job.positionTitle}...`);

        const tailorResponse = await fetch("/api/tailor", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            resumeLatex: jobResumeTemplate.content,
            jobDescription: job.jobDescription,
            personalDetails: job.personalDetails || globalPersonalDetails,
            masterContext: jobMasterContext,
            companyName: job.companyName,
            companyWebsite: job.companyWebsite,
          }),
          signal,
        });

        if (!tailorResponse.ok) {
          const data = await tailorResponse.json();
          throw new Error(data.error || "Resume tailoring failed");
        }

        const tailorData = await tailorResponse.json();
        updateJobResults(job.id, {
          tailoredResume: tailorData.tailoredResume,
          resumeLatex: jobResumeTemplate.content,
          coverLetterLatex: jobCoverLetterTemplate?.content,
          jobCountry: tailorData.jobCountry,
          jobWorkMode: tailorData.jobWorkMode,
        });
        updateJobStatus(job.id, "tailoring-resume", 60);
        addActivity(`[Done] Resume tailored for ${job.companyName}`);

        // Step 2: Tailor cover letter
        if (job.includeCoverLetter && jobCoverLetterTemplate) {
          updateJobStatus(job.id, "tailoring-cover-letter", 70);
          addActivity(`[Cover] Generating cover letter for ${job.positionTitle}...`);

          const coverLetterResponse = await fetch("/api/tailor-cover-letter", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              coverLetterLatex: jobCoverLetterTemplate.content,
              jobDescription: job.jobDescription,
              personalDetails: job.personalDetails || globalPersonalDetails,
              masterContext: jobMasterContext,
              companyName: job.companyName,
            }),
            signal,
          });

          if (!coverLetterResponse.ok) {
            const data = await coverLetterResponse.json();
            throw new Error(data.error || "Cover letter generation failed");
          }

          const coverLetterData = await coverLetterResponse.json();
          updateJobResults(job.id, {
            tailoredCoverLetter: coverLetterData.tailoredCoverLetter,
          });
          addActivity(`[Done] Cover letter generated for ${job.companyName}`);
        } else if (jobCoverLetterTemplate) {
          addActivity(`[Skip] Cover letter skipped for ${job.companyName} (default)`);
        }

        // Mark completed
        updateJobStatus(job.id, "completed", 100);
        addActivity(`[Complete] ${job.companyName} - ${job.positionTitle}`);
      } catch (error) {
        if ((error as Error).name === "AbortError") {
          if (intentionalCancelRef.current) {
            // Cancel was intentional — cancelJob already set status to cancelled
            addActivity(`[Cancelled] Stopped: ${job.companyName}`);
          } else {
            // Unintentional abort (page nav, effect re-run) — revert to pending
            addActivity(`[Paused] Interrupted: ${job.companyName}`);
            updateJobStatus(job.id, "pending", 0);
          }
        } else {
          const message = error instanceof Error ? error.message : "Unknown error";
          setJobError(job.id, message);
          addActivity(`[Error] Failed: ${job.companyName} - ${message}`);
        }
      }
    },
    [
      resumeTemplate,
      coverLetterTemplate,
      profiles,
      globalPersonalDetails,
      updateJobStatus,
      updateJobResults,
      setJobError,
      addActivity,
    ],
  );

  // Main processing loop - continuous auto processing
  useEffect(() => {
    if (!isProcessing || processingRef.current) return;

    // Don't start processing until templates are loaded
    if (!resumeTemplate) {
      addActivity("[Error] Resume template not loaded yet. Waiting...");
      return;
    }

    const processQueue = async () => {
      processingRef.current = true;
      abortControllerRef.current = new AbortController();

      let idleCount = 0;
      const maxIdleCount = 30; // Stop after 30 seconds of no pending jobs

      while (!abortControllerRef.current?.signal.aborted) {
        // Use ref to get current queue state
        const currentQueue = queueRef.current;
        const pendingJobs = currentQueue.filter((j) => j.status === "pending");

        if (pendingJobs.length === 0) {
          idleCount++;
          if (idleCount >= maxIdleCount) {
            // Loop finished naturally — re-enable auto-processing for new jobs
            setProcessingPaused(false);
            stopProcessing();
            break;
          }
          await new Promise((resolve) => setTimeout(resolve, 1000));
          continue;
        }

        // Reset idle counter when we find a job
        idleCount = 0;
        const job = pendingJobs[0];
        if (!job) continue;

        await processJob(job, abortControllerRef.current.signal);
        // Delay between jobs to avoid rate limits
        await new Promise((resolve) => setTimeout(resolve, 2000));
      }

      processingRef.current = false;
    };

    processQueue();

    return () => {
      abortControllerRef.current?.abort();
      processingRef.current = false;
    };
  }, [isProcessing, processJob, stopProcessing, resumeTemplate, addActivity, setProcessingPaused]);

  // Handle stop processing
  const handleStopProcessing = () => {
    // Mark as intentional cancel so processJob abort handler doesn't revert to pending
    intentionalCancelRef.current = true;

    // Set processing paused flag to prevent auto-restart
    setProcessingPaused(true);

    // Abort the current fetch request first
    abortControllerRef.current?.abort();

    // Then cancel all processing jobs to 'cancelled' status
    // (intentionalCancelRef prevents the abort handler from reverting to pending)
    const processingJobs = queue.filter(
      (j) =>
        j.status === "researching" ||
        j.status === "tailoring-resume" ||
        j.status === "tailoring-cover-letter",
    );
    processingJobs.forEach((job) => {
      cancelJob(job.id);
    });

    stopProcessing();
    processingRef.current = false;
    addActivity(`[Cancelled] Processing stopped by user`);
  };

  // Handle add job - auto starts processing
  const handleAddJob = (jobData: {
    companyName: string;
    companyUrl: string;
    positionTitle: string;
    jobDescription: string;
    personalDetails: string;
    profileId?: string;
    profileName?: string;
    profileColor?: string;
    includeCoverLetter?: boolean;
  }) => {
    // Clear paused state when adding new jobs
    setProcessingPaused(false);

    addJob({
      ...jobData,
      includeCoverLetter: jobData.includeCoverLetter || false,
    });
    addActivity(`[Added] ${jobData.companyName} - ${jobData.positionTitle}`);

    // Auto-start processing if not already running
    // Use setTimeout to ensure state is updated before starting
    setTimeout(() => {
      if (!processingRef.current && resumeTemplate) {
        startProcessing();
        addActivity(`[Started] Auto-started processing queue`);
      }
    }, 100);
  };

  // Handle view results - open in new tab
  const handleViewResults = async (job: QueuedJob) => {
    // Get profile firstName and lastName if available
    let profileFirstName = "";
    let profileLastName = "";
    let jobMasterContext = "";
    if (job.profileId) {
      const profile = profiles.find((p) => p.id === job.profileId);
      if (profile) {
        profileFirstName = profile.firstName;
        profileLastName = profile.lastName;
      }
      try {
        const ctx = await getMasterContext(job.profileId);
        if (ctx) jobMasterContext = ctx;
      } catch {
        // Non-critical
      }
    }
    // Fallback: legacy localStorage key
    if (!jobMasterContext) {
      try {
        const saved = localStorage.getItem("fd_master_context");
        if (saved) jobMasterContext = saved;
      } catch {
        // Non-critical
      }
    }

    // Save job data to sessionStorage for the new tab to read
    const jobKey = `batch_job_${job.id}`;
    sessionStorage.setItem(
      jobKey,
      JSON.stringify({
        tailoredResume: job.tailoredResume,
        tailoredCoverLetter: job.tailoredCoverLetter,
        resumeLatex: job.resumeLatex,
        coverLetterLatex: job.coverLetterLatex,
        companyName: job.companyName,
        companyUrl: job.companyUrl,
        positionTitle: job.positionTitle,
        jobDescription: job.jobDescription,
        masterContext: jobMasterContext,
        jobCountry: job.jobCountry,
        jobWorkMode: job.jobWorkMode,
        profileFirstName,
        profileLastName,
      }),
    );

    // Open new tab with company name in URL
    const companySlug = job.companyName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "");
    window.open(`/tailored/${companySlug}?jobId=${job.id}`, "_blank");
  };

  // Handle edit job - updates job and restarts from beginning
  const handleEditJob = (updates: {
    companyName: string;
    companyUrl: string;
    positionTitle: string;
    jobDescription: string;
    personalDetails: string;
    profileId?: string;
    profileName?: string;
    profileColor?: string;
  }) => {
    if (editingJob) {
      updateJob(editingJob.id, updates);
      addActivity(`✏️ Edited: ${updates.companyName} - ${updates.positionTitle} (restarting)`);

      // If processing is not active, start it
      setTimeout(() => {
        if (!processingRef.current && resumeTemplate) {
          startProcessing();
        }
      }, 100);
    }
  };

  const currentJob = queue.find((j) =>
    ["researching", "tailoring-resume", "tailoring-cover-letter"].includes(j.status),
  );

  // Track current job start time — reset on job change
  const currentJobId = currentJob?.id;
  useEffect(() => {
    setCurrentJobStartTime(currentJob ? Date.now() : null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentJobId]);

  // Filter jobs by status
  const getProcessingCount = () =>
    queue.filter((j) =>
      ["researching", "tailoring-resume", "tailoring-cover-letter"].includes(j.status),
    ).length;

  const filteredQueue = () => {
    switch (statusFilter) {
      case "pending":
        return queue.filter((j) => j.status === "pending");
      case "processing":
        return queue.filter((j) =>
          ["researching", "tailoring-resume", "tailoring-cover-letter"].includes(j.status),
        );
      case "completed":
        return queue.filter((j) => j.status === "completed");
      case "failed":
        return queue.filter((j) => j.status === "failed");
      default:
        return queue;
    }
  };

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Smart Sidebar */}
      <div
        className={`h-screen shrink-0 transition-all duration-300 ${sidebarCollapsed ? "w-16" : "w-80"}`}
      >
        <div className="flex h-full flex-col border-r border-gray-200 bg-white">
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
                <p className="text-muted text-[10px]">Auto-processing</p>
              </div>
            </div>
            <button
              onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
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
                    Set up templates first →
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
                  <svg
                    className="mr-2 h-4 w-4"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M12 4v16m8-8H4"
                    />
                  </svg>
                  Add Job
                </Button>

                {isProcessing ? (
                  <Button
                    onClick={handleStopProcessing}
                    variant="secondary"
                    className="w-full justify-center border-red-200 bg-red-50 text-red-600 hover:bg-red-100"
                  >
                    <svg
                      className="mr-2 h-4 w-4 animate-pulse"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path strokeWidth="2" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      <path
                        strokeWidth="2"
                        d="M9 10a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z"
                      />
                    </svg>
                    Stop Processing
                  </Button>
                ) : pendingCount > 0 && resumeTemplate ? (
                  <Button
                    onClick={() => {
                      setProcessingPaused(false);
                      startProcessing();
                    }}
                    variant="secondary"
                    className="w-full justify-center"
                  >
                    <svg
                      className="mr-2 h-4 w-4"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeWidth="2"
                        d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"
                      />
                      <path strokeWidth="2" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    Resume ({pendingCount})
                  </Button>
                ) : null}

                {/* Quick Actions */}
                <div className="flex gap-2 pt-2">
                  {completedCount > 0 && (
                    <button
                      onClick={clearCompleted}
                      className="text-muted hover:text-foreground flex-1 rounded-lg py-2 text-xs transition-colors hover:bg-gray-50"
                    >
                      Clear done ({completedCount})
                    </button>
                  )}
                  {totalCount > 0 && !isProcessing && (
                    <button
                      onClick={clearQueue}
                      className="flex-1 rounded-lg py-2 text-xs text-red-500 transition-colors hover:bg-red-50 hover:text-red-700"
                    >
                      Clear all
                    </button>
                  )}
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
      <main className="flex-1 overflow-y-auto bg-gray-50/50 p-6">
        <div className="mx-auto max-w-4xl space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold">Batch Processing</h1>
              <p className="text-muted mt-1 text-sm">
                Add jobs anytime - they process automatically
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

          {/* Extension Guide */}
          <div className="rounded-xl border border-blue-200 bg-blue-50 p-4">
            <button
              type="button"
              onClick={() => setExtensionOpen(!extensionOpen)}
              className="flex w-full items-center gap-2 text-left"
            >
              <svg
                className={`h-3 w-3 text-blue-600 transition-transform ${extensionOpen ? "rotate-90" : ""}`}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth="3"
              >
                <polyline points="9 18 15 12 9 6" />
              </svg>
              <svg
                className="h-4 w-4 shrink-0 text-blue-600"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path>
                <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path>
              </svg>
              <h2 className="text-sm font-bold text-blue-800">
                Use the Chrome Extension for faster batch processing
              </h2>
            </button>
            {extensionOpen && (
              <div className="mt-3">
                <div className="grid gap-4 sm:grid-cols-3">
                  <div className="rounded-lg bg-white p-3">
                    <div className="mb-1 flex h-6 w-6 items-center justify-center rounded bg-blue-100 text-xs font-bold text-blue-700">
                      1
                    </div>
                    <p className="text-xs font-medium text-gray-800">Install the Extension</p>
                    <p className="text-muted mt-0.5 text-[10px]">
                      Go to{" "}
                      <code className="rounded bg-gray-100 px-1 text-[10px]">
                        chrome://extensions
                      </code>
                      , enable Developer mode, click Load unpacked, and select the{" "}
                      <code className="rounded bg-gray-100 px-1 text-[10px]">extension/</code>{" "}
                      folder
                    </p>
                  </div>
                  <div className="rounded-lg bg-white p-3">
                    <div className="mb-1 flex h-6 w-6 items-center justify-center rounded bg-blue-100 text-xs font-bold text-blue-700">
                      2
                    </div>
                    <p className="text-xs font-medium text-gray-800">Set Your Server URL</p>
                    <p className="text-muted mt-0.5 text-[10px]">
                      In the extension popup, enter your server URL. For local dev use{" "}
                      <code className="rounded bg-gray-100 px-1 text-[10px]">
                        http://localhost:3000
                      </code>
                      . For production, use your deployed URL. A green dot means connected.
                    </p>
                  </div>
                  <div className="rounded-lg bg-white p-3">
                    <div className="mb-1 flex h-6 w-6 items-center justify-center rounded bg-blue-100 text-xs font-bold text-blue-700">
                      3
                    </div>
                    <p className="text-xs font-medium text-gray-800">Scrape & Queue Jobs</p>
                    <p className="text-muted mt-0.5 text-[10px]">
                      Browse job listings on any site, click the extension icon, select a profile,
                      fill in the details, and click Add to Queue. The job auto-processes here on
                      this page.
                    </p>
                  </div>
                </div>
                <details className="mt-3">
                  <summary className="cursor-pointer text-xs font-medium text-blue-700 hover:text-blue-800">
                    Pro tips for developers
                  </summary>
                  <div className="mt-2 space-y-1 text-[10px] text-gray-600">
                    <p>• The extension auto-detects company name and job title from the page URL</p>
                    <p>
                      • Select text on the job page before opening the extension — it auto-fills the
                      description
                    </p>
                    <p>
                      • Use Copy/Paste buttons in the extension header to transfer company data
                      between tabs
                    </p>
                    <p>• The green dot shows connection status — red means check your server URL</p>
                    <p>• Extension works with both local dev and deployed instances</p>
                  </div>
                </details>
              </div>
            )}
          </div>

          {/* Activity Feed */}
          <ActivityFeed
            currentJob={currentJob || null}
            recentActivities={recentActivities}
            currentJobStartTime={currentJobStartTime}
          />

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
                  count: getProcessingCount(),
                },
                { id: "completed", label: "Done", count: completedCount },
                { id: "failed", label: "Failed", count: failedCount },
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

            {queue.length === 0 ? (
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
            ) : (
              <div className="grid gap-3 md:grid-cols-2">
                {filteredQueue().map((job) => (
                  <JobQueueCard
                    key={job.id}
                    job={job}
                    onRemove={() => removeJob(job.id)}
                    onRetry={() => retryJob(job.id)}
                    onView={() => handleViewResults(job)}
                    onEdit={() => setEditingJob(job)}
                    isCurrentJob={currentJob?.id === job.id}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Add Job Modal */}
      <AddJobModal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        onAdd={handleAddJob}
        profiles={profiles}
      />

      {/* Edit Job Modal */}
      {editingJob && (
        <EditJobModal
          job={editingJob}
          onClose={() => setEditingJob(null)}
          onSave={handleEditJob}
          profiles={profiles}
        />
      )}
    </div>
  );
}
