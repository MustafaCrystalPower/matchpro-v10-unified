import { protectedProcedure } from './_core/trpc';
import { z } from 'zod';
import { getActiveProperties, getActiveBuyerRequests, getPropertiesByLocation, getBuyerRequestsByLocation } from './propertiesDb';
import * as ExcelJS from 'exceljs';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Export Properties to Excel
 */
export const exportPropertiesExcel = protectedProcedure
  .input(z.object({
    location: z.string().optional(),
    limit: z.number().default(500),
  }))
  .mutation(async ({ input }: { input: any }) => {
    try {
      console.log('📥 Exporting properties to Excel...');

      // Get properties data
      const properties = input.location
        ? await getPropertiesByLocation(input.location, input.limit)
        : await getActiveProperties(input.limit);

      // Create workbook
      const workbook = new ExcelJS.Workbook();
      const sheet = workbook.addWorksheet('Properties');

      // Add headers
      const headers = [
        'ID',
        'Contact Name',
        'Phone',
        'Property Type',
        'Location',
        'Price Min (EGP)',
        'Price Max (EGP)',
        'Bedrooms',
        'Bathrooms',
        'Status',
        'Priority',
        'Original Message',
        'Created At',
      ];

      const headerRow = sheet.addRow(headers);
      headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
      headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F4E78' } };
      headerRow.alignment = { horizontal: 'center', vertical: 'middle' };

      // Add data rows
      properties.forEach((prop: any, index: number) => {
        const row = sheet.addRow([
          prop.id,
          prop.name,
          prop.phone,
          prop.type,
          prop.location,
          prop.priceMin || '-',
          prop.priceMax || '-',
          prop.bedrooms || '-',
          prop.bathrooms || '-',
          prop.status,
          prop.priority,
          prop.originalMessage || '-',
          new Date(prop.createdAt).toLocaleString(),
        ]);

        if (index % 2 === 0) {
          row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF2F2F2' } };
        }
        row.alignment = { horizontal: 'left', vertical: 'middle' };
      });

      // Set column widths
      sheet.columns = [
        { width: 8 },
        { width: 20 },
        { width: 15 },
        { width: 15 },
        { width: 20 },
        { width: 15 },
        { width: 15 },
        { width: 10 },
        { width: 10 },
        { width: 12 },
        { width: 10 },
        { width: 40 },
        { width: 20 },
      ];

      // Save file
      const filename = `Properties_Export_${Date.now()}.xlsx`;
      const filepath = path.join('/tmp', filename);
      await workbook.xlsx.writeFile(filepath);

      console.log(`✅ Properties exported: ${properties.length} records`);
      return {
        success: true,
        filename,
        filepath,
        count: properties.length,
      };
    } catch (error: any) {
      console.error('[exportPropertiesExcel] Error:', error.message);
      throw new Error(`Failed to export properties: ${error.message}`);
    }
  });

/**
 * Export Buyer Requests to Excel
 */
export const exportBuyerRequestsExcel = protectedProcedure
  .input(z.object({
    location: z.string().optional(),
    limit: z.number().default(500),
  }))
  .mutation(async ({ input }: { input: any }) => {
    try {
      console.log('📥 Exporting buyer requests to Excel...');

      // Get buyer requests data
      const requests = input.location
        ? await getBuyerRequestsByLocation(input.location, input.limit)
        : await getActiveBuyerRequests(input.limit);

      // Create workbook
      const workbook = new ExcelJS.Workbook();
      const sheet = workbook.addWorksheet('Buyer Requests');

      // Add headers
      const headers = [
        'ID',
        'Contact Name',
        'Phone',
        'Property Type',
        'Location',
        'Budget Min (EGP)',
        'Budget Max (EGP)',
        'Bedrooms',
        'Bathrooms',
        'Status',
        'Priority',
        'Original Message',
        'Created At',
      ];

      const headerRow = sheet.addRow(headers);
      headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
      headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F4E78' } };
      headerRow.alignment = { horizontal: 'center', vertical: 'middle' };

      // Add data rows
      requests.forEach((req: any, index: number) => {
        const row = sheet.addRow([
          req.id,
          req.name,
          req.phone,
          req.type,
          req.location,
          req.budgetMin || '-',
          req.budgetMax || '-',
          req.bedrooms || '-',
          req.bathrooms || '-',
          req.status,
          req.priority,
          req.originalMessage || '-',
          new Date(req.createdAt).toLocaleString(),
        ]);

        if (index % 2 === 0) {
          row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF2F2F2' } };
        }
        row.alignment = { horizontal: 'left', vertical: 'middle' };
      });

      // Set column widths
      sheet.columns = [
        { width: 8 },
        { width: 20 },
        { width: 15 },
        { width: 15 },
        { width: 20 },
        { width: 15 },
        { width: 15 },
        { width: 10 },
        { width: 10 },
        { width: 12 },
        { width: 10 },
        { width: 40 },
        { width: 20 },
      ];

      // Save file
      const filename = `BuyerRequests_Export_${Date.now()}.xlsx`;
      const filepath = path.join('/tmp', filename);
      await workbook.xlsx.writeFile(filepath);

      console.log(`✅ Buyer requests exported: ${requests.length} records`);
      return {
        success: true,
        filename,
        filepath,
        count: requests.length,
      };
    } catch (error: any) {
      console.error('[exportBuyerRequestsExcel] Error:', error.message);
      throw new Error(`Failed to export buyer requests: ${error.message}`);
    }
  });
