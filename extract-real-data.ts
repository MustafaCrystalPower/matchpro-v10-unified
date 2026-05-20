import ExcelJS from "exceljs";

const API_BASE = "http://localhost:3000/api/trpc";

async function fetchDemandData() {
  try {
    const response = await fetch(`${API_BASE}/demand.recent`);
    const data = (await response.json()) as any;
    return data.result.data.json || [];
  } catch (e) {
    console.error("Error fetching demand:", e);
    return [];
  }
}

async function fetchSupplyData() {
  try {
    const response = await fetch(`${API_BASE}/supply.recent`);
    const data = (await response.json()) as any;
    return data.result.data.json || [];
  } catch (e) {
    console.error("Error fetching supply:", e);
    return [];
  }
}

function groupByArea(records: any[]) {
  const grouped: { [key: string]: any[] } = {};
  records.forEach((record) => {
    const area = record.area || "Unknown";
    if (!grouped[area]) grouped[area] = [];
    grouped[area].push(record);
  });
  return grouped;
}

async function generateDemandExcels(demandData: any[]) {
  const grouped = groupByArea(demandData);
  
  for (const [area, records] of Object.entries(grouped)) {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Demand");

    const headers = [
      "Lead ID",
      "Timestamp",
      "Contact",
      "Property Type",
      "Bedrooms",
      "Price Min",
      "Price Max",
      "Size Min",
      "Size Max",
      "Original Message",
      "Confidence",
      "Status"
    ];

    const headerRow = worksheet.addRow(headers);
    headerRow.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 11 };
    headerRow.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1F4E78" } };

    (records as any[]).forEach((record, index) => {
      const row = worksheet.addRow([
        `MP-${record.id}`,
        new Date(record.createdAt).toLocaleString("ar-EG"),
        record.contact || "N/A",
        record.propertyType || "N/A",
        record.bedrooms || "N/A",
        record.priceMin ? `${record.priceMin.toLocaleString()} EGP` : "N/A",
        record.priceMax ? `${record.priceMax.toLocaleString()} EGP` : "N/A",
        record.sizeMin || "N/A",
        record.sizeMax || "N/A",
        record.rawMessageText || "N/A",
        `${Math.round((record.confidence || 0) * 100)}%`,
        record.reviewStatus || "pending"
      ]);

      if (index % 2 === 0) {
        row.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF2F2F2" } };
      }
      row.alignment = { horizontal: "right", vertical: "top", wrapText: true };
    });

    worksheet.columns = [
      { width: 12 },
      { width: 18 },
      { width: 15 },
      { width: 12 },
      { width: 10 },
      { width: 15 },
      { width: 15 },
      { width: 10 },
      { width: 10 },
      { width: 60 },
      { width: 12 },
      { width: 12 }
    ];

    worksheet.views = [{ state: "frozen", ySplit: 1 }];

    const filename = `/tmp/Demand_${area.replace(/\s+/g, "_")}_${new Date().toISOString().split("T")[0]}_REAL.xlsx`;
    await workbook.xlsx.writeFile(filename);
    console.log(`✓ Generated: ${filename} (${records.length} records)`);
  }
}

async function generateSupplyExcel(supplyData: any[]) {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet("Supply");

  const headers = [
    "Property ID",
    "Timestamp",
    "Contact",
    "Area",
    "Property Type",
    "Bedrooms",
    "Price",
    "Size",
    "Original Message",
    "Confidence",
    "Status"
  ];

  const headerRow = worksheet.addRow(headers);
  headerRow.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 11 };
  headerRow.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF2F5496" } };

  supplyData.forEach((record, index) => {
    const row = worksheet.addRow([
      `SP-${record.id}`,
      new Date(record.createdAt).toLocaleString("ar-EG"),
      record.contact || "N/A",
      record.area || "N/A",
      record.propertyType || "N/A",
      record.bedrooms || "N/A",
      record.price ? `${record.price.toLocaleString()} EGP` : "N/A",
      record.size || "N/A",
      record.rawMessageText || "N/A",
      `${Math.round((record.confidence || 0) * 100)}%`,
      record.reviewStatus || "pending"
    ]);

    if (index % 2 === 0) {
      row.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF0F0F0" } };
    }
  });

  worksheet.columns = [
    { width: 12 },
    { width: 18 },
    { width: 15 },
    { width: 15 },
    { width: 12 },
    { width: 10 },
    { width: 15 },
    { width: 10 },
    { width: 60 },
    { width: 12 },
    { width: 12 }
  ];

  worksheet.views = [{ state: "frozen", ySplit: 1 }];

  const filename = `/tmp/Supply_Consolidated_${new Date().toISOString().split("T")[0]}_REAL.xlsx`;
  await workbook.xlsx.writeFile(filename);
  console.log(`✓ Generated: ${filename} (${supplyData.length} records)`);
}

async function main() {
  console.log("Fetching real data from database...");
  const demandData = await fetchDemandData();
  const supplyData = await fetchSupplyData();

  console.log(`\nFound ${demandData.length} demand records`);
  console.log(`Found ${supplyData.length} supply records\n`);

  await generateDemandExcels(demandData);
  await generateSupplyExcel(supplyData);

  console.log("\n✓ All real data Excel files generated!");
}

main().catch(console.error);
