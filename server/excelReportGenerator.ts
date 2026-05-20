import ExcelJS from 'exceljs';
import { getRecentSupply, getRecentDemand } from './db';

export async function generateLocationFilteredExcelReport(location?: string) {
  const workbook = new ExcelJS.Workbook();
  
  try {
    // Get all supply and demand data
    const supply = await getRecentSupply(1000);
    const demand = await getRecentDemand(1000);
    
    // Group by location
    const locationMap = new Map<string, { supply: any[]; demand: any[] }>();
    
    for (const s of supply) {
      const loc = (s as any).location || 'Unknown';
      if (!locationMap.has(loc)) {
        locationMap.set(loc, { supply: [], demand: [] });
      }
      locationMap.get(loc)!.supply.push(s);
    }
    
    for (const d of demand) {
      const loc = (d as any).location || 'Unknown';
      if (!locationMap.has(loc)) {
        locationMap.set(loc, { supply: [], demand: [] });
      }
      locationMap.get(loc)!.demand.push(d);
    }
    
    // Filter by location if provided
    if (location) {
      const filtered = new Map();
      const entries = Array.from(locationMap.entries());
      for (const [loc, data] of entries) {
        if (loc.toLowerCase().includes(location.toLowerCase())) {
          filtered.set(loc, data);
        }
      }
      locationMap.clear();
      const filteredEntries = Array.from(filtered.entries());
      for (const [loc, data] of filteredEntries) {
        locationMap.set(loc, data);
      }
    }
    
    // Create a worksheet for each location
    const entries = Array.from(locationMap.entries());
    for (const [loc, data] of entries) {
      if (data.supply.length === 0 && data.demand.length === 0) continue;
      
      const worksheet = workbook.addWorksheet(loc.substring(0, 31)); // Excel sheet name limit
      
      // Add header styling
      const headerRow = worksheet.addRow(['Location: ' + loc]);
      headerRow.font = { bold: true, size: 14 };
      headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4472C4' } };
      headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 14 };
      
      worksheet.addRow([]); // Empty row
      
      // Supply Section
      if (data.supply.length > 0) {
        const supplyHeader = worksheet.addRow(['SUPPLY LISTINGS']);
        supplyHeader.font = { bold: true, size: 12, color: { argb: 'FF70AD47' } };
        supplyHeader.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2EFDA' } };
        
        const supplyColHeader = worksheet.addRow([
          'ID', 'Location', 'Type', 'Bedrooms', 'Bathrooms', 'Price', 'Purpose', 'Contact', 'Date'
        ]);
        supplyColHeader.font = { bold: true };
        supplyColHeader.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFC6E0B4' } };
        
        for (const s of data.supply) {
          worksheet.addRow([
            (s as any).id || '',
            (s as any).location || '',
            (s as any).propertyType || '',
            (s as any).bedrooms || '',
            (s as any).bathrooms || '',
            (s as any).price || '',
            (s as any).purpose || '',
            (s as any).contact || '',
            (s as any).createdAt ? new Date((s as any).createdAt).toLocaleDateString() : ''
          ]);
        }
        
        worksheet.addRow([]); // Empty row
      }
      
      // Demand Section
      if (data.demand.length > 0) {
        const demandHeader = worksheet.addRow(['DEMAND LISTINGS']);
        demandHeader.font = { bold: true, size: 12, color: { argb: 'FFC55A11' } };
        demandHeader.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFCE4D6' } };
        
        const demandColHeader = worksheet.addRow([
          'ID', 'Location', 'Type', 'Bedrooms', 'Bathrooms', 'Budget Min', 'Budget Max', 'Contact', 'Date'
        ]);
        demandColHeader.font = { bold: true };
        demandColHeader.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFDBF8F' } };
        
        for (const d of data.demand) {
          worksheet.addRow([
            (d as any).id || '',
            (d as any).location || '',
            (d as any).propertyType || '',
            (d as any).bedrooms || '',
            (d as any).bathrooms || '',
            (d as any).budgetMin || '',
            (d as any).budgetMax || '',
            (d as any).contact || '',
            (d as any).createdAt ? new Date((d as any).createdAt).toLocaleDateString() : ''
          ]);
        }
      }
      
      // Auto-fit columns
      worksheet.columns.forEach(column => {
        let maxLength = 0;
        column.eachCell?.({ includeEmpty: true }, (cell) => {
          const cellLength = cell.value?.toString().length || 0;
          if (cellLength > maxLength) maxLength = cellLength;
        });
        column.width = Math.min(maxLength + 2, 50);
      });
    }
    
    return workbook;
  } catch (error) {
    console.error('[ExcelReport] Error generating report:', error);
    throw error;
  }
}

export async function generateExcelBuffer(location?: string): Promise<Buffer> {
  const workbook = await generateLocationFilteredExcelReport(location);
  return await workbook.xlsx.writeBuffer() as unknown as Buffer;
}
