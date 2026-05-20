/**
 * Asset Match Email Service
 * Sends branded Excel reports with matched leads to asset owners
 */

import nodemailer from "nodemailer";
import { Workbook } from "exceljs";

interface MatchedLead {
  senderName: string;
  senderPhone: string;
  location: string;
  propertyType: string;
  bedrooms?: number;
  bathrooms?: number;
  size?: number;
  budget?: number;
  purpose: "sale" | "rent";
  originalMessage: string;
  messageDate: string;
  matchScore: number;
}

interface AssetInfo {
  propertyType: string;
  location: string;
  bedrooms?: number;
  bathrooms?: number;
  size?: number;
  price: number;
  priceType: "sale" | "rent";
}

/**
 * Create branded Excel workbook with matched leads
 */
export async function generateAssetMatchExcel(
  assetInfo: AssetInfo,
  leads: MatchedLead[],
  logoUrl?: string
): Promise<Buffer> {
  const workbook = new Workbook();
  const worksheet = workbook.addWorksheet("Matched Leads");

  // Add header
  worksheet.mergeCells("A1:H1");
  const headerCell = worksheet.getCell("A1");
  headerCell.value = "MatchPro™ - Matched Leads Report";
  headerCell.font = { bold: true, size: 14, color: { argb: "FF1F2937" } };
  headerCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF3F4F6" } };
  headerCell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
  worksheet.getRow(1).height = 25;

  // Asset info section
  worksheet.mergeCells("A3:H3");
  const assetHeader = worksheet.getCell("A3");
  assetHeader.value = `Asset: ${assetInfo.propertyType} in ${assetInfo.location}`;
  assetHeader.font = { bold: true, size: 12 };
  assetHeader.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE5E7EB" } };

  // Asset details
  const detailsRow = 4;
  worksheet.getCell(`A${detailsRow}`).value = "Asset Details:";
  worksheet.getCell(`A${detailsRow + 1}`).value = `Type: ${assetInfo.propertyType}`;
  worksheet.getCell(`A${detailsRow + 2}`).value = `Location: ${assetInfo.location}`;
  worksheet.getCell(`A${detailsRow + 3}`).value = `Bedrooms: ${assetInfo.bedrooms || "N/A"}`;
  worksheet.getCell(`A${detailsRow + 4}`).value = `Bathrooms: ${assetInfo.bathrooms || "N/A"}`;
  worksheet.getCell(`A${detailsRow + 5}`).value = `Size: ${assetInfo.size || "N/A"} m²`;
  worksheet.getCell(`A${detailsRow + 6}`).value = `Price: ${assetInfo.price.toLocaleString()} EGP`;
  worksheet.getCell(`A${detailsRow + 7}`).value = `Type: ${assetInfo.priceType === "sale" ? "For Sale" : "For Rent"}`;

  // Leads table header (row 13)
  const headerRow = 13;
  const headers = [
    "Requester Name",
    "Phone",
    "Location",
    "Property Type",
    "Bedrooms",
    "Bathrooms",
    "Size (m²)",
    "Budget",
    "Purpose",
    "Match Score",
    "Original Message",
    "Date",
  ];

  headers.forEach((header, index) => {
    const cell = worksheet.getCell(headerRow, index + 1);
    cell.value = header;
    cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1F2937" } };
    cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
  });

  // Add leads data
  leads.forEach((lead, index) => {
    const row = headerRow + 1 + index;
    worksheet.getCell(row, 1).value = lead.senderName;
    worksheet.getCell(row, 2).value = lead.senderPhone;
    worksheet.getCell(row, 3).value = lead.location;
    worksheet.getCell(row, 4).value = lead.propertyType;
    worksheet.getCell(row, 5).value = lead.bedrooms || "N/A";
    worksheet.getCell(row, 6).value = lead.bathrooms || "N/A";
    worksheet.getCell(row, 7).value = lead.size || "N/A";
    worksheet.getCell(row, 8).value = lead.budget ? lead.budget.toLocaleString() : "N/A";
    worksheet.getCell(row, 9).value = lead.purpose === "sale" ? "For Sale" : "For Rent";
    worksheet.getCell(row, 10).value = `${lead.matchScore}%`;
    worksheet.getCell(row, 11).value = lead.originalMessage;
    worksheet.getCell(row, 12).value = lead.messageDate;

    // Color code by match score
    const scoreCell = worksheet.getCell(row, 10);
    if (lead.matchScore >= 85) {
      scoreCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFD1FAE5" } };
    } else if (lead.matchScore >= 70) {
      scoreCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFEF3C7" } };
    }
  });

  // Set column widths
  worksheet.columns = [
    { width: 15 },
    { width: 15 },
    { width: 15 },
    { width: 15 },
    { width: 10 },
    { width: 10 },
    { width: 10 },
    { width: 12 },
    { width: 10 },
    { width: 10 },
    { width: 30 },
    { width: 12 },
  ];

  // Freeze top rows
  worksheet.views = [{ state: "frozen", ySplit: headerRow }];

  // Generate buffer
  const buffer = await workbook.xlsx.writeBuffer();
  return buffer as unknown as Buffer;
}

/**
 * Send asset match email with branded Excel attachment
 */
export async function sendAssetMatchEmail(
  recipientEmail: string,
  assetInfo: AssetInfo,
  leads: MatchedLead[],
  logoUrl?: string
): Promise<boolean> {
  try {
    // Get SMTP config from env
    const smtpHost = process.env.SMTP_HOST;
    const smtpPort = parseInt(process.env.SMTP_PORT || "587");
    const smtpUser = process.env.SMTP_USER;
    const smtpPass = process.env.SMTP_PASS;

    if (!smtpHost || !smtpUser || !smtpPass) {
      console.error("[AssetMatchEmail] SMTP config missing");
      return false;
    }

    // Create transporter
    const transporter = nodemailer.createTransport({
      host: smtpHost,
      port: smtpPort,
      secure: smtpPort === 465,
      auth: {
        user: smtpUser,
        pass: smtpPass,
      },
    });

    // Generate Excel
    const excelBuffer = await generateAssetMatchExcel(assetInfo, leads, logoUrl);

    // Send email
    const info = await transporter.sendMail({
      from: `"MatchPro" <${smtpUser}>`,
      to: recipientEmail,
      subject: `🏠 New Matched Leads for Your ${assetInfo.propertyType} in ${assetInfo.location}`,
      html: `
        <div style="font-family: Arial, sans-serif; direction: ltr;">
          <h2>New Matched Leads Found!</h2>
          <p>Hi,</p>
          <p>We found <strong>${leads.length}</strong> potential buyer(s) or renter(s) matching your property:</p>
          
          <div style="background: #f3f4f6; padding: 15px; border-radius: 8px; margin: 20px 0;">
            <p><strong>Property Details:</strong></p>
            <ul style="margin: 10px 0;">
              <li><strong>Type:</strong> ${assetInfo.propertyType}</li>
              <li><strong>Location:</strong> ${assetInfo.location}</li>
              <li><strong>Bedrooms:</strong> ${assetInfo.bedrooms || "N/A"}</li>
              <li><strong>Price:</strong> ${assetInfo.price.toLocaleString()} EGP</li>
            </ul>
          </div>

          <p>See the attached Excel file for complete lead details including contact information and original messages.</p>
          
          <p><strong>Match Scores:</strong></p>
          <ul>
            <li>🟢 85%+ = Excellent match</li>
            <li>🟡 70-84% = Good match</li>
            <li>⚪ Below 70% = Possible match</li>
          </ul>

          <p style="margin-top: 30px; color: #6b7280; font-size: 12px;">
            This is an automated message from MatchPro™ Real Estate Intelligence Platform.<br>
            Crystal Power Investments © 2026
          </p>
        </div>
      `,
      attachments: [
        {
          filename: `matched-leads-${assetInfo.location}-${new Date().toISOString().split("T")[0]}.xlsx`,
          content: excelBuffer,
          contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        },
      ],
    });

    console.log("[AssetMatchEmail] Email sent successfully:", info.messageId);
    return true;
  } catch (error) {
    console.error("[AssetMatchEmail] Failed to send email:", error);
    return false;
  }
}

/**
 * Batch send emails for multiple assets with matches
 */
export async function sendBatchAssetMatchEmails(
  recipientEmail: string,
  assetMatches: Array<{
    asset: AssetInfo;
    leads: MatchedLead[];
  }>,
  logoUrl?: string
): Promise<number> {
  let successCount = 0;

  for (const match of assetMatches) {
    const success = await sendAssetMatchEmail(
      recipientEmail,
      match.asset,
      match.leads,
      logoUrl
    );
    if (success) successCount++;
  }

  return successCount;
}
