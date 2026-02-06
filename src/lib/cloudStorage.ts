// Cloud Storage Wrapper for Upstash Redis
// Drop-in replacement for localStorage that syncs with cloud

// In-memory cache and pending operations
let cache: Record<string, unknown> = {};
let isInitialized = false;
let initPromise: Promise<void> | null = null;

// Initialize cache from cloud
export async function initializeCloudStorage(): Promise<void> {
  if (isInitialized) return;
  if (initPromise) return initPromise;

  initPromise = (async () => {
    try {
      const response = await fetch("/api/storage");
      if (response.ok) {
        const { data } = await response.json();
        cache = data || {};
        isInitialized = true;
      }
    } catch (error) {
      console.error("Failed to initialize cloud storage:", error);
      // Fall back to localStorage if available
      if (typeof window !== "undefined") {
        const keys = [
          "fd_personal_details",
          "fd_resume_templates",
          "fd_cover_letter_templates",
          "fd_default_resume_id",
          "fd_default_cover_letter_id",
          "fd_profiles",
          "fd_active_profile_id",
        ];
        keys.forEach((key) => {
          const value = localStorage.getItem(key);
          if (value) {
            try {
              cache[key] = JSON.parse(value);
            } catch {
              cache[key] = value;
            }
          }
        });
      }
    }
  })();

  return initPromise;
}

// Get value from cloud storage
export async function cloudGet<T>(key: string): Promise<T | null> {
  await initializeCloudStorage();
  const value = cache[key];
  return value as T | null;
}

// Set value in cloud storage
export async function cloudSet<T>(key: string, value: T): Promise<void> {
  await initializeCloudStorage();
  cache[key] = value;

  // Sync to cloud
  try {
    await fetch("/api/storage", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key, value }),
    });
  } catch (error) {
    console.error("Failed to sync to cloud:", error);
  }
}

// Remove value from cloud storage
export async function cloudRemove(key: string): Promise<void> {
  await initializeCloudStorage();
  delete cache[key];

  try {
    await fetch(`/api/storage?key=${encodeURIComponent(key)}`, {
      method: "DELETE",
    });
  } catch (error) {
    console.error("Failed to remove from cloud:", error);
  }
}

// Export all data (for backup)
export async function exportAllData(): Promise<Record<string, unknown>> {
  await initializeCloudStorage();
  return { ...cache };
}

// Import data from localStorage to cloud (migration)
export async function migrateFromLocalStorage(): Promise<{
  success: boolean;
  migratedKeys: string[];
}> {
  if (typeof window === "undefined") {
    return { success: false, migratedKeys: [] };
  }

  const keysToMigrate = [
    "fd_personal_details",
    "fd_resume_templates",
    "fd_cover_letter_templates",
    "fd_default_resume_id",
    "fd_default_cover_letter_id",
    "fd_profiles",
    "fd_active_profile_id",
  ];

  const data: Record<string, unknown> = {};
  const migratedKeys: string[] = [];

  for (const key of keysToMigrate) {
    const value = localStorage.getItem(key);
    if (value) {
      try {
        data[key] = JSON.parse(value);
      } catch {
        data[key] = value;
      }
      migratedKeys.push(key);
    }
  }

  if (migratedKeys.length === 0) {
    return { success: true, migratedKeys: [] };
  }

  try {
    const response = await fetch("/api/storage", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ data }),
    });

    if (response.ok) {
      // Update cache
      cache = { ...cache, ...data };
      isInitialized = true;
      return { success: true, migratedKeys };
    }
  } catch (error) {
    console.error("Migration failed:", error);
  }

  return { success: false, migratedKeys: [] };
}

// Check if cloud storage is configured
export async function isCloudStorageConfigured(): Promise<boolean> {
  try {
    const response = await fetch("/api/storage");
    return response.ok;
  } catch {
    return false;
  }
}
