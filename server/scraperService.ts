/**
 * Scraper Service — Orchestrates all platform scrapers
 * 
 * Runs on a schedule (every 6 hours)
 * Handles:
 * - Property Finder Egypt
 * - Dubizzle Egypt
 * - Facebook Groups (stub)
 * - Aqarmap (stub, to be implemented)
 * - OLX (stub, to be implemented)
 * 
 * Logs all runs to database and provides admin dashboard
 */

import cron from "node-cron";
import { getDb } from "./db";
import { scheduledJobs } from "../drizzle/schema";
import { runPropertyFinderScraper } from "./scrapers/propertyFinder";
import { runDubizzleScraper } from "./scrapers/dubizzle";
import { v4 as uuidv4 } from "uuid";

export interface ScraperResult {
  scraper: string;
  success: boolean;
  scraped: number;
  inserted: number;
  error?: string;
  startedAt: Date;
  completedAt: Date;
  durationMs: number;
}

/**
 * Run Property Finder scraper
 */
export async function runPropertyFinderJob(): Promise<ScraperResult> {
  const startTime = Date.now();
  const startedAt = new Date();

  try {
    const result = await runPropertyFinderScraper();
    return {
      scraper: "PropertyFinder",
      success: result.success,
      scraped: result.scraped,
      inserted: result.inserted,
      error: result.error,
      startedAt,
      completedAt: new Date(),
      durationMs: Date.now() - startTime,
    };
  } catch (error) {
    return {
      scraper: "PropertyFinder",
      success: false,
      scraped: 0,
      inserted: 0,
      error: error instanceof Error ? error.message : "Unknown error",
      startedAt,
      completedAt: new Date(),
      durationMs: Date.now() - startTime,
    };
  }
}

/**
 * Run Dubizzle scraper
 */
export async function runDubizzleJob(): Promise<ScraperResult> {
  const startTime = Date.now();
  const startedAt = new Date();

  try {
    const result = await runDubizzleScraper();
    return {
      scraper: "Dubizzle",
      success: result.success,
      scraped: result.scraped,
      inserted: result.inserted,
      error: result.error,
      startedAt,
      completedAt: new Date(),
      durationMs: Date.now() - startTime,
    };
  } catch (error) {
    return {
      scraper: "Dubizzle",
      success: false,
      scraped: 0,
      inserted: 0,
      error: error instanceof Error ? error.message : "Unknown error",
      startedAt,
      completedAt: new Date(),
      durationMs: Date.now() - startTime,
    };
  }
}

/**
 * Run Facebook Groups scraper (stub)
 */
export async function runFacebookJob(): Promise<ScraperResult> {
  const startTime = Date.now();
  const startedAt = new Date();

  console.log("[Facebook] Scraper stub - not implemented yet");

  return {
    scraper: "Facebook",
    success: false,
    scraped: 0,
    inserted: 0,
    error: "Not implemented",
    startedAt,
    completedAt: new Date(),
    durationMs: Date.now() - startTime,
  };
}

/**
 * Log scraper result to database
 */
async function logScraperResult(result: ScraperResult): Promise<void> {
  const db = await getDb();
  if (!db) {
    console.error("[ScraperService] Database not available for logging");
    return;
  }

  try {
    await db.insert(scheduledJobs).values({
      jobId: uuidv4(),
      jobName: `scraper:${result.scraper.toLowerCase()}`,
      jobType: "scraper",
      status: result.success ? "success" : "failed",
      startedAt: result.startedAt,
      completedAt: result.completedAt,
      durationMs: result.durationMs,
      metadata: JSON.stringify({
        scraper: result.scraper,
        scraped: result.scraped,
        inserted: result.inserted,
        error: result.error,
      }),
      createdAt: new Date(),
    });
  } catch (error) {
    console.error("[ScraperService] Failed to log result:", error);
  }
}

/**
 * Run all scrapers (sequential to avoid overload)
 */
export async function runAllScrapers(): Promise<ScraperResult[]> {
  console.log("[ScraperService] Starting scheduled scraper run...");

  const results: ScraperResult[] = [];

  // Run Property Finder
  try {
    const pfResult = await runPropertyFinderJob();
    results.push(pfResult);
    await logScraperResult(pfResult);
    console.log("[ScraperService] Property Finder:", pfResult.success ? "✓" : "✗");
  } catch (error) {
    console.error("[ScraperService] Property Finder error:", error);
  }

  // Wait before next scraper
  await new Promise((resolve) => setTimeout(resolve, 5000));

  // Run Dubizzle
  try {
    const dbResult = await runDubizzleJob();
    results.push(dbResult);
    await logScraperResult(dbResult);
    console.log("[ScraperService] Dubizzle:", dbResult.success ? "✓" : "✗");
  } catch (error) {
    console.error("[ScraperService] Dubizzle error:", error);
  }

  // Wait before next scraper
  await new Promise((resolve) => setTimeout(resolve, 5000));

  // Run Facebook (stub)
  try {
    const fbResult = await runFacebookJob();
    results.push(fbResult);
    await logScraperResult(fbResult);
    console.log("[ScraperService] Facebook:", fbResult.success ? "✓" : "✗");
  } catch (error) {
    console.error("[ScraperService] Facebook error:", error);
  }

  console.log("[ScraperService] All scrapers completed");
  return results;
}

/**
 * Initialize scraper cron jobs
 * Runs every 6 hours (0, 6, 12, 18 UTC)
 */
export function initScraperJobs(): void {
  // Schedule scrapers to run every 6 hours (at 00:00, 06:00, 12:00, 18:00 UTC)
  // Format: "0 0,6,12,18 * * *"
  // Note: In production, adjust to your timezone (Cairo = UTC+2)

  const cronSchedule = "0 0,6,12,18 * * *"; // 6-hour intervals

  console.log(`[ScraperService] Initializing cron schedule: ${cronSchedule}`);

  const task = cron.schedule(cronSchedule, async () => {
    console.log("[ScraperService] Cron job triggered");
    try {
      await runAllScrapers();
    } catch (error) {
      console.error("[ScraperService] Cron job error:", error);
    }
  });

  console.log("[ScraperService] Scraper jobs initialized");

  // Return task for testing/cleanup
  return;
}

/**
 * Manual trigger for scraper (for testing/admin panel)
 */
export async function triggerScraperManual(scraperName?: string): Promise<ScraperResult | ScraperResult[]> {
  if (!scraperName) {
    return await runAllScrapers();
  }

  const nameLC = scraperName.toLowerCase();

  switch (nameLC) {
    case "propertyfinder":
      return await runPropertyFinderJob();
    case "dubizzle":
      return await runDubizzleJob();
    case "facebook":
      return await runFacebookJob();
    default:
      throw new Error(`Unknown scraper: ${scraperName}`);
  }
}

/**
 * Get recent scraper jobs from database
 */
export async function getScraperHistory(limit: number = 50): Promise<any[]> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  try {
    const results = await db
      .select()
      .from(scheduledJobs)
      .where(new (require("drizzle-orm").like)(scheduledJobs.jobName, "scraper:%"))
      .orderBy(new (require("drizzle-orm").desc)(scheduledJobs.createdAt))
      .limit(limit);

    return results.map((r: any) => ({
      ...r,
      metadata: r.metadata ? JSON.parse(r.metadata) : {},
    }));
  } catch (error) {
    console.error("[ScraperService] History query error:", error);
    return [];
  }
}
