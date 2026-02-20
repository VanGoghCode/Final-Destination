"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Button from "@/components/Button";

interface UserData {
  passcode: string;
  names?: string[];
  keyCount: number;
  keys: string[];
}

export default function AdminDashboard() {
  const router = useRouter();
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [users, setUsers] = useState<UserData[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState<string | null>(null);

  useEffect(() => {
    // Check authorization
    const code = localStorage.getItem("code");
    if (code !== "26012002") {
      router.replace("/");
      return;
    }

    setIsAuthorized(true);
    fetchUsers();
  }, [router]);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/admin/users");
      if (!res.ok) throw new Error("Failed to fetch");
      const data = await res.json();
      setUsers(data.users || []);
    } catch (err) {
      console.error("Error fetching users:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (passcode: string) => {
    if (
      !window.confirm(
        `Are you sure you want to delete ALL data for user ${passcode}?`,
      )
    ) {
      return;
    }

    try {
      setDeleting(passcode);
      const res = await fetch("/api/admin/users", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ passcode }),
      });

      if (!res.ok) throw new Error("Failed to delete user");

      const data = await res.json();
      alert(data.message || "User data deleted successfully");

      // Refresh list
      fetchUsers();
    } catch (err) {
      console.error("Error deleting user:", err);
      alert("Failed to delete user. Please try again.");
    } finally {
      setDeleting(null);
    }
  };

  if (!isAuthorized) {
    return null; // Will redirect in useEffect
  }

  return (
    <div className="min-h-screen bg-transparent flex flex-col items-center py-12 px-4 sm:px-6 lg:px-8 w-full max-w-5xl mx-auto">
      <div className="w-full space-y-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl gradient-text">
              Admin Users
            </h1>
            <p className="mt-2 text-sm text-gray-500">
              Manage user data across the application.
            </p>
          </div>
          <Button onClick={fetchUsers} variant="secondary">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="mr-2"
            >
              <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"></path>
              <path d="M3 3v5h5"></path>
              <path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16"></path>
              <path d="M16 21v-5h5"></path>
            </svg>
            Refresh
          </Button>
        </div>

        <div className="glass-card overflow-hidden">
          <div className="px-6 py-5 border-b border-gray-100 flex items-center justify-between bg-white/50">
            <h3 className="text-lg leading-6 font-medium text-gray-900">
              Active Users
            </h3>
            <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-gray-100 text-gray-800 border border-gray-200">
              {users.length} Total Users
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50/50">
                <tr>
                  <th
                    scope="col"
                    className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider"
                  >
                    Passcode
                  </th>
                  <th
                    scope="col"
                    className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider"
                  >
                    Data Stats
                  </th>
                  <th
                    scope="col"
                    className="px-6 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider"
                  >
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-transparent divide-y divide-gray-100">
                {loading ? (
                  <tr>
                    <td
                      colSpan={3}
                      className="px-6 py-12 text-center text-sm text-gray-500"
                    >
                      <div className="flex justify-center flex-col items-center space-y-4">
                        <div className="spinner-large"></div>
                        <span className="font-medium text-gray-600">
                          Loading users data...
                        </span>
                      </div>
                    </td>
                  </tr>
                ) : users.length === 0 ? (
                  <tr>
                    <td
                      colSpan={3}
                      className="px-6 py-12 text-center text-sm text-gray-500"
                    >
                      <div className="flex justify-center flex-col items-center space-y-2">
                        <svg
                          className="h-8 w-8 text-gray-400"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth="1.5"
                            d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"
                          />
                        </svg>
                        <span className="font-medium text-gray-600">
                          No active users found.
                        </span>
                      </div>
                    </td>
                  </tr>
                ) : (
                  users.map((user) => (
                    <tr
                      key={user.passcode}
                      className="hover:bg-white/40 transition-colors"
                    >
                      <td className="px-6 py-5 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className="h-10 w-10 shrink-0 bg-primary rounded-xl flex items-center justify-center text-white shadow-sm font-bold text-sm border border-black/10">
                            {user.passcode.substring(0, 2).toUpperCase()}
                          </div>
                          <div className="ml-4">
                            <div className="text-sm font-bold text-gray-900 font-mono tracking-wide">
                              {user.passcode}
                            </div>
                            <div className="text-xs text-gray-500 mt-0.5 font-medium flex flex-col gap-0.5">
                              <span>User ID</span>
                              {user.names && user.names.length > 0 && (
                                <span className="text-gray-400">
                                  Profiles: {user.names.join(", ")}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-5">
                        <div className="flex flex-col gap-2">
                          <div>
                            <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-100">
                              {user.keyCount} Storage Keys
                            </span>
                          </div>
                          <div className="text-xs text-gray-500 max-w-sm flex flex-wrap gap-1">
                            {user.keys.length > 0
                              ? Array.from(
                                  new Set(
                                    user.keys.map((k) => k.split(":")[0]),
                                  ),
                                ).map((type) => (
                                  <span
                                    key={type}
                                    className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-gray-100 text-gray-600 border border-gray-200"
                                  >
                                    {type}
                                  </span>
                                ))
                              : "No specific data"}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-5 whitespace-nowrap text-right text-sm font-medium">
                        <Button
                          variant="danger"
                          onClick={() => handleDelete(user.passcode)}
                          disabled={deleting === user.passcode}
                          className="!px-3 !py-2 !text-xs"
                        >
                          {deleting === user.passcode ? (
                            <>
                              <div className="spinner-small mr-2 border-t-white"></div>
                              Deleting...
                            </>
                          ) : (
                            <>
                              <svg
                                xmlns="http://www.w3.org/2000/svg"
                                width="14"
                                height="14"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                className="mr-1.5"
                              >
                                <path d="M3 6h18"></path>
                                <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"></path>
                                <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path>
                                <line x1="10" y1="11" x2="10" y2="17"></line>
                                <line x1="14" y1="11" x2="14" y2="17"></line>
                              </svg>
                              Delete User
                            </>
                          )}
                        </Button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
