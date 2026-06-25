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

/**
 * Hook for auto-saving data to localStorage
 */
export function useAutoSave<T>(
  key: string,
  data: T,
  delay: number = 1000,
): { isSaving: boolean; lastSaved: Date | null } {
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isFirstRender = useRef(true);

  useEffect(() => {
    // Skip first render to avoid saving initial state
    if (isFirstRender.current) {
      isFirstRender.current = false;
      // Try to load existing data on first render
      return;
    }

    // Clear existing timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    Promise.resolve().then(() => setIsSaving(true));

    // Debounced save
    timeoutRef.current = setTimeout(() => {
      try {
        localStorage.setItem(key, JSON.stringify(data));
        setLastSaved(new Date());
      } catch (error) {
        console.error("Auto-save failed:", error);
      }
      setIsSaving(false);
    }, delay);

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [key, data, delay]);

  return { isSaving, lastSaved };
}

/**
 * Hook to load data from localStorage on mount
 */
export function useLocalStorageLoad<T>(key: string, defaultValue: T): [T | null, boolean] {
  const [data] = useState<T | null>(() => {
    if (typeof window !== "undefined") {
      try {
        const stored = localStorage.getItem(key);
        return stored ? JSON.parse(stored) : defaultValue;
      } catch (error) {
        console.error("Failed to load from localStorage:", error);
        return defaultValue;
      }
    }
    return null;
  });
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    Promise.resolve().then(() => setIsLoaded(true));
  }, []);

  return [data, isLoaded];
}

/**
 * Hook for managing a field that clears related data on change
 */
export function useFieldWithSideEffect<T>(
  value: T,
  setValue: (value: T) => void,
  onChangeSideEffect: () => void,
  debounceMs: number = 500,
): (newValue: T) => void {
  const debouncedSideEffect = useDebouncedCallback(onChangeSideEffect, debounceMs);
  const previousValueRef = useRef(value);

  const handleChange = useCallback(
    (newValue: T) => {
      setValue(newValue);

      // Only trigger side effect if value actually changed
      if (previousValueRef.current !== newValue) {
        previousValueRef.current = newValue;
        debouncedSideEffect();
      }
    },
    [setValue, debouncedSideEffect],
  );

  return handleChange;
}

/**
 * Hook for retry logic with exponential backoff
 */
export function useRetryWithBackoff() {
  const [attempt, setAttempt] = useState(0);
  const [isRetrying, setIsRetrying] = useState(false);

  const executeWithRetry = useCallback(
    async <T>(
      fn: () => Promise<T>,
      maxRetries: number = 3,
      baseDelay: number = 1000,
    ): Promise<T> => {
      let lastError: Error | null = null;

      for (let i = 0; i <= maxRetries; i++) {
        try {
          setAttempt(i);
          if (i > 0) setIsRetrying(true);

          const result = await fn();
          setIsRetrying(false);
          return result;
        } catch (error) {
          lastError = error instanceof Error ? error : new Error(String(error));

          if (i < maxRetries) {
            // Exponential backoff: 1s, 2s, 4s, 8s...
            const delay = baseDelay * Math.pow(2, i);
            await new Promise((resolve) => setTimeout(resolve, delay));
          }
        }
      }

      setIsRetrying(false);
      throw lastError;
    },
    [],
  );

  return { executeWithRetry, attempt, isRetrying };
}
