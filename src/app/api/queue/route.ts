import { createQueueStore } from "@/lib/browser-queue";
import { githubQueueFile, transactQueue } from "@/lib/github-queue";
import { createQueueHandler } from "@/lib/local-api";

export const runtime = "nodejs";
export const maxDuration = 120;
async function handle(request: Request) {
  try {
    return await transactQueue(async (state) => {
      const store = createQueueStore({
        read: () => structuredClone(state),
        save: (next) => Object.assign(state, next),
        lock: (action) => action(),
      });
      const response = await createQueueHandler(store)(request.clone());
      response.headers.set("Cache-Control", "no-store");
      return response;
    }, githubQueueFile());
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Shared queue unavailable" },
      { status: 503 },
    );
  }
}
export { handle as GET, handle as POST, handle as PUT, handle as PATCH, handle as DELETE };
