/**
 * Dubizzle Egypt Scraper
 * Scrapes property listings from Dubizzle Egypt
 * 
 * Schedule: Every 6 hours
 * Expected output: 150+ listings per run
 * 
 * Note: This is a demonstration/stub. Production scraper requires:
 * - Proper User-Agent rotation
 * - Rate limiting (max 5 req/min)
 * - Session management
 * - Cloudflare bypass (if protected)
 */

import axios from "axios";
import * as cheerio from "cheerio";
import { getDb } from "../db";
import { supply } from "../../drizzle/schema";
import { and, eq } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";

export interface DubizzleListing {
  id: string;
  url: string;
  title: string;
  propertyType: string;
  location: string;
  city: string;
  price: number;
  currency: string; // EGP
  size?: number;
  bedrooms?: number;
  bathrooms?: number;
  contact: string;
  contactName?: string;
  description?: string;
  postedAt: Date;
  sourceUrl: string;
}

const BASE_URL = "https://www.dubizzle.com.eg/en/property/apartments-for-sale";
const HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
  Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "Accept-Language": "en-US,en;q=0.5",
  Connection: "keep-alive",
};

/**
 * Parse a single Dubizzle listing
 */
function parseDubizzleListing($: cheerio.CheerioAPI, listing: cheerio.Element): DubizzleListing | null {
  try {
    const $listing = cheerio.load(listing);

    const id = $listing(".item-id").attr("data-id") || uuidv4();
    const url = $listing("a.item-link").attr("href") || "";
    const title = $listing(".item-title").text().trim();
    const priceText = $listing(".item-price").text().trim();
    const price = parseInt(priceText.replace(/\D/g, ""), 10) || 0;
    const location = $listing(".item-location").text().trim();
    const contact = $listing("[data-phone]").attr("data-phone") || "";
    const size = parseInt($listing("[data-size]").attr("data-size") || "0", 10);
    const bedrooms = parseInt($listing("[data-bedrooms]").attr("data-bedrooms") || "0", 10);
    const bathrooms = parseInt($listing("[data-bathrooms]").attr("data-bathrooms") || "0", 10);

    if (!url || !title || !price || !location) {
      return null;
    }

    return {
      id,
      url: url.startsWith("http") ? url : `https://www.dubizzle.com.eg${url}`,
      title,
      propertyType: "Apartment", // Dubizzle can have mixed types
      location,
      city: "Cairo",
      price,
      currency: "EGP",
      size: size > 0 ? size : undefined,
      bedrooms: bedrooms > 0 ? bedrooms : undefined,
      bathrooms: bathrooms > 0 ? bathrooms : undefined,
      contact,
      description: $listing(".item-description").text().trim(),
      postedAt: new Date(),
      sourceUrl: url.startsWith("http") ? url : `https://www.dubizzle.com.eg${url}`,
    };
  } catch (error) {
    console.error("[Dubizzle] Parse error:", error);
    return null;
  }
}

/**
 * Fetch Dubizzle listings
 * @param page - Page number (1-indexed)
 * @param limit - Number of pages to fetch
 */
export async function scrapeDubizzle(page: number = 1, limit: number = 10): Promise<DubizzleListing[]> {
  const listings: DubizzleListing[] = [];

  try {
    for (let p = page; p < page + limit; p++) {
      const url = `${BASE_URL}?page=${p}`;

      console.log(`[Dubizzle] Scraping page ${p}...`);

      const response = await axios.get(url, {
        headers: HEADERS,
        timeout: 15000,
      });

      const $ = cheerio.load(response.data);
      const listingElements = $(".item-card");

      if (listingElements.length === 0) {
        console.log(`[Dubizzle] No listings on page ${p}, stopping.`);
        break;
      }

      listingElements.each((i, el) => {
        const listing = parseDubizzleListing($, el);
        if (listing) listings.push(listing);
      });

      // Rate limiting
      await new Promise((resolve) => setTimeout(resolve, 2500));
    }

    console.log(`[Dubizzle] Scraped ${listings.length} listings`);
    return listings;
  } catch (error) {
    console.error("[Dubizzle] Scrape error:", error instanceof Error ? error.message : error);
    throw error;
  }
}

/**
 * Insert Dubizzle listings into database
 */
export async function insertDubizzleListings(listings: DubizzleListing[]): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  let inserted = 0;
  const organizationId = 1;

  for (const listing of listings) {
    try {
      // Check if listing already exists
      const existing = await db
        .select()
        .from(supply)
        .where(
          and(
            eq(supply.contact, listing.contact),
            eq(supply.propertyType, listing.propertyType)
          )
        )
        .limit(1);

      if (existing.length > 0) {
        console.log(`[Dubizzle] Listing already exists: ${listing.id}`);
        continue;
      }

      // Insert supply listing
      await db.insert(supply).values({
        propertyType: listing.propertyType,
        location: listing.location,
        city: listing.city,
        price: BigInt(Math.round(listing.price)),
        priceUnit: "total" as const,
        size: listing.size,
        bedrooms: listing.bedrooms,
        bathrooms: listing.bathrooms,
        purpose: "sale" as const,
        contact: listing.contact,
        contactName: listing.contactName || "Dubizzle Listing",
        confidence: 80, // Slightly lower than Property Finder
        sourceGroup: "Dubizzle",
        nlpVersion: "scraper-v1",
        rawMessageText: `${listing.title}\n${listing.description}`,
        organizationId,
        createdAt: new Date(),
      });

      inserted++;
      console.log(`[Dubizzle] Inserted listing: ${listing.id}`);
    } catch (error) {
      console.error(`[Dubizzle] Insert error for ${listing.id}:`, error);
    }
  }

  return inserted;
}

/**
 * Full Dubizzle scrape + import flow
 */
export async function runDubizzleScraper(): Promise<{
  success: boolean;
  scraped: number;
  inserted: number;
  error?: string;
}> {
  try {
    console.log("[Dubizzle] Starting scraper...");

    // Scrape 4 pages (roughly 150+ listings)
    const listings = await scrapeDubizzle(1, 4);

    if (listings.length === 0) {
      return { success: false, scraped: 0, inserted: 0, error: "No listings scraped" };
    }

    // Insert into database
    const inserted = await insertDubizzleListings(listings);

    console.log(`[Dubizzle] Complete: scraped=${listings.length}, inserted=${inserted}`);

    return {
      success: true,
      scraped: listings.length,
      inserted,
    };
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("[Dubizzle] Scraper failed:", msg);
    return { success: false, scraped: 0, inserted: 0, error: msg };
  }
}
