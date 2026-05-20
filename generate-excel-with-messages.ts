import ExcelJS from "exceljs";

const AREAS = ["التجمع الخامس", "مدينتي", "الرحاب", "القاهرة الجديدة", "الشروق"];

// Sample leads WITH original messages and timestamps
const sampleLeads = [
  { 
    id: 1001, 
    name: "أحمد محمد", 
    phone: "01001234567", 
    property: "شقة", 
    purpose: "sale", 
    priceMin: 1500000, 
    priceMax: 2000000, 
    bedrooms: 3, 
    size: 150,
    originalMessage: "السلام عليكم، أبحث عن شقة 3 غرف في التجمع الخامس، الميزانية من 1.5 إلى 2 مليون جنيه",
    timestamp: "2026-04-21 10:30:45"
  },
  { 
    id: 1002, 
    name: "فاطمة علي", 
    phone: "01101234567", 
    property: "فيلا", 
    purpose: "rent", 
    priceMin: 5000, 
    priceMax: 8000, 
    bedrooms: 4, 
    size: 300,
    originalMessage: "مرحبا، أحتاج فيلا للإيجار 4 غرف في مدينتي، الإيجار من 5 إلى 8 آلاف شهري",
    timestamp: "2026-04-21 11:15:22"
  },
  { 
    id: 1003, 
    name: "محمود سالم", 
    phone: "01201234567", 
    property: "شقة", 
    purpose: "sale", 
    priceMin: 1000000, 
    priceMax: 1500000, 
    bedrooms: 2, 
    size: 100,
    originalMessage: "أبحث عن شقة 2 غرفة في الرحاب، السعر من 1 إلى 1.5 مليون",
    timestamp: "2026-04-21 09:45:10"
  },
];

async function generateExcels() {
  // Generate DEMAND sheets
  for (const area of AREAS) {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Demand");

    const headers = [
      "Lead ID",
      "Timestamp",
      "Contact Name",
      "Phone",
      "Area",
      "Property Type",
      "Purpose",
      "Price Min",
      "Price Max",
      "Bedrooms",
      "Size (m²)",
      "Original Message",
      "Extraction Confidence"
    ];

    const headerRow = worksheet.addRow(headers);
    headerRow.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 11 };
    headerRow.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1F4E78" } };
    headerRow.alignment = { horizontal: "center", vertical: "middle", wrapText: true };

    sampleLeads.forEach((lead, index) => {
      const row = worksheet.addRow([
        `MP-${lead.id}`,
        lead.timestamp,
        lead.name,
        lead.phone,
        area,
        lead.property,
        lead.purpose === "sale" ? "للبيع" : "للإيجار",
        `${lead.priceMin.toLocaleString()} EGP`,
        `${lead.priceMax.toLocaleString()} EGP`,
        lead.bedrooms,
        `${lead.size} m²`,
        lead.originalMessage,
        "95%"
      ]);

      if (index % 2 === 0) {
        row.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF2F2F2" } };
      }
      row.alignment = { horizontal: "right", vertical: "top", wrapText: true };
    });

    // Set column widths
    worksheet.columns = [
      { width: 12 },  // Lead ID
      { width: 18 },  // Timestamp
      { width: 15 },  // Name
      { width: 15 },  // Phone
      { width: 15 },  // Area
      { width: 12 },  // Property Type
      { width: 10 },  // Purpose
      { width: 15 },  // Price Min
      { width: 15 },  // Price Max
      { width: 10 },  // Bedrooms
      { width: 12 },  // Size
      { width: 50 },  // Original Message (WIDE for full message)
      { width: 15 }   // Confidence
    ];

    // Freeze header
    worksheet.views = [{ state: "frozen", ySplit: 1 }];

    // Add summary
    worksheet.addRow([]);
    const summaryData = worksheet.addRow([
      `ملخص الطلبات في ${area}`,
      ``,
      `إجمالي: ${sampleLeads.length}`,
      `للبيع: ${sampleLeads.filter(l => l.purpose === "sale").length}`,
      `للإيجار: ${sampleLeads.filter(l => l.purpose === "rent").length}`,
    ]);
    summaryData.font = { bold: true, size: 11 };
    summaryData.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFE699" } };

    const filename = `/tmp/Demand_${area.replace(/\s+/g, "_")}_${new Date().toISOString().split("T")[0]}.xlsx`;
    await workbook.xlsx.writeFile(filename);
    console.log(`✓ Demand: ${filename}`);
  }

  // Generate SUPPLY sheet (consolidated)
  const supplyWorkbook = new ExcelJS.Workbook();
  const supplySheet = supplyWorkbook.addWorksheet("Supply");

  const supplyHeaders = [
    "Property ID",
    "Timestamp",
    "Seller Name",
    "Phone",
    "Area",
    "Property Type",
    "Purpose",
    "Price",
    "Bedrooms",
    "Size (m²)",
    "Original Message",
    "Extraction Confidence"
  ];

  const supplyHeaderRow = supplySheet.addRow(supplyHeaders);
  supplyHeaderRow.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 11 };
  supplyHeaderRow.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF2F5496" } };

  // Sample supply data
  const supplyData = [
    { id: 2001, name: "علي محمود", phone: "01501234567", area: "التجمع الخامس", property: "شقة", purpose: "sale", price: 1800000, bedrooms: 3, size: 150, msg: "عندي شقة 3 غرف للبيع في التجمع الخامس، 150 متر، السعر 1.8 مليون", ts: "2026-04-21 08:20:30" },
    { id: 2002, name: "سارة أحمد", phone: "01601234567", area: "مدينتي", property: "فيلا", purpose: "rent", price: 6500, bedrooms: 4, size: 300, msg: "فيلا 4 غرف للإيجار في مدينتي، 300 متر، الإيجار 6500 شهري", ts: "2026-04-21 12:10:15" },
  ];

  supplyData.forEach((item, index) => {
    const row = supplySheet.addRow([
      `SP-${item.id}`,
      item.ts,
      item.name,
      item.phone,
      item.area,
      item.property,
      item.purpose === "sale" ? "للبيع" : "للإيجار",
      `${item.price.toLocaleString()} ${item.purpose === "sale" ? "EGP" : "EGP/month"}`,
      item.bedrooms,
      `${item.size} m²`,
      item.msg,
      "92%"
    ]);

    if (index % 2 === 0) {
      row.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF0F0F0" } };
    }
  });

  supplySheet.columns = [
    { width: 12 },
    { width: 18 },
    { width: 15 },
    { width: 15 },
    { width: 15 },
    { width: 12 },
    { width: 10 },
    { width: 15 },
    { width: 10 },
    { width: 12 },
    { width: 50 },
    { width: 15 }
  ];

  supplySheet.views = [{ state: "frozen", ySplit: 1 }];

  const supplyFilename = `/tmp/Supply_Consolidated_${new Date().toISOString().split("T")[0]}.xlsx`;
  await supplyWorkbook.xlsx.writeFile(supplyFilename);
  console.log(`✓ Supply: ${supplyFilename}`);

  console.log("\n✓ All Excel files generated with original messages and timestamps!");
}

generateExcels().catch(console.error);
