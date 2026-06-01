// ========================================
// COMPREHENSIVE TEST SUITE — Config Module
// ========================================

import { describe, it, expect } from "bun:test";
import { config } from "./config";

describe("config", () => {
  it("should have default chunkSize", () => {
    expect(config.chunkSize).toBe(200);
  });

  it("should have default scrape interval", () => {
    expect(config.scrapeIntervalMinutes).toBe(30);
  });

  it("should parse targetRoles into array", () => {
    expect(Array.isArray(config.targetRoles)).toBe(true);
    expect(config.targetRoles.length).toBeGreaterThan(0);
  });

  it("should parse excludedKeywords into array", () => {
    expect(Array.isArray(config.excludedKeywords)).toBe(true);
    expect(config.excludedKeywords.length).toBeGreaterThan(0);
  });

  it("should have default AWS region", () => {
    expect(config.awsRegion).toBe("us-west-2");
  });
});
