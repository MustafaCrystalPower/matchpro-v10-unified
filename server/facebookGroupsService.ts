/**
 * Facebook Groups Ingestion Service
 * Fetches posts from real estate groups, classifies them, and merges into leads database
 */

import { invokeLLM } from './_core/llm';
import { getDb } from './db';
import { detectBroker } from './brokerDetection';

interface FacebookPost {
  id: string;
  message: string;
  created_time: string;
  from: {
    name: string;
    id: string;
  };
  permalink_url?: string;
}

interface ClassifiedPost {
  category: 'supply' | 'demand' | 'other';
  client_type: 'broker/agency' | 'end_client' | 'unclear';
  intent: string;
  is_about_data_or_leads: boolean;
  locations: string[];
  signals: string[];
  confidence_category: number;
  confidence_client_type: number;
}

/**
 * Classify a Facebook post using the provided prompt
 */
export async function classifyFacebookPost(post: FacebookPost): Promise<ClassifiedPost> {
  const prompt = `You are an AI assistant classifying posts from a Facebook group called:
"The Society Of Real Estate In Egypt ⚡ Official Group".

This group is focused on real estate in Egypt and the region (buying, selling, renting, and lead/data trading).

### Task

Given a single post (Arabic or English), analyze it and return a **single JSON object** with:

- "category": one of ["supply", "demand", "other"]
  - "supply": the author is offering properties or services.
  - "demand": the author wants to buy/rent a property, or wants to buy real estate data/leads.
  - "other": anything else (general discussion, questions, announcements not directly related to leads or properties).

- "client_type": one of ["broker/agency", "end_client", "unclear"]
  - "broker/agency": real estate company, broker office, sales team, etc.
  - "end_client": an individual buyer/tenant/property owner seeking a property or selling their own.
  - "unclear": cannot decide.

- "intent": short natural-language description (1–2 sentences) of what the author wants.

- "is_about_data_or_leads": true/false  
  (true if the post is about buying/selling "data", "leads", or "clients" rather than properties.)

- "locations": array of strings for any cities/areas mentioned (e.g. ["Dubai", "Cairo", "New Cairo"]).

- "signals": list of short clues that support your decision
  (e.g. ["mentions 'company'", "has 120 sales staff", "asks to buy data"]).

- "confidence_category": float between 0 and 1.
- "confidence_client_type": float between 0 and 1.

### Post

${post.message}

### Output format

Respond with **only** a JSON object, no extra text.`;

  try {
    const response = await invokeLLM({
      messages: [
        {
          role: 'user' as const,
          content: prompt as string,
        },
      ],
    });

    const content = (response.choices[0]?.message?.content || '{}') as string;
    const classified = JSON.parse(content) as ClassifiedPost;
    return classified;
  } catch (error) {
    console.error('[classifyFacebookPost] Error:', error);
    // Return default classification on error
    return {
      category: 'other',
      client_type: 'unclear',
      intent: 'Unable to classify',
      is_about_data_or_leads: false,
      locations: [],
      signals: ['classification error'],
      confidence_category: 0,
      confidence_client_type: 0,
    };
  }
}

/**
 * Fetch posts from a Facebook group
 */
export async function fetchFacebookGroupPosts(
  groupId: string,
  accessToken: string,
  limit: number = 100
): Promise<FacebookPost[]> {
  try {
    const url = `https://graph.facebook.com/v18.0/${groupId}/feed?access_token=${accessToken}&limit=${limit}&fields=id,message,created_time,from,permalink_url`;

    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Facebook API error: ${response.statusText}`);
    }

    const data = (await response.json()) as { data: FacebookPost[] };
    return data.data || [];
  } catch (error) {
    console.error('[fetchFacebookGroupPosts] Error:', error);
    return [];
  }
}

/**
 * Normalize Facebook post to lead record
 */
function normalizeFacebookPostToLead(post: FacebookPost, classified: ClassifiedPost) {
  if (classified.category === 'other') {
    return null; // Skip non-relevant posts
  }

  const brokerDetection = detectBroker({
    message: post.message,
    contactName: post.from.name,
  });

  return {
    title: classified.intent.substring(0, 100),
    message: post.message,
    contact: post.from.id,
    contactName: post.from.name,
    location: classified.locations.join(', ') || 'Unknown',
    propertyType: extractPropertyType(post.message),
    price: extractPrice(post.message),
    bedrooms: extractBedrooms(post.message),
    bathrooms: extractBathrooms(post.message),
    size: extractSize(post.message),
    source: 'facebook_group',
    sourceGroupId: post.id,
    sourceUrl: post.permalink_url,
    category: classified.category,
    clientType: classified.client_type,
    isAboutDataOrLeads: classified.is_about_data_or_leads,
    signals: classified.signals.join('; '),
    confidenceCategory: classified.confidence_category,
    confidenceClientType: classified.confidence_client_type,
    brokerScore: brokerDetection.brokerScore,
    isBroker: brokerDetection.isBroker,
    createdAt: new Date(post.created_time),
    fetchedAt: new Date(),
  };
}

/**
 * Ingest Facebook posts into leads database
 */
export async function ingestFacebookGroupPosts(
  groupId: string,
  accessToken: string,
  config?: { excludeBrokers?: boolean; minConfidence?: number }
): Promise<number> {
  const db = await getDb();
  if (!db) return 0;

  try {
    // Fetch posts
    const posts = await fetchFacebookGroupPosts(groupId, accessToken);
    if (posts.length === 0) {
      console.log('[ingestFacebookGroupPosts] No posts fetched');
      return 0;
    }

    let ingestedCount = 0;

    // Classify and ingest each post
    for (const post of posts) {
      try {
        const classified = await classifyFacebookPost(post);
        const normalizedLead = normalizeFacebookPostToLead(post, classified);

        if (!normalizedLead) continue;

        // Apply filters
        if (config?.excludeBrokers && normalizedLead.isBroker) continue;
        if (config?.minConfidence) {
          const avgConfidence = (normalizedLead.confidenceCategory + normalizedLead.confidenceClientType) / 2;
          if (avgConfidence < config.minConfidence) continue;
        }

        // Determine if supply or demand
        const table = classified.category === 'supply' ? 'supply' : 'demand';

        // Check for duplicates (by source URL)
        const [existing] = await (db as any).$client.promise().execute(
          `SELECT id FROM ${table} WHERE sourceUrl = ?`,
          [normalizedLead.sourceUrl]
        );

        if ((existing as any[]).length > 0) {
          console.log(`[ingestFacebookGroupPosts] Duplicate post skipped: ${normalizedLead.sourceUrl}`);
          continue;
        }

        // Insert into database
        await (db as any).$client.promise().execute(
          `INSERT INTO ${table} (
            title, message, contact, contactName, location, propertyType, 
            price, bedrooms, bathrooms, size, source, sourceGroupId, sourceUrl,
            clientType, isAboutDataOrLeads, signals, confidenceScore, brokerScore, isBroker,
            createdAt, fetchedAt
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            normalizedLead.title,
            normalizedLead.message,
            normalizedLead.contact,
            normalizedLead.contactName,
            normalizedLead.location,
            normalizedLead.propertyType,
            normalizedLead.price,
            normalizedLead.bedrooms,
            normalizedLead.bathrooms,
            normalizedLead.size,
            normalizedLead.source,
            normalizedLead.sourceGroupId,
            normalizedLead.sourceUrl,
            normalizedLead.clientType,
            normalizedLead.isAboutDataOrLeads ? 1 : 0,
            normalizedLead.signals,
            Math.round((normalizedLead.confidenceCategory + normalizedLead.confidenceClientType) / 2 * 100),
            normalizedLead.brokerScore,
            normalizedLead.isBroker ? 1 : 0,
            normalizedLead.createdAt,
            normalizedLead.fetchedAt,
          ]
        );

        ingestedCount++;
        console.log(`[ingestFacebookGroupPosts] Ingested: ${normalizedLead.title}`);
      } catch (error) {
        console.error(`[ingestFacebookGroupPosts] Error processing post ${post.id}:`, error);
        continue;
      }
    }

    console.log(`[ingestFacebookGroupPosts] Completed: ${ingestedCount} posts ingested`);
    return ingestedCount;
  } catch (error) {
    console.error('[ingestFacebookGroupPosts] Error:', error);
    return 0;
  }
}

/**
 * Extract property type from message
 */
function extractPropertyType(message: string): string {
  const types = ['apartment', 'villa', 'townhouse', 'commercial', 'land', 'studio', 'penthouse'];
  const lowerMessage = message.toLowerCase();

  for (const type of types) {
    if (lowerMessage.includes(type)) return type;
  }

  // Arabic property types
  if (lowerMessage.includes('شقة')) return 'apartment';
  if (lowerMessage.includes('فيلا')) return 'villa';
  if (lowerMessage.includes('عمارة')) return 'building';
  if (lowerMessage.includes('أرض')) return 'land';
  if (lowerMessage.includes('محل')) return 'commercial';

  return 'property';
}

/**
 * Extract price from message
 */
function extractPrice(message: string): number | null {
  const priceMatch = message.match(/(\d+(?:,\d{3})*(?:\.\d{2})?)\s*(ج\.م|egp|pounds|LE|£)?/i);
  if (priceMatch) {
    const priceStr = priceMatch[1].replace(/,/g, '');
    return parseInt(priceStr);
  }
  return null;
}

/**
 * Extract bedrooms from message
 */
function extractBedrooms(message: string): number | null {
  const match = message.match(/(\d+)\s*(?:bed|br|bedroom|غرفة|نوم)/i);
  return match ? parseInt(match[1]) : null;
}

/**
 * Extract bathrooms from message
 */
function extractBathrooms(message: string): number | null {
  const match = message.match(/(\d+)\s*(?:bath|bathroom|حمام)/i);
  return match ? parseInt(match[1]) : null;
}

/**
 * Extract size from message
 */
function extractSize(message: string): number | null {
  const match = message.match(/(\d+)\s*(?:m2|sqm|متر|م2)/i);
  return match ? parseInt(match[1]) : null;
}

/**
 * Schedule periodic Facebook group ingestion
 */
export function scheduleFacebookGroupIngestion(
  groupId: string,
  accessToken: string,
  intervalHours: number = 6
): void {
  // Run immediately
  ingestFacebookGroupPosts(groupId, accessToken);

  // Schedule recurring ingestion
  setInterval(() => {
    ingestFacebookGroupPosts(groupId, accessToken);
  }, intervalHours * 60 * 60 * 1000);

  console.log(`[scheduleFacebookGroupIngestion] Scheduled to run every ${intervalHours} hours`);
}
