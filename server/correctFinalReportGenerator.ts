/**
 * Correct Final Report Generator - FIXED
 * Structure:
 * - Sheet 1: Matches (best matches for owner)
 * - Sheets 2-N: Area - Demand (sorted: For Rent → For Sale → Time → Price)
 * - Sheet N+1: Supply (all supply, sorted: Area → Type → Price → Time)
 */

import ExcelJS from 'exceljs';
import { storagePut } from './storage';
import { createConnection } from 'mysql2/promise';

interface MessageRecord {
  id: number;
  messageText: string;
  classification: 'supply' | 'demand' | 'unknown';
  createdAt: Date;
  sender: string;
  senderName: string;
  groupName: string;
}

interface ParsedMessage {
  time: string;
  name: string;
  phone: string;
  propertyType: string;
  budget: string;
  area: string;
  location: string;
  type: 'For Rent' | 'For Sale' | 'Unknown';
  source: string;
  originalMessage: string;
  confidence: number;
  classification: 'supply' | 'demand' | 'unknown';
}

function extractType(text: string): 'For Rent' | 'For Sale' | 'Unknown' {
  const lowerText = text.toLowerCase();
  
  // For Sale indicators
  if (text.includes('للبيع') || text.includes('للـبيع') || text.includes('تمليك') || 
      text.includes('شراء') || lowerText.includes('for sale') || lowerText.includes('buy')) {
    return 'For Sale';
  }
  
  // For Rent indicators
  if (text.includes('للايجار') || text.includes('للإيجار') || text.includes('للـايجار') ||
      lowerText.includes('for rent') || lowerText.includes('rent') || lowerText.includes('lease')) {
    return 'For Rent';
  }
  
  return 'Unknown';
}

function extractArea(text: string): string {
  if (text.match(/[bB]\d{1,2}/)) {
    return 'مدينتي';
  } else if (text.includes('التجمع')) return 'التجمع الخامس';
  else if (text.includes('الرحاب')) return 'الرحاب';
  else if (text.includes('القاهرة الجديدة')) return 'القاهرة الجديدة';
  else if (text.includes('الشيخ زايد')) return 'الشيخ زايد';
  else if (text.includes('مدينة نصر')) return 'مدينة نصر';
  else if (text.includes('المعادي')) return 'المعادي';
  else if (text.includes('6 اكتوبر')) return '6 اكتوبر';
  else if (text.includes('الساحل')) return 'الساحل الشمالي';
  else if (text.includes('العاصمة')) return 'العاصمة الإدارية';
  
  return 'Other';
}

function parseMessage(msg: MessageRecord): ParsedMessage {
  const text = msg.messageText;
  
  // IMPORTANT: Keep the original classification from database
  const classification = msg.classification as 'supply' | 'demand' | 'unknown';
  
  // Extract phone
  const phoneMatch = text.match(/0[1125]\d{8}/);
  const phone = phoneMatch ? phoneMatch[0] : msg.sender.replace('@c.us', '');
  
  // Extract name
  const name = msg.senderName || 'Unknown';
  
  // Extract property type
  let propertyType = '-';
  if (text.includes('شقة') || text.includes('apartment')) propertyType = 'Apartment';
  else if (text.includes('فيلا') || text.includes('villa')) propertyType = 'Villa';
  else if (text.includes('دوبلكس')) propertyType = 'Duplex';
  else if (text.includes('استوديو') || text.includes('studio')) propertyType = 'Studio';
  else if (text.includes('أرض') || text.includes('land')) propertyType = 'Land';
  else if (text.includes('تاون') || text.includes('townhouse')) propertyType = 'Townhouse';
  
  // Extract budget/price
  const priceMatch = text.match(/(\d+(?:[,.]?\d+)?)\s*(مليون|الف|thousand|k|egp|le)?/i);
  let budget = '-';
  if (priceMatch) {
    let num = parseFloat(priceMatch[1].replace(',', '.'));
    const unit = priceMatch[2]?.toLowerCase() || '';
    if (unit.includes('مليون') || unit.includes('million') || unit === 'm') {
      num *= 1000000;
    } else if (unit.includes('الف') || unit.includes('ألف') || unit.includes('thousand') || unit === 'k') {
      num *= 1000;
    }
    budget = `${num.toLocaleString()} EGP`;
  }
  
  // Extract area
  const area = extractArea(text);
  
  // Extract location
  let location = '-';
  const bMatch = text.match(/[bB](\d{1,2})/i);
  if (bMatch) {
    location = `B${bMatch[1]}`;
  }
  
  // Extract type
  const type = extractType(text);
  
  // Format time
  const messageTime = new Date(msg.createdAt).toLocaleString('en-EG', {
    timeZone: 'Africa/Cairo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  });
  
  // Calculate confidence
  let confidence = 0.5;
  if (propertyType !== '-') confidence += 0.15;
  if (budget !== '-') confidence += 0.15;
  if (location !== '-') confidence += 0.2;
  confidence = Math.min(confidence, 0.95);
  
  return {
    time: messageTime,
    name,
    phone,
    propertyType,
    budget,
    area,
    location,
    type,
    source: msg.groupName,
    originalMessage: text.substring(0, 150),
    confidence,
    classification: classification
  };
}

function extractPriceNumber(budget: string): number {
  if (budget === '-') return 0;
  const num = parseFloat(budget.replace(/[^\d.]/g, ''));
  return isNaN(num) ? 0 : num;
}

export async function generateCorrectFinalReport(): Promise<{ url: string; key: string }> {
  const connection = await createConnection(process.env.DATABASE_URL || '');
  
  try {
    console.log('\n🔄 جاري إنشاء التقرير النهائي الصحيح...\n');
    
    // Get last 24 hours messages
    const [messages] = await connection.execute(`
      SELECT 
        id,
        messageText,
        classification,
        createdAt,
        sender,
        senderName,
        groupName
      FROM messages
      WHERE createdAt >= DATE_SUB(NOW(), INTERVAL 24 HOUR)
      ORDER BY createdAt DESC
    `) as any;
    
    console.log(`📊 عدد الرسائل (آخر 24 ساعة): ${messages.length}`);
    
    // Create workbook
    const workbook = new ExcelJS.Workbook();
    
    // Parse all messages
    const parsed = messages.map((m: MessageRecord) => parseMessage(m));
    
    // Separate demand and supply (using original classification from DB)
    const demandMessages = parsed.filter((p: ParsedMessage) => p.classification === 'demand');
    const supplyMessages = parsed.filter((p: ParsedMessage) => p.classification === 'supply');
    const unknownMessages = parsed.filter((p: ParsedMessage) => p.classification === 'unknown');
    
    console.log(`   📥 Demand: ${demandMessages.length}`);
    console.log(`   📤 Supply: ${supplyMessages.length}`);
    console.log(`   ❓ Unknown: ${unknownMessages.length}`);
    
    // ============ SHEET 1: MATCHES (for owner) ============
    const matchesSheet = workbook.addWorksheet('Matches');
    matchesSheet.columns = [
      { header: 'Time', key: 'time', width: 18 },
      { header: 'Name', key: 'name', width: 18 },
      { header: 'Phone', key: 'phone', width: 15 },
      { header: 'Property Type', key: 'propertyType', width: 15 },
      { header: 'Budget/Price', key: 'budget', width: 15 },
      { header: 'Area', key: 'area', width: 15 },
      { header: 'Location', key: 'location', width: 10 },
      { header: 'Type', key: 'type', width: 12 },
      { header: 'Confidence', key: 'confidence', width: 12 },
      { header: 'Source', key: 'source', width: 25 },
      { header: 'Original Message', key: 'originalMessage', width: 50 }
    ];
    
    // Get top matches (high confidence, from demand messages)
    const topMatches = demandMessages
      .filter((p: ParsedMessage) => p.confidence >= 0.75)
      .sort((a: ParsedMessage, b: ParsedMessage) => b.confidence - a.confidence)
      .slice(0, 500);
    
    for (const match of topMatches) {
      matchesSheet.addRow({
        time: match.time,
        name: match.name,
        phone: match.phone,
        propertyType: match.propertyType,
        budget: match.budget,
        area: match.area,
        location: match.location,
        type: match.type,
        confidence: `${(match.confidence * 100).toFixed(0)}%`,
        source: match.source,
        originalMessage: match.originalMessage
      });
    }
    
    // ============ SHEETS 2-N: AREA - DEMAND ============
    
    // Group demand by area (only demand messages)
    const demandByArea: { [key: string]: ParsedMessage[] } = {};
    for (const msg of demandMessages as ParsedMessage[]) {
      if (!demandByArea[msg.area]) {
        demandByArea[msg.area] = [];
      }
      demandByArea[msg.area].push(msg);
    }
    
    // Filter out empty areas
    const validDemandAreas = Object.entries(demandByArea).filter(([_, msgs]: [string, ParsedMessage[]]) => msgs.length > 0);
    
    // Create demand sheets for each area
    for (const [area, areaMessages] of validDemandAreas) {
      const demandSheet = workbook.addWorksheet(`${area} - Demand`);
      demandSheet.columns = [
        { header: 'Time', key: 'time', width: 18 },
        { header: 'Name', key: 'name', width: 18 },
        { header: 'Phone', key: 'phone', width: 15 },
        { header: 'Property Type', key: 'propertyType', width: 15 },
        { header: 'Budget', key: 'budget', width: 15 },
        { header: 'Location', key: 'location', width: 10 },
        { header: 'Type', key: 'type', width: 12 },
        { header: 'Source', key: 'source', width: 25 },
        { header: 'Original Message', key: 'originalMessage', width: 50 }
      ];
      
      // Sort: For Rent first → For Sale → Time (newest first) → Price (highest first)
      const sorted = areaMessages.sort((msgA: ParsedMessage, msgB: ParsedMessage) => {
        // 1. Type: For Rent first
        if (msgA.type !== msgB.type) {
          if (msgA.type === 'For Rent') return -1;
          if (msgB.type === 'For Rent') return 1;
        }
        // 2. Time: Newest first
        const timeA = new Date(msgA.time).getTime();
        const timeB = new Date(msgB.time).getTime();
        if (timeA !== timeB) return timeB - timeA;
        // 3. Price: Highest first
        return extractPriceNumber(msgB.budget) - extractPriceNumber(msgA.budget);
      });
      
      for (const msg of sorted) {
        demandSheet.addRow({
          time: msg.time,
          name: msg.name,
          phone: msg.phone,
          propertyType: msg.propertyType,
          budget: msg.budget,
          location: msg.location,
          type: msg.type,
          source: msg.source,
          originalMessage: msg.originalMessage
        });
      }
    }
    
    // ============ SHEET N+1: SUPPLY (all supply) ============
    if (supplyMessages && supplyMessages.length > 0) {
      const supplySheet = workbook.addWorksheet('Supply');
      supplySheet.columns = [
        { header: 'Time', key: 'time', width: 18 },
        { header: 'Name', key: 'name', width: 18 },
        { header: 'Phone', key: 'phone', width: 15 },
        { header: 'Property Type', key: 'propertyType', width: 15 },
        { header: 'Price', key: 'budget', width: 15 },
        { header: 'Area', key: 'area', width: 15 },
        { header: 'Location', key: 'location', width: 10 },
        { header: 'Type', key: 'type', width: 12 },
        { header: 'Source', key: 'source', width: 25 },
        { header: 'Original Message', key: 'originalMessage', width: 50 }
      ];
      
      // Sort: Area → Type (For Rent first) → Price (highest first) → Time (newest first)
      const sorted = supplyMessages.sort((msgA: ParsedMessage, msgB: ParsedMessage) => {
        // 1. Area
        if (msgA.area !== msgB.area) return msgA.area.localeCompare(msgB.area);
        // 2. Type: For Rent first
        if (msgA.type !== msgB.type) {
          if (msgA.type === 'For Rent') return -1;
          if (msgB.type === 'For Rent') return 1;
        }
        // 3. Price: Highest first
        const priceA = extractPriceNumber(msgA.budget);
        const priceB = extractPriceNumber(msgB.budget);
        if (priceA !== priceB) return priceB - priceA;
        // 4. Time: Newest first
        return new Date(msgB.time).getTime() - new Date(msgA.time).getTime();
      });
      
      for (const msg of sorted) {
        supplySheet.addRow({
          time: msg.time,
          name: msg.name,
          phone: msg.phone,
          propertyType: msg.propertyType,
          budget: msg.budget,
          area: msg.area,
          location: msg.location,
          type: msg.type,
          source: msg.source,
          originalMessage: msg.originalMessage
        });
      }
    }
    
    // Style all sheets
    for (const sheet of workbook.worksheets) {
      if (sheet.rowCount > 0) {
        const headerRow = sheet.getRow(1);
        headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
        headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4472C4' } };
        headerRow.alignment = { horizontal: 'center', vertical: 'middle' };
      }
    }
    
    console.log(`\n✅ النتائج:`);
    console.log(`   📥 Matches: ${topMatches.length}`);
    console.log(`   📍 Demand Areas: ${validDemandAreas.length}`);
    console.log(`   📤 Supply: ${supplyMessages.length}`);
    
    // Generate buffer
    const buffer = await workbook.xlsx.writeBuffer();
    
    // Upload to S3
    const timestamp = new Date().getTime();
    const key = `reports/MatchPro_Final_Correct_${timestamp}.xlsx`;
    const result = await storagePut(key, buffer as unknown as Buffer, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    
    console.log(`\n✅ تم الرفع بنجاح!`);
    console.log(`📥 الرابط: ${result.url}\n`);
    
    await connection.end();
    
    return result;
  } catch (error) {
    console.error('❌ خطأ:', error);
    await connection.end();
    throw error;
  }
}
