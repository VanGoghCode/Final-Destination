"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Button from "@/components/Button";

interface AdminData {
  redisConnected: boolean;
  message?: string;
  profiles?: Array<{
    id: string;
    name: string;
    color: string;
  }>;
  queueStats?: {
    total: number;
    pending: number;
    processing: number;
    completed: number;
    failed: number;
    cancelled: number;
  };
}

export default function AdminDashboard() {
  const router = useRouter();
  const [data, setData] = useState<AdminData | null>(null);
  const [loading, setLoading] = useState(true);
  const [clearing, setClearing] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const res = await fetch("/api/admin/users");
      const json = await res.json();
      setData(json);
    } catch {
      setError("Failed to fetch admin data");
    } finally {
      setLoading(false);
    }
  };

  const handleClearAll = async () => {
    if (!window.confirm("Are you sure you want to delete ALL data? This cannot be undone.")) return;

    setClearing(true);
    try {
      const res = await fetch("/api/admin/users", { method: "DELETE" });
      const json = await res.json();
      if (json.success) {
        await fetchData();
      } else {
        setError(json.error || "Failed to clear data");
      }
    } catch {
      setError("Failed to clear data");
    } finally {
      setClearing(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-300 border-t-gray-900" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="mx-auto max-w-4xl">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Admin Dashboard</h1>
            <p className="text-muted mt-1 text-sm">System status and data management</p>
          </div>
          <div className="flex gap-3">
            <Button onClick={() => router.push("/")} variant="secondary">
              Back to App
            </Button>
            <Button onClick={() => fetchData()} variant="secondary">
              Refresh
            </Button>
          </div>
        </div>

        {error && (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {error}
          </div>
        )}

        {data && (
          <div className="space-y-6">
            {/* Redis Status */}
            <div className="rounded-xl border border-gray-200 bg-white p-6">
              <h2 className="mb-4 text-lg font-semibold">Connection Status</h2>
              <div className="flex items-center gap-3">
                <div
                  className={`h-3 w-3 rounded-full ${data.redisConnected ? "bg-green-500" : "bg-yellow-500"}`}
                />
                <span className="font-medium">
                  {data.redisConnected ? "Redis Connected" : "Local Storage Only"}
                </span>
              </div>
              {data.message && <p className="text-muted mt-2 text-sm">{data.message}</p>}
            </div>

            {/* Queue Stats */}
            {data.queueStats && (
              <div className="rounded-xl border border-gray-200 bg-white p-6">
                <h2 className="mb-4 text-lg font-semibold">Queue Statistics</h2>
                <div className="grid grid-cols-3 gap-4 sm:grid-cols-6">
                  {[
                    {
                      label: "Total",
                      value: data.queueStats.total,
                      color: "bg-gray-100 text-gray-700",
                    },
                    {
                      label: "Pending",
                      value: data.queueStats.pending,
                      color: "bg-blue-100 text-blue-700",
                    },
                    {
                      label: "Processing",
                      value: data.queueStats.processing,
                      color: "bg-purple-100 text-purple-700",
                    },
                    {
                      label: "Completed",
                      value: data.queueStats.completed,
                      color: "bg-green-100 text-green-700",
                    },
                    {
                      label: "Failed",
                      value: data.queueStats.failed,
                      color: "bg-red-100 text-red-700",
                    },
                    {
                      label: "Cancelled",
                      value: data.queueStats.cancelled,
                      color: "bg-orange-100 text-orange-700",
                    },
                  ].map((stat) => (
                    <div key={stat.label} className={`rounded-lg ${stat.color} p-4 text-center`}>
                      <div className="text-2xl font-bold">{stat.value}</div>
                      <div className="mt-1 text-xs font-medium">{stat.label}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Profiles */}
            {data.profiles && data.profiles.length > 0 && (
              <div className="rounded-xl border border-gray-200 bg-white p-6">
                <h2 className="mb-4 text-lg font-semibold">Profiles ({data.profiles.length})</h2>
                <div className="space-y-2">
                  {data.profiles.map((profile) => (
                    <div
                      key={profile.id}
                      className="flex items-center gap-3 rounded-lg border border-gray-100 p-3"
                    >
                      <div
                        className={`h-8 w-8 rounded-full bg-gradient-to-br ${profile.color} flex items-center justify-center text-xs font-bold text-white`}
                      >
                        {profile.name[0]?.toUpperCase()}
                      </div>
                      <span className="font-medium">{profile.name}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Danger Zone */}
            <div className="rounded-xl border border-red-200 bg-red-50 p-6">
              <h2 className="mb-2 text-lg font-semibold text-red-800">Danger Zone</h2>
              <p className="mb-4 text-sm text-red-600">
                This will permanently delete all stored data (job queue, profiles, templates). This
                action cannot be undone.
              </p>
              <Button
                onClick={handleClearAll}
                disabled={clearing || !data.redisConnected}
                variant="danger"
              >
                {clearing ? "Clearing..." : "Clear All Data"}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
