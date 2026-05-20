/**
 * Property Finder Egypt Scraper
 * Scrapes property listings from Property Finder Egypt
 * 
 * Schedule: Every 6 hours
 * Expected output: 200+ listings per run
 * 
 * Note: This is a demonstration/stub. Production scraper requires:
 * - Proper User-Agent rotation
 * - Rate limiting (max 10 req/min)
 * - Session management
 * - Proxy support
 */

import axios, { AxiosError } from "axios";
import * as cheerio from "cheerio";
import { getDb } from "../db";
import { supply, messages } from "../../drizzle/schema";
import { eq, and, gt } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";

export interface PropertyFinderListing {
  id: string;
  url: string;
  title: string;
  propertyType: string; // e.g., "Apartment", "Villa", "Studio"
  location: string;
  area?: string;
  city: string;
  price: number;
  currency: string; // EGP
  size?: number; // m²
  bedrooms?: number;
  bathrooms?: number;
  contact: string; // Phone number
  contactName?: string;
  description?: string;
  images?: string[];
  postedAt: Date;
  sourceUrl: string;
}

// Configuration
const BASE_URL = "https://www.propertyfinder.eg";
const HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
  Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "Accept-Language": "en-US,en;q=0.5",
  "Accept-Encoding": "gzip, deflate",
  Connection: "keep-alive",
};

/**
 * Parse a single Property Finder listing
 */
function parsePropertyFinderListing($: cheerio.CheerioAPI, listing: cheerio.Element): PropertyFinderListing | null {
  try {
    const $listing = cheerio.load(listing);
    
    // Extract key fields
    const id = $listing(".listing-id").attr("data-id") || uuidv4();
    const url = BASE_URL + ($listing("a.listing-link").attr("href") || "");
    const title = $listing("h2.listing-title").text().trim();
    const price = parseInt($listing(".listing-price").text().replace(/\D/g, ""), 10) || 0;
    const location = $listing(".listing-location").text().trim();
    const contact = $listing(".listing-contact").attr("data-phone") || "";
    const size = parseInt($listing("[data-size]").attr("data-size") || "0", 10);
    const bedrooms = parseInt($listing("[data-beds]").attr("data-beds") || "0", 10);
    const bathrooms = parseInt($listing("[data-baths]").attr("data-baths") || "0", 10);
    
    // Determine property type
    const typeText = $listing(".listing-type").text().toLowerCase();
    let propertyType = "Apartment";
    if (typeText.includes("villa")) propertyType = "Villa";
    else if (typeText.includes("studio")) propertyType = "Studio";
    else if (typeText.includes("townhouse")) propertyType = "Townhouse";
    else if (typeText.includes("duplex")) propertyType = "Duplex";
    else if (typeText.includes("penthouse")) propertyType = "Penthouse";

    if (!url || !title || !price || !location) {
      return null; // Skip incomplete listings
    }

    return {
      id,
      url,
      title,
      propertyType,
      location,
      city: "Cairo", // Default to Cairo; can be enhanced
      price,
      currency: "EGP",
      size: size > 0 ? size : undefined,
      bedrooms: bedrooms > 0 ? bedrooms : undefined,
      bathrooms: bathrooms > 0 ? bathrooms : undefined,
      contact,
      description: $listing(".listing-description").text().trim(),
      postedAt: new Date(),
      sourceUrl: url,
    };
  } catch (error) {
    console.error("[PropertyFinder] Parse error:", error);
    return null;
  }
}

/**
 * Fetch Property Finder listings
 * @param page - Page number (1-indexed)
 * @param limit - Number of pages to fetch
 */
export async function scrapePropertyFinder(
  page: number = 1,
  limit: number = 10
): Promise<PropertyFinderListing[]> {
  const listings: PropertyFinderListing[] = [];

  try {
    for (let p = page; p < page + limit; p++) {
      const url = `${BASE_URL}/en/search?page=${p}`;
      
      console.log(`[PropertyFinder] Scraping page ${p}...`);
      
      const response = await axios.get(url, {
        headers: HEADERS,
        timeout: 15000,
      });

      const $ = cheerio.load(response.data);
      const listingElements = $(".listing-card");

      if (listingElements.length === 0) {
        console.log(`[PropertyFinder] No listings on page ${p}, stopping.`);
        break;
      }

      listingElements.each((i, el) => {
        const listing = parsePropertyFinderListing($, el);
        if (listing) listings.push(listing);
      });

      // Rate limiting
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }

    console.log(`[PropertyFinder] Scraped ${listings.length} listings`);
    return listings;
  } catch (error) {
    if (error instanceof AxiosError) {
      console.error(`[PropertyFinder] Scrape error (${error.code}):`, error.message);
    } else {
      console.error("[PropertyFinder] Scrape error:", error);
    }
    throw error;
  }
}

/**
 * Insert Property Finder listings into database
 */
export async function insertPropertyFinderListings(
  listings: PropertyFinderListing[]
): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  let inserted = 0;
  const organizationId = 1; // Default organization

  for (const listing of listings) {
    try {
      // Check if listing already exists (by phone + title hash)
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
        console.log(`[PropertyFinder] Listing already exists: ${listing.id}`);
        continue;
      }

      // Create message record first
      const messageId = uuidv4();
      const messageRecord = {
        messageId,
        chatId: "property-finder-scraper",
        groupName: "Property Finder",
        sender: listing.contact,
        senderName: listing.contactName || "Property Finder User",
        messageText: listing.description || listing.title,
        classification: "supply" as const,
        language: "en" as const,
        hasImage: (listing.images?.length || 0) > 0 ? 1 : 0,
        imageUrl: listing.images?.[0],
        processed: 1,
        organizationId,
        createdAt: new Date(),
      };

      // Insert supply listing
      await db.insert(supply).values({
        propertyType: listing.propertyType,
        location: listing.location,
        area: listing.area,
        city: listing.city,
        price: BigInt(Math.round(listing.price)),
        priceUnit: "total" as const,
        size: listing.size,
        bedrooms: listing.bedrooms,
        bathrooms: listing.bathrooms,
        purpose: "sale" as const,
        contact: listing.contact,
        contactName: listing.contactName || "Property Finder Listing",
        confidence: 85, // High confidence for structured data
        sourceGroup: "Property Finder",
        nlpVersion: "scraper-v1",
        rawMessageText: `${listing.title}\n${listing.description}`,
        organizationId,
        createdAt: new Date(),
      });

      inserted++;
      console.log(`[PropertyFinder] Inserted listing: ${listing.id}`);
    } catch (error) {
      console.error(`[PropertyFinder] Insert error for ${listing.id}:`, error);
    }
  }

  return inserted;
}

/**
 * Full Property Finder scrape + import flow
 */
export async function runPropertyFinderScraper(): Promise<{
  success: boolean;
  scraped: number;
  inserted: number;
  error?: string;
}> {
  try {
    console.log("[PropertyFinder] Starting scraper...");
    
    // Scrape 5 pages (roughly 200-250 listings)
    const listings = await scrapePropertyFinder(1, 5);
    
    if (listings.length === 0) {
      return { success: false, scraped: 0, inserted: 0, error: "No listings scraped" };
    }

    // Insert into database
    const inserted = await insertPropertyFinderListings(listings);

    console.log(`[PropertyFinder] Complete: scraped=${listings.length}, inserted=${inserted}`);
    
    return {
      success: true,
      scraped: listings.length,
      inserted,
    };
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("[PropertyFinder] Scraper failed:", msg);
    return { success: false, scraped: 0, inserted: 0, error: msg };
  }
}
