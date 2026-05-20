import ExcelJS from 'exceljs';
import { getDb } from './server/db.ts';

console.log('🔄 Fetching real data from database...');

const db = await getDb();

// Get all demands
const demands = await db.all(`
  SELECT * FROM messages 
  WHERE classification = 'demand' 
  ORDER BY createdAt DESC 
  LIMIT 5000
`);

// Get all supplies
const supplies = await db.all(`
  SELECT * FROM messages 
  WHERE classification = 'supply' 
  ORDER BY createdAt DESC 
  LIMIT 5000
`);

// Get matches
const matches = await db.all(`
  SELECT * FROM matches 
  WHERE deletedAt IS NULL 
  ORDER BY matchScore DESC 
  LIMIT 1000
`);

console.log(`✅ Fetched ${demands.length} demands, ${supplies.length} supplies, ${matches.length} matches`);

// Create workbook
const workbook = new ExcelJS.Workbook();

// Helper function to format cell
function formatCell(ws, row, col, value, style = {}) {
  const cell = ws.getCell(row, col);
  cell.value = value;
  Object.assign(cell, style);
}

// Sheet 1: Summary
console.log('📝 Creating Summary sheet...');
const summary = workbook.addWorksheet('Summary');
summary.columns = [
  { header: 'Metric', key: 'metric', width: 30 },
  { header: 'Value', key: 'value', width: 20 },
];

const summaryData = [
  { metric: 'Total Demands', value: demands.length },
  { metric: 'Total Supplies', value: supplies.length },
  { metric: 'Total Matches', value: matches.length },
  { metric: 'High-Confidence Matches (≥75%)', value: matches.filter(m => m.matchScore >= 75).length },
  { metric: 'Hot Matches (≥90%)', value: matches.filter(m => m.matchScore >= 90).length },
  { metric: 'Average Match Score', value: (matches.reduce((a, m) => a + m.matchScore, 0) / matches.length).toFixed(2) },
];

summary.addRows(summaryData);

// Sheet 2: All Demands
console.log('📝 Creating Demands sheet...');
const demandsSheet = workbook.addWorksheet('All Demands');
demandsSheet.columns = [
  { header: 'ID', key: 'id', width: 10 },
  { header: 'Date', key: 'createdAt', width: 15 },
  { header: 'Name', key: 'senderName', width: 20 },
  { header: 'Phone', key: 'senderPhone', width: 15 },
  { header: 'Area', key: 'area', width: 20 },
  { header: 'Property Type', key: 'propertyType', width: 15 },
  { header: 'Budget', key: 'budget', width: 12 },
  { header: 'Message', key: 'content', width: 50 },
];

demands.forEach(d => {
  demandsSheet.addRow({
    id: d.id,
    createdAt: new Date(d.createdAt).toLocaleDateString(),
    senderName: d.senderName || 'Unknown',
    senderPhone: d.senderPhone || 'N/A',
    area: d.area || 'Unknown',
    propertyType: d.propertyType || 'N/A',
    budget: d.budget || 'N/A',
    content: d.content?.substring(0, 100) || 'N/A',
  });
});

// Sheet 3: All Supplies
console.log('📝 Creating Supplies sheet...');
const suppliesSheet = workbook.addWorksheet('All Supplies');
suppliesSheet.columns = [
  { header: 'ID', key: 'id', width: 10 },
  { header: 'Date', key: 'createdAt', width: 15 },
  { header: 'Name', key: 'senderName', width: 20 },
  { header: 'Phone', key: 'senderPhone', width: 15 },
  { header: 'Area', key: 'area', width: 20 },
  { header: 'Property Type', key: 'propertyType', width: 15 },
  { header: 'Price', key: 'price', width: 12 },
  { header: 'Message', key: 'content', width: 50 },
];

supplies.forEach(s => {
  suppliesSheet.addRow({
    id: s.id,
    createdAt: new Date(s.createdAt).toLocaleDateString(),
    senderName: s.senderName || 'Unknown',
    senderPhone: s.senderPhone || 'N/A',
    area: s.area || 'Unknown',
    propertyType: s.propertyType || 'N/A',
    price: s.price || 'N/A',
    content: s.content?.substring(0, 100) || 'N/A',
  });
});

// Sheet 4: High-Confidence Matches
console.log('📝 Creating High-Confidence Matches sheet...');
const highConfMatches = matches.filter(m => m.matchScore >= 75);
const matchesSheet = workbook.addWorksheet('High-Confidence Matches');
matchesSheet.columns = [
  { header: 'Match ID', key: 'id', width: 10 },
  { header: 'Score', key: 'matchScore', width: 10 },
  { header: 'Demand', key: 'demandId', width: 10 },
  { header: 'Supply', key: 'supplyId', width: 10 },
  { header: 'Status', key: 'status', width: 12 },
  { header: 'Created', key: 'createdAt', width: 15 },
];

highConfMatches.forEach(m => {
  matchesSheet.addRow({
    id: m.id,
    matchScore: m.matchScore?.toFixed(2) || 'N/A',
    demandId: m.demandId,
    supplyId: m.supplyId,
    status: m.status || 'new',
    createdAt: new Date(m.createdAt).toLocaleDateString(),
  });
});

// Sheet 5: Hot Matches (≥90%)
console.log('📝 Creating Hot Matches sheet...');
const hotMatches = matches.filter(m => m.matchScore >= 90);
const hotMatchesSheet = workbook.addWorksheet('Hot Matches (90%+)');
hotMatchesSheet.columns = [
  { header: 'Match ID', key: 'id', width: 10 },
  { header: 'Score', key: 'matchScore', width: 10 },
  { header: 'Demand ID', key: 'demandId', width: 10 },
  { header: 'Supply ID', key: 'supplyId', width: 10 },
  { header: 'Status', key: 'status', width: 12 },
];

hotMatches.forEach(m => {
  hotMatchesSheet.addRow({
    id: m.id,
    matchScore: m.matchScore?.toFixed(2) || 'N/A',
    demandId: m.demandId,
    supplyId: m.supplyId,
    status: m.status || 'new',
  });
});

// Save file
const filename = `/home/ubuntu/matchpro-dashboard/MatchPro_RealData_${Date.now()}.xlsx`;
await workbook.xlsx.writeFile(filename);

console.log(`✅ Excel file created: ${filename}`);
console.log(`📊 Summary:`);
console.log(`   - Demands: ${demands.length}`);
console.log(`   - Supplies: ${supplies.length}`);
console.log(`   - Total Matches: ${matches.length}`);
console.log(`   - High-Confidence (≥75%): ${highConfMatches.length}`);
console.log(`   - Hot Matches (≥90%): ${hotMatches.length}`);
console.log(`   - Average Score: ${(matches.reduce((a, m) => a + m.matchScore, 0) / matches.length).toFixed(2)}`);
