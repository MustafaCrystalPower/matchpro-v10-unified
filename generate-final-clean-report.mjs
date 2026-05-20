#!/usr/bin/env node

import mysql from 'mysql2/promise';
import ExcelJS from 'exceljs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function parseConnectionString() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL not set');
  const urlObj = new URL(url);
  const sslParam = urlObj.searchParams.get('ssl');
  return {
    host: urlObj.hostname,
    port: parseInt(urlObj.port) || 3306,
    user: urlObj.username,
    password: urlObj.password,
    database: urlObj.pathname.slice(1),
    ssl: sslParam ? JSON.parse(sslParam) : true,
  };
}

const dbConfig = parseConnectionString();
const PROPERTY_TYPE_ORDER = ['Apartment', 'Villa', 'Studio', 'Land', 'Duplex', 'Penthouse', 'Townhouse', 'Twin House', 'Office', 'Shop', 'Building', 'Chalet', 'Other'];

function formatTimestamp(date) {
  if (!date) return 'N/A';
  const d = new Date(date);
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}`;
}

function extractPhoneNumber(phone) {
  return phone ? phone.replace(/\D/g, '') : '';
}

function classifyLocation(location) {
  if (!location) return 'Other';
  const loc = location.toLowerCase();
  if (loc.includes('b1') || loc.includes('b2') || loc.includes('b11') || loc.includes('b12') || loc.includes('madinaty') || loc.includes('مدينتي')) return 'Madinaty';
  if (loc.includes('rehab') || loc.includes('الرحاب')) return 'Rehab';
  if (loc.includes('fifth') || loc.includes('التجمع الخامس')) return 'Fifth Settlement';
  if (loc.includes('maadi') || loc.includes('maady') || loc.includes('المعادي')) return 'Maadi';
  if (loc.includes('october') || loc.includes('أكتوبر')) return '6 October';
  if (loc.includes('sheikh') || loc.includes('zayed') || loc.includes('الشيخ زايد')) return 'Sheikh Zayed';
  return 'Other';
}

const headerStyle = { fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF3b82f6' } }, font: { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 }, alignment: { horizontal: 'center', vertical: 'center', wrapText: true } };
const typeHeaderStyle = { fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF60a5fa' } }, font: { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 }, alignment: { horizontal: 'left', vertical: 'center' } };

function addDataRow(ws, d, waLink) {
  ws.addRow([d.buyerName || 'N/A', d.buyerPhone || 'N/A', waLink, d.originalMessage || 'N/A', d.propertyType || 'N/A', d.location || 'N/A', d.subArea || 'N/A', d.budget || 'N/A', d.bedrooms || 'N/A', d.areaSize || 'N/A', d.confidence || 'N/A', d.status || 'N/A', formatTimestamp(d.messageCreatedAt || d.updatedAt)]);
}

function addPurposeSheet(wb, sheetName, demands, purpose) {
  const purposeDemands = demands.filter(d => (purpose === 'Sale' && (d.purpose === 'Sale' || d.purpose === 'sale')) || (purpose === 'Rent' && (d.purpose === 'Rent' || d.purpose === 'rent')));
  if (purposeDemands.length === 0) return;

  const ws = wb.addWorksheet((sheetName + '_' + purpose).substring(0, 31));
  let rowIndex = 1;

  const byType = {};
  purposeDemands.forEach(d => { const type = d.propertyType || 'Other'; if (!byType[type]) byType[type] = []; byType[type].push(d); });

  const sortedTypes = Object.keys(byType).sort((a, b) => { const aIdx = PROPERTY_TYPE_ORDER.indexOf(a); const bIdx = PROPERTY_TYPE_ORDER.indexOf(b); return (aIdx === -1 ? 999 : aIdx) - (bIdx === -1 ? 999 : bIdx); });

  sortedTypes.forEach(propType => {
    const typeRow = ws.insertRow(rowIndex++, [propType]);
    typeRow.getCell(1).style = typeHeaderStyle;
    ws.mergeCells(`A${rowIndex - 1}:M${rowIndex - 1}`);

    const headerRow = ws.insertRow(rowIndex++, ['Buyer Name', 'Contact Number', 'WhatsApp', 'Original Message', 'Property Type', 'Location', 'Sub-Area', 'Budget (EGP)', 'Bedrooms', 'Area (sqm)', 'Confidence', 'Status', 'Updated At']);
    headerRow.eachCell(cell => Object.assign(cell, headerStyle));

    byType[propType].forEach(d => { const waLink = d.buyerPhone ? `https://wa.me/${extractPhoneNumber(d.buyerPhone)}` : ''; addDataRow(ws, d, waLink); });

    rowIndex = ws.rowCount + 1;
    ws.insertRow(rowIndex++, []);
  });

  ws.columns = [{ width: 16 }, { width: 14 }, { width: 20 }, { width: 50 }, { width: 14 }, { width: 16 }, { width: 14 }, { width: 14 }, { width: 10 }, { width: 12 }, { width: 10 }, { width: 10 }, { width: 18 }];
}

async function fetchAllData() {
  const conn = await mysql.createConnection(dbConfig);
  try {
    const demandQuery = `SELECT d.id, d.contactName as buyerName, d.contact as buyerPhone, d.propertyType, d.location, d.area as subArea, CONCAT(d.priceMin, ' - ', d.priceMax) as budget, d.bedrooms, CONCAT(d.sizeMin, ' - ', d.sizeMax) as areaSize, d.purpose, d.confidence, d.reviewStatus as status, d.createdAt as updatedAt, m.messageText as originalMessage, m.createdAt as messageCreatedAt, (SELECT COUNT(*) FROM matches WHERE demandId = d.id) as matchCount FROM demand d LEFT JOIN messages m ON d.messageId = m.id ORDER BY d.createdAt DESC, d.confidence DESC`;
    const [demands] = await conn.query(demandQuery);

    const matchQuery = `SELECT m.id, m.demandId, m.supplyId, m.matchScore as confidence, m.createdAt as updatedAt, d.contactName as buyerName, d.contact as buyerPhone, d.propertyType as demandType, d.location as demandLocation, d.purpose, d.area as subArea, CONCAT(d.priceMin, ' - ', d.priceMax) as budget, d.bedrooms, CONCAT(d.sizeMin, ' - ', d.sizeMax) as areaSize, msg.messageText as originalMessage, msg.createdAt as messageCreatedAt FROM matches m LEFT JOIN demand d ON m.demandId = d.id LEFT JOIN messages msg ON d.messageId = msg.id ORDER BY m.createdAt DESC, m.matchScore DESC`;
    const [matches] = await conn.query(matchQuery);

    return { demands, matches };
  } finally {
    await conn.end();
  }
}

function deduplicateDemands(demands) {
  const seen = new Set();
  const deduplicated = [];
  demands.forEach(d => {
    const key = `${d.buyerPhone || d.buyerName}|${d.propertyType || 'unknown'}|${d.location || 'unknown'}|${d.purpose || 'unknown'}`;
    if (!seen.has(key)) { seen.add(key); deduplicated.push(d); }
  });
  return deduplicated;
}

function deduplicateMatches(matches) {
  const seen = new Set();
  const deduplicated = [];
  matches.forEach(m => {
    const key = `${m.demandId}-${m.supplyId}`;
    if (!seen.has(key)) { seen.add(key); deduplicated.push(m); }
  });
  return deduplicated;
}

async function generateFinalReport(demands, matches) {
  const wb = new ExcelJS.Workbook();
  const uniqueDemands = deduplicateDemands(demands);
  const uniqueMatches = deduplicateMatches(matches);

  console.log(`   📊 Deduplicated: ${demands.length} → ${uniqueDemands.length} demands`);
  console.log(`   🎯 Deduplicated: ${matches.length} → ${uniqueMatches.length} matches`);

  // MATCHES SHEET
  const wsMatches = wb.addWorksheet('Matches');
  let rowIndex = 1;
  const matchHeaderRow = wsMatches.insertRow(rowIndex++, ['Buyer Name', 'Contact Number', 'WhatsApp', 'Original Message', 'Property Type', 'Location', 'Sub-Area', 'Budget (EGP)', 'Bedrooms', 'Area (sqm)', 'Match Score', 'Status', 'Updated At']);
  matchHeaderRow.eachCell(cell => Object.assign(cell, headerStyle));
  uniqueMatches.forEach(m => { const waLink = m.buyerPhone ? `https://wa.me/${extractPhoneNumber(m.buyerPhone)}` : ''; wsMatches.addRow([m.buyerName || 'N/A', m.buyerPhone || 'N/A', waLink, m.originalMessage || 'N/A', m.demandType || 'N/A', m.demandLocation || 'N/A', m.subArea || 'N/A', m.budget || 'N/A', m.bedrooms || 'N/A', m.areaSize || 'N/A', m.confidence || 'N/A', m.status || 'N/A', formatTimestamp(m.messageCreatedAt || m.updatedAt)]); });
  wsMatches.columns = [{ width: 16 }, { width: 14 }, { width: 20 }, { width: 50 }, { width: 14 }, { width: 16 }, { width: 14 }, { width: 14 }, { width: 10 }, { width: 12 }, { width: 10 }, { width: 10 }, { width: 18 }];

  // LOCATION SHEETS
  const locations = [{ name: 'Madinaty', key: 'Madinaty' }, { name: 'Rehab', key: 'Rehab' }, { name: 'Fifth Settlement', key: 'Fifth Settlement' }, { name: 'Maadi', key: 'Maadi' }, { name: '6 October', key: '6 October' }, { name: 'Sheikh Zayed', key: 'Sheikh Zayed' }];
  locations.forEach(loc => {
    const locationDemands = uniqueDemands.filter(d => classifyLocation(d.location) === loc.key);
    if (locationDemands.length > 0) { addPurposeSheet(wb, loc.name, locationDemands, 'Sale'); addPurposeSheet(wb, loc.name, locationDemands, 'Rent'); }
  });

  const today = new Date().toISOString().split('T')[0];
  const filename = `MatchPro_Final_Report_${today}.xlsx`;
  const filepath = path.join(__dirname, filename);
  await wb.xlsx.writeFile(filepath);
  return { filename, filepath, stats: { totalDemands: uniqueDemands.length, totalMatches: uniqueMatches.length } };
}

async function main() {
  try {
    console.log('\n📊 MATCHPRO FINAL DEDUPLICATED REPORT');
    console.log('='.repeat(80));
    console.log('\n🔍 Fetching all data from dashboard...');
    const { demands, matches } = await fetchAllData();
    console.log(`✅ Retrieved ${demands.length} demands and ${matches.length} matches`);
    console.log('\n📋 Generating deduplicated report...');
    const { filename, filepath, stats } = await generateFinalReport(demands, matches);
    console.log(`✅ Report created: ${filename}`);
    console.log(`📁 Location: ${filepath}`);
    console.log('\n' + '='.repeat(80));
    console.log('📊 FINAL REPORT SUMMARY:');
    console.log(`   🔵 Unique Demands: ${stats.totalDemands}`);
    console.log(`   🎯 Unique Matches: ${stats.totalMatches}`);
    console.log('   📋 Sheets: Matches + 6 Markets');
    console.log('   📑 Each market: FOR SALE & FOR RENT tabs organized by property type');
    console.log('   📅 Sorted by date (newest first)');
    console.log('='.repeat(80) + '\n');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

main();
