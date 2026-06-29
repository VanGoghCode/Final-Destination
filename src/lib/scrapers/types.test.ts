// ========================================
// COMPREHENSIVE TEST SUITE — Scraper Types
// ========================================

import { describe, it, expect } from "bun:test";
import { filterJobs, getTargetRoles, getExcludedKeywords } from "./types";
import type { Job } from "./types";

function makeJob(overrides: Partial<Job> = {}): Job {
  return {
    id: "test-1",
    companyId: "ACME",
    companyName: "Acme Corp",
    title: "Software Engineer",
    location: "Remote",
    url: "https://example.com/job/1",
    scrapedAt: new Date().toISOString(),
    platform: "greenhouse",
    ...overrides,
  };
}

describe("filterJobs", () => {
  const roles = ["software engineer", "backend", "devops"];
  const excluded = ["director", "senior director"];

  it("should include jobs matching target roles", () => {
    const jobs = [makeJob({ title: "Senior Software Engineer" })];
    const filtered = filterJobs(jobs, roles, excluded);
    expect(filtered.length).toBe(1);
  });

  it("should exclude jobs with excluded keywords", () => {
    const jobs = [makeJob({ title: "Director of Software Engineering" })];
    const filtered = filterJobs(jobs, roles, excluded);
    expect(filtered.length).toBe(0);
  });

  it("should handle case-insensitive matching", () => {
    const jobs = [makeJob({ title: "DEVOPS ENGINEER" })];
    const filtered = filterJobs(jobs, roles, excluded);
    expect(filtered.length).toBe(1);
  });

  it("should exclude jobs that don't match any role", () => {
    const jobs = [makeJob({ title: "Sales Manager" })];
    const filtered = filterJobs(jobs, roles, excluded);
    expect(filtered.length).toBe(0);
  });

  it("should handle empty arrays", () => {
    expect(filterJobs([], roles, excluded)).toEqual([]);
  });
});

describe("getTargetRoles", () => {
  it("should return defaults when env is not set", () => {
    const roles = getTargetRoles();
    expect(roles.length).toBeGreaterThan(0);
    expect(roles).toContain("software engineer");
    expect(roles).toContain("devops");
  });
});

describe("getExcludedKeywords", () => {
  it("should return defaults when env is not set", () => {
    const keywords = getExcludedKeywords();
    expect(keywords.length).toBeGreaterThan(0);
    expect(keywords).toContain("senior director");
    expect(keywords).toContain("director of");
    expect(keywords).toContain("sales");
  });
});
