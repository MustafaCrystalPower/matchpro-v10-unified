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

  // Supply indicators (property is AVAILABLE)
  const supplyKeywords = ['متوفر', 'متاح', 'للإيجار', 'للبيع', 'فرصة', 'من المالك', 'استلام', 'تشطيب', 'فيو', 'asking price', 'available', 'for sale', 'for rent'];
  for (const kw of supplyKeywords) {
    if (text.includes(kw.toLowerCase())) supplyScore += 10;
  }

  // Demand indicators (property is REQUESTED)
  const demandKeywords = ['مطلوب', 'عايز', 'بدور على', 'محتاج', 'بادجت', 'budget', 'looking for', 'searching', 'need', 'require'];
  for (const kw of demandKeywords) {
    if (text.includes(kw.toLowerCase())) demandScore += 10;
  }

  // Property details (Supply indicator)
  const details = ['متر', 'م²', 'sqm', 'غرفة', 'bedroom', 'حمام', 'bathroom', 'دور', 'floor', 'villa', 'apartment', 'شقة', 'فيلا'];
  let detailCount = 0;
  for (const d of details) {
    if (text.includes(d.toLowerCase())) detailCount++;
  }
  if (detailCount >= 2) supplyScore += 15;

  // Price indicators (Supply)
  const priceKeywords = ['ألف', 'مليون', 'جنيه', 'egp', 'price', 'cost', 'asking'];
  let hasPrice = false;
  for (const pk of priceKeywords) {
    if (text.includes(pk.toLowerCase())) {
      hasPrice = true;
      break;
    }
  }
  if (hasPrice) supplyScore += 10;

  let classification = 'manual_review';
  if (supplyScore > demandScore + 5) {
    classification = 'supply';
  } else if (demandScore > supplyScore + 5) {
    classification = 'demand';
  }

  return { classification, confidence: Math.min(100, Math.max(supplyScore, demandScore) * 5) };
}

console.log('🔄 Fetching REAL messages from server API...');

try {
  // Fetch messages (NOT demands)
  const messagesRes = await fetch(`${API_BASE}/messages.recent?input=%7B%7D`);
  const messagesData = await messagesRes.json();
  const messages = messagesData.result?.data?.json || [];

  console.log(`✅ Fetched ${Array.isArray(messages) ? messages.length : 0} messages`);

  if (!Array.isArray(messages)) {
    console.error('❌ Error: messages is not an array');
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
  const supplyMessages = [];
  const demandMessages = [];
  
  messages.slice(0, 500).forEach((m, idx) => {
    const classification = classifyByContent(m.messageText || '');
    
    if (classification.classification === 'supply') supplyMessages.push(m);
    if (classification.classification === 'demand') demandMessages.push(m);

    const rowData = {
      'id': m.id || '',
      'property_type': 'property',
      'location': m.groupName || 'Unknown',
      'area': 'Other',
      'city': 'Cairo',
      'price_min': '',
      'price_max': '',
      'size_min': '',
      'size_max': '',
      'bedrooms': '',
      'bathrooms': '',
      'purpose': 'sale',
      'contact': m.sender || '',
      'contact_name': m.senderName || 'Unknown',
      'requirements': '',
      'created_at': formatDate(m.createdAt),
      'priority': 'medium',
      'source_group': m.groupName || 'unknown',
      'date_only': formatDate(m.createdAt),
      'normalized_location': 'Other',
      'classification': classification.classification,
      'confidence': classification.confidence,
      'original_message': m.messageText?.substring(0, 100) || ''
    };

    const row = allDemandsSheet.addRow(rowData);

    // Alternate row colors
    if (idx % 2 === 0) {
      row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF5F5F5' } };
    }

    // Highlight supply (green)
    if (classification.classification === 'supply') {
      row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFCCFFCC' } };
    }
    
    // Highlight demand (yellow)
    if (classification.classification === 'demand') {
      row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFF99' } };
    }
  });

  allDemandsSheet.views = [{ state: 'frozen', ySplit: 1 }];

  // ========== SHEET 2: Summary ==========
  console.log('📝 Creating Summary sheet...');
  const summarySheet = workbook.addWorksheet('Summary');
  
  const supplyCount = supplyMessages.length;
  const demandCount = demandMessages.length;
  const manualCount = messages.length - supplyCount - demandCount;

  summarySheet.columns = [
    { header: 'Metric', key: 'metric', width: 30 },
    { header: 'Value', key: 'value', width: 20 },
    { header: 'Percentage', key: 'percentage', width: 15 },
    { header: 'Details', key: 'details', width: 40 }
  ];

  createHeaderRow(summarySheet, ['Metric', 'Value', 'Percentage', 'Details']);

  summarySheet.addRows([
    { metric: 'Total Messages', value: messages.length, percentage: '100%', details: 'All extracted messages' },
    { metric: 'Supply (Available)', value: supplyCount, percentage: `${((supplyCount / messages.length) * 100).toFixed(1)}%`, details: 'Properties offered' },
    { metric: 'Demand (Requested)', value: demandCount, percentage: `${((demandCount / messages.length) * 100).toFixed(1)}%`, details: 'Properties searched' },
    { metric: 'Manual Review', value: manualCount, percentage: `${((manualCount / messages.length) * 100).toFixed(1)}%`, details: 'Unclear classification' },
    { metric: 'Report Generated', value: new Date().toLocaleString('ar-EG'), percentage: '', details: 'Latest update' }
  ]);

  // Save file
  const filename = `/home/ubuntu/matchpro-dashboard/MatchPro_Real_Data_Report_${Date.now()}.xlsx`;
  await workbook.xlsx.writeFile(filename);

  console.log(`✅ Excel file created: ${filename}`);
  console.log(`📊 Summary:`);
  console.log(`   - Total Messages: ${messages.length}`);
  console.log(`   - Supply: ${supplyCount} (${((supplyCount / messages.length) * 100).toFixed(1)}%)`);
  console.log(`   - Demand: ${demandCount} (${((demandCount / messages.length) * 100).toFixed(1)}%)`);
  console.log(`   - Manual Review: ${manualCount} (${((manualCount / messages.length) * 100).toFixed(1)}%)`);

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
    subject: '✅ MatchPro Dashboard - Real Data Report with Content-Based Classification',
    html: `
      <h2>MatchPro Real Estate Dashboard</h2>
      <p>Dear Maisara,</p>
      <p>Your comprehensive Excel report with REAL DATA has been generated:</p>
      <ul>
        <li><strong>Total Messages:</strong> ${messages.length}</li>
        <li><strong>Supply (Available):</strong> ${supplyCount} (${((supplyCount / messages.length) * 100).toFixed(1)}%)</li>
        <li><strong>Demand (Requested):</strong> ${demandCount} (${((demandCount / messages.length) * 100).toFixed(1)}%)</li>
        <li><strong>Manual Review:</strong> ${manualCount} (${((manualCount / messages.length) * 100).toFixed(1)}%)</li>
      </ul>
      <p><strong>Classification Method:</strong> Content-based analysis of actual message text.</p>
      <p>Best regards,<br>MatchPro System</p>
    `,
    attachments: [
      {
        filename: 'MatchPro_Real_Data_Report.xlsx',
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
