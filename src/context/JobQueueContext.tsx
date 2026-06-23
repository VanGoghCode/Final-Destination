"use client";

import { createContext, useContext, useState, useCallback, useEffect, ReactNode } from "react";

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
  progress: number;
  error?: string;
  profileId?: string;
  profileName?: string;
  profileColor?: string;
  companyWebsite?: string;
  companyResearch?: string;
  tailoredResume?: string;
  tailoredCoverLetter?: string;
  resumeLatex?: string;
  coverLetterLatex?: string;
  jobCountry?: string;
  jobWorkMode?: "" | "Remote" | "Hybrid" | "On-site";
  retryCount?: number;
  addedAt: number;
  startedAt?: number;
  completedAt?: number;
}

interface JobQueueContextType {
  queue: QueuedJob[];
  isProcessing: boolean;
  currentJobId: string | null;
  addJob: (job: Omit<QueuedJob, "id" | "status" | "progress" | "addedAt">) => string;
  addJobs: (jobs: Omit<QueuedJob, "id" | "status" | "progress" | "addedAt">[]) => string[];
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
  startProcessing: () => void;
  stopProcessing: () => void;
  cancelJob: (id: string) => void;
  retryJob: (id: string) => void;
  processingPaused: boolean;
  setProcessingPaused: (paused: boolean) => void;
  updateJobStatus: (id: string, status: JobStatus, progress?: number) => void;
  updateJobResults: (id: string, results: Partial<QueuedJob>) => void;
  setJobError: (id: string, error: string) => void;
  completedCount: number;
  failedCount: number;
  pendingCount: number;
  cancelledCount: number;
  totalCount: number;
  pollingEnabled: boolean;
  setPollingEnabled: (enabled: boolean) => void;
}

const JobQueueContext = createContext<JobQueueContextType | undefined>(undefined);

const HEADERS = { "Content-Type": "application/json" };

export function JobQueueProvider({ children }: { children: ReactNode }) {
  const [queue, setQueue] = useState<QueuedJob[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentJobId, setCurrentJobId] = useState<string | null>(null);
  const [pollingEnabled, setPollingEnabled] = useState(false);
  const [processingPaused, setProcessingPaused] = useState(false);

  useEffect(() => {
    if (!pollingEnabled) return;

    const fetchQueue = () => {
      fetch("/api/queue")
        .then((res) => res.json())
        .then((data) => {
          if (Array.isArray(data)) setQueue(data);
        })
        .catch(console.error);
    };

    fetchQueue();
    const interval = setInterval(fetchQueue, 3000);
    return () => clearInterval(interval);
  }, [pollingEnabled]);

  useEffect(() => {
    if (processingPaused) return;
    const hasPending = queue.some((j) => j.status === "pending");
    if (hasPending && !isProcessing && !currentJobId) {
      Promise.resolve().then(() => setIsProcessing(true));
    }
  }, [queue, isProcessing, currentJobId, processingPaused]);

  const generateId = () => `job_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  const addJob = useCallback((job: Omit<QueuedJob, "id" | "status" | "progress" | "addedAt">) => {
    const id = generateId();
    const newJob: QueuedJob = { ...job, id, status: "pending", progress: 0, addedAt: Date.now() };
    setQueue((prev) => [...prev, newJob]);
    fetch("/api/queue", {
      method: "POST",
      headers: HEADERS,
      body: JSON.stringify(newJob),
    }).catch((err) => console.error("Failed to sync addJob:", err));
    return id;
  }, []);

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
      newJobs.forEach((job) => {
        fetch("/api/queue", {
          method: "POST",
          headers: HEADERS,
          body: JSON.stringify(job),
        }).catch((err) => console.error("Failed to sync addJobs:", err));
      });
      return newJobs.map((j) => j.id);
    },
    [],
  );

  const removeJob = useCallback((id: string) => {
    setQueue((prev) => prev.filter((j) => j.id !== id));
    fetch(`/api/queue?id=${id}`, { method: "DELETE" }).catch(console.error);
  }, []);

  const updateJob = useCallback(
    (
      id: string,
      updates: Partial<
        Pick<
          QueuedJob,
          "companyName" | "companyUrl" | "positionTitle" | "jobDescription" | "personalDetails"
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
      setQueue((prev) => prev.map((job) => (job.id === id ? { ...job, ...fullUpdates } : job)));
      fetch("/api/queue", {
        method: "PATCH",
        headers: HEADERS,
        body: JSON.stringify({ id, updates: fullUpdates }),
      }).catch(console.error);
    },
    [],
  );

  const clearQueue = useCallback(() => {
    setQueue([]);
    setIsProcessing(false);
    setCurrentJobId(null);
    fetch("/api/queue", { method: "DELETE" }).catch(console.error);
  }, []);

  const clearCompleted = useCallback(() => {
    setQueue((prev) => {
      const completedIds = prev.filter((j) => j.status === "completed").map((j) => j.id);
      completedIds.forEach((id) => {
        fetch(`/api/queue?id=${id}`, { method: "DELETE" }).catch(console.error);
      });
      return prev.filter((j) => j.status !== "completed");
    });
  }, []);

  const updateJobStatus = useCallback((id: string, status: JobStatus, progress?: number) => {
    const baseUpdates: Partial<QueuedJob> = { status };
    if (progress !== undefined) baseUpdates.progress = progress;

    const serverUpdates: Partial<QueuedJob> = { ...baseUpdates };

    setQueue((prev) =>
      prev.map((job) => {
        if (job.id !== id) return job;
        const updates: Partial<QueuedJob> = { ...baseUpdates };
        if (["researching", "tailoring-resume", "tailoring-cover-letter"].includes(status)) {
          if (!job.startedAt) {
            const now = Date.now();
            updates.startedAt = now;
            serverUpdates.startedAt = now;
          }
        }
        if (status === "completed" || status === "failed") {
          const now = Date.now();
          updates.completedAt = now;
          serverUpdates.completedAt = now;
        }
        return { ...job, ...updates };
      }),
    );

    fetch("/api/queue", {
      method: "PATCH",
      headers: HEADERS,
      body: JSON.stringify({ id, updates: serverUpdates }),
    }).catch(console.error);
  }, []);

  const updateJobResults = useCallback((id: string, results: Partial<QueuedJob>) => {
    setQueue((prev) => prev.map((job) => (job.id === id ? { ...job, ...results } : job)));
    fetch("/api/queue", {
      method: "PATCH",
      headers: HEADERS,
      body: JSON.stringify({ id, updates: results }),
    }).catch(console.error);
  }, []);

  const setJobError = useCallback((id: string, error: string) => {
    const updates = { status: "failed" as JobStatus, error, completedAt: Date.now() };
    setQueue((prev) => prev.map((job) => (job.id === id ? { ...job, ...updates } : job)));
    fetch("/api/queue", {
      method: "PATCH",
      headers: HEADERS,
      body: JSON.stringify({ id, updates }),
    }).catch(console.error);
  }, []);

  const startProcessing = useCallback(() => setIsProcessing(true), []);
  const stopProcessing = useCallback(() => {
    setIsProcessing(false);
    setCurrentJobId(null);
  }, []);

  const cancelJob = useCallback((id: string) => {
    const updates = { status: "cancelled" as JobStatus, progress: 0, completedAt: Date.now() };
    setQueue((prev) => prev.map((job) => (job.id === id ? { ...job, ...updates } : job)));
    fetch("/api/queue", {
      method: "PATCH",
      headers: HEADERS,
      body: JSON.stringify({ id, updates }),
    }).catch(console.error);
  }, []);

  const retryJob = useCallback((id: string) => {
    let newRetryCount = 0;
    setQueue((prev) => {
      const job = prev.find((j) => j.id === id);
      newRetryCount = (job?.retryCount || 0) + 1;
      return prev.map((job) =>
        job.id === id
          ? {
              ...job,
              status: "pending" as JobStatus,
              progress: 0,
              error: undefined,
              startedAt: undefined,
              completedAt: undefined,
              retryCount: newRetryCount,
            }
          : job,
      );
    });
    fetch("/api/queue", {
      method: "PATCH",
      headers: HEADERS,
      body: JSON.stringify({
        id,
        updates: {
          status: "pending",
          progress: 0,
          error: undefined,
          retryCount: newRetryCount,
        },
      }),
    }).catch(console.error);
  }, []);

  const completedCount = queue.filter((j) => j.status === "completed").length;
  const failedCount = queue.filter((j) => j.status === "failed").length;
  const pendingCount = queue.filter((j) => j.status === "pending").length;
  const cancelledCount = queue.filter((j) => j.status === "cancelled").length;
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
        cancelledCount,
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
