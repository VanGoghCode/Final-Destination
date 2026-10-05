import { Window } from "happy-dom";

export function openBrowser() {
  const browser = new Window({ url: "https://example.test" });
  const globals = {
    window: browser,
    document: browser.document,
    localStorage: browser.localStorage,
    HTMLElement: browser.HTMLElement,
    IS_REACT_ACT_ENVIRONMENT: true,
    navigator: { locks: { request } },
    fetch: async (url: string, init?: RequestInit) => {
      const { localRequest } = await import("../local-api");
      if (url.startsWith("/api/queue")) return (await localRequest(url, init))!;
      throw new Error("Unexpected network request");
    },
  };
  const saved = Object.keys(globals).map(
    (key) => [key, Object.getOwnPropertyDescriptor(globalThis, key)] as const,
  );
  const locks = new Map<string, Promise<unknown>>();
  function request(name: string, options: unknown, callback?: (lock: object | null) => unknown) {
    const fn =
      typeof options === "function" ? (options as (lock: object | null) => unknown) : callback!;
    if ((options as { ifAvailable?: boolean })?.ifAvailable && locks.has(name))
      return Promise.resolve(fn(null));
    const pending = (locks.get(name) || Promise.resolve()).catch(() => {}).then(() => fn({ name }));
    locks.set(name, pending);
    return pending.finally(() => {
      if (locks.get(name) === pending) locks.delete(name);
    });
  }
  for (const [name, value] of Object.entries(globals))
    Object.defineProperty(globalThis, name, { value, configurable: true, writable: true });
  return {
    browser,
    close: () =>
      saved.forEach(([key, descriptor]) => {
        if (descriptor) Object.defineProperty(globalThis, key, descriptor);
        else Reflect.deleteProperty(globalThis, key);
      }),
  };
}
