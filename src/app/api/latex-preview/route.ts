import { checkRateLimit, getClientIdentifier, RATE_LIMITS } from "@/lib/rate-limit";
import { compileLatex, LatexError } from "@/lib/latex";
import { aiErrorResponse } from "@/lib/api-error";
import { withAIBudget } from "@/lib/ai-providers/http";

export const maxDuration = 300;
export function POST(request: Request) {
  return withAIBudget(
    275_000,
    async () => {
      try {
        const limit = checkRateLimit(`latex_${getClientIdentifier(request)}`, RATE_LIMITS.LATEX);
        if (!limit.success)
          return Response.json(
            { error: `Try the preview again in ${limit.retryAfter} seconds.` },
            { status: 429, headers: { "Retry-After": String(limit.retryAfter) } },
          );
        const { latex } = await request.json();
        if (typeof latex !== "string" || !latex.trim())
          return Response.json({ error: "LaTeX code is required." }, { status: 400 });
        return Response.json(await compileLatex(latex, { signal: request.signal }));
      } catch (error) {
        if (error instanceof LatexError)
          return Response.json({ error: error.message }, { status: error.status });
        return aiErrorResponse(
          error,
          "Unable to repair LaTeX. Your source is preserved; retry the preview.",
        );
      }
    },
    request.signal,
  );
}
