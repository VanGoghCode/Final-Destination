// Custom React hooks for the application

import { useState, useEffect, useRef, useCallback } from "react";

/**
 * Debounced callback hook
 * Returns a debounced version of the callback that only fires after the delay
 */
export function useDebouncedCallback<T extends (...args: unknown[]) => unknown>(
  callback: T,
  delay: number,
): T {
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const callbackRef = useRef(callback);

  // Update callback ref on each render
  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  const debouncedCallback = useCallback(
    (...args: Parameters<T>) => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      timeoutRef.current = setTimeout(() => {
        callbackRef.current(...args);
      }, delay);
    },
    [delay],
  ) as T;

  return debouncedCallback;
}

/** Saves browser drafts after edits and flushes pending data on navigation. */
export function useAutoSave<T>(key: string, data: T, delay = 1000) {
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [error, setError] = useState("");
  const first = useRef(true);
  const pending = useRef<{ key: string; value: string } | null>(null);
  const value = JSON.stringify(data);
  const flush = useCallback((notify = true) => {
    if (!pending.current) return;
    try {
      localStorage.setItem(pending.current.key, pending.current.value);
      pending.current = null;
      if (notify) {
        setLastSaved(new Date());
        setError("");
      }
    } catch {
      if (notify) setError("Draft could not be saved. Browser storage is unavailable or full.");
    } finally {
      if (notify) setIsSaving(false);
    }
  }, []);
  useEffect(() => {
    const save = () => flush(false);
    window.addEventListener("beforeunload", save);
    return () => {
      window.removeEventListener("beforeunload", save);
      flush(false);
    };
  }, [flush]);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    pending.current = { key, value };
    Promise.resolve().then(() => setIsSaving(true));
    const timer = setTimeout(flush, delay);
    return () => clearTimeout(timer);
  }, [key, value, delay, flush]);
  return { isSaving, lastSaved, error };
}
