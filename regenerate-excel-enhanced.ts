import ExcelJS from "exceljs";
import { extractLocationFromArabicMessage } from "./server/arabicLocationDictionary";

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

function groupByArea(records: any[]) {
  const grouped: { [key: string]: any[] } = {};
  records.forEach((record) => {
    // Try to extract location from message first
    let area = record.area;
    if (!area && record.rawMessageText) {
      const locationResult = extractLocationFromArabicMessage(record.rawMessageText);
      area = locationResult.area;
    }
    area = area || "Unknown";
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
      "Phone",
      "Property Type",
      "Bedrooms",
      "Price Min",
      "Price Max",
      "Size",
      "Building Code",
      "Original Message",
      "Confidence"
    ];

    const headerRow = worksheet.addRow(headers);
    headerRow.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 11 };
    headerRow.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1F4E78" } };

    (records as any[]).forEach((record, index) => {
      // Extract location info from message
      let buildingCode = null;
      let locationConfidence = 0;
      if (record.rawMessageText) {
        const locResult = extractLocationFromArabicMessage(record.rawMessageText);
        buildingCode = locResult.buildingCode;
        locationConfidence = locResult.confidence;
      }

      const row = worksheet.addRow([
        `MP-${record.id}`,
        new Date(record.createdAt).toLocaleString("ar-EG"),
        record.contact || "N/A",
        record.phone || "N/A",
        record.propertyType || "N/A",
        record.bedrooms || "N/A",
        record.priceMin ? `${record.priceMin.toLocaleString()} EGP` : "N/A",
        record.priceMax ? `${record.priceMax.toLocaleString()} EGP` : "N/A",
        record.size || "N/A",
        buildingCode || "N/A",
        record.rawMessageText || "N/A",
        `${Math.round((locationConfidence || 0) * 100)}%`
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
      { width: 15 },
      { width: 12 },
      { width: 10 },
      { width: 15 },
      { width: 15 },
      { width: 10 },
      { width: 12 },
      { width: 60 },
      { width: 12 }
    ];

    worksheet.views = [{ state: "frozen", ySplit: 1 }];

    const filename = `/tmp/Demand_${area.replace(/\s+/g, "_")}_ENHANCED_${new Date().toISOString().split("T")[0]}.xlsx`;
    await workbook.xlsx.writeFile(filename);
    console.log(`✓ Generated: ${filename} (${records.length} records)`);
  }
}

async function main() {
  console.log("Fetching demand data and regenerating with enhanced location extraction...\n");
  const demandData = await fetchDemandData();
  console.log(`Found ${demandData.length} demand records\n`);
  await generateDemandExcels(demandData);
  console.log("\n✓ Enhanced Excel files generated!");
}

main().catch(console.error);
