import { describe, it, expect } from "bun:test";

// Pure function mirroring QueueProgress component's calculation logic
function calcProgress(
  total: number,
  completed: number,
  failed: number,
  pending: number,
  cancelled: number,
) {
  const inProgress = total - completed - failed - pending - cancelled;
  return {
    inProgress,
    completedWidth: total > 0 ? (completed / total) * 100 : 0,
    failedWidth: total > 0 ? (failed / total) * 100 : 0,
    inProgressWidth: total > 0 ? (inProgress / total) * 100 : 0,
    pendingWidth: total > 0 ? (pending / total) * 100 : 0,
  };
}

describe("QueueProgress calculation", () => {
  // Bug #4: cancelled jobs must not inflate "in progress" count
  it("should exclude cancelled from inProgress (bug #4)", () => {
    // 10 total: 3 completed, 1 failed, 2 pending, 4 cancelled
    const r = calcProgress(10, 3, 1, 2, 4);
    expect(r.inProgress).toBe(0);
    expect(r.inProgressWidth).toBe(0);
  });

  it("should calculate correctly with mixed statuses", () => {
    const r = calcProgress(10, 4, 2, 1, 1);
    expect(r.inProgress).toBe(2); // 10 - 4 - 2 - 1 - 1 = 2
    expect(r.completedWidth).toBe(40);
    expect(r.failedWidth).toBe(20);
    expect(r.inProgressWidth).toBe(20);
  });

  it("should return zero widths when total is zero", () => {
    const r = calcProgress(0, 0, 0, 0, 0);
    expect(r.inProgress).toBe(0);
    expect(r.completedWidth).toBe(0);
    expect(r.failedWidth).toBe(0);
    expect(r.inProgressWidth).toBe(0);
  });

  it("should have only completed when all done", () => {
    const r = calcProgress(5, 5, 0, 0, 0);
    expect(r.inProgress).toBe(0);
    expect(r.completedWidth).toBe(100);
    expect(r.failedWidth).toBe(0);
  });

  it("should handle mix including inProgress jobs", () => {
    const r = calcProgress(8, 2, 1, 3, 1);
    expect(r.inProgress).toBe(1); // 8 - 2 - 1 - 3 - 1 = 1
    expect(r.completedWidth).toBe(25);
    expect(r.failedWidth).toBe(12.5);
    expect(r.inProgressWidth).toBe(12.5);
    expect(r.pendingWidth).toBe(37.5);
  });
});
