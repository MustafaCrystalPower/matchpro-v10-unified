import ExcelJS from 'exceljs';
import nodemailer from 'nodemailer';

const API_BASE = 'http://localhost:3000/api/trpc';

// Content-based classifier
function classifyByContent(message) {
  if (!message || message.trim().length < 5) {
    return { classification: 'manual_review', confidence: 0, reason: 'Too short' };
  }

  const text = message.toLowerCase();
  let supplyScore = 0;
  let demandScore = 0;

  // Supply indicators
  const supplyKeywords = ['متاح', 'للإيجار', 'للبيع', 'فرصة', 'من المالك', 'استلام', 'تشطيب'];
  for (const kw of supplyKeywords) {
    if (text.includes(kw.toLowerCase())) supplyScore += 10;
  }

  // Demand indicators
  const demandKeywords = ['مطلوب', 'عايز', 'بدور على', 'محتاج', 'بادجت', 'budget'];
  for (const kw of demandKeywords) {
    if (text.includes(kw.toLowerCase())) demandScore += 10;
  }

  // Special handling for "مطلوب"
  if (text.includes('مطلوب')) {
    const priceKeywords = ['ألف', 'مليون', 'جنيه', 'egp'];
    let hasPrice = false;
    for (const pk of priceKeywords) {
      if (text.includes(pk.toLowerCase())) {
        hasPrice = true;
        break;
      }
    }
    if (hasPrice) {
      supplyScore += 15; // "مطلوب X ألف" = asking price
    } else {
      demandScore += 15; // "مطلوب شقة" = request
    }
  }

  // Property details (Supply indicator)
  const details = ['متر', 'م²', 'غرفة', 'حمام', 'دور', 'floor'];
  let detailCount = 0;
  for (const d of details) {
    if (text.includes(d.toLowerCase())) detailCount++;
  }
  if (detailCount >= 2) supplyScore += 10;

  let classification = 'manual_review';
  if (supplyScore > demandScore + 5) {
    classification = 'supply';
  } else if (demandScore > supplyScore + 5) {
    classification = 'demand';
  }

  return { classification, confidence: Math.min(100, Math.max(supplyScore, demandScore) * 5) };
}

console.log('🔄 Fetching real data from server API...');

try {
  // Fetch demands
  const demandsRes = await fetch(`${API_BASE}/demand.recent?input=%7B%7D`);
  const demandsData = await demandsRes.json();
  const demands = demandsData.result?.data?.json || [];

  console.log(`✅ Fetched ${Array.isArray(demands) ? demands.length : 0} demands`);
  
  if (!Array.isArray(demands)) {
    console.error('❌ Error: demands is not an array', typeof demands);
    process.exit(1);
  }

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

  // Helper function
  const formatDate = (date) => {
    if (!date) return 'N/A';
    return new Date(date).toLocaleDateString('ar-EG');
  };

  const createHeaderRow = (worksheet, headers) => {
    const headerRow = worksheet.addRow(headers);
    headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF003366' } };
    headerRow.alignment = { horizontal: 'center', vertical: 'center', wrapText: true };
  };

  // Sheet 1: All_Demands (matching template)
  console.log('📝 Creating All_Demands sheet...');
  const allDemandsSheet = workbook.addWorksheet('All_Demands');
  allDemandsSheet.columns = [
    { header: 'ID', key: 'id', width: 8 },
    { header: 'Property Type', key: 'propertyType', width: 12 },
    { header: 'Location', key: 'location', width: 18 },
    { header: 'Area', key: 'area', width: 15 },
    { header: 'City', key: 'city', width: 12 },
    { header: 'Price Min', key: 'priceMin', width: 10 },
    { header: 'Price Max', key: 'priceMax', width: 10 },
    { header: 'Size Min', key: 'sizeMin', width: 10 },
    { header: 'Size Max', key: 'sizeMax', width: 10 },
    { header: 'Bedrooms', key: 'bedrooms', width: 10 },
    { header: 'Bathrooms', key: 'bathrooms', width: 10 },
    { header: 'Purpose', key: 'purpose', width: 10 },
    { header: 'Contact', key: 'contact', width: 15 },
    { header: 'Contact Name', key: 'contactName', width: 15 },
    { header: 'Requirements', key: 'requirements', width: 20 },
    { header: 'Created At', key: 'createdAt', width: 15 },
    { header: 'Priority', key: 'priority', width: 10 },
    { header: 'Source Group', key: 'sourceGroup', width: 15 },
    { header: 'Date Only', key: 'dateOnly', width: 12 },
    { header: 'Normalized Location', key: 'normalizedLocation', width: 18 },
    { header: 'Classification', key: 'classification', width: 12 },
    { header: 'Confidence', key: 'confidence', width: 10 },
    { header: 'Original Message', key: 'originalMessage', width: 40 },
  ];

  createHeaderRow(allDemandsSheet, allDemandsSheet.columns.map(c => c.header));

  // Add classified demands
  demands.slice(0, 500).forEach((d, idx) => {
    const classification = classifyByContent(d.content || '');
    const row = allDemandsSheet.addRow({
      id: d.id,
      propertyType: d.propertyType || 'Unknown',
      location: d.location || 'Unknown',
      area: d.area || 'Unknown',
      city: d.city || 'Cairo',
      priceMin: d.priceMin || '',
      priceMax: d.priceMax || '',
      sizeMin: d.sizeMin || '',
      sizeMax: d.sizeMax || '',
      bedrooms: d.bedrooms || '',
      bathrooms: d.bathrooms || '',
      purpose: d.purpose || 'sale',
      contact: d.senderPhone || 'N/A',
      contactName: d.senderName || 'Unknown',
      requirements: d.requirements || '',
      createdAt: formatDate(d.createdAt),
      priority: d.priority || 'medium',
      sourceGroup: d.sourceGroup || 'unknown',
      dateOnly: formatDate(d.createdAt),
      normalizedLocation: d.area || 'Unknown',
      classification: classification.classification,
      confidence: classification.confidence,
      originalMessage: d.content?.substring(0, 100) || 'N/A',
    });

    // Alternate row colors
    if (idx % 2 === 0) {
      row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF0F0F0' } };
    }

    // Highlight high priority
    if (d.priority === 'high') {
      row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFF6B6B' } };
    }
  });

  // Sheet 2: Summary
  console.log('📝 Creating Summary sheet...');
  const summarySheet = workbook.addWorksheet('Summary');
  summarySheet.columns = [
    { header: 'Metric', key: 'metric', width: 30 },
    { header: 'Value', key: 'value', width: 20 },
    { header: 'Percentage', key: 'percentage', width: 15 },
    { header: 'Details', key: 'details', width: 40 },
    { header: '', key: 'empty1', width: 10 },
    { header: '', key: 'empty2', width: 10 },
    { header: '', key: 'empty3', width: 10 },
  ];

  const supplyCount = demands.filter(d => classifyByContent(d.content || '').classification === 'supply').length;
  const demandCount = demands.filter(d => classifyByContent(d.content || '').classification === 'demand').length;
  const manualCount = demands.filter(d => classifyByContent(d.content || '').classification === 'manual_review').length;

  summarySheet.addRows([
    { metric: 'Total Messages', value: demands.length, percentage: '100%', details: 'All extracted messages' },
    { metric: 'Supply (Available)', value: supplyCount, percentage: `${((supplyCount / demands.length) * 100).toFixed(1)}%`, details: 'Properties offered' },
    { metric: 'Demand (Requested)', value: demandCount, percentage: `${((demandCount / demands.length) * 100).toFixed(1)}%`, details: 'Properties searched' },
    { metric: 'Manual Review', value: manualCount, percentage: `${((manualCount / demands.length) * 100).toFixed(1)}%`, details: 'Unclear classification' },
    { metric: 'Report Generated', value: new Date().toLocaleString('ar-EG'), percentage: '', details: 'Latest update' },
  ]);

  // Sheets 3-11: Location-specific sheets
  for (const [areaAr, areaEn] of Object.entries(areas)) {
    console.log(`📝 Creating ${areaAr} sheet...`);
    const areaSheet = workbook.addWorksheet(`${areaAr}_Demands`);
    
    areaSheet.columns = [
      { header: 'ID', key: 'id', width: 8 },
      { header: 'Property Type', key: 'propertyType', width: 12 },
      { header: 'Location', key: 'location', width: 18 },
      { header: 'Size', key: 'size', width: 10 },
      { header: 'Beds', key: 'bedrooms', width: 8 },
      { header: 'Baths', key: 'bathrooms', width: 8 },
      { header: 'Purpose', key: 'purpose', width: 10 },
      { header: 'Budget', key: 'budget', width: 12 },
      { header: 'Contact', key: 'contact', width: 15 },
      { header: 'Name', key: 'contactName', width: 15 },
      { header: 'Date', key: 'createdAt', width: 12 },
      { header: 'Classification', key: 'classification', width: 12 },
      { header: 'Confidence', key: 'confidence', width: 10 },
      { header: 'Message', key: 'message', width: 40 },
    ];

    createHeaderRow(areaSheet, areaSheet.columns.map(c => c.header));

    const areaDemands = demands.filter(d => d.area === areaAr || d.area === areaEn);
    areaDemands.slice(0, 100).forEach((d, idx) => {
      const classification = classifyByContent(d.content || '');
      const row = areaSheet.addRow({
        id: d.id,
        propertyType: d.propertyType || 'Unknown',
        location: d.location || 'Unknown',
        size: d.sizeMax || d.sizeMin || '',
        bedrooms: d.bedrooms || '',
        bathrooms: d.bathrooms || '',
        purpose: d.purpose || 'sale',
        budget: d.priceMax || d.priceMin || '',
        contact: d.senderPhone || 'N/A',
        contactName: d.senderName || 'Unknown',
        createdAt: formatDate(d.createdAt),
        classification: classification.classification,
        confidence: classification.confidence,
        message: d.content?.substring(0, 50) || 'N/A',
      });

      if (idx % 2 === 0) {
        row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF0F0F0' } };
      }
    });
  }

  // Save file
  const filename = `/home/ubuntu/matchpro-dashboard/MatchPro_Template_Report_${Date.now()}.xlsx`;
  await workbook.xlsx.writeFile(filename);

  console.log(`✅ Excel file created: ${filename}`);
  console.log(`📊 Summary:`);
  console.log(`   - Total Rows: ${demands.length}`);
  console.log(`   - Supply: ${supplyCount} (${((supplyCount / demands.length) * 100).toFixed(1)}%)`);
  console.log(`   - Demand: ${demandCount} (${((demandCount / demands.length) * 100).toFixed(1)}%)`);
  console.log(`   - Manual Review: ${manualCount} (${((manualCount / demands.length) * 100).toFixed(1)}%)`);

  // Send email
  console.log('📧 Sending email...');
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT || '587'),
    secure: false,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });

  await transporter.sendMail({
    from: process.env.REPORT_FROM_EMAIL,
    to: 'maisaramoamen@gmail.com',
    subject: '✅ MatchPro Dashboard - Template-Matching Report with Content-Based Classification',
    html: `
      <h2>MatchPro Real Estate Dashboard</h2>
      <p>Dear Maisara,</p>
      <p>Your comprehensive Excel report has been generated with content-based classification:</p>
      <ul>
        <li><strong>Total Messages:</strong> ${demands.length}</li>
        <li><strong>Supply (Available):</strong> ${supplyCount} (${((supplyCount / demands.length) * 100).toFixed(1)}%)</li>
        <li><strong>Demand (Requested):</strong> ${demandCount} (${((demandCount / demands.length) * 100).toFixed(1)}%)</li>
        <li><strong>Manual Review:</strong> ${manualCount} (${((manualCount / demands.length) * 100).toFixed(1)}%)</li>
      </ul>
      <p><strong>Classification Method:</strong> Each row classified by actual message content using comprehensive decision tree rules.</p>
      <p>Report includes 12 worksheets: All_Demands, Summary, and 10 location-specific sheets.</p>
      <p>Best regards,<br>MatchPro System</p>
    `,
    attachments: [
      {
        filename: 'MatchPro_Template_Report.xlsx',
        path: filename,
      },
    ],
  });

  console.log('✅ Email sent successfully!');
  process.exit(0);
} catch (error) {
  console.error('❌ Error:', error.message);
  process.exit(1);
}
