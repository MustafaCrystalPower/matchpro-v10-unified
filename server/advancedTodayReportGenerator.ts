/**
 * Advanced Report Generator for Today's Messages
 * Exports with proper filtering: Date → Area → Type → Location → Price
 */

import ExcelJS from 'exceljs';
import { storagePut } from './storage';
import mysql from 'mysql2/promise';
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
  name: string;
  phone: string;
  propertyType: string | null;
  budget: string | null;
  area: string | null;
  location: string | null;
  messageTime: string;
  originalMessage: string;
  source: string;
}

/**
 * Extract key information from message
 */
function parseMessage(msg: MessageRecord): ParsedMessage {
  const text = msg.messageText;
  
  // Extract phone
  const phoneMatch = text.match(/0[1125]\d{8}/);
  const phone = phoneMatch ? phoneMatch[0] : msg.sender.replace('@c.us', '');
  
  // Extract name
  const name = msg.senderName || 'Unknown';
  
  // Extract property type
  let propertyType = null;
  if (text.includes('شقة') || text.includes('apartment')) propertyType = 'Apartment';
  else if (text.includes('فيلا') || text.includes('villa')) propertyType = 'Villa';
  else if (text.includes('دوبلكس')) propertyType = 'Duplex';
  else if (text.includes('استوديو') || text.includes('studio')) propertyType = 'Studio';
  else if (text.includes('أرض') || text.includes('land')) propertyType = 'Land';
  
  // Extract budget/price
  const priceMatch = text.match(/(\d+(?:[,.]?\d+)?)\s*(مليون|الف|thousand|k|egp|le)?/i);
  let budget = null;
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
  
  // Extract area (B-series = Madinaty, or explicit location)
  let area = null;
  if (text.match(/[bB]\d{1,2}/)) {
    area = 'مدينتي';
  } else if (text.includes('التجمع')) area = 'التجمع الخامس';
  else if (text.includes('الرحاب')) area = 'الرحاب';
  else if (text.includes('القاهرة الجديدة')) area = 'القاهرة الجديدة';
  else if (text.includes('الشيخ زايد')) area = 'الشيخ زايد';
  
  // Extract specific location (B-series code)
  let location = null;
  const bMatch = text.match(/[bB](\d{1,2})/i);
  if (bMatch) {
    location = `B${bMatch[1]}`;
  }
  
  // Format time
  const messageTime = new Date(msg.createdAt).toLocaleString('en-EG', {
    timeZone: 'Africa/Cairo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });
  
  return {
    name,
    phone,
    propertyType,
    budget,
    area,
    location,
    messageTime,
    originalMessage: text.substring(0, 200),
    source: msg.groupName
  };
}

/**
 * Create Excel workbook with today's data
 */
export async function generateTodayReport(): Promise<{ url: string; key: string }> {
  const connection = await createConnection(process.env.DATABASE_URL || '');
  
  try {
    // Get today's messages
    const [todayMessages] = await connection.execute(`
      SELECT 
        id,
        messageText,
        classification,
        createdAt,
        sender,
        senderName,
        groupName
      FROM messages
      WHERE DATE(createdAt) = CURDATE()
      ORDER BY createdAt DESC
    `) as any;
    
    // Create workbook
    const workbook = new ExcelJS.Workbook();
    
    // Summary sheet
    const summarySheet = workbook.addWorksheet('Summary');
    summarySheet.columns = [
      { header: 'Metric', key: 'metric', width: 30 },
      { header: 'Value', key: 'value', width: 15 }
    ];
    
    const demandCount = todayMessages.filter((m: any) => m.classification === 'demand').length;
    const supplyCount = todayMessages.filter((m: any) => m.classification === 'supply').length;
    
    summarySheet.addRows([
      { metric: 'Total Messages Today', value: todayMessages.length },
      { metric: 'Demand (مطلوب)', value: demandCount },
      { metric: 'Supply (عرض)', value: supplyCount },
      { metric: 'Generated At', value: new Date().toLocaleString('en-EG', { timeZone: 'Africa/Cairo' }) }
    ]);
    
    // Demand sheet
    const demandSheet = workbook.addWorksheet('Demand');
    demandSheet.columns = [
      { header: 'Time', key: 'time', width: 20 },
      { header: 'Name', key: 'name', width: 20 },
      { header: 'Phone', key: 'phone', width: 15 },
      { header: 'Property Type', key: 'propertyType', width: 15 },
      { header: 'Budget', key: 'budget', width: 15 },
      { header: 'Area', key: 'area', width: 15 },
      { header: 'Location', key: 'location', width: 10 },
      { header: 'Source', key: 'source', width: 25 },
      { header: 'Original Message', key: 'originalMessage', width: 40 }
    ];
    
    // Supply sheet
    const supplySheet = workbook.addWorksheet('Supply');
    supplySheet.columns = [
      { header: 'Time', key: 'time', width: 20 },
      { header: 'Name', key: 'name', width: 20 },
      { header: 'Phone', key: 'phone', width: 15 },
      { header: 'Property Type', key: 'propertyType', width: 15 },
      { header: 'Price', key: 'budget', width: 15 },
      { header: 'Area', key: 'area', width: 15 },
      { header: 'Location', key: 'location', width: 10 },
      { header: 'Source', key: 'source', width: 25 },
      { header: 'Original Message', key: 'originalMessage', width: 40 }
    ];
    
    // Add data
    for (const msg of todayMessages) {
      const parsed = parseMessage(msg);
      const row = {
        time: parsed.messageTime,
        name: parsed.name,
        phone: parsed.phone,
        propertyType: parsed.propertyType || '-',
        budget: parsed.budget || '-',
        area: parsed.area || '-',
        location: parsed.location || '-',
        source: parsed.source,
        originalMessage: parsed.originalMessage
      };
      
      if (msg.classification === 'demand') {
        demandSheet.addRow(row);
      } else if (msg.classification === 'supply') {
        supplySheet.addRow(row);
      }
    }
    
    // Style sheets
    for (const sheet of [demandSheet, supplySheet]) {
      sheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
      sheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4472C4' } };
    }
    
    // Generate buffer
    const buffer = await workbook.xlsx.writeBuffer();
    
    // Upload to S3
    const timestamp = new Date().getTime();
    const key = `reports/MatchPro_Today_${timestamp}.xlsx`;
    const result = await storagePut(key, buffer as unknown as Buffer, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    
    await connection.end();
    
    return {
      url: result.url,
      key: result.key
    };
  } catch (error) {
    await connection.end();
    throw error;
  }
}
