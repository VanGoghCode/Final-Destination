"use client";

import { useState, useEffect, useMemo } from "react";

interface Job {
  id: string;
  companyId: string;
  companyName: string;
  title: string;
  location: string;
  department?: string;
  url: string;
  postedAt?: string;
  scrapedAt: string;
  platform: string;
}

interface JobsData {
  lastScraped: string | null;
  totalJobs: number;
  jobs: Job[];
}

const PLATFORM_COLORS: Record<string, string> = {
  greenhouse: "bg-green-100 text-green-800 border-green-300",
  lever: "bg-purple-100 text-purple-800 border-purple-300",
  workday: "bg-blue-100 text-blue-800 border-blue-300",
  ashby: "bg-pink-100 text-pink-800 border-pink-300",
  custom: "bg-gray-100 text-gray-700 border-gray-300",
};

export default function JobListingsPage() {
  const [data, setData] = useState<JobsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [scraping, setScraping] = useState(false);
  const [selectedCompany, setSelectedCompany] = useState<string | null>(null);

  const fetchJobs = () => {
    setLoading(true);
    fetch("/api/jobs?limit=10000")
      .then((res) => res.json())
      .then((json) => {
        setData(json);
        setLoading(false);
      })
      .catch((err) => {
        console.error("Failed to load jobs:", err);
        setLoading(false);
      });
  };

  useEffect(() => {
    fetchJobs();
  }, []);

  const triggerScrape = async () => {
    setScraping(true);
    try {
      const res = await fetch("/api/jobs", { method: "POST" });
      const result = await res.json();
      if (result.success) {
        fetchJobs();
      }
    } catch (err) {
      console.error("Scraping failed:", err);
    }
    setScraping(false);
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return "Unknown";
    const date = new Date(dateStr);
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const isFresh = (dateStr?: string) => {
    if (!dateStr) return false;
    const date = new Date(dateStr);
    const oneDayAgo = new Date();
    oneDayAgo.setHours(oneDayAgo.getHours() - 24);
    return date >= oneDayAgo;
  };

  // Group jobs by company
  const companyStats = useMemo(() => {
    if (!data?.jobs) return [];

    const stats = new Map<
      string,
      {
        name: string;
        totalJobs: number;
        freshJobs: number;
        latestJobDate: string | null;
        platform: string;
      }
    >();

    data.jobs.forEach((job) => {
      const current = stats.get(job.companyName) || {
        name: job.companyName,
        totalJobs: 0,
        freshJobs: 0,
        latestJobDate: null,
        platform: job.platform,
      };

      current.totalJobs += 1;
      if (isFresh(job.postedAt)) {
        current.freshJobs += 1;
      }

      if (
        job.postedAt &&
        (!current.latestJobDate ||
          new Date(job.postedAt) > new Date(current.latestJobDate))
      ) {
        current.latestJobDate = job.postedAt;
      }

      stats.set(job.companyName, current);
    });

    return Array.from(stats.values()).sort((a, b) => {
      // Sort by fresh jobs count (desc), then total jobs (desc)
      if (b.freshJobs !== a.freshJobs) return b.freshJobs - a.freshJobs;
      return b.totalJobs - a.totalJobs;
    });
  }, [data]);

  // Filter jobs for selected company
  const companyJobs = useMemo(() => {
    if (!data?.jobs || !selectedCompany) return [];

    const jobs = data.jobs.filter((j) => j.companyName === selectedCompany);

    return jobs.sort((a, b) => {
      if (!a.postedAt) return 1;
      if (!b.postedAt) return -1;
      return new Date(b.postedAt).getTime() - new Date(a.postedAt).getTime();
    });
  }, [data, selectedCompany]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="spinner-large mx-auto mb-4"></div>
          <p className="text-muted">Loading jobs...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen py-6 lg:py-8">
      <div className="responsive-container">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl lg:text-3xl font-bold gradient-text mb-2">
              Job Listings
            </h1>
            <p className="text-muted text-sm">
              {selectedCompany ? (
                <>
                  Viewing jobs for{" "}
                  <span className="font-semibold text-gray-900">
                    {selectedCompany}
                  </span>
                </>
              ) : (
                <>
                  {data?.totalJobs || 0} jobs across {companyStats.length}{" "}
                  companies
                </>
              )}
              {data?.lastScraped && (
                <span className="ml-2">
                  (Last updated: {formatDate(data.lastScraped)})
                </span>
              )}
            </p>
          </div>
          <div className="flex items-center gap-3">
            {selectedCompany && (
              <button
                onClick={() => setSelectedCompany(null)}
                className="px-4 py-2 rounded-lg bg-gray-100 hover:bg-gray-200 text-sm font-medium transition-colors"
              >
                ← Back to Companies
              </button>
            )}
            <button
              onClick={triggerScrape}
              disabled={scraping}
              className="btn-primary flex items-center gap-2"
            >
              {scraping ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  Scraping...
                </>
              ) : (
                <>
                  <svg
                    className="w-5 h-5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                    />
                  </svg>
                  Refresh Jobs
                </>
              )}
            </button>
          </div>
        </div>

        {selectedCompany ? (
          /* Company Detail View */
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold">
                Available Openings
                <span className="ml-2 text-sm text-gray-500 font-normal">
                  ({companyJobs.length})
                </span>
              </h2>
            </div>

            {companyJobs.length > 0 ? (
              <div className="space-y-3">
                {companyJobs.map((job) => (
                  <a
                    key={job.id}
                    href={job.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="glass-card p-4 lg:p-5 block hover:shadow-lg transition-all group border-l-4 border-l-transparent hover:border-l-primary"
                  >
                    <div className="flex flex-col md:flex-row md:items-center gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-semibold text-lg group-hover:text-primary transition-colors truncate">
                            {job.title}
                          </h3>
                          {isFresh(job.postedAt) && (
                            <span className="px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 text-xs font-semibold">
                              New
                            </span>
                          )}
                        </div>
                        <div className="flex flex-wrap items-center gap-2 text-sm text-muted">
                          <span className="font-medium text-gray-700">
                            {job.companyName}
                          </span>
                          <span>•</span>
                          <span>{job.location}</span>
                          {job.department && (
                            <>
                              <span>•</span>
                              <span>{job.department}</span>
                            </>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        <span
                          className={`text-xs px-2 py-1 rounded-full border ${PLATFORM_COLORS[job.platform] || PLATFORM_COLORS.custom}`}
                        >
                          {job.platform}
                        </span>
                        <div className="text-right">
                          <div className="text-sm font-medium text-gray-900">
                            {formatDate(job.postedAt)}
                          </div>
                          <div className="text-xs text-muted">Posted</div>
                        </div>
                      </div>
                    </div>
                  </a>
                ))}
              </div>
            ) : (
              <div className="text-center py-12 glass-card">
                <p className="text-lg text-gray-500">
                  No jobs found for this filter.
                </p>
              </div>
            )}
          </div>
        ) : (
          /* Companies Grid View */
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {companyStats.map((stat) => (
              <button
                key={stat.name}
                onClick={() => setSelectedCompany(stat.name)}
                className="glass-card p-5 text-left hover:shadow-lg transition-all group flex flex-col justify-between h-full relative overflow-hidden"
              >
                <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                  <svg
                    className="w-24 h-24 text-primary"
                    fill="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2zm0 2v12h16V6H4zm2 2h12v2H6V8zm0 4h12v2H6v-2zm0 4h12v2H6v-2z" />
                  </svg>
                </div>

                <div>
                  <div className="flex items-start justify-between mb-2">
                    <h3 className="text-xl font-bold group-hover:text-primary transition-colors">
                      {stat.name}
                    </h3>
                    <span
                      className={`text-xs px-2 py-1 rounded-full border ${PLATFORM_COLORS[stat.platform] || PLATFORM_COLORS.custom}`}
                    >
                      {stat.platform}
                    </span>
                  </div>
                  <div className="text-sm text-muted mb-4">
                    Last active: {formatDate(stat.latestJobDate || undefined)}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 mt-auto">
                  <div className="p-3 rounded-lg bg-gray-50">
                    <div className="text-xl font-bold text-gray-900">
                      {stat.freshJobs}
                    </div>
                    <div className="text-xs font-semibold text-blue-600">
                      New (24h)
                    </div>
                  </div>
                  <div className="p-3 rounded-lg bg-gray-50">
                    <div className="text-xl font-bold text-gray-900">
                      {stat.totalJobs}
                    </div>
                    <div className="text-xs text-gray-500">Total Jobs</div>
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
