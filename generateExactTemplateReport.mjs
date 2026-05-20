import ExcelJS from 'exceljs';
import nodemailer from 'nodemailer';

const API_BASE = 'http://localhost:3000/api/trpc';

// Content-based classifier
function classifyByContent(message) {
  if (!message || message.trim().length < 5) {
    return { classification: 'manual_review', confidence: 0 };
  }

  const text = message.toLowerCase();
  let supplyScore = 0;
  let demandScore = 0;

  // Supply indicators
  const supplyKeywords = ['متاح', 'للإيجار', 'للبيع', 'فرصة', 'من المالك', 'استلام', 'تشطيب', 'فيو'];
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
      supplyScore += 15;
    } else {
      demandScore += 15;
    }
  }

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
    console.error('❌ Error: demands is not an array');
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

  const formatDate = (date) => {
    if (!date) return '';
    return new Date(date).toLocaleDateString('ar-EG');
  };

  const createHeaderRow = (worksheet, headers) => {
    const headerRow = worksheet.addRow(headers);
    headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
    headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF003366' } };
    headerRow.alignment = { horizontal: 'center', vertical: 'center', wrapText: true };
    headerRow.height = 25;
  };

  // ========== SHEET 1: All_Demands ==========
  console.log('📝 Creating All_Demands sheet...');
  const allDemandsSheet = workbook.addWorksheet('All_Demands');
  
  const headers = [
    'ID', 'Property Type', 'Location', 'Area', 'City', 'Price Min', 'Price Max',
    'Size Min', 'Size Max', 'Bedrooms', 'Bathrooms', 'Purpose', 'Contact',
    'Contact Name', 'Requirements', 'Created At', 'Priority', 'Source Group',
    'Date Only', 'Normalized Location', 'Classification', 'Confidence', 'Original Message'
  ];

  allDemandsSheet.columns = headers.map((h, i) => ({
    header: h,
    key: h.replace(/\s+/g, '_').toLowerCase(),
    width: i === headers.length - 1 ? 50 : (h === 'Original Message' ? 40 : 12)
  }));

  createHeaderRow(allDemandsSheet, headers);

  // Add data rows
  demands.slice(0, 500).forEach((d, idx) => {
    const classification = classifyByContent(d.content || '');
    const rowData = {
      'id': d.id || '',
      'property_type': d.propertyType || 'apartment',
      'location': d.location || 'Unknown',
      'area': d.area || 'Other',
      'city': 'Cairo',
      'price_min': d.priceMin || '',
      'price_max': d.priceMax || '',
      'size_min': d.sizeMin || '',
      'size_max': d.sizeMax || '',
      'bedrooms': d.bedrooms || '',
      'bathrooms': d.bathrooms || '',
      'purpose': d.purpose || 'sale',
      'contact': d.senderPhone || '',
      'contact_name': d.senderName || 'Unknown',
      'requirements': d.requirements || '',
      'created_at': formatDate(d.createdAt),
      'priority': d.priority || 'medium',
      'source_group': d.sourceGroup || 'unknown',
      'date_only': formatDate(d.createdAt),
      'normalized_location': d.area || 'Other',
      'classification': classification.classification,
      'confidence': classification.confidence,
      'original_message': d.content?.substring(0, 100) || ''
    };

    const row = allDemandsSheet.addRow(rowData);

    // Alternate row colors
    if (idx % 2 === 0) {
      row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF5F5F5' } };
    }

    // Highlight high priority
    if (d.priority === 'high') {
      row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFF6B6B' } };
    }
  });

  // Freeze header row
  allDemandsSheet.views = [{ state: 'frozen', ySplit: 1 }];

  // ========== SHEET 2: Summary ==========
  console.log('📝 Creating Summary sheet...');
  const summarySheet = workbook.addWorksheet('Summary');
  
  const supplyCount = demands.filter(d => classifyByContent(d.content || '').classification === 'supply').length;
  const demandCount = demands.filter(d => classifyByContent(d.content || '').classification === 'demand').length;
  const manualCount = demands.filter(d => classifyByContent(d.content || '').classification === 'manual_review').length;

  summarySheet.columns = [
    { header: 'Metric', key: 'metric', width: 30 },
    { header: 'Value', key: 'value', width: 20 },
    { header: 'Percentage', key: 'percentage', width: 15 },
    { header: 'Details', key: 'details', width: 40 }
  ];

  createHeaderRow(summarySheet, ['Metric', 'Value', 'Percentage', 'Details']);

  summarySheet.addRows([
    { metric: 'Total Messages', value: demands.length, percentage: '100%', details: 'All extracted messages' },
    { metric: 'Supply (Available)', value: supplyCount, percentage: `${((supplyCount / demands.length) * 100).toFixed(1)}%`, details: 'Properties offered' },
    { metric: 'Demand (Requested)', value: demandCount, percentage: `${((demandCount / demands.length) * 100).toFixed(1)}%`, details: 'Properties searched' },
    { metric: 'Manual Review', value: manualCount, percentage: `${((manualCount / demands.length) * 100).toFixed(1)}%`, details: 'Unclear classification' },
    { metric: 'Report Generated', value: new Date().toLocaleString('ar-EG'), percentage: '', details: 'Latest update' }
  ]);

  // ========== SHEETS 3-11: Location-Specific ==========
  for (const [areaAr, areaEn] of Object.entries(areas)) {
    console.log(`📝 Creating ${areaAr} sheet...`);
    const areaSheet = workbook.addWorksheet(`${areaAr}_Demands`);
    
    const areaHeaders = [
      'ID', 'Property Type', 'Location', 'Size', 'Beds', 'Baths', 'Purpose',
      'Budget', 'Contact', 'Name', 'Date', 'Classification', 'Confidence', 'Message'
    ];

    areaSheet.columns = areaHeaders.map((h, i) => ({
      header: h,
      key: h.replace(/\s+/g, '_').toLowerCase(),
      width: i === areaHeaders.length - 1 ? 40 : 12
    }));

    createHeaderRow(areaSheet, areaHeaders);

    const areaDemands = demands.filter(d => d.area === areaAr || d.area === areaEn);
    areaDemands.slice(0, 100).forEach((d, idx) => {
      const classification = classifyByContent(d.content || '');
      const row = areaSheet.addRow({
        'id': d.id || '',
        'property_type': d.propertyType || 'apartment',
        'location': d.location || 'Unknown',
        'size': d.sizeMax || d.sizeMin || '',
        'beds': d.bedrooms || '',
        'baths': d.bathrooms || '',
        'purpose': d.purpose || 'sale',
        'budget': d.priceMax || d.priceMin || '',
        'contact': d.senderPhone || '',
        'name': d.senderName || 'Unknown',
        'date': formatDate(d.createdAt),
        'classification': classification.classification,
        'confidence': classification.confidence,
        'message': d.content?.substring(0, 50) || ''
      });

      if (idx % 2 === 0) {
        row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF5F5F5' } };
      }
    });

    areaSheet.views = [{ state: 'frozen', ySplit: 1 }];
  }

  // ========== SHEET 12: MatchPro_Spec ==========
  console.log('📝 Creating MatchPro_Spec sheet...');
  const specSheet = workbook.addWorksheet('MatchPro_Spec');
  specSheet.columns = [
    { header: 'MATCHPRO SECURE DEMAND REPORT SYSTEM', key: 'title', width: 50 }
  ];
  specSheet.addRow({ title: 'Technical Specification' });
  specSheet.addRow({ title: `Version 1.0 | Date: ${new Date().toLocaleDateString('ar-EG')}` });
  specSheet.addRow({ title: 'Classification Method: Content-Based Decision Tree' });
  specSheet.addRow({ title: 'Supply = Available property with unit details' });
  specSheet.addRow({ title: 'Demand = Requested property with desired specs' });

  // Save file
  const filename = `/home/ubuntu/matchpro-dashboard/MatchPro_Template_Exact_${Date.now()}.xlsx`;
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
    subject: '✅ MatchPro Dashboard - Exact Template Report with Real Data',
    html: `
      <h2>MatchPro Real Estate Dashboard</h2>
      <p>Dear Maisara,</p>
      <p>Your comprehensive Excel report has been generated matching the exact template structure:</p>
      <ul>
        <li><strong>Total Messages:</strong> ${demands.length}</li>
        <li><strong>Supply (Available):</strong> ${supplyCount} (${((supplyCount / demands.length) * 100).toFixed(1)}%)</li>
        <li><strong>Demand (Requested):</strong> ${demandCount} (${((demandCount / demands.length) * 100).toFixed(1)}%)</li>
        <li><strong>Manual Review:</strong> ${manualCount} (${((manualCount / demands.length) * 100).toFixed(1)}%)</li>
      </ul>
      <p><strong>Sheets Included:</strong></p>
      <ul>
        <li>All_Demands (Main data sheet)</li>
        <li>Summary (Analytics dashboard)</li>
        <li>9 Location-specific sheets</li>
        <li>MatchPro_Spec (Technical specifications)</li>
      </ul>
      <p><strong>Classification Method:</strong> Content-based decision tree analyzing each message for supply/demand indicators.</p>
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
