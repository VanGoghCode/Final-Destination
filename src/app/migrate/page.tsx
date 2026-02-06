"use client";

import { useState, useEffect } from "react";
import Button from "@/components/Button";
import {
  migrateFromLocalStorage,
  isCloudStorageConfigured,
} from "@/lib/cloudStorage";

export default function MigratePage() {
  const [status, setStatus] = useState<
    "checking" | "ready" | "migrating" | "done" | "error"
  >("checking");
  const [message, setMessage] = useState("");
  const [migratedKeys, setMigratedKeys] = useState<string[]>([]);
  const [localStorageData, setLocalStorageData] = useState<
    Record<string, string>
  >({});

  useEffect(() => {
    // Check cloud storage status and gather localStorage data
    const checkStatus = async () => {
      const configured = await isCloudStorageConfigured();
      if (!configured) {
        setStatus("error");
        setMessage(
          "Cloud storage is not configured. Please add KV_REST_API_URL and KV_REST_API_TOKEN to your environment.",
        );
        return;
      }

      // Gather localStorage data for preview
      const keys = [
        "fd_personal_details",
        "fd_resume_templates",
        "fd_cover_letter_templates",
        "fd_default_resume_id",
        "fd_default_cover_letter_id",
        "fd_profiles",
        "fd_active_profile_id",
      ];

      const data: Record<string, string> = {};
      keys.forEach((key) => {
        const value = localStorage.getItem(key);
        if (value) {
          data[key] = value;
        }
      });

      setLocalStorageData(data);
      setStatus("ready");

      if (Object.keys(data).length === 0) {
        setMessage("No localStorage data found to migrate.");
      } else {
        setMessage(`Found ${Object.keys(data).length} items to migrate.`);
      }
    };

    checkStatus();
  }, []);

  const handleMigrate = async () => {
    setStatus("migrating");
    setMessage("Migrating data to cloud storage...");

    const result = await migrateFromLocalStorage();

    if (result.success) {
      setStatus("done");
      setMigratedKeys(result.migratedKeys);
      setMessage(
        `Successfully migrated ${result.migratedKeys.length} items to cloud storage!`,
      );
    } else {
      setStatus("error");
      setMessage("Migration failed. Please try again.");
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="max-w-2xl w-full bg-white rounded-xl shadow-lg p-8">
        <h1 className="text-2xl font-bold mb-2">Data Migration</h1>
        <p className="text-gray-600 mb-6">
          Migrate your localStorage data to cloud storage for reliable
          persistence.
        </p>

        {/* Status */}
        <div
          className={`p-4 rounded-lg mb-6 ${
            status === "error"
              ? "bg-red-50 border border-red-200"
              : status === "done"
                ? "bg-green-50 border border-green-200"
                : "bg-blue-50 border border-blue-200"
          }`}
        >
          <p
            className={`text-sm ${
              status === "error"
                ? "text-red-700"
                : status === "done"
                  ? "text-green-700"
                  : "text-blue-700"
            }`}
          >
            {message || "Checking status..."}
          </p>
        </div>

        {/* Data Preview */}
        {Object.keys(localStorageData).length > 0 && status !== "done" && (
          <div className="mb-6">
            <h2 className="text-lg font-semibold mb-3">Data to Migrate</h2>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {Object.entries(localStorageData).map(([key, value]) => {
                let preview = value;
                try {
                  const parsed = JSON.parse(value);
                  if (Array.isArray(parsed)) {
                    preview = `Array with ${parsed.length} items`;
                  } else if (typeof parsed === "object") {
                    preview = `Object with keys: ${Object.keys(parsed).join(", ")}`;
                  }
                } catch {
                  preview =
                    value.substring(0, 50) + (value.length > 50 ? "..." : "");
                }
                return (
                  <div
                    key={key}
                    className="flex justify-between items-center p-3 bg-gray-50 rounded-lg"
                  >
                    <span className="font-mono text-sm text-gray-700">
                      {key}
                    </span>
                    <span className="text-xs text-gray-500 truncate max-w-xs">
                      {preview}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Migrated Keys */}
        {migratedKeys.length > 0 && (
          <div className="mb-6">
            <h2 className="text-lg font-semibold mb-3">Migrated Items</h2>
            <div className="space-y-1">
              {migratedKeys.map((key) => (
                <div
                  key={key}
                  className="flex items-center gap-2 text-green-700"
                >
                  <svg
                    className="w-4 h-4"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                  <span className="font-mono text-sm">{key}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-3">
          {status === "ready" && Object.keys(localStorageData).length > 0 && (
            <Button
              onClick={handleMigrate}
              variant="primary"
              className="flex-1"
            >
              Migrate to Cloud
            </Button>
          )}
          {status === "done" && (
            <Button
              onClick={() => (window.location.href = "/")}
              variant="primary"
              className="flex-1"
            >
              Go to Home
            </Button>
          )}
          <Button
            onClick={() => (window.location.href = "/")}
            variant="secondary"
            className="flex-1"
          >
            Cancel
          </Button>
        </div>

        {/* Instructions */}
        <div className="mt-8 pt-6 border-t border-gray-200">
          <h3 className="font-semibold text-sm mb-2">Instructions</h3>
          <ol className="text-xs text-gray-600 space-y-1 list-decimal list-inside">
            <li>
              Open this page on your <strong>production site</strong>{" "}
              (final-destination-rose.vercel.app)
            </li>
            <li>
              Click "Migrate to Cloud" to copy your localStorage to Upstash
              Redis
            </li>
            <li>Once done, your data will be synced across all environments</li>
          </ol>
        </div>
      </div>
    </div>
  );
}
