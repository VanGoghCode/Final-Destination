"use client";

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  ReactNode,
} from "react";

export type JobStatus =
  | "pending"
  | "researching"
  | "tailoring-resume"
  | "tailoring-cover-letter"
  | "completed"
  | "failed"
  | "cancelled";

export interface QueuedJob {
  id: string;
  companyName: string;
  companyUrl: string;
  positionTitle: string;
  jobDescription: string;
  personalDetails: string;
  includeCoverLetter: boolean;
  status: JobStatus;
  progress: number; // 0-100
  error?: string;
  // Profile info
  profileId?: string;
  profileName?: string;
  profileColor?: string;
  // Company website for research (separate from job posting URL)
  companyWebsite?: string;
  // Results
  companyResearch?: string;
  tailoredResume?: string;
  tailoredCoverLetter?: string;
  jobCountry?: string;
  jobWorkMode?: "" | "Remote" | "Hybrid" | "On-site";
  // Retry tracking
  retryCount?: number;
  // Timestamps
  addedAt: number;
  startedAt?: number;
  completedAt?: number;
}

interface JobQueueContextType {
  // Queue state
  queue: QueuedJob[];
  isProcessing: boolean;
  currentJobId: string | null;

  // Queue actions
  addJob: (
    job: Omit<QueuedJob, "id" | "status" | "progress" | "addedAt">,
  ) => string;
  addJobs: (
    jobs: Omit<QueuedJob, "id" | "status" | "progress" | "addedAt">[],
  ) => string[];
  removeJob: (id: string) => void;
  updateJob: (
    id: string,
    updates: Partial<
      Pick<
        QueuedJob,
        | "companyName"
        | "companyUrl"
        | "positionTitle"
        | "jobDescription"
        | "personalDetails"
        | "includeCoverLetter"
      >
    >,
  ) => void;
  clearQueue: () => void;
  clearCompleted: () => void;

  // Processing actions
  startProcessing: () => void;
  stopProcessing: () => void;
  cancelJob: (id: string) => void;
  retryJob: (id: string) => void;

  // Pause state (prevents auto-restart after explicit cancellation)
  processingPaused: boolean;
  setProcessingPaused: (paused: boolean) => void;

  // Job updates (internal use)
  updateJobStatus: (id: string, status: JobStatus, progress?: number) => void;
  updateJobResults: (id: string, results: Partial<QueuedJob>) => void;
  setJobError: (id: string, error: string) => void;

  // Stats
  completedCount: number;
  failedCount: number;
  pendingCount: number;
  totalCount: number;

  // Polling control
  pollingEnabled: boolean;
  setPollingEnabled: (enabled: boolean) => void;
}

const JobQueueContext = createContext<JobQueueContextType | undefined>(
  undefined,
);

// Helper to get headers with passcode
function getAuthHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (typeof window !== "undefined") {
    const passcode = localStorage.getItem("fd_passcode");
    if (passcode) {
      headers["x-passcode"] = passcode;
    }
  }
  return headers;
}

// Helper for GET/DELETE requests (no Content-Type needed)
function getPasscodeHeaders(): Record<string, string> {
  const headers: Record<string, string> = {};
  if (typeof window !== "undefined") {
    const passcode = localStorage.getItem("fd_passcode");
    if (passcode) {
      headers["x-passcode"] = passcode;
    }
  }
  return headers;
}

export function JobQueueProvider({ children }: { children: ReactNode }) {
  const [queue, setQueue] = useState<QueuedJob[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentJobId, setCurrentJobId] = useState<string | null>(null);
  const [pollingEnabled, setPollingEnabled] = useState(false);
  const [processingPaused, setProcessingPaused] = useState(false);

  // Initial fetch and polling (only when pollingEnabled)
  useEffect(() => {
    if (!pollingEnabled) return;

    const fetchQueue = () => {
      fetch("/api/queue", { headers: getPasscodeHeaders() })
        .then((res) => res.json())
        .then((data) => {
          if (Array.isArray(data)) {
            setQueue(data);
          }
        })
        .catch(console.error);
    };

    // Fetch immediately
    fetchQueue();

    // Poll every 3 seconds
    const interval = setInterval(fetchQueue, 3000);

    return () => clearInterval(interval);
  }, [pollingEnabled]);

  // Effect to auto-start processing when pending jobs exist and not processing
  // Respects processingPaused to prevent restart after explicit user cancellation
  useEffect(() => {
    // Don't auto-start if user has explicitly paused processing
    if (processingPaused) return;

    // Check if we have any pending jobs
    const hasPending = queue.some((j) => j.status === "pending");
    if (hasPending && !isProcessing && !currentJobId) {
      console.log("Auto-starting processing for valid pending jobs...");
      setIsProcessing(true);
    }
  }, [queue, isProcessing, currentJobId, processingPaused]);

  // Generate unique ID
  const generateId = () =>
    `job_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  // Add single job
  const addJob = useCallback(
    (job: Omit<QueuedJob, "id" | "status" | "progress" | "addedAt">) => {
      const id = generateId();
      const newJob: QueuedJob = {
        ...job,
        id,
        status: "pending",
        progress: 0,
        addedAt: Date.now(),
      };

      // Optimistic update
      setQueue((prev) => [...prev, newJob]);

      // Sync with server
      fetch("/api/queue", {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify(newJob),
      }).catch((err) => {
        console.error("Failed to sync addJob:", err);
        // Revert if failed? For now, just log.
      });

      return id;
    },
    [],
  );

  // Add multiple jobs
  const addJobs = useCallback(
    (jobs: Omit<QueuedJob, "id" | "status" | "progress" | "addedAt">[]) => {
      const newJobs: QueuedJob[] = jobs.map((job) => ({
        ...job,
        id: generateId(),
        status: "pending" as JobStatus,
        progress: 0,
        addedAt: Date.now(),
      }));
      setQueue((prev) => [...prev, ...newJobs]);
      return newJobs.map((j) => j.id);
    },
    [],
  );

  // Remove job
  const removeJob = useCallback((id: string) => {
    setQueue((prev) => prev.filter((j) => j.id !== id));

    fetch(`/api/queue?id=${id}`, {
      method: "DELETE",
      headers: getPasscodeHeaders(),
    }).catch(console.error);
  }, []);

  // Update job data
  const updateJob = useCallback(
    (
      id: string,
      updates: Partial<
        Pick<
          QueuedJob,
          | "companyName"
          | "companyUrl"
          | "positionTitle"
          | "jobDescription"
          | "personalDetails"
        >
      >,
    ) => {
      const fullUpdates = {
        ...updates,
        status: "pending" as JobStatus,
        progress: 0,
        error: undefined,
        startedAt: undefined,
        completedAt: undefined,
        companyResearch: undefined,
        tailoredResume: undefined,
        tailoredCoverLetter: undefined,
        jobCountry: undefined,
        jobWorkMode: undefined,
      };

      setQueue((prev) =>
        prev.map((job) => (job.id === id ? { ...job, ...fullUpdates } : job)),
      );

      fetch("/api/queue", {
        method: "PATCH",
        headers: getAuthHeaders(),
        body: JSON.stringify({ id, updates: fullUpdates }),
      }).catch(console.error);
    },
    [],
  );

  // Clear entire queue
  const clearQueue = useCallback(() => {
    setQueue([]);
    setIsProcessing(false);
    setCurrentJobId(null);
    fetch("/api/queue", {
      method: "DELETE",
      headers: getPasscodeHeaders(),
    }).catch(console.error);
  }, []);

  // Clear only completed jobs
  const clearCompleted = useCallback(() => {
    // Get completed job IDs before clearing
    setQueue((prev) => {
      const completedIds = prev
        .filter((j) => j.status === "completed")
        .map((j) => j.id);

      // Delete each completed job from server
      completedIds.forEach((id) => {
        fetch(`/api/queue?id=${id}`, {
          method: "DELETE",
          headers: getPasscodeHeaders(),
        }).catch(console.error);
      });

      return prev.filter((j) => j.status !== "completed");
    });
  }, []);

  // Update job status
  const updateJobStatus = useCallback(
    (id: string, status: JobStatus, progress?: number) => {
      const updates: Partial<QueuedJob> = { status };
      if (progress !== undefined) updates.progress = progress;
      if (status !== "pending") updates.startedAt = Date.now(); // We can't check 'startedAt' easily here without reading queue, but Date.now() is fine to overwrite
      if (status === "completed" || status === "failed")
        updates.completedAt = Date.now();

      setQueue((prev) =>
        prev.map((job) => {
          if (job.id !== id) return job;
          return {
            ...job,
            ...updates,
            startedAt: updates.startedAt || job.startedAt,
          };
        }),
      );

      fetch("/api/queue", {
        method: "PATCH",
        headers: getAuthHeaders(),
        body: JSON.stringify({ id, updates }),
      }).catch(console.error);
    },
    [],
  );

  // Update job results
  const updateJobResults = useCallback(
    (id: string, results: Partial<QueuedJob>) => {
      setQueue((prev) =>
        prev.map((job) => (job.id === id ? { ...job, ...results } : job)),
      );

      fetch("/api/queue", {
        method: "PATCH",
        headers: getAuthHeaders(),
        body: JSON.stringify({ id, updates: results }),
      }).catch(console.error);
    },
    [],
  );

  // Set job error
  const setJobError = useCallback((id: string, error: string) => {
    setQueue((prev) =>
      prev.map((job) =>
        job.id === id
          ? {
              ...job,
              status: "failed" as JobStatus,
              error,
              completedAt: Date.now(),
            }
          : job,
      ),
    );
  }, []);

  // Start processing
  const startProcessing = useCallback(() => {
    setIsProcessing(true);
  }, []);

  // Stop processing
  const stopProcessing = useCallback(() => {
    setIsProcessing(false);
    setCurrentJobId(null);
  }, []);

  // Cancel a specific job (sets to cancelled status, won't auto-restart)
  const cancelJob = useCallback((id: string) => {
    const updates = {
      status: "cancelled" as JobStatus,
      progress: 0,
      completedAt: Date.now(),
    };

    setQueue((prev) =>
      prev.map((job) => (job.id === id ? { ...job, ...updates } : job)),
    );

    fetch("/api/queue", {
      method: "PATCH",
      headers: getAuthHeaders(),
      body: JSON.stringify({ id, updates }),
    }).catch(console.error);
  }, []);

  // Retry failed job
  const retryJob = useCallback((id: string) => {
    const updates = {
      status: "pending" as JobStatus,
      progress: 0,
      error: undefined,
      startedAt: undefined,
      completedAt: undefined,
    };

    setQueue((prev) =>
      prev.map((job) => (job.id === id ? { ...job, ...updates } : job)),
    );

    fetch("/api/queue", {
      method: "PATCH",
      headers: getAuthHeaders(),
      body: JSON.stringify({ id, updates }),
    }).catch(console.error);
  }, []);

  // Computed stats
  const completedCount = queue.filter((j) => j.status === "completed").length;
  const failedCount = queue.filter((j) => j.status === "failed").length;
  const pendingCount = queue.filter((j) => j.status === "pending").length;
  const totalCount = queue.length;

  return (
    <JobQueueContext.Provider
      value={{
        queue,
        isProcessing,
        currentJobId,
        addJob,
        addJobs,
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
        totalCount,
        pollingEnabled,
        setPollingEnabled,
        processingPaused,
        setProcessingPaused,
      }}
    >
      {children}
    </JobQueueContext.Provider>
  );
}

export function useJobQueue() {
  const context = useContext(JobQueueContext);
  if (context === undefined) {
    throw new Error("useJobQueue must be used within a JobQueueProvider");
  }
  return context;
}
