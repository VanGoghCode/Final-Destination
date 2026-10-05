import { parseQueueState, type QueuedJob } from "./browser-queue";

interface QueueFile<T> {
  read(): Promise<{ state: T; sha: string }>;
  write(state: T, sha: string): Promise<boolean>;
}
export async function transactQueue<T, R>(
  action: (state: T) => Promise<R>,
  file: QueueFile<T>,
): Promise<R> {
  for (let attempt = 0; attempt < 5; attempt++) {
    const { state, sha } = await file.read();
    const before = JSON.stringify(state);
    const result = await action(state);
    if (JSON.stringify(state) === before || (await file.write(state, sha))) return result;
  }
  throw new Error("The shared queue changed repeatedly. Retry your action.");
}

type State = { jobs: QueuedJob[]; paused: boolean };
export function githubQueueFile(): QueueFile<State> {
  const repo = process.env.GITHUB_QUEUE_REPO;
  const token = process.env.GITHUB_QUEUE_TOKEN;
  if (!repo || !/^[\w.-]+\/[\w.-]+$/.test(repo) || !token)
    throw new Error(
      "Configure GITHUB_QUEUE_REPO and GITHUB_QUEUE_TOKEN on Vercel to enable the shared queue.",
    );
  const url = `https://api.github.com/repos/${repo}/contents/queue.json`;
  const request = async (init?: RequestInit) => {
    const result = await fetch(url, {
      ...init,
      cache: "no-store",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        "Content-Type": "application/json",
      },
      signal: AbortSignal.timeout(20_000),
    });
    if (!result.ok && result.status !== 409)
      throw new Error(
        `Shared queue unavailable (GitHub ${result.status}). Check repository permissions or retry later.`,
      );
    return result;
  };
  return {
    read: async () => {
      const result = await request();
      const data = await result.json();
      if (!data.sha || data.encoding !== "base64" || !data.content)
        throw new Error(
          "Shared queue file is missing or too large. Export completed jobs before continuing.",
        );
      return {
        state: parseQueueState(Buffer.from(data.content, "base64").toString("utf8")),
        sha: data.sha,
      };
    },
    write: async (state, sha) => {
      const content = Buffer.from(JSON.stringify(state)).toString("base64");
      if (content.length > 1_200_000)
        throw new Error(
          "Shared queue is full. Export and remove completed jobs before adding more.",
        );
      return (
        await request({
          method: "PUT",
          body: JSON.stringify({ message: "Update personal queue", content, sha }),
        })
      ).ok;
    },
  };
}
