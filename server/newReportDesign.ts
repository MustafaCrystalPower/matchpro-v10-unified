/**
 * New Report Generator Design Specification
 * 
 * GOAL: Deliver high-quality, area-segregated reports with essential data only
 * 
 * STRUCTURE:
 * 1. Matches Sheet (for owner) - High-quality matches only
 * 2. Area Sheets (for brokers) - Demand leads segregated by location
 *    - Each area sheet contains For Sale / For Rent sections
 * 
 * SCHEMA (7 Essential Columns):
 * 1. Name (الاسم)
 * 2. Phone (رقم التليفون)
 * 3. Property Type (نوع العقار)
 * 4. Budget (الميزانية)
 * 5. Time (الوقت)
 * 6. Original Message (الرسالة الأصلية)
 * 7. Source (المصدر)
 */

export interface ReportLead {
  name: string;
  phone: string;
  propertyType: string; // apartment, villa, duplex, land, etc.
  budget: string; // e.g., "5.5M EGP", "flexible"
  timestamp: Date;
  originalMessage: string;
  source: string; // WhatsApp, Direct, etc.
}

export interface DemandLead extends ReportLead {
  location: string; // Area name (مدينتي, التجمع الخامس, etc.)
  purpose: 'for_sale' | 'for_rent'; // Sale or Rent
  confidence: number; // 0-100
}

export interface MatchLead extends ReportLead {
  matchId: string;
  sellerName: string;
  sellerPhone: string;
  buyerName: string;
  buyerPhone: string;
  score: number; // 0-100
  matchSummary: string;
}

/**
 * REPORT STRUCTURE:
 * 
 * REPORT 1: Matches Sheet (Owner Email)
 * ├─ Header: Crystal Power Investments Logo + Report Date/Time
 * ├─ Summary: Total Matches, Excellent, High, Medium
 * ├─ Data Rows: Match details with 7 essential columns
 * │  (Seller Name, Seller Phone, Buyer Name, Buyer Phone, Property Type, Budget, Score)
 * └─ Footer: Report metadata, generation timestamp
 * 
 * REPORT 2+: Area Sheets (Broker Distribution)
 * ├─ Area 1: مدينتي (Madinaty)
 * │  ├─ For Sale Section
 * │  │  └─ Data: Name, Phone, Property Type, Budget, Time, Message, Source
 * │  └─ For Rent Section
 * │     └─ Data: Name, Phone, Property Type, Budget, Time, Message, Source
 * │
 * ├─ Area 2: التجمع الخامس (Fifth Settlement)
 * │  ├─ For Sale Section
 * │  └─ For Rent Section
 * │
 * └─ ... (Additional areas as needed)
 */

export interface ReportConfig {
  // Matches Sheet
  matchesSheet: {
    name: string; // "Matches"
    includeColumns: [
      'seller_name',
      'seller_phone',
      'buyer_name',
      'buyer_phone',
      'property_type',
      'budget',
      'score'
    ];
    filterCriteria: {
      minScore: number; // e.g., 75
      includeStatuses: string[]; // ['new', 'contacted', 'viewing_scheduled']
    };
  };

  // Area Sheets
  areaSheets: {
    areas: string[]; // ['مدينتي', 'التجمع الخامس', 'الرحاب', ...]
    columnsPerSheet: [
      'name',
      'phone',
      'property_type',
      'budget',
      'timestamp',
      'original_message',
      'source'
    ];
    internalSections: ['for_sale', 'for_rent'];
    sortBy: 'timestamp_desc'; // Most recent first
  };

  // Delivery
  delivery: {
    matchesSheetEmail: string; // Owner email
    areaSheetDistribution: {
      [area: string]: string[]; // Area -> Broker emails
    };
    frequency: '6_hours'; // Every 6 hours
    timezone: 'Africa/Cairo';
  };
}

/**
 * IMPLEMENTATION ROADMAP:
 * 
 * 1. Extract Demand Leads
 *    - Query demand table for last 6 hours
 *    - Extract: name, phone, property_type, budget, timestamp, original_message
 *    - Normalize location to area name
 *    - Classify as for_sale or for_rent
 * 
 * 2. Group by Area & Purpose
 *    - Group demand leads by location + purpose
 *    - Create section headers for each group
 * 
 * 3. Generate Matches Sheet
 *    - Query matches table for high-quality matches (score >= 75)
 *    - Extract: seller_name, seller_phone, buyer_name, buyer_phone, property_type, budget, score
 *    - Sort by score descending
 * 
 * 4. Create Excel Workbook
 *    - Workbook 1: Matches sheet (for owner)
 *    - Workbooks 2+: Area sheets (for brokers)
 * 
 * 5. Format & Brand
 *    - Add CPI logo and branding
 *    - Apply professional styling (colors, fonts, alignment)
 *    - Freeze header rows
 *    - Auto-fit column widths
 * 
 * 6. Deliver
 *    - Email Matches sheet to owner
 *    - Email Area sheets to respective brokers
 *    - Log delivery in reports table
 */

/**
 * QUALITY METRICS:
 * 
 * - Accuracy: 100% of extracted fields match source messages
 * - Completeness: All 7 required columns populated for every lead
 * - Timeliness: Report generated within 5 minutes of 6-hour cycle
 * - Formatting: Professional Excel with consistent styling
 * - Delivery: 100% email delivery success rate
 */
