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
  Template,
  Profile,
} from "@/lib/storage";
import JobForm from "@/components/JobForm";

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
      className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-6 border-b border-gray-100">
          <h2 className="text-lg font-semibold">Add Job to Queue</h2>
          <p className="text-sm text-muted mt-1">
            Job will start processing automatically
          </p>
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
              <svg
                className="w-4 h-4 mr-1"
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
  const isProcessing = [
    "researching",
    "tailoring-resume",
    "tailoring-cover-letter",
  ].includes(job.status);

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
      className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-6 border-b border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold">Edit Job</h2>
              <p className="text-sm text-muted mt-1">
                {isProcessing
                  ? "Job will restart from the beginning after saving"
                  : "Update job details and restart processing"}
              </p>
            </div>
            {isProcessing && (
              <span className="px-2 py-1 text-xs font-medium bg-yellow-100 text-yellow-700 rounded">
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
          }}
          onCancel={onClose}
          onSubmit={(data) => {
            onSave(data);
            onClose();
          }}
          isProcessing={isProcessing}
          submitLabel={
            <>
              <svg
                className="w-4 h-4 mr-1"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
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

// Live Activity Feed Component
function ActivityFeed({
  currentJob,
  recentActivities,
}: {
  currentJob: QueuedJob | null;
  recentActivities: string[];
}) {
  return (
    <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 font-mono text-xs">
      <div className="flex items-center gap-2 mb-2 pb-2 border-b border-gray-200">
        {currentJob ? (
          <div className="w-2 h-2 rounded-full bg-gray-900 animate-pulse" />
        ) : (
          <div className="w-2 h-2 rounded-full bg-gray-400" />
        )}
        <span className="text-gray-700 font-medium">Activity Log</span>
        {currentJob && (
          <span className="ml-auto text-gray-500 text-[10px]">
            {currentJob.progress}%
          </span>
        )}
      </div>
      <div className="space-y-1 max-h-24 overflow-y-auto">
        {currentJob && (
          <div className="flex gap-2 text-gray-700">
            <span className="text-gray-400">
              [{new Date().toLocaleTimeString()}]
            </span>
            <span>Processing: {currentJob.companyName}</span>
          </div>
        )}
        {recentActivities.slice(0, 5).map((activity, i) => (
          <div key={i} className="flex gap-2 text-gray-500">
            <span className="text-gray-400">
              [{new Date(Date.now() - i * 5000).toLocaleTimeString()}]
            </span>
            <span>{activity}</span>
          </div>
        ))}
        {!currentJob && recentActivities.length === 0 && (
          <div className="text-gray-400">Waiting for jobs...</div>
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
    retryJob,
    updateJobStatus,
    updateJobResults,
    setJobError,
    completedCount,
    failedCount,
    pendingCount,
    totalCount,
  } = useJobQueue();

  const { personalDetails: globalPersonalDetails } = useAppContext();

  const [showAddModal, setShowAddModal] = useState(false);
  const [editingJob, setEditingJob] = useState<QueuedJob | null>(null);
  const [recentActivities, setRecentActivities] = useState<string[]>([]);
  const [resumeTemplate, setResumeTemplate] = useState<Template | null>(null);
  const [coverLetterTemplate, setCoverLetterTemplate] =
    useState<Template | null>(null);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [statusFilter, setStatusFilter] = useState<
    "all" | "pending" | "processing" | "completed" | "failed"
  >("all");

  const processingRef = useRef(false);
  const abortControllerRef = useRef<AbortController | null>(null);
  const queueRef = useRef<QueuedJob[]>([]);

  // Keep queueRef in sync
  useEffect(() => {
    queueRef.current = queue;
  }, [queue]);

  // Load templates and profiles on mount
  useEffect(() => {
    const defaultResume = getDefaultResumeTemplate();
    const defaultCoverLetter = getDefaultCoverLetterTemplate();
    if (defaultResume) setResumeTemplate(defaultResume);
    if (defaultCoverLetter) setCoverLetterTemplate(defaultCoverLetter);

    // Get profiles and sync to server
    const localProfiles = getProfiles();
    setProfiles(localProfiles);

    // Sync to server so extension can see them
    if (localProfiles.length > 0) {
      fetch("/api/profiles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(localProfiles),
      }).catch((err) => console.error("Failed to sync profiles:", err));
    }
  }, []);

  // Add activity log
  const addActivity = useCallback((message: string) => {
    setRecentActivities((prev) => [message, ...prev.slice(0, 19)]);
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
            const allResumeTemplates = getResumeTemplates();
            const profileResume = allResumeTemplates.find(
              (t) => t.id === profile.defaultResumeId,
            );
            if (profileResume) {
              jobResumeTemplate = profileResume;
              addActivity(`📋 Using profile "${profile.name}" resume template`);
            }
          }
          if (profile.defaultCoverLetterId) {
            const allCoverLetterTemplates = getCoverLetterTemplates();
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

      try {
        // Step 1: Research company
        updateJobStatus(job.id, "researching", 10);
        addActivity(`🔍 Researching ${job.companyName}...`);

        const researchResponse = await fetch("/api/research", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            companyName: job.companyName,
            companyUrl: job.companyUrl,
            positionTitle: job.positionTitle,
            jobDescription: job.jobDescription,
          }),
          signal,
        });

        if (!researchResponse.ok) {
          const data = await researchResponse.json();
          throw new Error(data.error || "Research failed");
        }

        const researchData = await researchResponse.json();
        updateJobResults(job.id, { companyResearch: researchData.research });
        updateJobStatus(job.id, "researching", 30);
        addActivity(`✓ Research complete for ${job.companyName}`);

        // Step 2: Tailor resume
        updateJobStatus(job.id, "tailoring-resume", 40);
        addActivity(`📝 Tailoring resume for ${job.positionTitle}...`);

        const tailorResponse = await fetch("/api/tailor", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            resumeLatex: jobResumeTemplate.content,
            jobDescription: job.jobDescription,
            personalDetails: job.personalDetails || globalPersonalDetails,
            companyInfo: researchData.research,
            companyName: job.companyName,
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
          jobCountry: tailorData.jobCountry,
          jobWorkMode: tailorData.jobWorkMode,
        });
        updateJobStatus(job.id, "tailoring-resume", 60);
        addActivity(`✓ Resume tailored for ${job.companyName}`);

        // Step 3: Tailor cover letter
        if (jobCoverLetterTemplate) {
          updateJobStatus(job.id, "tailoring-cover-letter", 70);
          addActivity(`✉️ Generating cover letter for ${job.positionTitle}...`);

          const coverLetterResponse = await fetch("/api/tailor-cover-letter", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              coverLetterLatex: jobCoverLetterTemplate.content,
              jobDescription: job.jobDescription,
              personalDetails: job.personalDetails || globalPersonalDetails,
              companyInfo: researchData.research,
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
          addActivity(`✓ Cover letter generated for ${job.companyName}`);
        }

        // Mark completed
        updateJobStatus(job.id, "completed", 100);
        addActivity(`🎉 Completed: ${job.companyName} - ${job.positionTitle}`);
      } catch (error) {
        if ((error as Error).name === "AbortError") {
          addActivity(`⏸️ Cancelled: ${job.companyName}`);
          updateJobStatus(job.id, "pending", 0);
        } else {
          const message =
            error instanceof Error ? error.message : "Unknown error";
          setJobError(job.id, message);
          addActivity(`❌ Failed: ${job.companyName} - ${message}`);
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
            // Stop processing after being idle
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
  }, [isProcessing, processJob, stopProcessing]);

  // Handle stop processing
  const handleStopProcessing = () => {
    abortControllerRef.current?.abort();
    stopProcessing();
    processingRef.current = false;
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
  }) => {
    addJob(jobData);
    addActivity(`➕ Added: ${jobData.companyName} - ${jobData.positionTitle}`);

    // Auto-start processing if not already running
    // Use setTimeout to ensure state is updated before starting
    setTimeout(() => {
      if (!processingRef.current && resumeTemplate) {
        startProcessing();
        addActivity(`▶️ Auto-started processing queue`);
      }
    }, 100);
  };

  // Handle view results - open in new tab
  const handleViewResults = (job: QueuedJob) => {
    // Get profile firstName and lastName if available
    let profileFirstName = "";
    let profileLastName = "";
    if (job.profileId) {
      const profile = profiles.find((p) => p.id === job.profileId);
      if (profile) {
        profileFirstName = profile.firstName;
        profileLastName = profile.lastName;
      }
    }

    // Save job data to sessionStorage for the new tab to read
    const jobKey = `batch_job_${job.id}`;
    sessionStorage.setItem(
      jobKey,
      JSON.stringify({
        tailoredResume: job.tailoredResume,
        tailoredCoverLetter: job.tailoredCoverLetter,
        companyName: job.companyName,
        companyUrl: job.companyUrl,
        positionTitle: job.positionTitle,
        jobDescription: job.jobDescription,
        companyResearch: job.companyResearch,
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
      addActivity(
        `✏️ Edited: ${updates.companyName} - ${updates.positionTitle} (restarting)`,
      );

      // If processing is not active, start it
      setTimeout(() => {
        if (!processingRef.current && resumeTemplate) {
          startProcessing();
        }
      }, 100);
    }
  };

  const currentJob = queue.find((j) =>
    ["researching", "tailoring-resume", "tailoring-cover-letter"].includes(
      j.status,
    ),
  );

  // Filter jobs by status
  const getProcessingCount = () =>
    queue.filter((j) =>
      ["researching", "tailoring-resume", "tailoring-cover-letter"].includes(
        j.status,
      ),
    ).length;

  const filteredQueue = () => {
    switch (statusFilter) {
      case "pending":
        return queue.filter((j) => j.status === "pending");
      case "processing":
        return queue.filter((j) =>
          [
            "researching",
            "tailoring-resume",
            "tailoring-cover-letter",
          ].includes(j.status),
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
    <div className="h-screen flex overflow-hidden">
      {/* Smart Sidebar */}
      <div
        className={`shrink-0 h-screen transition-all duration-300 ${sidebarCollapsed ? "w-16" : "w-80"}`}
      >
        <div className="h-full bg-white border-r border-gray-200 flex flex-col">
          {/* Header */}
          <div className="h-14 flex items-center justify-between px-3 border-b border-gray-100">
            <div
              className={`flex items-center gap-2 ${sidebarCollapsed ? "hidden" : ""}`}
            >
              <div className="w-8 h-8 rounded-lg bg-gray-900 flex items-center justify-center">
                <svg
                  className="w-4 h-4 text-white"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <rect
                    x="3"
                    y="3"
                    width="7"
                    height="7"
                    rx="1"
                    strokeWidth="2"
                  />
                  <rect
                    x="14"
                    y="3"
                    width="7"
                    height="7"
                    rx="1"
                    strokeWidth="2"
                  />
                  <rect
                    x="3"
                    y="14"
                    width="7"
                    height="7"
                    rx="1"
                    strokeWidth="2"
                  />
                  <rect
                    x="14"
                    y="14"
                    width="7"
                    height="7"
                    rx="1"
                    strokeWidth="2"
                  />
                </svg>
              </div>
              <div>
                <span className="font-bold text-sm">Batch Mode</span>
                <p className="text-[10px] text-muted">Auto-processing</p>
              </div>
            </div>
            <button
              onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
              className="w-7 h-7 flex items-center justify-center bg-white border border-gray-200 rounded-md shadow-sm hover:bg-gray-50"
            >
              <svg
                className={`w-4 h-4 text-gray-600 transition-transform ${sidebarCollapsed ? "rotate-180" : ""}`}
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
            <div className="flex-1 flex flex-col items-center py-4 gap-3">
              <button
                onClick={() => router.push("/")}
                className="w-10 h-10 flex items-center justify-center rounded-lg hover:bg-gray-100 text-muted"
                title="Back to Single Mode"
              >
                <svg
                  className="w-5 h-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                </svg>
              </button>
              <button
                onClick={() => {
                  setSidebarCollapsed(false);
                  setShowAddModal(true);
                }}
                className="w-10 h-10 flex items-center justify-center rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200"
                title="Add Job"
              >
                <svg
                  className="w-5 h-5"
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
              </button>
              <div className="flex-1" />
              {/* Mini Stats */}
              <div className="space-y-2">
                <div
                  className="w-10 h-10 flex items-center justify-center rounded-lg bg-gray-100 text-xs font-bold"
                  title={`${pendingCount} pending`}
                >
                  {pendingCount}
                </div>
                <div
                  className="w-10 h-10 flex items-center justify-center rounded-lg bg-green-100 text-green-700 text-xs font-bold"
                  title={`${completedCount} completed`}
                >
                  {completedCount}
                </div>
              </div>
            </div>
          ) : (
            <>
              {/* Navigation */}
              <div className="p-3 border-b border-gray-100">
                <button
                  onClick={() => router.push("/")}
                  className="w-full flex items-center gap-2 py-2 px-3 rounded-lg hover:bg-surface-hover text-muted hover:text-foreground text-sm transition-colors"
                >
                  <svg
                    className="w-4 h-4"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                  </svg>
                  Single Mode
                </button>
              </div>

              {/* Queue Stats */}
              <div className="p-4 border-b border-gray-100">
                <QueueProgress
                  total={totalCount}
                  completed={completedCount}
                  failed={failedCount}
                  pending={pendingCount}
                  isProcessing={isProcessing}
                />
              </div>

              {/* Templates Status - Compact */}
              <div className="px-4 py-3 border-b border-gray-100">
                <div className="flex items-center gap-2 text-xs">
                  <div
                    className={`w-2 h-2 rounded-full ${resumeTemplate ? "bg-green-500" : "bg-red-500"}`}
                  />
                  <span className="text-muted">Resume:</span>
                  <span className="font-medium truncate">
                    {resumeTemplate?.name || "Not set"}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-xs mt-1">
                  <div
                    className={`w-2 h-2 rounded-full ${coverLetterTemplate ? "bg-green-500" : "bg-yellow-500"}`}
                  />
                  <span className="text-muted">Cover:</span>
                  <span className="font-medium truncate">
                    {coverLetterTemplate?.name || "Optional"}
                  </span>
                </div>
                {!resumeTemplate && (
                  <button
                    onClick={() => router.push("/")}
                    className="text-xs text-primary hover:underline mt-2"
                  >
                    Set up templates first →
                  </button>
                )}
              </div>

              {/* Actions */}
              <div className="p-4 space-y-2 flex-1">
                <Button
                  onClick={() => setShowAddModal(true)}
                  variant="primary"
                  className="w-full justify-center"
                >
                  <svg
                    className="w-4 h-4 mr-2"
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
                    className="w-full justify-center bg-red-50 hover:bg-red-100 text-red-600 border-red-200"
                  >
                    <svg
                      className="w-4 h-4 mr-2 animate-pulse"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeWidth="2"
                        d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                      <path
                        strokeWidth="2"
                        d="M9 10a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z"
                      />
                    </svg>
                    Stop Processing
                  </Button>
                ) : pendingCount > 0 && resumeTemplate ? (
                  <Button
                    onClick={startProcessing}
                    variant="secondary"
                    className="w-full justify-center"
                  >
                    <svg
                      className="w-4 h-4 mr-2"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeWidth="2"
                        d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"
                      />
                      <path
                        strokeWidth="2"
                        d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                    Resume ({pendingCount})
                  </Button>
                ) : null}

                {/* Quick Actions */}
                <div className="flex gap-2 pt-2">
                  {completedCount > 0 && (
                    <button
                      onClick={clearCompleted}
                      className="flex-1 text-xs text-muted hover:text-foreground py-2 transition-colors hover:bg-gray-50 rounded-lg"
                    >
                      Clear done ({completedCount})
                    </button>
                  )}
                  {totalCount > 0 && !isProcessing && (
                    <button
                      onClick={clearQueue}
                      className="flex-1 text-xs text-red-500 hover:text-red-700 py-2 transition-colors hover:bg-red-50 rounded-lg"
                    >
                      Clear all
                    </button>
                  )}
                </div>

                {/* Processing Status */}
                {isProcessing && (
                  <div className="mt-4 p-3 bg-gray-100 rounded-lg">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-gray-700 animate-pulse" />
                      <span className="text-xs font-medium text-gray-700">
                        Processing active
                      </span>
                    </div>
                    <p className="text-[10px] text-gray-500 mt-1">
                      Add more jobs anytime
                    </p>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto p-6 bg-gray-50/50">
        <div className="max-w-4xl mx-auto space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold">Batch Processing</h1>
              <p className="text-sm text-muted mt-1">
                Add jobs anytime - they process automatically
              </p>
            </div>
            {isProcessing && currentJob && (
              <div className="flex items-center gap-2 px-3 py-1.5 bg-gray-100 rounded-full">
                <div className="w-2 h-2 rounded-full bg-gray-700 animate-pulse" />
                <span className="text-sm font-medium text-gray-700">
                  {currentJob.companyName}
                </span>
                <span className="text-xs text-gray-500">
                  {currentJob.progress}%
                </span>
              </div>
            )}
          </div>

          {/* Activity Feed */}
          <ActivityFeed
            currentJob={currentJob || null}
            recentActivities={recentActivities}
          />

          {/* Queue List */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold">Job Queue</h2>
              <span className="text-xs text-muted">
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
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                    statusFilter === tab.id
                      ? "bg-gray-900 text-white"
                      : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                  }`}
                >
                  <span>{tab.label}</span>
                  <span
                    className={`px-1.5 py-0.5 rounded text-[10px] ${
                      statusFilter === tab.id ? "bg-white/20" : "bg-gray-200"
                    }`}
                  >
                    {tab.count}
                  </span>
                </button>
              ))}
            </div>

            {queue.length === 0 ? (
              <div className="text-center py-12 bg-white rounded-xl border border-gray-200">
                <div className="w-12 h-12 mx-auto mb-3 rounded-xl bg-gray-100 flex items-center justify-center">
                  <svg
                    className="w-6 h-6 text-gray-400"
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
                <h3 className="text-sm font-medium text-gray-600 mb-1">
                  No jobs in queue
                </h3>
                <p className="text-xs text-muted mb-3">
                  Add a job to start processing
                </p>
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
