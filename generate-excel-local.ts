import ExcelJS from "exceljs";
import * as fs from "fs";

const AREAS = [
  "التجمع الخامس",
  "مدينتي",
  "الرحاب",
  "القاهرة الجديدة",
  "الشروق",
];

const sampleLeads = [
  { id: 1001, name: "أحمد محمد", phone: "01001234567", property: "شقة", purpose: "sale", priceMin: 1500000, priceMax: 2000000, bedrooms: 3, size: 150 },
  { id: 1002, name: "فاطمة علي", phone: "01101234567", property: "فيلا", purpose: "rent", priceMin: 5000, priceMax: 8000, bedrooms: 4, size: 300 },
  { id: 1003, name: "محمود سالم", phone: "01201234567", property: "شقة", purpose: "sale", priceMin: 1000000, priceMax: 1500000, bedrooms: 2, size: 100 },
  { id: 1004, name: "نور حسن", phone: "01301234567", property: "استوديو", purpose: "rent", priceMin: 2000, priceMax: 3000, bedrooms: 1, size: 50 },
  { id: 1005, name: "كريم إبراهيم", phone: "01401234567", property: "فيلا", purpose: "sale", priceMin: 5000000, priceMax: 8000000, bedrooms: 5, size: 500 },
];

async function generateExcels() {
  for (const area of AREAS) {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet(area.substring(0, 31));

    const headers = ["Lead ID", "Contact Name", "Phone", "Area", "Property Type", "Purpose", "Price Min", "Price Max", "Bedrooms", "Size (m²)", "Requirements", "Date"];
    const headerRow = worksheet.addRow(headers);
    headerRow.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 12 };
    headerRow.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1F4E78" } };

    sampleLeads.forEach((lead, index) => {
      const row = worksheet.addRow([
        `MP-${lead.id}`,
        lead.name,
        lead.phone,
        area,
        lead.property,
        lead.purpose === "sale" ? "للبيع" : "للإيجار",
        `${lead.priceMin.toLocaleString()} EGP`,
        `${lead.priceMax.toLocaleString()} EGP`,
        lead.bedrooms,
        `${lead.size} m²`,
        "متطلبات خاصة",
        new Date().toLocaleDateString("ar-EG"),
      ]);
      if (index % 2 === 0) {
        row.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF2F2F2" } };
      }
    });

    worksheet.columns.forEach((column) => {
      let maxLength = 0;
      column.eachCell?.({ includeEmpty: true }, (cell) => {
        const cellLength = cell.value?.toString().length || 0;
        if (cellLength > maxLength) maxLength = cellLength;
      });
      column.width = Math.min(maxLength + 3, 30);
    });

    worksheet.views = [{ state: "frozen", ySplit: 1 }];

    const filename = `/tmp/Demand_${area.replace(/\s+/g, "_")}_${new Date().toISOString().split("T")[0]}.xlsx`;
    await workbook.xlsx.writeFile(filename);
    console.log(`✓ Generated: ${filename}`);
  }
}

generateExcels().catch(console.error);
