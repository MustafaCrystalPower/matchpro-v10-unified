/**
 * CORRECT TEMPLATE REPORT GENERATOR
 * 
 * This generator:
 * 1. Reads from messages table (real data)
 * 2. Classifies using professionalClassifier
 * 3. Generates 21-sheet Excel matching user's template exactly
 * 4. Ensures file opens without corruption
 */

import ExcelJS from 'exceljs';
import { getDb } from './db';
import { messages } from '../drizzle/schema';
import { classifyMessage } from './professionalClassifier';
import { eq, desc } from 'drizzle-orm';

interface DemandRecord {
  id: number;
  propertyType: string | null;
  location: string;
  area: string | null;
  city: string;
  priceMin: string | null;
  priceMax: string | null;
  sizeMin: number | null;
  sizeMax: number | null;
  bedrooms: number | null;
  bathrooms: number | null;
  purpose: string;
  contact: string;
  contactName: string;
  requirements: string;
  createdAt: string;
  priority: string;
  sourceGroup: string;
  dateOnly: string;
  normalizedLocation: string;
  isFifthSettlement: string;
  budgetRange: string;
  originalMessage: string;
}

// Area mapping for normalized locations
const AREA_MAPPING: Record<string, string> = {
  'Fifth Settlement': 'Fifth_Settlement_Only',
  'Madinaty': 'Madinaty_Demands',
  'Rehab': 'Rehab_Demands',
  'Sheikh Zayed': 'Sheikh_Zayed_Demands',
  'North Coast': 'North_Coast_Demands',
  'Nasr City': 'Nasr_City_Demands',
  'Madinet Nour': 'Madinet_Nour_Demands',
  'Admin Capital': 'Admin_Capital_Demands',
  'Other Areas': 'Other_Areas_Demands',
};

const AREA_MAPPING_AR: Record<string, string> = {
  'Fifth Settlement': '🏙️_التجمع_الخامس',
  'Madinaty': '🏘️_مدينتي',
  'Rehab': '🏢_الرحاب',
  'Sheikh Zayed': '🌳_الشيخ_زايد',
  'North Coast': '🏖️_الساحل_الشمالي',
  'Nasr City': '🏬_مدينة_نصر',
  'Madinet Nour': '🏛️_مدينة_نور',
  'Admin Capital': '🏛️_العاصمة_الإدارية',
  'Other Areas': '📍_مناطق_أخرى',
};

export async function generateCorrectTemplateReport(): Promise<string> {
  try {
    // Fetch all messages from database
    const db = await getDb();
    if (!db) {
      throw new Error('Database not available');
    }
    
    const allMessages = await db
      .select()
      .from(messages)
      .orderBy(desc(messages.createdAt))
      .limit(1000);

    console.log(`📊 Fetched ${allMessages.length} messages from database`);

    // Create workbook
    const workbook = new ExcelJS.Workbook();

    // Extract demands from messages
    const demands: DemandRecord[] = [];
    const demandsByArea: Record<string, DemandRecord[]> = {};

    for (const msg of allMessages) {
      // Classify message
      const classification = classifyMessage(msg.messageText || '');
      
      // Only process demands
      if (classification.classification !== 'demand') continue;

      // Parse message to extract details
      const demand = parseMessageToDemand(msg, classification);
      demands.push(demand);

      // Group by area
      const area = demand.normalizedLocation || 'Other Areas';
      if (!demandsByArea[area]) {
        demandsByArea[area] = [];
      }
      demandsByArea[area].push(demand);
    }

    console.log(`📋 Extracted ${demands.length} demands from messages`);

    // Create All_Demands sheet
    createAllDemandsSheet(workbook, demands);

    // Create area-specific sheets
    for (const [area, areaName] of Object.entries(AREA_MAPPING)) {
      const areaData = demandsByArea[area] || [];
      createAreaSheet(workbook, areaName, areaData);
    }

    // Create Summary sheet
    createSummarySheet(workbook, demands, demandsByArea);

    // Create MatchPro_Spec sheet (reference)
    createSpecSheet(workbook);

    // Create Arabic area sheets (only if not already created)
    const createdSheets = new Set(workbook.worksheets.map(ws => ws.name));
    for (const [area, arName] of Object.entries(AREA_MAPPING_AR)) {
      if (!createdSheets.has(arName)) {
        const areaData = demandsByArea[area] || [];
        createAreaSheetArabic(workbook, arName, areaData);
      }
    }

    // Save to file
    const filename = `/tmp/MatchPro_Report_${Date.now()}.xlsx`;
    await workbook.xlsx.writeFile(filename);

    console.log(`✅ Report generated: ${filename}`);
    return filename;
  } catch (error) {
    console.error('❌ Report generation failed:', error);
    throw error;
  }
}

function parseMessageToDemand(msg: any, classification: any): DemandRecord {
  const text = msg.messageText || '';
  
  // Extract property type
  const propertyType = extractPropertyType(text);
  
  // Extract location
  const location = extractLocation(text);
  
  // Extract price range
  const { priceMin, priceMax } = extractPriceRange(text);
  
  // Extract size
  const { sizeMin, sizeMax } = extractSize(text);
  
  // Extract bedrooms/bathrooms
  const bedrooms = extractBedrooms(text);
  const bathrooms = extractBathrooms(text);
  
  // Extract purpose (sale/rent)
  const purpose = extractPurpose(text);
  
  // Normalize location
  const normalizedLocation = normalizeLocation(location);
  
  // Extract requirements
  const requirements = extractRequirements(text);
  
  return {
    id: msg.id,
    propertyType,
    location,
    area: normalizedLocation,
    city: 'Cairo',
    priceMin,
    priceMax,
    sizeMin,
    sizeMax,
    bedrooms,
    bathrooms,
    purpose,
    contact: msg.sender || 'Unknown',
    contactName: msg.senderName || 'Unknown',
    requirements,
    createdAt: msg.createdAt?.toISOString() || new Date().toISOString(),
    priority: classification.confidence > 0.85 ? 'high' : 'medium',
    sourceGroup: msg.groupName || 'WhatsApp',
    dateOnly: msg.createdAt?.toISOString().split('T')[0] || new Date().toISOString().split('T')[0],
    normalizedLocation,
    isFifthSettlement: normalizedLocation === 'Fifth Settlement' ? 'Yes' : 'No',
    budgetRange: formatBudgetRange(priceMin, priceMax),
    originalMessage: text.substring(0, 500),
  };
}

function extractPropertyType(text: string): string {
  const types = ['apartment', 'villa', 'chalet', 'townhouse', 'studio', 'land', 'duplex', 'penthouse'];
  const arTypes = ['شقة', 'فيلا', 'شاليه', 'تاون', 'ستوديو', 'أرض', 'دوبلكس', 'بنتهاوس'];
  
  const lowerText = text.toLowerCase();
  for (const type of [...types, ...arTypes]) {
    if (lowerText.includes(type.toLowerCase())) {
      return type;
    }
  }
  return 'apartment';
}

function extractLocation(text: string): string {
  const locations = ['Fifth Settlement', 'Madinaty', 'Rehab', 'Sheikh Zayed', 'North Coast', 'Nasr City', 'New Cairo'];
  const arLocations = ['التجمع الخامس', 'مدينتي', 'الرحاب', 'الشيخ زايد', 'الساحل الشمالي', 'مدينة نصر', 'القاهرة الجديدة'];
  
  const lowerText = text.toLowerCase();
  for (const loc of [...locations, ...arLocations]) {
    if (lowerText.includes(loc.toLowerCase())) {
      return loc;
    }
  }
  return 'Other Areas';
}

function extractPriceRange(text: string): { priceMin: string | null; priceMax: string | null } {
  // Look for price patterns like "30 ألف" or "5 مليون"
  const pricePattern = /(\d+)\s*(ألف|الف|مليون|million|thousand|k|m|egp)/gi;
  const matches = [...text.matchAll(pricePattern)];
  
  if (matches.length === 0) return { priceMin: null, priceMax: null };
  
  const prices = matches.map(m => {
    const num = parseInt(m[1]);
    const unit = m[2].toLowerCase();
    if (unit.includes('مليون') || unit.includes('million')) return num * 1000000;
    if (unit.includes('ألف') || unit.includes('الف') || unit.includes('thousand') || unit === 'k') return num * 1000;
    return num;
  });
  
  prices.sort((a, b) => a - b);
  
  return {
    priceMin: prices[0]?.toString() || null,
    priceMax: prices[prices.length - 1]?.toString() || null,
  };
}

function extractSize(text: string): { sizeMin: number | null; sizeMax: number | null } {
  const sizePattern = /(\d+)\s*(م²|متر|m²|sqm)/gi;
  const matches = [...text.matchAll(sizePattern)];
  
  if (matches.length === 0) return { sizeMin: null, sizeMax: null };
  
  const sizes = matches.map(m => parseInt(m[1]));
  sizes.sort((a, b) => a - b);
  
  return {
    sizeMin: sizes[0] || null,
    sizeMax: sizes[sizes.length - 1] || null,
  };
}

function extractBedrooms(text: string): number | null {
  const pattern = /(\d+)\s*(غرف|نوم|bedrooms?|rooms?)/i;
  const match = text.match(pattern);
  return match ? parseInt(match[1]) : null;
}

function extractBathrooms(text: string): number | null {
  const pattern = /(\d+)\s*(حمام|bathrooms?)/i;
  const match = text.match(pattern);
  return match ? parseInt(match[1]) : null;
}

function extractPurpose(text: string): string {
  if (/للإيجار|for rent|rent/i.test(text)) return 'rent';
  if (/للبيع|for sale|sale/i.test(text)) return 'sale';
  return 'sale';
}

function normalizeLocation(location: string): string {
  const mapping: Record<string, string> = {
    'fifth settlement': 'Fifth Settlement',
    'التجمع الخامس': 'Fifth Settlement',
    'madinaty': 'Madinaty',
    'مدينتي': 'Madinaty',
    'rehab': 'Rehab',
    'الرحاب': 'Rehab',
    'sheikh zayed': 'Sheikh Zayed',
    'الشيخ زايد': 'Sheikh Zayed',
    'north coast': 'North Coast',
    'الساحل الشمالي': 'North Coast',
    'nasr city': 'Nasr City',
    'مدينة نصر': 'Nasr City',
    'madinet nour': 'Madinet Nour',
    'admin capital': 'Admin Capital',
    'العاصمة الإدارية': 'Admin Capital',
  };
  
  const lower = location.toLowerCase();
  return mapping[lower] || 'Other Areas';
}

function extractRequirements(text: string): string {
  // Extract key requirements from message
  const requirements = [];
  if (/جاردن|garden/i.test(text)) requirements.push('garden');
  if (/فيو|view/i.test(text)) requirements.push('view');
  if (/مفروشة|furnished/i.test(text)) requirements.push('furnished');
  if (/مكيفة|ac/i.test(text)) requirements.push('AC');
  if (/بلكونة|balcony/i.test(text)) requirements.push('balcony');
  
  return requirements.length > 0 ? JSON.stringify(requirements) : '[]';
}

function formatBudgetRange(min: string | null, max: string | null): string {
  if (!min && !max) return 'N/A';
  if (min && !max) return `${parseInt(min).toLocaleString()} EGP`;
  if (!min && max) return `Up to ${parseInt(max).toLocaleString()} EGP`;
  if (min && max) return `${parseInt(min).toLocaleString()} - ${parseInt(max).toLocaleString()} EGP`;
  return 'N/A';
}

function createAllDemandsSheet(workbook: ExcelJS.Workbook, demands: DemandRecord[]): void {
  const sheet = workbook.addWorksheet('All_Demands');
  
  // Headers (23 columns as per template)
  const headers = [
    'ID', 'Property Type', 'Location', 'Area', 'City', 'Price Min', 'Price Max',
    'Size Min', 'Size Max', 'Bedrooms', 'Bathrooms', 'Purpose', 'Contact',
    'Contact Name', 'Requirements', 'Created At', 'Priority', 'Source Group',
    'Date Only', 'Normalized Location', 'Is Fifth Settlement', 'Budget Range',
    'Original Message / الرسالة الأصلية'
  ];
  
  sheet.addRow(headers);
  
  // Add data rows
  for (const demand of demands) {
    sheet.addRow([
      demand.id,
      demand.propertyType,
      demand.location,
      demand.area,
      demand.city,
      demand.priceMin,
      demand.priceMax,
      demand.sizeMin,
      demand.sizeMax,
      demand.bedrooms,
      demand.bathrooms,
      demand.purpose,
      demand.contact,
      demand.contactName,
      demand.requirements,
      demand.createdAt,
      demand.priority,
      demand.sourceGroup,
      demand.dateOnly,
      demand.normalizedLocation,
      demand.isFifthSettlement,
      demand.budgetRange,
      demand.originalMessage,
    ]);
  }
  
  // Format sheet
  sheet.columns.forEach(col => {
    col.width = 15;
  });
  
  // Freeze header row
  sheet.views = [{ state: 'frozen', ySplit: 1 }];
}

function createAreaSheet(workbook: ExcelJS.Workbook, sheetName: string, demands: DemandRecord[]): void {
  const sheet = workbook.addWorksheet(sheetName);
  
  // Add title
  sheet.addRow([`${sheetName.replace(/_/g, ' ')} DEMAND REPORT`]);
  sheet.addRow([]);
  
  // Headers
  const headers = [
    'ID', 'Property Type', 'Location', 'Bedrooms', 'Bathrooms', 'Purpose',
    'Contact', 'Contact Name', 'Price Min', 'Price Max', 'Size Min', 'Size Max',
    'Requirements', 'Created At'
  ];
  
  sheet.addRow(headers);
  
  // Add data
  for (const demand of demands) {
    sheet.addRow([
      demand.id,
      demand.propertyType,
      demand.location,
      demand.bedrooms,
      demand.bathrooms,
      demand.purpose,
      demand.contact,
      demand.contactName,
      demand.priceMin,
      demand.priceMax,
      demand.sizeMin,
      demand.sizeMax,
      demand.requirements,
      demand.createdAt,
    ]);
  }
  
  sheet.columns.forEach(col => {
    col.width = 15;
  });
}

function createAreaSheetArabic(workbook: ExcelJS.Workbook, sheetName: string, demands: DemandRecord[]): void {
  const sheet = workbook.addWorksheet(sheetName);
  
  // Add title
  sheet.addRow([`${sheetName.replace(/_/g, ' ')} تقرير الطلبات`]);
  sheet.addRow([]);
  
  // Headers (Arabic)
  const headers = [
    'الرقم', 'نوع العقار', 'الموقع', 'عدد الغرف', 'عدد الحمامات', 'الغرض',
    'جهة الاتصال', 'اسم المتصل', 'السعر الأدنى', 'السعر الأقصى', 'المساحة الصغرى', 'المساحة الكبرى',
    'المتطلبات', 'تاريخ الإنشاء'
  ];
  
  sheet.addRow(headers);
  
  // Add data
  for (const demand of demands) {
    sheet.addRow([
      demand.id,
      demand.propertyType,
      demand.location,
      demand.bedrooms,
      demand.bathrooms,
      demand.purpose,
      demand.contact,
      demand.contactName,
      demand.priceMin,
      demand.priceMax,
      demand.sizeMin,
      demand.sizeMax,
      demand.requirements,
      demand.createdAt,
    ]);
  }
  
  sheet.columns.forEach(col => {
    col.width = 15;
  });
}

function createSummarySheet(workbook: ExcelJS.Workbook, demands: DemandRecord[], demandsByArea: Record<string, DemandRecord[]>): void {
  const sheet = workbook.addWorksheet('Summary');
  
  sheet.addRow(['REAL ESTATE DEMAND ANALYSIS SUMMARY']);
  sheet.addRow([]);
  
  sheet.addRow(['Total Demands:', demands.length]);
  sheet.addRow(['Report Generated:', new Date().toISOString()]);
  sheet.addRow([]);
  
  sheet.addRow(['DEMANDS BY AREA:']);
  for (const [area, areaData] of Object.entries(demandsByArea)) {
    sheet.addRow([area, areaData.length]);
  }
  
  sheet.addRow([]);
  sheet.addRow(['DEMANDS BY PURPOSE:']);
  const bySale = demands.filter(d => d.purpose === 'sale').length;
  const byRent = demands.filter(d => d.purpose === 'rent').length;
  sheet.addRow(['For Sale', bySale]);
  sheet.addRow(['For Rent', byRent]);
  
  sheet.addRow([]);
  sheet.addRow(['DEMANDS BY PRIORITY:']);
  const highPriority = demands.filter(d => d.priority === 'high').length;
  const mediumPriority = demands.filter(d => d.priority === 'medium').length;
  sheet.addRow(['High Priority', highPriority]);
  sheet.addRow(['Medium Priority', mediumPriority]);
}

function createSpecSheet(workbook: ExcelJS.Workbook): void {
  const sheet = workbook.addWorksheet('MatchPro_Spec');
  
  sheet.addRow(['MATCHPRO SECURE DEMAND REPORT SYSTEM']);
  sheet.addRow(['Technical Specification for AI Developer']);
  sheet.addRow([]);
  sheet.addRow(['This report contains:']);
  sheet.addRow(['1. All_Demands - Complete list of all demands']);
  sheet.addRow(['2. Area-specific sheets - Demands grouped by location']);
  sheet.addRow(['3. Summary - Analysis and statistics']);
  sheet.addRow(['4. Arabic sheets - Localized area reports']);
  sheet.addRow([]);
  sheet.addRow(['Generated:', new Date().toISOString()]);
}
