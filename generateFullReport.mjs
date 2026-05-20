import ExcelJS from 'exceljs';
import mysql from 'mysql2/promise';

const pool = mysql.createPool({
  host: process.env.DATABASE_URL?.split('@')[1]?.split('/')[0] || 'localhost',
  user: process.env.DATABASE_URL?.split('://')[1]?.split(':')[0] || 'root',
  password: process.env.DATABASE_URL?.split(':')[2]?.split('@')[0] || '',
  database: process.env.DATABASE_URL?.split('/').pop() || 'matchpro',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

console.log('🔄 Fetching real data from database...');

try {
  const connection = await pool.getConnection();

  // Fetch demands
  const [demands] = await connection.query(`
    SELECT * FROM messages 
    WHERE classification = 'demand' 
    ORDER BY createdAt DESC 
    LIMIT 5000
  `);

  // Fetch supplies
  const [supplies] = await connection.query(`
    SELECT * FROM messages 
    WHERE classification = 'supply' 
    ORDER BY createdAt DESC 
    LIMIT 5000
  `);

  // Fetch matches
  const [matches] = await connection.query(`
    SELECT * FROM matches 
    WHERE deletedAt IS NULL 
    ORDER BY matchScore DESC 
    LIMIT 1000
  `);

  connection.release();

  console.log(`✅ Fetched ${demands.length} demands, ${supplies.length} supplies, ${matches.length} matches`);

  // Create workbook
  const workbook = new ExcelJS.Workbook();

  // Define areas
  const areas = {
    'مدينتي': 'Madinaty',
    'التجمع الخامس': 'Fifth Settlement',
    'الرحاب': 'Rehab',
    'الشيخ زايد': 'Sheikh Zayed',
    'الساحل الشمالي': 'North Coast',
    'مدينة نصر': 'Nasr City',
    'مدينة نور': 'Madinet Nour',
    'العاصمة الإدارية': 'Admin Capital',
    'مدينة بدر': 'Madinet Badr',
  };

  // Helper function to format date
  const formatDate = (date) => new Date(date).toLocaleDateString('ar-EG');

  // Helper function to create header row
  const createHeaderRow = (worksheet, headers) => {
    const headerRow = worksheet.addRow(headers);
    headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF003366' } };
    headerRow.alignment = { horizontal: 'center', vertical: 'center' };
  };

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
    { metric: 'Average Match Score', value: matches.length > 0 ? (matches.reduce((a, m) => a + (m.matchScore || 0), 0) / matches.length).toFixed(2) : 'N/A' },
  ];

  summary.addRows(summaryData);

  // Sheet 2: All Demands
  console.log('📝 Creating All Demands sheet...');
  const demandsSheet = workbook.addWorksheet('All Demands');
  demandsSheet.columns = [
    { header: 'ID', key: 'id', width: 8 },
    { header: 'Date', key: 'createdAt', width: 12 },
    { header: 'Name', key: 'senderName', width: 15 },
    { header: 'Phone', key: 'senderPhone', width: 15 },
    { header: 'Area', key: 'area', width: 18 },
    { header: 'Type', key: 'propertyType', width: 12 },
    { header: 'Budget', key: 'budget', width: 12 },
    { header: 'Message', key: 'content', width: 40 },
  ];

  createHeaderRow(demandsSheet, demandsSheet.columns.map(c => c.header));

  demands.slice(0, 1000).forEach((d, idx) => {
    demandsSheet.addRow({
      id: d.id,
      createdAt: formatDate(d.createdAt),
      senderName: d.senderName || 'Unknown',
      senderPhone: d.senderPhone || 'N/A',
      area: d.area || 'Unknown',
      propertyType: d.propertyType || 'N/A',
      budget: d.budget || 'N/A',
      content: d.content?.substring(0, 50) || 'N/A',
    });
    if (idx % 2 === 0) {
      demandsSheet.getRow(idx + 2).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF0F0F0' } };
    }
  });

  // Sheet 3: All Supplies
  console.log('📝 Creating All Supplies sheet...');
  const suppliesSheet = workbook.addWorksheet('All Supplies');
  suppliesSheet.columns = [
    { header: 'ID', key: 'id', width: 8 },
    { header: 'Date', key: 'createdAt', width: 12 },
    { header: 'Name', key: 'senderName', width: 15 },
    { header: 'Phone', key: 'senderPhone', width: 15 },
    { header: 'Area', key: 'area', width: 18 },
    { header: 'Type', key: 'propertyType', width: 12 },
    { header: 'Price', key: 'price', width: 12 },
    { header: 'Message', key: 'content', width: 40 },
  ];

  createHeaderRow(suppliesSheet, suppliesSheet.columns.map(c => c.header));

  supplies.slice(0, 1000).forEach((s, idx) => {
    suppliesSheet.addRow({
      id: s.id,
      createdAt: formatDate(s.createdAt),
      senderName: s.senderName || 'Unknown',
      senderPhone: s.senderPhone || 'N/A',
      area: s.area || 'Unknown',
      propertyType: s.propertyType || 'N/A',
      price: s.price || 'N/A',
      content: s.content?.substring(0, 50) || 'N/A',
    });
    if (idx % 2 === 0) {
      suppliesSheet.getRow(idx + 2).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF0F0F0' } };
    }
  });

  // Sheet 4: High-Confidence Matches
  console.log('📝 Creating High-Confidence Matches sheet...');
  const highConfMatches = matches.filter(m => m.matchScore >= 75);
  const matchesSheet = workbook.addWorksheet('High-Confidence Matches');
  matchesSheet.columns = [
    { header: 'Match ID', key: 'id', width: 10 },
    { header: 'Score', key: 'matchScore', width: 10 },
    { header: 'Demand ID', key: 'demandId', width: 10 },
    { header: 'Supply ID', key: 'supplyId', width: 10 },
    { header: 'Status', key: 'status', width: 12 },
    { header: 'Created', key: 'createdAt', width: 12 },
  ];

  createHeaderRow(matchesSheet, matchesSheet.columns.map(c => c.header));

  highConfMatches.forEach((m, idx) => {
    matchesSheet.addRow({
      id: m.id,
      matchScore: m.matchScore?.toFixed(2) || 'N/A',
      demandId: m.demandId,
      supplyId: m.supplyId,
      status: m.status || 'new',
      createdAt: formatDate(m.createdAt),
    });
    if (idx % 2 === 0) {
      matchesSheet.getRow(idx + 2).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF0F0F0' } };
    }
  });

  // Sheet 5: Hot Matches
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

  createHeaderRow(hotMatchesSheet, hotMatchesSheet.columns.map(c => c.header));

  hotMatches.forEach((m, idx) => {
    hotMatchesSheet.addRow({
      id: m.id,
      matchScore: m.matchScore?.toFixed(2) || 'N/A',
      demandId: m.demandId,
      supplyId: m.supplyId,
      status: m.status || 'new',
    });
    if (idx % 2 === 0) {
      hotMatchesSheet.getRow(idx + 2).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFCC00' } };
    }
  });

  // Sheets 6-15: Location-specific Demand sheets
  for (const [areaAr, areaEn] of Object.entries(areas)) {
    console.log(`📝 Creating ${areaAr} - Demand sheet...`);
    const areaSheet = workbook.addWorksheet(`${areaAr} - Demand`);
    
    areaSheet.columns = [
      { header: 'ID', key: 'id', width: 8 },
      { header: 'Type', key: 'type', width: 12 },
      { header: 'Name', key: 'senderName', width: 15 },
      { header: 'Phone', key: 'senderPhone', width: 15 },
      { header: 'Budget', key: 'budget', width: 12 },
      { header: 'Date', key: 'createdAt', width: 12 },
      { header: 'Message', key: 'content', width: 40 },
    ];

    // Add summary at top
    areaSheet.addRow([]);
    areaSheet.addRow(['المنطقة:', areaAr]);
    areaSheet.addRow([]);

    createHeaderRow(areaSheet, areaSheet.columns.map(c => c.header));

    const areaDemands = demands.filter(d => d.area === areaAr || d.area === areaEn);
    const forRent = areaDemands.filter(d => d.content?.includes('إيجار') || d.content?.includes('rent'));
    const forSale = areaDemands.filter(d => !forRent.includes(d));

    // For Rent section
    forRent.slice(0, 50).forEach((d, idx) => {
      areaSheet.addRow({
        id: d.id,
        type: 'For Rent',
        senderName: d.senderName || 'Unknown',
        senderPhone: d.senderPhone || 'N/A',
        budget: d.budget || 'N/A',
        createdAt: formatDate(d.createdAt),
        content: d.content?.substring(0, 50) || 'N/A',
      });
    });

    // For Sale section
    forSale.slice(0, 50).forEach((d, idx) => {
      areaSheet.addRow({
        id: d.id,
        type: 'For Sale',
        senderName: d.senderName || 'Unknown',
        senderPhone: d.senderPhone || 'N/A',
        budget: d.budget || 'N/A',
        createdAt: formatDate(d.createdAt),
        content: d.content?.substring(0, 50) || 'N/A',
      });
    });
  }

  // Sheet 16: Supply (All areas)
  console.log('📝 Creating Supply sheet...');
  const supplySheet = workbook.addWorksheet('Supply');
  supplySheet.columns = [
    { header: 'ID', key: 'id', width: 8 },
    { header: 'Area', key: 'area', width: 18 },
    { header: 'Type', key: 'type', width: 12 },
    { header: 'Name', key: 'senderName', width: 15 },
    { header: 'Phone', key: 'senderPhone', width: 15 },
    { header: 'Price', key: 'price', width: 12 },
    { header: 'Date', key: 'createdAt', width: 12 },
    { header: 'Message', key: 'content', width: 40 },
  ];

  createHeaderRow(supplySheet, supplySheet.columns.map(c => c.header));

  supplies.slice(0, 1000).forEach((s, idx) => {
    supplySheet.addRow({
      id: s.id,
      area: s.area || 'Unknown',
      type: s.propertyType || 'N/A',
      senderName: s.senderName || 'Unknown',
      senderPhone: s.senderPhone || 'N/A',
      price: s.price || 'N/A',
      createdAt: formatDate(s.createdAt),
      content: s.content?.substring(0, 50) || 'N/A',
    });
    if (idx % 2 === 0) {
      supplySheet.getRow(idx + 2).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF0F0F0' } };
    }
  });

  // Sheet 17: High Priority Demands
  console.log('📝 Creating High Priority Demands sheet...');
  const prioritySheet = workbook.addWorksheet('High Priority Demands');
  prioritySheet.columns = [
    { header: 'ID', key: 'id', width: 8 },
    { header: 'Priority', key: 'priority', width: 10 },
    { header: 'Name', key: 'senderName', width: 15 },
    { header: 'Phone', key: 'senderPhone', width: 15 },
    { header: 'Area', key: 'area', width: 18 },
    { header: 'Budget', key: 'budget', width: 12 },
    { header: 'Date', key: 'createdAt', width: 12 },
    { header: 'Message', key: 'content', width: 40 },
  ];

  createHeaderRow(prioritySheet, prioritySheet.columns.map(c => c.header));

  const priorityKeywords = ['أنا المشتري', 'أنا البايع', 'أنا المالك', 'من المالك', 'urgent', 'ASAP'];
  const priorityDemands = demands.filter(d => 
    priorityKeywords.some(kw => d.content?.includes(kw))
  );

  priorityDemands.slice(0, 500).forEach((d, idx) => {
    const row = prioritySheet.addRow({
      id: d.id,
      priority: '🔴 HIGH',
      senderName: d.senderName || 'Unknown',
      senderPhone: d.senderPhone || 'N/A',
      area: d.area || 'Unknown',
      budget: d.budget || 'N/A',
      createdAt: formatDate(d.createdAt),
      content: d.content?.substring(0, 50) || 'N/A',
    });
    row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFF6B6B' } };
  });

  // Save file
  const filename = `/home/ubuntu/matchpro-dashboard/MatchPro_Full_Report_${Date.now()}.xlsx`;
  await workbook.xlsx.writeFile(filename);

  console.log(`✅ Excel file created: ${filename}`);
  console.log(`📊 Summary:`);
  console.log(`   - Total Sheets: 17`);
  console.log(`   - Demands: ${demands.length}`);
  console.log(`   - Supplies: ${supplies.length}`);
  console.log(`   - Matches: ${matches.length}`);
  console.log(`   - High-Confidence: ${highConfMatches.length}`);
  console.log(`   - Hot Matches: ${hotMatches.length}`);
  console.log(`   - Priority Demands: ${priorityDemands.length}`);

  process.exit(0);
} catch (error) {
  console.error('❌ Error:', error.message);
  process.exit(1);
}
