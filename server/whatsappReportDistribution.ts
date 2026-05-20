/**
 * WhatsApp Report Distribution Service
 * Sends location-based reports to broker WhatsApp groups
 */



interface BrokerGroup {
  groupId: string;
  groupName: string;
  whatsappNumber: string;
  locationKey: string;
}

interface ReportDistribution {
  groupId: string;
  messageId: string;
  status: "pending" | "sent" | "delivered" | "read" | "failed";
  sentAt: Date;
  excelUrl: string;
  otpCode: string;
}

/**
 * Send report to WhatsApp group
 */
export async function sendReportToWhatsappGroup(
  brokerGroup: BrokerGroup,
  message: string,
  excelUrl: string
): Promise<ReportDistribution> {
  try {
    // Use Green API (already configured in Manus)
    const greenApiInstanceId = process.env.GREEN_API_INSTANCE_ID;
    const greenApiToken = process.env.GREEN_API_TOKEN;

    if (!greenApiInstanceId || !greenApiToken) {
      throw new Error("Green API credentials not configured");
    }

    // Send message via Green API
    const response = await fetch(
      `https://api.green-api.com/waInstance${greenApiInstanceId}/SendMessage/${greenApiToken}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chatId: `${brokerGroup.whatsappNumber}@g.us`, // Group ID format
          message: message,
        }),
      }
    );

    if (!response.ok) {
      throw new Error(`Green API error: ${response.statusText}`);
    }

    const data = await response.json();

    return {
      groupId: brokerGroup.groupId,
      messageId: data.idMessage || "unknown",
      status: "sent",
      sentAt: new Date(),
      excelUrl,
      otpCode: "", // OTP sent in message
    };
  } catch (error) {
    console.error("[WhatsAppDistribution] Failed to send report:", error);
    throw error;
  }
}

/**
 * Send reports to all broker groups for a location
 */
export async function distributReportToAllGroups(
  brokerGroups: BrokerGroup[],
  message: string,
  excelUrl: string
): Promise<ReportDistribution[]> {
  const results: ReportDistribution[] = [];

  for (const group of brokerGroups) {
    try {
      const distribution = await sendReportToWhatsappGroup(group, message, excelUrl);
      results.push(distribution);
      console.log(`[WhatsAppDistribution] Sent to ${group.groupName}`);
    } catch (error) {
      console.error(`[WhatsAppDistribution] Failed for ${group.groupName}:`, error);
      results.push({
        groupId: group.groupId,
        messageId: "failed",
        status: "failed",
        sentAt: new Date(),
        excelUrl,
        otpCode: "",
      });
    }
  }

  return results;
}

/**
 * Send report to email (for Karim and owner)
 */
export async function sendReportViaEmail(
  recipientEmail: string,
  locationName: string,
  excelUrl: string,
  demandsCount: number
): Promise<boolean> {
  try {
    const nodemailer = await import("nodemailer");

    const smtpHost = process.env.SMTP_HOST;
    const smtpPort = parseInt(process.env.SMTP_PORT || "587");
    const smtpUser = process.env.SMTP_USER;
    const smtpPass = process.env.SMTP_PASS;

    if (!smtpHost || !smtpUser || !smtpPass) {
      console.error("[EmailDistribution] SMTP config missing");
      return false;
    }

    const transporter = nodemailer.createTransport({
      host: smtpHost,
      port: smtpPort,
      secure: smtpPort === 465,
      auth: {
        user: smtpUser,
        pass: smtpPass,
      },
    });

    const info = await transporter.sendMail({
      from: `"MatchPro Reports" <${smtpUser}>`,
      to: recipientEmail,
      subject: `📊 MatchPro™ Demand Report - ${locationName} (${new Date().toLocaleDateString()})`,
      html: `
        <div style="font-family: Arial, sans-serif; direction: ltr;">
          <h2>📊 Demand Report Generated</h2>
          <p>Hi,</p>
          <p>Your automated demand report for <strong>${locationName}</strong> has been generated and distributed to broker groups.</p>
          
          <div style="background: #f3f4f6; padding: 15px; border-radius: 8px; margin: 20px 0;">
            <p><strong>Report Details:</strong></p>
            <ul style="margin: 10px 0;">
              <li><strong>Location:</strong> ${locationName}</li>
              <li><strong>Total Demands:</strong> ${demandsCount}</li>
              <li><strong>Generated:</strong> ${new Date().toLocaleString()}</li>
              <li><strong>Expires:</strong> In 15 minutes</li>
            </ul>
          </div>

          <p><a href="${excelUrl}" style="background: #3b82f6; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block;">Download Report</a></p>

          <p style="margin-top: 30px; color: #6b7280; font-size: 12px;">
            This is an automated message from MatchPro™ Real Estate Intelligence Platform.<br>
            Crystal Power Investments © 2026
          </p>
        </div>
      `,
    });

    console.log("[EmailDistribution] Email sent successfully:", info.messageId);
    return true;
  } catch (error) {
    console.error("[EmailDistribution] Failed to send email:", error);
    return false;
  }
}

/**
 * Log distribution event for audit trail
 */
export async function logDistributionEvent(
  reportId: string,
  locationKey: string,
  distributions: ReportDistribution[],
  emailSent: boolean
): Promise<void> {
  try {
    const successCount = distributions.filter((d) => d.status === "sent").length;
    const failureCount = distributions.filter((d) => d.status === "failed").length;

    console.log(`[DistributionAudit] Report ${reportId}`);
    console.log(`  Location: ${locationKey}`);
    console.log(`  WhatsApp Groups: ${successCount} sent, ${failureCount} failed`);
    console.log(`  Email: ${emailSent ? "sent" : "failed"}`);

    // In production, save to audit_logs table
  } catch (error) {
    console.error("[DistributionAudit] Failed to log event:", error);
  }
}
