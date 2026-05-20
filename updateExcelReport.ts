import ExcelJS from 'exceljs';
import mysql from 'mysql2/promise';
import { createConnection } from 'mysql2/promise';
import { storagePut } from './server/storage';

interface ParsedMsg {
  time: string;
  name: string;
  phone: string;
  propertyType: string;
  budget: string;
  area: string;
  location: string;
  source: string;
  originalMessage: string;
}

function parseMessage(msg: any): ParsedMsg {
  const text = msg.messageText;
  
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
  let area = '-';
  if (text.match(/[bB]\d{1,2}/)) {
    area = 'مدينتي';
  } else if (text.includes('التجمع')) area = 'التجمع الخامس';
  else if (text.includes('الرحاب')) area = 'الرحاب';
  else if (text.includes('القاهرة الجديدة')) area = 'القاهرة الجديدة';
  else if (text.includes('الشيخ زايد')) area = 'الشيخ زايد';
  
  // Extract location
  let location = '-';
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
    minute: '2-digit'
  });
  
  return {
    time: messageTime,
    name,
    phone,
    propertyType,
    budget,
    area,
    location,
    source: msg.groupName,
    originalMessage: text.substring(0, 150)
  };
}

async function updateExcelWithData() {
  const connection = await createConnection(process.env.DATABASE_URL || '');
  
  try {
    console.log('\n🔄 جاري تحديث الملف...\n');
    
    // Load existing workbook
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile('/home/ubuntu/upload/MatchPro_Report_2026-04-21-1776785595399.xlsx');
    
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
      WHERE DATE(createdAt) = '2026-04-21'
      ORDER BY createdAt DESC
    `) as any;
    
    console.log(`📊 عدد الرسائل: ${todayMessages.length}`);
    
    // Remove old sheets and create new ones
    workbook.removeWorksheet('Matches');
    workbook.removeWorksheet('Demand');
    workbook.removeWorksheet('Supply');
    
    // Create Demand sheet
    const demandSheet = workbook.addWorksheet('Demand');
    demandSheet.columns = [
      { header: 'Time', key: 'time', width: 18 },
      { header: 'Name', key: 'name', width: 18 },
      { header: 'Phone', key: 'phone', width: 15 },
      { header: 'Property Type', key: 'propertyType', width: 15 },
      { header: 'Budget', key: 'budget', width: 15 },
      { header: 'Area', key: 'area', width: 15 },
      { header: 'Location', key: 'location', width: 10 },
      { header: 'Source', key: 'source', width: 25 },
      { header: 'Original Message', key: 'originalMessage', width: 50 }
    ];
    
    // Create Supply sheet
    const supplySheet = workbook.addWorksheet('Supply');
    supplySheet.columns = [
      { header: 'Time', key: 'time', width: 18 },
      { header: 'Name', key: 'name', width: 18 },
      { header: 'Phone', key: 'phone', width: 15 },
      { header: 'Property Type', key: 'propertyType', width: 15 },
      { header: 'Price', key: 'budget', width: 15 },
      { header: 'Area', key: 'area', width: 15 },
      { header: 'Location', key: 'location', width: 10 },
      { header: 'Source', key: 'source', width: 25 },
      { header: 'Original Message', key: 'originalMessage', width: 50 }
    ];
    
    // Add data
    let demandCount = 0;
    let supplyCount = 0;
    
    for (const msg of todayMessages) {
      const parsed = parseMessage(msg);
      
      if (msg.classification === 'demand') {
        demandSheet.addRow(parsed);
        demandCount++;
      } else if (msg.classification === 'supply') {
        supplySheet.addRow(parsed);
        supplyCount++;
      }
    }
    
    // Style headers
    for (const sheet of [demandSheet, supplySheet]) {
      const headerRow = sheet.getRow(1);
      headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4472C4' } };
      headerRow.alignment = { horizontal: 'center', vertical: 'center' };
    }
    
    console.log(`\n✅ النتائج:`);
    console.log(`   📥 Demand: ${demandCount}`);
    console.log(`   📤 Supply: ${supplyCount}`);
    
    // Save to file
    const outputPath = '/home/ubuntu/upload/MatchPro_Report_2026-04-21-UPDATED.xlsx';
    await workbook.xlsx.writeFile(outputPath);
    
    console.log(`\n💾 تم حفظ الملف: ${outputPath}`);
    
    // Upload to S3
    const buffer = await workbook.xlsx.writeBuffer();
    const result = await storagePut(
      `reports/MatchPro_Report_2026-04-21-UPDATED.xlsx`,
      buffer as unknown as Buffer,
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    
    console.log(`📥 رابط التحميل: ${result.url}\n`);
    
    await connection.end();
  } catch (error) {
    console.error('❌ خطأ:', error);
    await connection.end();
  }
}

updateExcelWithData();
