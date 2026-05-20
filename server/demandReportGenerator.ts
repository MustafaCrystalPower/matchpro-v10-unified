/**
 * Demand-Only Report Generator for Email Delivery
 * Generates Excel reports with only demand messages, sorted by area
 * Includes archive functionality to mark demands as sent
 */

import ExcelJS from 'exceljs';
import { storagePut } from './storage';
import { createConnection } from 'mysql2/promise';

interface DemandMessage {
  id: number;
  messageText: string;
  createdAt: Date;
  senderName: string;
  sender: string;
  groupName: string;
  area: string;
  type: 'For Rent' | 'For Sale' | 'Unknown';
  propertyType: string;
  budget: string;
  location: string;
}

function extractArea(text: string): string {
  if (text.match(/[bB]\d{1,2}/)) return 'مدينتي';
  if (text.includes('التجمع')) return 'التجمع الخامس';
  if (text.includes('الرحاب')) return 'الرحاب';
  if (text.includes('القاهرة الجديدة')) return 'القاهرة الجديدة';
  if (text.includes('الشيخ زايد')) return 'الشيخ زايد';
  if (text.includes('مدينة نصر')) return 'مدينة نصر';
  if (text.includes('المعادي')) return 'المعادي';
  if (text.includes('6 اكتوبر')) return '6 اكتوبر';
  if (text.includes('الساحل')) return 'الساحل الشمالي';
  if (text.includes('العاصمة')) return 'العاصمة الإدارية';
  return 'Other';
}

function extractType(text: string): 'For Rent' | 'For Sale' | 'Unknown' {
  const lowerText = text.toLowerCase();
  if (text.includes('للبيع') || text.includes('للـبيع') || text.includes('تمليك') ||
      lowerText.includes('for sale') || lowerText.includes('buy')) {
    return 'For Sale';
  }
  if (text.includes('للايجار') || text.includes('للإيجار') || text.includes('للـايجار') ||
      lowerText.includes('for rent') || lowerText.includes('rent') || lowerText.includes('lease')) {
    return 'For Rent';
  }
  return 'Unknown';
}

function extractPropertyType(text: string): string {
  if (text.includes('شقة') || text.includes('apartment')) return 'Apartment';
  if (text.includes('فيلا') || text.includes('villa')) return 'Villa';
  if (text.includes('دوبلكس')) return 'Duplex';
  if (text.includes('استوديو') || text.includes('studio')) return 'Studio';
  if (text.includes('أرض') || text.includes('land')) return 'Land';
  if (text.includes('تاون') || text.includes('townhouse')) return 'Townhouse';
  return '-';
}

function extractBudget(text: string): string {
  const priceMatch = text.match(/(\d+(?:[,.]?\d+)?)\s*(مليون|الف|thousand|k|egp|le)?/i);
  if (!priceMatch) return '-';
  
  let num = parseFloat(priceMatch[1].replace(',', '.'));
  const unit = priceMatch[2]?.toLowerCase() || '';
  
  if (unit.includes('مليون') || unit.includes('million') || unit === 'm') {
    num *= 1000000;
  } else if (unit.includes('الف') || unit.includes('ألف') || unit.includes('thousand') || unit === 'k') {
    num *= 1000;
  }
  
  return `${num.toLocaleString()} EGP`;
}

function extractLocation(text: string): string {
  const bMatch = text.match(/[bB](\d{1,2})/i);
  if (bMatch) return `B${bMatch[1]}`;
  return '-';
}

function extractPhone(text: string, sender: string): string {
  const phoneMatch = text.match(/0[1125]\d{8}/);
  return phoneMatch ? phoneMatch[0] : sender.replace('@c.us', '');
}

export async function generateDemandReport(archiveAfterSending = true): Promise<{ url: string; key: string; demandCount: number }> {
  const connection = await createConnection(process.env.DATABASE_URL || '');
  
  try {
    console.log('\n📋 جاري إنشاء تقرير الطلبات (Demand Only)...\n');
    
    // Get unarchived demand messages from last 3 days
    const [demands] = await connection.execute(`
      SELECT 
        id,
        messageText,
        createdAt,
        sender,
        senderName,
        groupName
      FROM messages
      WHERE classification = 'demand'
      AND archived_at IS NULL
      AND createdAt >= DATE_SUB(NOW(), INTERVAL 3 DAY)
      ORDER BY createdAt DESC
    `) as any;
    
    console.log(`📥 عدد الطلبات: ${demands.length}`);
    
    // Parse demands
    const parsedDemands: DemandMessage[] = demands.map((msg: any) => ({
      id: msg.id,
      messageText: msg.messageText,
      createdAt: msg.createdAt,
      senderName: msg.senderName || 'Unknown',
      sender: msg.sender,
      groupName: msg.groupName,
      area: extractArea(msg.messageText),
      type: extractType(msg.messageText),
      propertyType: extractPropertyType(msg.messageText),
      budget: extractBudget(msg.messageText),
      location: extractLocation(msg.messageText)
    }));
    
    // Group by area
    const demandsByArea: { [key: string]: DemandMessage[] } = {};
    for (const demand of parsedDemands) {
      if (!demandsByArea[demand.area]) {
        demandsByArea[demand.area] = [];
      }
      demandsByArea[demand.area].push(demand);
    }
    
    // Create workbook
    const workbook = new ExcelJS.Workbook();
    
    // Add summary sheet
    const summarySheet = workbook.addWorksheet('Summary');
    summarySheet.columns = [
      { header: 'Area', key: 'area', width: 20 },
      { header: 'For Rent', key: 'forRent', width: 12 },
      { header: 'For Sale', key: 'forSale', width: 12 },
      { header: 'Total', key: 'total', width: 12 }
    ];
    
    let totalDemands = 0;
    for (const [area, areaMessages] of Object.entries(demandsByArea)) {
      const forRent = areaMessages.filter(d => d.type === 'For Rent').length;
      const forSale = areaMessages.filter(d => d.type === 'For Sale').length;
      totalDemands += areaMessages.length;
      
      summarySheet.addRow({
        area,
        forRent,
        forSale,
        total: areaMessages.length
      });
    }
    
    // Add area sheets
    for (const [area, areaMessages] of Object.entries(demandsByArea)) {
      const areaSheet = workbook.addWorksheet(`${area} - Demand`);
      areaSheet.columns = [
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
      
      // Sort: For Rent first → For Sale → Time (newest first) → Budget (highest first)
      const sorted = areaMessages.sort((a, b) => {
        // 1. Type: For Rent first
        if (a.type !== b.type) {
          if (a.type === 'For Rent') return -1;
          if (b.type === 'For Rent') return 1;
        }
        // 2. Time: Newest first
        const timeA = new Date(a.createdAt).getTime();
        const timeB = new Date(b.createdAt).getTime();
        if (timeA !== timeB) return timeB - timeA;
        // 3. Budget: Highest first
        const budgetA = parseFloat(a.budget.replace(/[^\d.]/g, ''));
        const budgetB = parseFloat(b.budget.replace(/[^\d.]/g, ''));
        return budgetB - budgetA;
      });
      
      for (const demand of sorted) {
        const messageTime = new Date(demand.createdAt).toLocaleString('en-EG', {
          timeZone: 'Africa/Cairo',
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit'
        });
        
        areaSheet.addRow({
          time: messageTime,
          name: demand.senderName,
          phone: extractPhone(demand.messageText, demand.sender),
          propertyType: demand.propertyType,
          budget: demand.budget,
          location: demand.location,
          type: demand.type,
          source: demand.groupName,
          originalMessage: demand.messageText.substring(0, 150)
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
    
    console.log(`✅ النتائج:`);
    console.log(`   📥 إجمالي الطلبات: ${totalDemands}`);
    console.log(`   📍 عدد المناطق: ${Object.keys(demandsByArea).length}`);
    
    // Generate buffer
    const buffer = await workbook.xlsx.writeBuffer();
    
    // Upload to S3
    const timestamp = new Date().getTime();
    const key = `reports/MatchPro_Demand_Report_${timestamp}.xlsx`;
    const result = await storagePut(key, buffer as unknown as Buffer, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    
    console.log(`\n✅ تم الرفع بنجاح!`);
    console.log(`📥 الرابط: ${result.url}\n`);
    
    // Archive demands if requested
    if (archiveAfterSending && totalDemands > 0) {
      const demandIds = parsedDemands.map(d => d.id);
      const placeholders = demandIds.map(() => '?').join(',');
      
      await connection.execute(`
        UPDATE messages 
        SET archived_at = NOW() 
        WHERE id IN (${placeholders})
      `, demandIds as any);
      
      console.log(`✅ تم أرشفة ${totalDemands} طلب\n`);
    }
    
    await connection.end();
    
    return { ...result, demandCount: totalDemands };
  } catch (error) {
    console.error('❌ خطأ:', error);
    await connection.end();
    throw error;
  }
}
