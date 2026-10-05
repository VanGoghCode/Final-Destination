import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { getApiKey, getAISelection } from "./api-key";

const envNames = ["AI_PROVIDER", "OPENAI_API_KEY", "OPENAI_MODEL", "DEEPSEEK_API_KEY"] as const;
let saved: Array<string | undefined>;
beforeEach(() => {
  saved = envNames.map((name) => process.env[name]);
  envNames.forEach((name) => delete process.env[name]);
});
afterEach(() =>
  envNames.forEach((name, i) => {
    if (saved[i] === undefined) delete process.env[name];
    else process.env[name] = saved[i];
  }),
);
const request = (headers: Record<string, string> = {}) =>
  new Request("http://localhost", { headers });

describe("AI selection and credentials", () => {
  it("defaults to Luna when no provider is configured", async () => {
    expect(await getAISelection(request())).toEqual({
      provider: "openai",
      modelId: "gpt-6-luna",
    });
  });
  it("automatically selects Luna for an OpenAI-only installation", async () => {
    process.env.OPENAI_API_KEY = "server-openai";
    expect(await getAISelection(request())).toEqual({ provider: "openai", modelId: "gpt-6-luna" });
  });
  it("honors server provider and model configuration", async () => {
    process.env.AI_PROVIDER = "openai";
    process.env.OPENAI_MODEL = "custom-model";
    expect(await getAISelection(request())).toEqual({
      provider: "openai",
      modelId: "custom-model",
    });
  });
  it("headers override cookie and environment selection", async () => {
    process.env.AI_PROVIDER = "deepseek";
    expect(
      await getAISelection(
        request({
          "x-ai-provider": "openai",
          "x-ai-model": "another-model",
          cookie: "fd_ai_provider=deepseek",
        }),
      ),
    ).toEqual({ provider: "openai", modelId: "another-model" });
  });
  it("uses browser selection and its provider-specific model cookie", async () => {
    expect(
      await getAISelection(
        request({ cookie: "fd_ai_provider=openai; fd_openai_model=gpt-6-luna" }),
      ),
    ).toEqual({ provider: "openai", modelId: "gpt-6-luna" });
  });
  it("ignores invalid provider values", async () => {
    expect((await getAISelection(request({ "x-ai-provider": "invalid" }))).provider).toBe("openai");
  });
  for (const provider of ["deepseek", "openai"] as const) {
    const env = provider === "openai" ? "OPENAI_API_KEY" : "DEEPSEEK_API_KEY";
    const cookie = provider === "openai" ? "fd_openai_api_key" : "fd_api_key";
    it(`${provider}: environment key takes precedence`, async () => {
      process.env[env] = "server";
      expect(
        await getApiKey(
          provider,
          request({ [`x-${provider}-api-key`]: "header", cookie: `${cookie}=browser` }),
        ),
      ).toBe("server");
    });
    it(`${provider}: header key takes precedence over cookie`, async () => {
      expect(
        await getApiKey(
          provider,
          request({ [`x-${provider}-api-key`]: "header", cookie: `${cookie}=browser` }),
        ),
      ).toBe("header");
    });
    it(`${provider}: reads decoded cookie key`, async () => {
      expect(await getApiKey(provider, request({ cookie: `${cookie}=key%2Bvalue` }))).toBe(
        "key+value",
      );
    });
    it(`${provider}: does not use the other provider's key`, async () => {
      const other = provider === "openai" ? "deepseek" : "openai";
      expect(
        await getApiKey(provider, request({ [`x-${other}-api-key`]: "wrong" })),
      ).toBeUndefined();
    });
  }
  it("does not throw on malformed cookie encoding or outside a request", async () => {
    expect(await getApiKey("openai", request({ cookie: "fd_openai_api_key=%XX" }))).toBeUndefined();
    expect(await getApiKey("openai")).toBeUndefined();
  });
});
