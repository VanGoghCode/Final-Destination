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
    const updates: Partial<QueuedJob> = { status };
    if (progress !== undefined) updates.progress = progress;
    if (status === "completed" || status === "failed") updates.completedAt = Date.now();

    setQueue((prev) =>
      prev.map((job) => {
        if (job.id !== id) return job;
        return { ...job, ...updates, startedAt: updates.startedAt || job.startedAt };
      }),
    );

    fetch("/api/queue", {
      method: "PATCH",
      headers: HEADERS,
      body: JSON.stringify({ id, updates }),
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
    const updates = {
      status: "pending" as JobStatus,
      progress: 0,
      error: undefined,
      startedAt: undefined,
      completedAt: undefined,
    };
    setQueue((prev) => prev.map((job) => (job.id === id ? { ...job, ...updates } : job)));
    fetch("/api/queue", {
      method: "PATCH",
      headers: HEADERS,
      body: JSON.stringify({ id, updates }),
    }).catch(console.error);
  }, []);

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
