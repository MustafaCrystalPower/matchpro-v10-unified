/**
 * Comprehensive 17-Sheet Demand Report Generator
 * Phase 12: Professional demand data extraction with location-specific sheets
 */

import ExcelJS from 'exceljs';
import { getDb, getMessagesByClassification } from './db';
import { storagePut } from './storage';

interface DemandRecord {
  id: number;
  messageText: string;
  createdAt: string;
  senderName: string;
  area: string;
  location?: string;
  propertyType?: string;
  transactionType: 'sale' | 'rent';
  area_m2?: number;
  bedrooms?: number;
  bathrooms?: number;
  requirements?: string;
  priority: 'high' | 'medium' | 'low';
}

const LOCATIONS = [
  { name: 'مدينتي', code: 'madinaty' },
  { name: 'التجمع الخامس', code: 'fifth_settlement' },
  { name: 'الرحاب', code: 'rehab' },
  { name: 'الشيخ زايد', code: 'sheikh_zayed' },
  { name: 'الساحل الشمالي', code: 'north_coast' },
  { name: 'مدينة نصر', code: 'nasr_city' },
  { name: 'مدينة نور', code: 'madinet_nour' },
  { name: 'العاصمة الإدارية', code: 'admin_capital' },
  { name: 'مدينة بدر', code: 'madinet_badr' },
  { name: 'أخرى', code: 'other' }
];

const PRIORITY_KEYWORDS = ['أنا المشتري', 'أنا البايع', 'أنا المالك', 'من المالك', 'عاجل', 'فوري'];
const SALE_KEYWORDS = ['بيع', 'للبيع', 'للتمليك', 'تمليك', 'شراء'];
const RENT_KEYWORDS = ['إيجار', 'للإيجار', 'للكراء', 'أجار'];

export async function generateComprehensiveDemandReport(): Promise<string> {
  const workbook = new ExcelJS.Workbook();

  // Fetch all demand messages (up to 5000)
  const allDemands = await getMessagesByClassification('demand', 5000);
  
  const demandRecords: DemandRecord[] = (allDemands || []).map((d: any) => ({
    id: d.id || 0,
    messageText: d.messageText || d.message_text || '',
    createdAt: d.createdAt ? (typeof d.createdAt === 'string' ? d.createdAt : d.createdAt.toISOString()) : new Date().toISOString(),
    senderName: d.senderName || d.sender_name || 'Unknown',
    area: d.area || 'أخرى',
    location: d.location,
    propertyType: d.propertyType || d.property_type,
    transactionType: detectTransactionType(d.messageText || d.message_text || ''),
    area_m2: d.areaSqm || d.area_m2,
    bedrooms: d.bedrooms,
    bathrooms: d.bathrooms,
    requirements: d.requirements,
    priority: detectPriority(d.messageText || d.message_text || '')
  }));

  // Sheet 1: Dashboard Summary
  createDashboardSheet(workbook, demandRecords);

  // Sheet 2: All Demands - Sorted
  createAllDemandsSheet(workbook, demandRecords);

  // Sheet 3: Sale Demands
  createSaleDemandsSheet(workbook, demandRecords);

  // Sheet 4: Rent Demands
  createRentDemandsSheet(workbook, demandRecords);

  // Sheets 5-14: Location-Specific Sheets
  for (const location of LOCATIONS) {
    createLocationSheet(workbook, demandRecords, location);
  }

  // Sheet 15: High Priority Demands
  createHighPrioritySheet(workbook, demandRecords);

  // Sheet 16: Today's Demands
  createTodayDemandsSheet(workbook, demandRecords);

  // Sheet 17: Madinaty B-Series Breakdown
  createMadinatyBSeriesSheet(workbook, demandRecords);

  // Save and upload
  const buffer = await workbook.xlsx.writeBuffer();
  const fileName = `MatchPro_Demand_Report_${new Date().toISOString().split('T')[0]}_${new Date().getHours().toString().padStart(2, '0')}-${new Date().getMinutes().toString().padStart(2, '0')}.xlsx`;
  
  const { url } = await storagePut(
    `reports/${fileName}`,
    buffer as unknown as Buffer,
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  );

  return url;
}

function detectTransactionType(message: string): 'sale' | 'rent' {
  const lowerMsg = message.toLowerCase();
  if (RENT_KEYWORDS.some(k => lowerMsg.includes(k))) return 'rent';
  if (SALE_KEYWORDS.some(k => lowerMsg.includes(k))) return 'sale';
  return 'sale';
}

function detectPriority(message: string): 'high' | 'medium' | 'low' {
  if (PRIORITY_KEYWORDS.some(k => message.includes(k))) return 'high';
  return 'medium';
}

function createDashboardSheet(workbook: ExcelJS.Workbook, demands: DemandRecord[]) {
  const sheet = workbook.addWorksheet('ملخص عام');
  
  const totalDemands = demands.length;
  const saleDemands = demands.filter(d => d.transactionType === 'sale').length;
  const rentDemands = demands.filter(d => d.transactionType === 'rent').length;
  const apartments = demands.filter(d => d.propertyType === 'شقة').length;
  const villas = demands.filter(d => d.propertyType === 'فيلا').length;
  const highPriority = demands.filter(d => d.priority === 'high').length;
  const mediumPriority = demands.filter(d => d.priority === 'medium').length;

  sheet.columns = [
    { header: 'المقياس', key: 'metric', width: 20 },
    { header: 'القيمة', key: 'value', width: 15 },
    { header: 'النسبة المئوية', key: 'percentage', width: 15 }
  ];

  sheet.addRows([
    { metric: 'إجمالي الطلبات', value: totalDemands, percentage: '100%' },
    { metric: 'طلبات البيع', value: saleDemands, percentage: totalDemands > 0 ? `${((saleDemands / totalDemands) * 100).toFixed(1)}%` : '0%' },
    { metric: 'طلبات الإيجار', value: rentDemands, percentage: totalDemands > 0 ? `${((rentDemands / totalDemands) * 100).toFixed(1)}%` : '0%' },
    { metric: 'شقق', value: apartments, percentage: totalDemands > 0 ? `${((apartments / totalDemands) * 100).toFixed(1)}%` : '0%' },
    { metric: 'فيلات', value: villas, percentage: totalDemands > 0 ? `${((villas / totalDemands) * 100).toFixed(1)}%` : '0%' },
    { metric: 'أولوية عالية', value: highPriority, percentage: totalDemands > 0 ? `${((highPriority / totalDemands) * 100).toFixed(1)}%` : '0%' },
    { metric: 'أولوية متوسطة', value: mediumPriority, percentage: totalDemands > 0 ? `${((mediumPriority / totalDemands) * 100).toFixed(1)}%` : '0%' }
  ]);

  applyHeaderFormatting(sheet);
}

function createAllDemandsSheet(workbook: ExcelJS.Workbook, demands: DemandRecord[]) {
  const sheet = workbook.addWorksheet('كل الطلبات مرتبة');
  
  sheet.columns = [
    { header: 'ID', key: 'id', width: 8 },
    { header: 'التاريخ', key: 'date', width: 12 },
    { header: 'الوقت', key: 'time', width: 10 },
    { header: 'المنطقة', key: 'area', width: 15 },
    { header: 'الموقع المحدد', key: 'location', width: 12 },
    { header: 'نوع العقار', key: 'propertyType', width: 12 },
    { header: 'نوع المعاملة', key: 'transactionType', width: 12 },
    { header: 'المساحة (م²)', key: 'area_m2', width: 10 },
    { header: 'الغرف', key: 'bedrooms', width: 8 },
    { header: 'الحمامات', key: 'bathrooms', width: 10 },
    { header: 'اسم العميل', key: 'senderName', width: 15 },
    { header: 'المتطلبات الخاصة', key: 'requirements', width: 20 },
    { header: 'الأولوية', key: 'priority', width: 12 },
    { header: 'الرسالة الأصلية', key: 'messageText', width: 40 }
  ];

  const sortedDemands = demands.sort((a, b) => {
    if (a.area !== b.area) return a.area.localeCompare(b.area);
    if (a.transactionType !== b.transactionType) return a.transactionType === 'sale' ? -1 : 1;
    if (a.propertyType !== b.propertyType) return (a.propertyType || '').localeCompare(b.propertyType || '');
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });

  sortedDemands.forEach(d => {
    const date = new Date(d.createdAt);
    sheet.addRow({
      id: d.id,
      date: date.toISOString().split('T')[0],
      time: date.toTimeString().split(' ')[0],
      area: d.area,
      location: d.location || '-',
      propertyType: d.propertyType || '-',
      transactionType: d.transactionType === 'sale' ? 'بيع' : 'إيجار',
      area_m2: d.area_m2 || '-',
      bedrooms: d.bedrooms || '-',
      bathrooms: d.bathrooms || '-',
      senderName: d.senderName,
      requirements: d.requirements || '-',
      priority: d.priority === 'high' ? 'عالية' : 'متوسطة',
      messageText: d.messageText
    });
  });

  applyHeaderFormatting(sheet);
}

function createSaleDemandsSheet(workbook: ExcelJS.Workbook, demands: DemandRecord[]) {
  const sheet = workbook.addWorksheet('طلبات البيع');
  const saleDemands = demands.filter(d => d.transactionType === 'sale');
  
  sheet.columns = [
    { header: 'ID', key: 'id', width: 8 },
    { header: 'التاريخ', key: 'date', width: 12 },
    { header: 'المنطقة', key: 'area', width: 15 },
    { header: 'نوع العقار', key: 'propertyType', width: 12 },
    { header: 'الغرف', key: 'bedrooms', width: 8 },
    { header: 'اسم العميل', key: 'senderName', width: 15 },
    { header: 'الرسالة الأصلية', key: 'messageText', width: 40 }
  ];

  saleDemands.forEach(d => {
    const date = new Date(d.createdAt);
    sheet.addRow({
      id: d.id,
      date: date.toISOString().split('T')[0],
      area: d.area,
      propertyType: d.propertyType || '-',
      bedrooms: d.bedrooms || '-',
      senderName: d.senderName,
      messageText: d.messageText
    });
  });

  applyHeaderFormatting(sheet);
}

function createRentDemandsSheet(workbook: ExcelJS.Workbook, demands: DemandRecord[]) {
  const sheet = workbook.addWorksheet('طلبات الإيجار');
  const rentDemands = demands.filter(d => d.transactionType === 'rent');
  
  sheet.columns = [
    { header: 'ID', key: 'id', width: 8 },
    { header: 'التاريخ', key: 'date', width: 12 },
    { header: 'المنطقة', key: 'area', width: 15 },
    { header: 'نوع العقار', key: 'propertyType', width: 12 },
    { header: 'الغرف', key: 'bedrooms', width: 8 },
    { header: 'اسم العميل', key: 'senderName', width: 15 },
    { header: 'الرسالة الأصلية', key: 'messageText', width: 40 }
  ];

  rentDemands.forEach(d => {
    const date = new Date(d.createdAt);
    sheet.addRow({
      id: d.id,
      date: date.toISOString().split('T')[0],
      area: d.area,
      propertyType: d.propertyType || '-',
      bedrooms: d.bedrooms || '-',
      senderName: d.senderName,
      messageText: d.messageText
    });
  });

  applyHeaderFormatting(sheet);
}

function createLocationSheet(workbook: ExcelJS.Workbook, demands: DemandRecord[], location: { name: string; code: string }) {
  const sheet = workbook.addWorksheet(location.name);
  const locationDemands = demands.filter(d => d.area === location.name);
  
  const saleDemands = locationDemands.filter(d => d.transactionType === 'sale');
  const rentDemands = locationDemands.filter(d => d.transactionType === 'rent');

  // Summary
  sheet.addRow([]);
  sheet.addRow([`المنطقة: ${location.name}`]);
  sheet.addRow([`إجمالي الطلبات: ${locationDemands.length}`]);
  sheet.addRow([`طلبات البيع: ${saleDemands.length}`]);
  sheet.addRow([`طلبات الإيجار: ${rentDemands.length}`]);
  sheet.addRow([`آخر تحديث: ${new Date().toISOString()}`]);
  sheet.addRow([]);

  // Sale Demands Section
  if (saleDemands.length > 0) {
    sheet.addRow(['📌 طلبات البيع (Sale Demands)']);
    sheet.addRow(['ID', 'التاريخ', 'الموقع', 'نوع العقار', 'المساحة', 'الغرف', 'اسم العميل', 'المتطلبات', 'الرسالة الأصلية']);
    
    saleDemands.sort((a, b) => {
      if (a.propertyType !== b.propertyType) return (a.propertyType || '').localeCompare(b.propertyType || '');
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    }).forEach(d => {
      const date = new Date(d.createdAt);
      sheet.addRow([
        d.id,
        date.toISOString().split('T')[0],
        d.location || '-',
        d.propertyType || '-',
        d.area_m2 || '-',
        d.bedrooms || '-',
        d.senderName,
        d.requirements || '-',
        d.messageText
      ]);
    });
    sheet.addRow([]);
  }

  // Rent Demands Section
  if (rentDemands.length > 0) {
    sheet.addRow(['📌 طلبات الإيجار (Rent Demands)']);
    sheet.addRow(['ID', 'التاريخ', 'الموقع', 'نوع العقار', 'المساحة', 'الغرف', 'اسم العميل', 'المتطلبات', 'الرسالة الأصلية']);
    
    rentDemands.sort((a, b) => {
      if (a.propertyType !== b.propertyType) return (a.propertyType || '').localeCompare(b.propertyType || '');
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    }).forEach(d => {
      const date = new Date(d.createdAt);
      sheet.addRow([
        d.id,
        date.toISOString().split('T')[0],
        d.location || '-',
        d.propertyType || '-',
        d.area_m2 || '-',
        d.bedrooms || '-',
        d.senderName,
        d.requirements || '-',
        d.messageText
      ]);
    });
  }

  applyHeaderFormatting(sheet);
}

function createHighPrioritySheet(workbook: ExcelJS.Workbook, demands: DemandRecord[]) {
  const sheet = workbook.addWorksheet('طلبات أولوية عالية');
  const highPriority = demands.filter(d => d.priority === 'high');
  
  sheet.columns = [
    { header: 'ID', key: 'id', width: 8 },
    { header: 'التاريخ', key: 'date', width: 12 },
    { header: 'المنطقة', key: 'area', width: 15 },
    { header: 'نوع المعاملة', key: 'transactionType', width: 12 },
    { header: 'نوع العقار', key: 'propertyType', width: 12 },
    { header: 'اسم العميل', key: 'senderName', width: 15 },
    { header: 'الرسالة الأصلية', key: 'messageText', width: 40 }
  ];

  highPriority.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).forEach(d => {
    const date = new Date(d.createdAt);
    const row = sheet.addRow({
      id: d.id,
      date: date.toISOString().split('T')[0],
      area: d.area,
      transactionType: d.transactionType === 'sale' ? 'بيع' : 'إيجار',
      propertyType: d.propertyType || '-',
      senderName: d.senderName,
      messageText: d.messageText
    });
    row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFF6B6B' } };
  });

  applyHeaderFormatting(sheet);
}

function createTodayDemandsSheet(workbook: ExcelJS.Workbook, demands: DemandRecord[]) {
  const sheet = workbook.addWorksheet('طلبات اليوم');
  const today = new Date().toISOString().split('T')[0];
  const todayDemands = demands.filter(d => d.createdAt.split('T')[0] === today);
  
  sheet.columns = [
    { header: 'الوقت', key: 'time', width: 10 },
    { header: 'المنطقة', key: 'area', width: 15 },
    { header: 'نوع المعاملة', key: 'transactionType', width: 12 },
    { header: 'اسم العميل', key: 'senderName', width: 15 },
    { header: 'الرسالة الأصلية', key: 'messageText', width: 40 }
  ];

  todayDemands.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).forEach(d => {
    const date = new Date(d.createdAt);
    const row = sheet.addRow({
      time: date.toTimeString().split(' ')[0],
      area: d.area,
      transactionType: d.transactionType === 'sale' ? 'بيع' : 'إيجار',
      senderName: d.senderName,
      messageText: d.messageText
    });
    row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF3CD' } };
  });

  applyHeaderFormatting(sheet);
}

function createMadinatyBSeriesSheet(workbook: ExcelJS.Workbook, demands: DemandRecord[]) {
  const sheet = workbook.addWorksheet('Madinaty B-Series');
  const madinatyDemands = demands.filter(d => d.area === 'مدينتي');
  
  sheet.columns = [
    { header: 'B-Group', key: 'bgroup', width: 10 },
    { header: 'نوع المعاملة', key: 'transactionType', width: 12 },
    { header: 'نوع العقار', key: 'propertyType', width: 12 },
    { header: 'المساحة', key: 'area_m2', width: 10 },
    { header: 'الغرف', key: 'bedrooms', width: 8 },
    { header: 'اسم العميل', key: 'senderName', width: 15 },
    { header: 'المتطلبات', key: 'requirements', width: 20 },
    { header: 'التاريخ', key: 'date', width: 12 },
    { header: 'الرسالة الأصلية', key: 'messageText', width: 40 }
  ];

  madinatyDemands.forEach(d => {
    const bgroup = d.location?.match(/B\d+/)?.[0] || 'Other';
    const date = new Date(d.createdAt);
    sheet.addRow({
      bgroup,
      transactionType: d.transactionType === 'sale' ? 'بيع' : 'إيجار',
      propertyType: d.propertyType || '-',
      area_m2: d.area_m2 || '-',
      bedrooms: d.bedrooms || '-',
      senderName: d.senderName,
      requirements: d.requirements || '-',
      date: date.toISOString().split('T')[0],
      messageText: d.messageText
    });
  });

  applyHeaderFormatting(sheet);
}

function applyHeaderFormatting(sheet: ExcelJS.Worksheet) {
  const headerRow = sheet.getRow(1);
  if (headerRow) {
    headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F4E78' } };
    headerRow.alignment = { horizontal: 'center', vertical: 'middle' };
  }
  
  sheet.views = [{ state: 'frozen', ySplit: 1 }];
}
