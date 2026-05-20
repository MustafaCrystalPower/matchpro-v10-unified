import { getDb } from "./db";
import { brokersList, scheduledJobs, demand } from "../drizzle/schema";
import { eq, and } from "drizzle-orm";

/**
 * Create or update a broker
 */
export async function createBroker(data: {
  name: string;
  phone?: string;
  email?: string;
  whatsappNumber?: string;
  preferredAreas?: string[];
  preferredTypes?: string[];
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  return await db.insert(brokersList).values([
    {
      name: data.name,
      phone: data.phone,
      email: data.email,
      whatsappNumber: data.whatsappNumber,
      preferredAreas: data.preferredAreas ? JSON.stringify(data.preferredAreas) : null,
      preferredTypes: data.preferredTypes ? JSON.stringify(data.preferredTypes) : null,
    },
  ]);
}

/**
 * Get all brokers
 */
export async function getAllBrokers() {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  return await db.select().from(brokersList).where(eq(brokersList.status, "active"));
}

/**
 * Delete broker
 */
export async function deleteBroker(brokerId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  return await db
    .update(brokersList)
    .set({ status: "inactive" })
    .where(eq(brokersList.id, brokerId));
}

/**
 * Generate demand sheet for brokers (organized by area and type)
 */
export async function generateDemandSheet(filters?: {
  area?: string;
  type?: "sale" | "rent";
  minConfidence?: number;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // Get all demand records
  let query = db.select().from(demand);

  if (filters?.area) {
    // Filter by area
  }

  if (filters?.type) {
    // Filter by type
  }

  const demands = await query.limit(1000);

  // Organize by area and type
  const organized: Record<string, Record<string, any[]>> = {};

  demands.forEach((d: any) => {
    const area = d.area || d.location || "Unknown";
    const type = d.purpose || "Unknown";

    if (!organized[area]) organized[area] = {};
    if (!organized[area][type]) organized[area][type] = [];

    organized[area][type].push({
      id: d.id,
      contactName: d.contactName,
      contact: d.contact,
      propertyType: d.propertyType,
      bedrooms: d.bedrooms,
      priceMin: d.priceMin ? parseFloat(String(d.priceMin)) : null,
      priceMax: d.priceMax ? parseFloat(String(d.priceMax)) : null,
      requirements: d.requirements,
      confidence: d.confidence ? parseFloat(String(d.confidence)) : 0,
      createdAt: d.createdAt,
    });
  });

  return organized;
}

/**
 * Schedule 6-hour demand sheet send
 */
export async function scheduledemandSheetSend(brokerId: number, brokerEmail: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const nextRun = new Date(Date.now() + 6 * 60 * 60 * 1000); // 6 hours from now

  return await db.insert(scheduledJobs).values([
    {
      jobType: "broker_demand_sheet",
      status: "pending",
      frequency: "every 6 hours",
      recipientId: brokerId,
      recipientEmail: brokerEmail,
      nextRun,
    },
  ]);
}

/**
 * Get scheduled jobs for a broker
 */
export async function getScheduledJobs(brokerId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  return await db
    .select()
    .from(scheduledJobs)
    .where(
      and(
        eq(scheduledJobs.recipientId, brokerId),
        eq(scheduledJobs.jobType, "broker_demand_sheet")
      )
    );
}

/**
 * Update job status
 */
export async function updateJobStatus(
  jobId: number,
  status: "pending" | "running" | "completed" | "failed",
  errorMessage?: string
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  return await db
    .update(scheduledJobs)
    .set({
      status,
      lastRun: new Date(),
      errorMessage: errorMessage || null,
    })
    .where(eq(scheduledJobs.id, jobId));
}
