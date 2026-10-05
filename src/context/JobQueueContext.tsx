"use client";
import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  useRef,
  type ReactNode,
} from "react";
import type { QueuedJob } from "@/lib/browser-queue";
import { isClaimable, isActiveJob } from "@/lib/queue";
import { installExtensionBridge } from "@/lib/extension-bridge";
import { processLocalQueue } from "@/lib/process-local-queue";
import { apiJSON } from "@/lib/client-api";
export type { QueuedJob };
export type JobStatus = QueuedJob["status"];
type NewJob = Omit<QueuedJob, "id" | "status" | "progress" | "addedAt">;
type Edits = Partial<
  Pick<
    QueuedJob,
    | "companyName"
    | "companyUrl"
    | "positionTitle"
    | "jobDescription"
    | "personalDetails"
    | "includeCoverLetter"
    | "profileId"
    | "profileName"
    | "profileColor"
  >
>;
type State = { jobs: QueuedJob[]; paused: boolean };
const json = (method: string, body?: unknown): RequestInit => ({
  method,
  headers: { "Content-Type": "application/json" },
  body: body === undefined ? undefined : JSON.stringify(body),
});
interface QueueContext {
  queue: QueuedJob[];
  loading: boolean;
  queueError: string;
  busyIds: string[];
  retryConnection: () => Promise<void>;
  refreshQueue: () => Promise<void>;
  isProcessing: boolean;
  currentJobId: string | null;
  processingPaused: boolean;
  pollingEnabled: boolean;
  setPollingEnabled: (value: boolean) => void;
  setProcessingPaused: (value: boolean) => Promise<boolean>;
  activeCount: number;
  completedCount: number;
  failedCount: number;
  pendingCount: number;
  cancelledCount: number;
  totalCount: number;
  addJob: (job: NewJob) => Promise<string | null>;
  addJobs: (jobs: NewJob[]) => Promise<string[]>;
  removeJob: (id: string) => Promise<boolean>;
  updateJob: (id: string, updates: Edits, reset?: boolean) => Promise<boolean>;
  clearQueue: () => Promise<boolean>;
  clearCompleted: () => Promise<boolean>;
  retryJob: (id: string) => Promise<boolean>;
  cancelJob: (id: string) => Promise<boolean>;
  startProcessing: () => Promise<boolean>;
  stopProcessing: () => Promise<boolean>;
}
const JobQueueContext = createContext<QueueContext | undefined>(undefined);
export function JobQueueProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<State>({ jobs: [], paused: true });
  const current = useRef(state);
  const [pollingEnabled, setPollingEnabled] = useState(true);
  const [queueError, setQueueError] = useState("");
  const [loading, setLoading] = useState(true);
  const [busyIds, setBusyIds] = useState<string[]>([]);
  const writes = useRef<Promise<unknown>>(Promise.resolve());
  const submissions = useRef(new Map<string, string>());
  const batchSubmissions = useRef(new Map<string, string[]>());
  const revision = useRef(0),
    pending = useRef(0),
    running = useRef(false),
    blocked = useRef(false);
  const commit = useCallback((next: State) => {
    current.current = next;
    setState(next);
    setLoading(false);
  }, []);
  const read = useCallback(async () => {
    const next = await apiJSON<State>("/api/queue?state=1", {
      cache: "no-store",
      signal: AbortSignal.timeout(120_000),
    });
    if (!Array.isArray(next.jobs) || typeof next.paused !== "boolean")
      throw new Error("Invalid queue response");
    return next;
  }, []);
  const refreshQueue = useCallback(async () => {
    const version = revision.current;
    try {
      const next = await read();
      if (version === revision.current && pending.current === 0) {
        commit(next);
        if (!blocked.current) setQueueError("");
      }
      return true;
    } catch (error) {
      setQueueError(error instanceof Error ? error.message : "Queue unavailable");
      return false;
    } finally {
      setLoading(false);
    }
  }, [commit, read]);
  const mutate = useCallback(
    <T,>(id: string, url: string, init: RequestInit): Promise<T | null> => {
      pending.current++;
      revision.current++;
      setBusyIds((ids) => [...ids, id]);
      const request = writes.current
        .catch(() => undefined)
        .then(async () => {
          try {
            const result = await apiJSON<T>(url, { ...init, signal: AbortSignal.timeout(120_000) });
            blocked.current = false;
            try {
              commit(await read());
              setQueueError("");
            } catch {
              blocked.current = true;
              setQueueError(
                "Change saved, but the queue could not refresh. Reconnect to see the latest state.",
              );
            }
            return result;
          } catch (error) {
            blocked.current = true;
            setQueueError(error instanceof Error ? error.message : "Queue action failed");
            return null;
          } finally {
            pending.current--;
            revision.current++;
            setBusyIds((ids) => {
              const next = [...ids];
              next.splice(next.indexOf(id), 1);
              return next;
            });
            if (!blocked.current) window.dispatchEvent(new window.Event("fd-queue"));
          }
        });
      writes.current = request;
      return request;
    },
    [commit, read],
  );
  useEffect(() => {
    if (!pollingEnabled) return;
    const controller = new AbortController();
    let active = true,
      polling = false;
    const tick = async () => {
      if (polling || !active) return;
      polling = true;
      const synced = await refreshQueue();
      polling = false;
      if (
        !synced ||
        !active ||
        running.current ||
        blocked.current ||
        pending.current ||
        current.current.paused
      )
        return;
      const jobs = current.current.jobs;
      if (!jobs.some((job) => isClaimable(job) || isActiveJob(job))) return;
      running.current = true;
      try {
        await processLocalQueue(controller.signal);
      } catch (error) {
        blocked.current = true;
        setQueueError(error instanceof Error ? error.message : "Processing unavailable");
      } finally {
        running.current = false;
        if (active) await refreshQueue();
      }
    };
    void tick();
    const timer = setInterval(() => void tick(), 15000);
    const retry = () => {
      blocked.current = false;
      void tick();
    };
    for (const event of ["fd-ai-settings", "online", "storage", "fd-queue"])
      window.addEventListener(event, retry);
    return () => {
      active = false;
      controller.abort();
      clearInterval(timer);
      for (const event of ["fd-ai-settings", "online", "storage", "fd-queue"])
        window.removeEventListener(event, retry);
    };
  }, [pollingEnabled, refreshQueue]);
  useEffect(() => installExtensionBridge(), []);
  const addJobs = useCallback(
    async (jobs: NewJob[]) => {
      const fingerprint = JSON.stringify(jobs);
      const ids = batchSubmissions.current.get(fingerprint) || jobs.map(() => crypto.randomUUID());
      batchSubmissions.current.set(fingerprint, ids);
      const input = jobs.map((job, index) => ({ ...job, id: ids[index] }));
      const result = await mutate<{ jobs: QueuedJob[]; errors?: unknown[] }>(
        "queue",
        "/api/queue",
        json("PUT", { jobs: input }),
      );
      if (result?.errors?.length)
        setQueueError("Some jobs were rejected. Check the queue before retrying.");
      else if (result) {
        batchSubmissions.current.delete(fingerprint);
        return ids;
      }
      return result?.jobs.map((job) => job.id) ?? [];
    },
    [mutate],
  );
  const addJob = useCallback(
    async (job: NewJob) => {
      const fingerprint = JSON.stringify(job);
      const id = submissions.current.get(fingerprint) || crypto.randomUUID();
      submissions.current.set(fingerprint, id);
      const result = await mutate<{ job: QueuedJob }>(
        "queue",
        "/api/queue",
        json("POST", { ...job, id }),
      );
      if (result) submissions.current.delete(fingerprint);
      return result?.job.id ?? null;
    },
    [mutate],
  );
  const patch = useCallback(
    async (id: string, updates: Partial<QueuedJob>, action?: string) =>
      !!(await mutate(id, "/api/queue", json("PATCH", { id, updates, action }))),
    [mutate],
  );
  const removeJob = useCallback(
    async (id: string) =>
      !!(await mutate(id, `/api/queue?id=${encodeURIComponent(id)}`, json("DELETE"))),
    [mutate],
  );
  const clearQueue = useCallback(
    async () => !!(await mutate("queue", "/api/queue", json("DELETE"))),
    [mutate],
  );
  const clearCompleted = useCallback(
    async () => !!(await mutate("queue", "/api/queue?status=completed", json("DELETE"))),
    [mutate],
  );
  const updateJob = useCallback(
    (id: string, edits: Edits, reset = true) => patch(id, edits, reset ? "edit" : undefined),
    [patch],
  );
  const retryJob = useCallback((id: string) => patch(id, {}, "retry"), [patch]);
  const cancelJob = useCallback((id: string) => patch(id, {}, "cancel"), [patch]);
  const setProcessingPaused = useCallback(
    async (paused: boolean) =>
      !!(await mutate(
        "queue",
        "/api/queue",
        json("PATCH", { action: paused ? "pause" : "resume" }),
      )),
    [mutate],
  );
  const startProcessing = useCallback(() => setProcessingPaused(false), [setProcessingPaused]);
  const stopProcessing = useCallback(() => setProcessingPaused(true), [setProcessingPaused]);
  const retryConnection = useCallback(async () => {
    blocked.current = false;
    setQueueError("");
    await refreshQueue();
  }, [refreshQueue]);
  const queue = state.jobs,
    activeJobs = queue.filter(isActiveJob);
  const value = {
    queue,
    loading,
    queueError,
    busyIds,
    retryConnection,
    refreshQueue: retryConnection,
    isProcessing: activeJobs.some((job) => !isClaimable(job)),
    currentJobId: activeJobs.find((job) => !isClaimable(job))?.id ?? null,
    processingPaused: state.paused,
    pollingEnabled,
    setPollingEnabled,
    setProcessingPaused,
    activeCount: activeJobs.length,
    completedCount: queue.filter((job) => job.status === "completed").length,
    failedCount: queue.filter((job) => job.status === "failed").length,
    pendingCount: queue.filter((job) => job.status === "pending").length,
    cancelledCount: queue.filter((job) => job.status === "cancelled").length,
    totalCount: queue.length,
    addJob,
    addJobs,
    removeJob,
    updateJob,
    clearQueue,
    clearCompleted,
    retryJob,
    cancelJob,
    startProcessing,
    stopProcessing,
  };
  return <JobQueueContext.Provider value={value}>{children}</JobQueueContext.Provider>;
}
export function useJobQueue() {
  const context = useContext(JobQueueContext);
  if (!context) throw new Error("useJobQueue must be used within a JobQueueProvider");
  return context;
}
