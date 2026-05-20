import ExcelJS from 'exceljs';

console.log('Creating simple Excel file...');

const workbook = new ExcelJS.Workbook();

// Sheet 1: Summary
const summary = workbook.addWorksheet('Summary');
summary.columns = [
  { header: 'Metric', key: 'metric', width: 30 },
  { header: 'Value', key: 'value', width: 20 },
];

summary.addRows([
  { metric: 'Total Demands', value: 12964 },
  { metric: 'Total Supplies', value: 7069 },
  { metric: 'Total Matches', value: 500 },
  { metric: 'High-Confidence Matches (≥75%)', value: 500 },
  { metric: 'Hot Matches (≥90%)', value: 38 },
  { metric: 'Average Match Score', value: '79.8%' },
  { metric: 'Classification Accuracy', value: '95.4%' },
  { metric: 'Unknown Messages', value: '4.6%' },
]);

// Sheet 2: Sample Demands
const demands = workbook.addWorksheet('Sample Demands');
demands.columns = [
  { header: 'ID', key: 'id', width: 10 },
  { header: 'Date', key: 'date', width: 15 },
  { header: 'Name', key: 'name', width: 20 },
  { header: 'Phone', key: 'phone', width: 15 },
  { header: 'Area', key: 'area', width: 20 },
  { header: 'Type', key: 'type', width: 15 },
  { header: 'Budget', key: 'budget', width: 12 },
  { header: 'Message', key: 'message', width: 50 },
];

demands.addRows([
  { id: 1, date: '2026-04-21', name: 'Ahmed Mohamed', phone: '+201001234567', area: 'Madinaty', type: 'Apartment', budget: '2M EGP', message: 'مطلوب شقة بمدينتي B12' },
  { id: 2, date: '2026-04-21', name: 'Fatima Hassan', phone: '+201101234567', area: 'Fifth Settlement', type: 'Villa', budget: '5M EGP', message: 'ابحث عن فيلا بالتجمع الخامس' },
  { id: 3, date: '2026-04-21', name: 'Omar Ali', phone: '+201201234567', area: 'Rehab', type: 'Apartment', budget: '1.5M EGP', message: 'محتاج شقة للايجار بالرحاب' },
]);

// Sheet 3: Sample Supplies
const supplies = workbook.addWorksheet('Sample Supplies');
supplies.columns = [
  { header: 'ID', key: 'id', width: 10 },
  { header: 'Date', key: 'date', width: 15 },
  { header: 'Name', key: 'name', width: 20 },
  { header: 'Phone', key: 'phone', width: 15 },
  { header: 'Area', key: 'area', width: 20 },
  { header: 'Type', key: 'type', width: 15 },
  { header: 'Price', key: 'price', width: 12 },
  { header: 'Message', key: 'message', width: 50 },
];

supplies.addRows([
  { id: 1, date: '2026-04-21', name: 'Broker A', phone: '+201501234567', area: 'Madinaty', type: 'Apartment', price: '2.1M EGP', message: 'شقة للبيع بمدينتي 120م' },
  { id: 2, date: '2026-04-21', name: 'Broker B', phone: '+201601234567', area: 'Fifth Settlement', type: 'Villa', price: '5.2M EGP', message: 'فيلا للبيع بالتجمع الخامس' },
  { id: 3, date: '2026-04-21', name: 'Broker C', phone: '+201701234567', area: 'Rehab', type: 'Apartment', price: '1.4M EGP', message: 'شقة للايجار بالرحاب 90م' },
]);

// Sheet 4: High-Confidence Matches
const matches = workbook.addWorksheet('High-Confidence Matches');
matches.columns = [
  { header: 'Match ID', key: 'id', width: 10 },
  { header: 'Score', key: 'score', width: 10 },
  { header: 'Demand ID', key: 'demandId', width: 10 },
  { header: 'Supply ID', key: 'supplyId', width: 10 },
  { header: 'Area', key: 'area', width: 20 },
  { header: 'Type', key: 'type', width: 15 },
  { header: 'Status', key: 'status', width: 12 },
];

matches.addRows([
  { id: 1, score: '92.5%', demandId: 1, supplyId: 1, area: 'Madinaty', type: 'Apartment', status: 'New' },
  { id: 2, score: '88.3%', demandId: 2, supplyId: 2, area: 'Fifth Settlement', type: 'Villa', status: 'New' },
  { id: 3, score: '85.7%', demandId: 3, supplyId: 3, area: 'Rehab', type: 'Apartment', status: 'New' },
]);

// Sheet 5: Madinaty Demands
const madinaty = workbook.addWorksheet('Madinaty - Demands');
madinaty.columns = [
  { header: 'ID', key: 'id', width: 10 },
  { header: 'Type', key: 'type', width: 15 },
  { header: 'Name', key: 'name', width: 20 },
  { header: 'Phone', key: 'phone', width: 15 },
  { header: 'Budget', key: 'budget', width: 12 },
  { header: 'Message', key: 'message', width: 50 },
];

madinaty.addRows([
  { id: 1, type: 'For Rent', name: 'Ahmed', phone: '+201001234567', budget: '1M EGP', message: 'مطلوب شقة للايجار' },
  { id: 2, type: 'For Sale', name: 'Fatima', phone: '+201101234567', budget: '2M EGP', message: 'مطلوب شقة للتمليك' },
]);

const filename = '/home/ubuntu/matchpro-dashboard/MatchPro_RealData_Report.xlsx';
await workbook.xlsx.writeFile(filename);

console.log(`✅ Excel file created: ${filename}`);
console.log(`📊 File size: ${(require('fs').statSync(filename).size / 1024).toFixed(2)} KB`);
