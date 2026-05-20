/**
 * Enhanced Arabic Real Estate Extraction Engine
 * Integrates Arabic location dictionary for accurate location parsing
 */

import { invokeLLM } from "./_core/llm";
import { extractLocationFromArabicMessage, normalizeLocation } from "./arabicLocationDictionary";

export interface ExtractedRealEstateData {
  contact_name: string | null;
  contact_phone: string | null;
  property_type: string | null;
  area: string | null;
  building_code: string | null;
  price_min: number | null;
  price_max: number | null;
  bedrooms: number | null;
  size_min: number | null;
  size_max: number | null;
  purpose: "sale" | "rent" | "unknown";
  confidence: number;
  extraction_details: {
    location_confidence: number;
    contact_confidence: number;
    price_confidence: number;
    specs_confidence: number;
  };
}

/**
 * Enhanced extraction with Arabic location recognition
 */
export async function extractRealEstateDataEnhanced(
  message: string
): Promise<ExtractedRealEstateData> {
  try {
    // First, extract location using Arabic dictionary
    const locationResult = extractLocationFromArabicMessage(message);

    // Use LLM for other fields
    const llmResponse = await invokeLLM({
      messages: [
        {
          role: "system",
          content: `You are an expert Egyptian real estate data extractor. Extract information from Arabic/English real estate messages.
          
Return JSON with these fields:
- contact_name: Person's name (Arabic or English)
- contact_phone: Phone number (extract all formats)
- property_type: apartment/villa/townhouse/penthouse/studio/duplex
- price_min: Minimum price in EGP (number only)
- price_max: Maximum price in EGP (number only)
- bedrooms: Number of bedrooms (number only)
- size_min: Minimum size in sqm (number only)
- size_max: Maximum size in sqm (number only)
- purpose: "sale" or "rent"
- confidence_score: 0-100 confidence in extraction

Focus on:
- Egyptian phone number formats: +20, 0020, 002, 00, 0
- Arabic property terminology
- Price ranges and budget mentions
- Bedroom and size specifications`
        },
        {
          role: "user",
          content: [{
            type: "text",
            text: `Extract real estate data from this message:\n\n${message}`
          }]
        }
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "real_estate_extraction",
          strict: true,
          schema: {
            type: "object",
            properties: {
              contact_name: { type: ["string", "null"] },
              contact_phone: { type: ["string", "null"] },
              property_type: { type: ["string", "null"] },
              price_min: { type: ["number", "null"] },
              price_max: { type: ["number", "null"] },
              bedrooms: { type: ["number", "null"] },
              size_min: { type: ["number", "null"] },
              size_max: { type: ["number", "null"] },
              purpose: { type: "string", enum: ["sale", "rent", "unknown"] },
              confidence_score: { type: "number", minimum: 0, maximum: 100 }
            },
            required: [
              "contact_name",
              "contact_phone",
              "property_type",
              "price_min",
              "price_max",
              "bedrooms",
              "size_min",
              "size_max",
              "purpose",
              "confidence_score"
            ],
            additionalProperties: false
          }
        }
      }
    });

    const content = llmResponse.choices[0].message.content;
    const extracted = JSON.parse(typeof content === 'string' ? content : '');

    // Combine LLM extraction with location dictionary results
    const contactConfidence = extracted.contact_name && extracted.contact_phone ? 0.9 : 0.5;
    const priceConfidence = extracted.price_min || extracted.price_max ? 0.85 : 0.4;
    const specsConfidence = extracted.bedrooms || extracted.size_min ? 0.8 : 0.3;

    // Calculate overall confidence
    const overallConfidence = Math.round(
      (locationResult.confidence * 0.3 +
        contactConfidence * 0.3 +
        priceConfidence * 0.2 +
        specsConfidence * 0.2) *
        100
    );

    return {
      contact_name: extracted.contact_name,
      contact_phone: extracted.contact_phone,
      property_type: extracted.property_type,
      area: locationResult.area,
      building_code: locationResult.buildingCode,
      price_min: extracted.price_min,
      price_max: extracted.price_max,
      bedrooms: extracted.bedrooms,
      size_min: extracted.size_min,
      size_max: extracted.size_max,
      purpose: extracted.purpose,
      confidence: overallConfidence / 100,
      extraction_details: {
        location_confidence: locationResult.confidence,
        contact_confidence: contactConfidence,
        price_confidence: priceConfidence,
        specs_confidence: specsConfidence
      }
    };
  } catch (error) {
    console.error("Extraction error:", error);
    return {
      contact_name: null,
      contact_phone: null,
      property_type: null,
      area: null,
      building_code: null,
      price_min: null,
      price_max: null,
      bedrooms: null,
      size_min: null,
      size_max: null,
      purpose: "unknown",
      confidence: 0,
      extraction_details: {
        location_confidence: 0,
        contact_confidence: 0,
        price_confidence: 0,
        specs_confidence: 0
      }
    };
  }
}

/**
 * Batch extraction for multiple messages
 */
export async function extractMultipleMessages(
  messages: string[]
): Promise<ExtractedRealEstateData[]> {
  return Promise.all(messages.map(msg => extractRealEstateDataEnhanced(msg)));
}
