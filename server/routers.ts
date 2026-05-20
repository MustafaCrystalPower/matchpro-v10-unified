import { COOKIE_NAME } from "@shared/const";
import { z } from "zod";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import { reportRouter } from "./reportProcedures";
import { savedSearchesRouter } from "./routers/savedSearches";
import {
  getRecentMessages,
  getLiveMessageFeed,
  getRecentSupply,
  getRecentDemand,
  getPendingReviewSupply,
  getPendingReviewDemand,
  approveSupplyRecord,
  rejectSupplyRecord,
  approveDemandRecord,
  rejectDemandRecord,
  getPendingReviewCount,
  getFilteredSupply,
  getFilteredDemand,
  getRecentMatches,
  getHighConfidenceMatches,
  getMatchWithDetails,
  updateMatchStatus,
  getDashboardStats,
  getLocationStats,
  getPropertyTypeStats,
  getPriceStats,
  getActiveGroups,
  getUnreadNotifications,
  getUnreadNotificationCount,
  markNotificationRead,
  markAllNotificationsRead,
  addBookmark,
  removeBookmark,
  getUserBookmarks,
  getBookmarksWithDetails,
  isBookmarked,
  addMatchFeedback,
  getMatchFeedback,
  getAverageMatchRating,
  getUserFeedbackForMatch,
  getSupplyWithAmenityFilters,
  // New imports for market intelligence
  getNotificationPreferences,
  upsertNotificationPreferences,
  isAuthorizedAdmin,
  getAuthorizedAdmins,
  getAllAuthorizedAdmins,
  addAuthorizedAdmin,
  deactivateAuthorizedAdmin,
  reactivateAuthorizedAdmin,
  getMarketIntelligence,
  getMarketHeatmap,
  refreshMarketIntelligence,
  getLiveSupplyPins,
  getLiveDemandPins,
  getLiveHeatmapData,
  hasMarketIntelligenceAccess,
  upsertUserProfile,
  getUserProfile,
  createCustomNotification,
  getUserNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  getUserUnreadNotificationCount,
  createUserOnboarding,
  getUserOnboardingByToken,
  qualifyMatch,
  getQualifiedMatches,
  getTopBrokers,
  getBrokerAnalytics,
  getHotZones,
  getMarketDataByLocation,
  completeUserOnboarding,
  // P0: System Health
  getSystemHealth,
  updateWhatsappHealth,
  // P1: Audit Logs
  createAuditLog,
  getAuditLogs,
  // P2: Conversion & Analytics
  createConversionFunnel,
  updateConversionStage,
  getConversionMetrics,
  getSegmentedAnalytics,
  getTopOpportunities,
  getOversupplyAreas,
  // Multi-tenant / organization
  createOrganization,
  getOrganizationById,
  getAllOrganizations,
  setUserOrganization,
  getSupplyByOrg,
  getDemandByOrg,
  getMatchesByOrg,
  getDashboardStatsByOrg,
  deduplicateExistingMatches,
  getSupplySourceGroups,
  getDemandSourceGroups,
  getDailyDigest,
  getMatchAccuracyTrend,
  getAllSettings,
  getSetting,
  upsertSetting,
} from "./db";
import { generateInviteQR } from "./whatsappMagicLink";
import { runFullMatchingCycle } from "./matchingEngine";
import { runReport, getReportLogs } from "./reportingService";
import { savePushSubscription, deletePushSubscription, sendPushToAll, isVapidReady } from "./webPushService";
import { getInvestorDashboardData, getAreaAnalysis, generateInsights } from "./investorInsights";
import { getDb } from "./db";
import { supply, demand, brokersList, scheduledJobs } from "../drizzle/schema";
import { profileIntakes, appointments } from "../drizzle/schema";
import { eq, desc } from "drizzle-orm";
// Outbound WhatsApp sending is disabled — MatchPro is a read-only dashboard
// import { sendWhatsAppNotification, sendEmailNotification, notifyHighConfidenceMatch } from "./notificationService";
import { TRPCError } from "@trpc/server";

// Green API helper functions
async function getGreenApiStatus() {
  const instanceId = process.env.GREEN_API_INSTANCE_ID;
  const token = process.env.GREEN_API_TOKEN;
  
  if (!instanceId || !token) {
    return { status: 'not_configured', message: 'Green API credentials not set' };
  }
  
  try {
    const response = await fetch(
      `https://api.green-api.com/waInstance${instanceId}/getStateInstance/${token}`
    );
    const data = await response.json();
    return { 
      status: data.stateInstance, 
      instanceId,
      message: data.stateInstance === 'authorized' ? 'WhatsApp connected' : 'WhatsApp not connected'
    };
  } catch (error) {
    return { status: 'error', message: 'Failed to connect to Green API' };
  }
}

async function getGreenApiQRCode() {
  const instanceId = process.env.GREEN_API_INSTANCE_ID;
  const token = process.env.GREEN_API_TOKEN;
  
  if (!instanceId || !token) {
    return { qrCode: null, message: 'Green API credentials not set' };
  }
  
  try {
    const response = await fetch(
      `https://api.green-api.com/waInstance${instanceId}/qr/${token}`
    );
    const data = await response.json();
    return { 
      qrCode: data.message === 'qr code is not available' ? null : data.message,
      type: data.type || 'qrCode'
    };
  } catch (error) {
    return { qrCode: null, message: 'Failed to get QR code' };
  }
}

async function logoutGreenApi() {
  const instanceId = process.env.GREEN_API_INSTANCE_ID;
  const token = process.env.GREEN_API_TOKEN;
  
  if (!instanceId || !token) {
    return { success: false, message: 'Green API credentials not set' };
  }
  
  try {
    const response = await fetch(
      `https://api.green-api.com/waInstance${instanceId}/logout/${token}`,
      { method: 'GET' }
    );
    const data = await response.json();
    return { success: data.isLogout, message: data.isLogout ? 'Logged out successfully' : 'Logout failed' };
  } catch (error) {
    return { success: false, message: 'Failed to logout' };
  }
}

async function setGreenApiWebhook(webhookUrl: string) {
  const instanceId = process.env.GREEN_API_INSTANCE_ID;
  const token = process.env.GREEN_API_TOKEN;
  
  if (!instanceId || !token) {
    return { success: false, message: 'Green API credentials not set' };
  }
  
  try {
    const response = await fetch(
      `https://api.green-api.com/waInstance${instanceId}/setSettings/${token}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          webhookUrl: webhookUrl,
          webhookUrlToken: '',
          outgoingWebhook: 'yes',
          incomingWebhook: 'yes',
          stateWebhook: 'yes',
          outgoingMessageWebhook: 'yes',
          outgoingAPIMessageWebhook: 'yes',
          receiveWebhook: 'yes'
        })
      }
    );
    const data = await response.json();
    return { success: data.saveSettings, message: data.saveSettings ? 'Webhook configured' : 'Failed to configure webhook' };
  } catch (error) {
    return { success: false, message: 'Failed to set webhook' };
  }
}

// Admin-only procedure middleware
const adminProcedure = protectedProcedure.use(async ({ ctx, next }) => {
  if (!ctx.user?.email) {
    throw new TRPCError({ code: 'FORBIDDEN', message: 'Admin access required' });
  }
  
  const isAdmin = await isAuthorizedAdmin(ctx.user.email);
  if (!isAdmin && ctx.user.role !== 'admin') {
    throw new TRPCError({ code: 'FORBIDDEN', message: 'Admin access required' });
  }
  
  return next({ ctx: { ...ctx, isAdmin: true } });
});

// Import report generator
import { generateCorrectTemplateReport } from './correctTemplateReportGenerator';
import { matchesRouter } from './matchesProcedures';

export const appRouter = router({
  system: systemRouter,

  admin: router({
    overrideMessageClassification: protectedProcedure
      .input(z.object({
        messageId: z.number(),
        classification: z.enum(['supply', 'demand', 'general']),
        role: z.enum(['broker', 'end_user', 'seller', 'buyer', 'unknown']),
      }))
      .mutation(async ({ ctx, input }) => {
        if (ctx.user?.role !== 'admin') {
          throw new TRPCError({ code: 'FORBIDDEN', message: 'Admin access required' });
        }

        const db = await getDb();
        if (!db) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR' });

        try {
          await (db as any).$client.promise().execute(
            `UPDATE messages SET classification = ?, inferredRole = ?, overriddenBy = ?, overriddenAt = NOW() WHERE id = ?`,
            [input.classification, input.role, ctx.user?.id || 'admin', input.messageId]
          );

          // Skip audit log for now - schema mismatch
          // Will be implemented in next phase

          return { success: true };
        } catch (error) {
          console.error('[admin.overrideMessageClassification] Error:', error);
          throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Failed to update classification' });
        }
      }),
      
    generateReport: protectedProcedure
      .mutation(async ({ ctx }) => {
        if (ctx.user?.role !== 'admin') {
          throw new TRPCError({ code: 'FORBIDDEN', message: 'Admin access required' });
        }
        
        try {
          const filename = await generateCorrectTemplateReport();
          return { success: true, filename };
        } catch (error) {
          console.error('[admin.generateReport] Error:', error);
          throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Failed to generate report' });
        }
      }),
  }),
  
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
    isAdmin: protectedProcedure.query(async ({ ctx }) => {
      if (!ctx.user?.email) return false;
      const isAdmin = await isAuthorizedAdmin(ctx.user.email);
      return isAdmin || ctx.user.role === 'admin';
    }),
  }),

  // Dashboard statistics
  dashboard: router({
    stats: publicProcedure
      .input(z.object({ area: z.string().optional() }).optional())
      .query(async ({ input }) => {
      const stats = await getDashboardStats(input?.area);
      return stats || {
        totalSupply: 0,
        totalDemand: 0,
        totalMatches: 0,
        highConfidenceMatches: 0,
        totalMessages: 0,
        todayMessages: 0,
        supplyDemandRatio: 0,
        lastMessageAt: null as Date | null,
        lastMessageSender: null as string | null,
        lastMessageSenderName: null as string | null,
        lastMessageGroup: null as string | null,
        lastMatchAt: null as Date | null,
      };
    }),

    liveFeed: publicProcedure
      .input(z.object({ 
        limit: z.number().min(1).max(50).default(20),
        senderFilter: z.string().optional(),
      }).optional())
      .query(async ({ input }) => {
        return getLiveMessageFeed(input?.limit || 20, input?.senderFilter);
      }),

    locationStats: publicProcedure.query(async () => {
      return getLocationStats();
    }),

    propertyTypeStats: publicProcedure.query(async () => {
      return getPropertyTypeStats();
    }),

    priceStats: publicProcedure.query(async () => {
      return getPriceStats();
    }),
  }),

  // Messages
  messages: router({
    recent: publicProcedure
      .input(z.object({ limit: z.number().min(1).max(5000).default(500) }).optional())
      .query(async ({ input }) => {
        return getRecentMessages(input?.limit || 500);
      }),
  }),

  // Supply listings
  supply: router({
    recent: publicProcedure
      .input(z.object({ limit: z.number().min(1).max(5000).default(200) }).optional())
      .query(async ({ input }) => {
        return getRecentSupply(input?.limit || 200);
      }),
    
    withAmenities: publicProcedure
      .input(z.object({
        hasPool: z.boolean().optional(),
        hasBalcony: z.boolean().optional(),
        hasGarden: z.boolean().optional(),
        hasParking: z.boolean().optional(),
        hasElevator: z.boolean().optional(),
        hasSecurity: z.boolean().optional(),
        hasGym: z.boolean().optional(),
        hasFurnished: z.boolean().optional(),
        hasAC: z.boolean().optional(),
        limit: z.number().min(1).max(100).default(50)
      }).optional())
      .query(async ({ input }) => {
        return getSupplyWithAmenityFilters(input || {}, input?.limit || 50);
      }),

    // Get distinct source groups for filter dropdown
    sourceGroups: publicProcedure.query(async () => {
      return getSupplySourceGroups();
    }),

    // Advanced filtered supply for Properties page
    filtered: publicProcedure
      .input(z.object({
        propertyType: z.string().optional(),
        location: z.string().optional(),
        purpose: z.enum(['sale', 'rent']).optional(),
        priority: z.enum(['high', 'medium', 'low']).optional(),
        reviewStatus: z.enum(['auto_approved', 'pending_review', 'approved', 'rejected']).optional(),
        minConfidence: z.number().min(0).max(1).optional(),
        maxConfidence: z.number().min(0).max(1).optional(),
        minPrice: z.number().optional(),
        maxPrice: z.number().optional(),
        bedrooms: z.number().optional(),
        sourceGroup: z.string().optional(),
        matched: z.boolean().optional(),
        limit: z.number().min(1).max(500).default(100),
      }).optional())
      .query(async ({ input }) => {
        return getFilteredSupply(input || {});
      }),

    // Pending review queue
    pendingReview: publicProcedure
      .input(z.object({ limit: z.number().min(1).max(100).default(50) }).optional())
      .query(async ({ input }) => {
        return getPendingReviewSupply(input?.limit || 50);
      }),

    // Approve a supply record
    approve: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const reviewerName = ctx.user?.name || ctx.user?.email || 'admin';
        await approveSupplyRecord(input.id, reviewerName);
        return { success: true };
      }),

    // Reject a supply record
    reject: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const reviewerName = ctx.user?.name || ctx.user?.email || 'admin';
        await rejectSupplyRecord(input.id, reviewerName);
        return { success: true };
      }),
  }),

  // Demand requests
  demand: router({
    // Get distinct source groups for filter dropdown
    sourceGroups: publicProcedure.query(async () => {
      return getDemandSourceGroups();
    }),

    recent: publicProcedure
      .input(z.object({ limit: z.number().min(1).max(5000).default(200) }).optional())
      .query(async ({ input }) => {
        return getRecentDemand(input?.limit || 200);
      }),

    // Advanced filtered demand for Buyer Requests page
    filtered: publicProcedure
      .input(z.object({
        propertyType: z.string().optional(),
        location: z.string().optional(),
        purpose: z.enum(['sale', 'rent']).optional(),
        priority: z.enum(['high', 'medium', 'low']).optional(),
        reviewStatus: z.enum(['auto_approved', 'pending_review', 'approved', 'rejected']).optional(),
        minConfidence: z.number().min(0).max(1).optional(),
        maxConfidence: z.number().min(0).max(1).optional(),
        minBudget: z.number().optional(),
        maxBudget: z.number().optional(),
        bedrooms: z.number().optional(),
        sourceGroup: z.string().optional(),
        matched: z.boolean().optional(),
        limit: z.number().min(1).max(500).default(100),
      }).optional())
      .query(async ({ input }) => {
        return getFilteredDemand(input || {});
      }),

    // Pending review queue
    pendingReview: publicProcedure
      .input(z.object({ limit: z.number().min(1).max(100).default(50) }).optional())
      .query(async ({ input }) => {
        return getPendingReviewDemand(input?.limit || 50);
      }),

    // Approve a demand record
    approve: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const reviewerName = ctx.user?.name || ctx.user?.email || 'admin';
        await approveDemandRecord(input.id, reviewerName);
        return { success: true };
      }),

    // Reject a demand record
    reject: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const reviewerName = ctx.user?.name || ctx.user?.email || 'admin';
        await rejectDemandRecord(input.id, reviewerName);
        return { success: true };
      }),
  }),

  // Review workflow
  review: router({
    // Get count of pending items
    pendingCount: publicProcedure.query(async () => {
      return getPendingReviewCount();
    }),
  }),

  // Matches
  matches: router({
    recent: publicProcedure
      .input(z.object({ 
        limit: z.number().min(1).max(5000).default(500),
        minScore: z.number().min(0).max(100).optional()
      }).optional())
      .query(async ({ input }) => {
        const allMatches = await getRecentMatches(input?.limit || 500);
        // Filter by minimum score if specified
        if (input?.minScore) {
          return allMatches.filter((m: any) => Number(m.matchScore) >= input.minScore!);
        }
        return allMatches;
      }),

    highConfidence: publicProcedure
      .input(z.object({ 
        minScore: z.number().min(0).max(100).default(85),
        limit: z.number().min(1).max(100).default(20) 
      }).optional())
      .query(async ({ input }) => {
        return getHighConfidenceMatches(input?.minScore || 85, input?.limit || 20);
      }),

    // Live polling: returns count of new high-confidence matches since a given timestamp
    newSince: publicProcedure
      .input(z.object({
        sinceTimestamp: z.number(), // Unix ms
        minScore: z.number().min(0).max(100).default(85),
      }))
      .query(async ({ input }) => {
        const { getDb } = await import('./db');
        const db = await getDb();
        if (!db) return { count: 0, latestId: 0 };
        const since = new Date(input.sinceTimestamp);
        const [rows] = await (db as any).$client.promise().execute(
          `SELECT COUNT(*) as count, MAX(id) as latestId
           FROM matches
           WHERE CAST(matchScore AS DECIMAL) >= ? AND deletedAt IS NULL AND createdAt > ?`,
          [input.minScore, since]
        );
        const row = (rows as any[])[0];
        return { count: Number(row?.count ?? 0), latestId: Number(row?.latestId ?? 0) };
      }),

    details: publicProcedure
      .input(z.object({ matchId: z.number() }))
      .query(async ({ input }) => {
        return getMatchWithDetails(input.matchId);
      }),

    updateStatus: protectedProcedure
      .input(z.object({
        matchId: z.number(),
        status: z.enum(["new", "viewed", "contacted", "viewing_scheduled", "negotiating", "closed"]),
        note: z.string().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const { getDb } = await import("./db");
        const db = await getDb();
        if (!db) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'DB unavailable' });
        // Get current status for history
        const [rows] = await (db as any).$client.promise().execute(
          'SELECT status FROM matches WHERE id = ?', [input.matchId]
        );
        const currentStatus = (rows as any[])[0]?.status ?? null;
        // Update match status
        await updateMatchStatus(input.matchId, input.status);
        // Record history
        await (db as any).$client.promise().execute(
          `INSERT INTO matchStatusHistory (matchId, fromStatus, toStatus, changedByUserId, changedByName, note, createdAt)
           VALUES (?, ?, ?, ?, ?, ?, NOW())`,
          [input.matchId, currentStatus, input.status, ctx.user.id, ctx.user.name ?? ctx.user.email ?? 'Admin', input.note ?? null]
        );
        return { success: true, fromStatus: currentStatus, toStatus: input.status };
      }),

    getStatusHistory: protectedProcedure
      .input(z.object({ matchId: z.number() }))
      .query(async ({ input }) => {
        const { getDb } = await import("./db");
        const db = await getDb();
        if (!db) return [];
        const [rows] = await (db as any).$client.promise().execute(
          `SELECT * FROM matchStatusHistory WHERE matchId = ? ORDER BY createdAt DESC LIMIT 50`,
          [input.matchId]
        );
        return rows as any[];
      }),

    conversionFunnel: protectedProcedure.query(async () => {
      const { getDb } = await import("./db");
      const db = await getDb();
      if (!db) return null;
      const [rows] = await (db as any).$client.promise().execute(`
        SELECT
          COUNT(*) as total,
          SUM(CASE WHEN status = 'new' THEN 1 ELSE 0 END) as new_count,
          SUM(CASE WHEN status = 'viewed' THEN 1 ELSE 0 END) as viewed_count,
          SUM(CASE WHEN status = 'contacted' THEN 1 ELSE 0 END) as contacted_count,
          SUM(CASE WHEN status = 'viewing_scheduled' THEN 1 ELSE 0 END) as viewing_count,
          SUM(CASE WHEN status = 'negotiating' THEN 1 ELSE 0 END) as negotiating_count,
          SUM(CASE WHEN status = 'closed' THEN 1 ELSE 0 END) as closed_count
        FROM matches WHERE deletedAt IS NULL
      `);
      const r = (rows as any[])[0] ?? {};
      return {
        total: Number(r.total ?? 0),
        new: Number(r.new_count ?? 0),
        viewed: Number(r.viewed_count ?? 0),
        contacted: Number(r.contacted_count ?? 0),
        viewingScheduled: Number(r.viewing_count ?? 0),
        negotiating: Number(r.negotiating_count ?? 0),
        closed: Number(r.closed_count ?? 0),
      };
    }),

    updateNotes: protectedProcedure
      .input(z.object({
        matchId: z.number(),
        notes: z.string()
      }))
      .mutation(async ({ input }) => {
        const { updateMatchNotes } = await import("./db");
        await updateMatchNotes(input.matchId, input.notes);
        return { success: true };
      }),

    updateLastContacted: protectedProcedure
      .input(z.object({ matchId: z.number() }))
      .mutation(async ({ input }) => {
        const { getDb } = await import("./db");
        const db = await getDb();
        if (!db) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'DB unavailable' });
        await (db as any).$client.promise().execute(
          'UPDATE matches SET lastContactedAt = NOW(), status = IF(status = "new", "contacted", status), updatedAt = NOW() WHERE id = ?',
          [input.matchId]
        );
        return { success: true, contactedAt: new Date().toISOString() };
      }),

    runMatching: protectedProcedure.mutation(async () => {
      const result = await runFullMatchingCycle();
      return result;
    }),

    deduplicateMatches: protectedProcedure.mutation(async () => {
      const result = await deduplicateExistingMatches();
      return result;
    }),

    exportCSV: publicProcedure
      .input(z.object({
        minScore: z.number().min(0).max(100).optional(),
        status: z.enum(["new", "viewed", "contacted", "viewing_scheduled", "negotiating", "closed"]).optional(),
        limit: z.number().min(1).max(1000).default(500)
      }).optional())
      .query(async ({ input }) => {
        const matches = await getRecentMatches(input?.limit || 500);
        
        // Filter by score if specified
        let filteredMatches = matches;
        if (input?.minScore) {
          filteredMatches = matches.filter((m: any) => Number(m.matchScore) >= input.minScore!);
        }
        if (input?.status) {
          filteredMatches = filteredMatches.filter((m: any) => m.status === input.status);
        }
        
        // Generate CSV content
        const headers = [
          'Match ID',
          'Match Score',
          'Status',
          'SUPPLY Contact Name',
          'SUPPLY Contact Phone',
          'DEMAND Contact Name',
          'DEMAND Contact Phone',
          'Location Score',
          'Price Score',
          'Specs Score',
          'Qualification Status',
          'Contacts Verified',
          'Match Summary',
          'Match Explanation',
          'Notes',
          'Created At'
        ];
        
        const rows = filteredMatches.map((m: any) => [
          m.id,
          m.matchScore || m.confidenceScore || '',
          m.status || 'new',
          m.supplyContactName || 'N/A',
          m.supplyContactPhone || 'N/A',
          m.demandContactName || 'N/A',
          m.demandContactPhone || 'N/A',
          m.locationScore || '',
          m.priceScore || '',
          m.specsScore || '',
          m.qualificationStatus || 'pending',
          m.contactsVerified ? 'Yes' : 'No',
          (m.matchSummary || '').replace(/,/g, ';').replace(/\n/g, ' '),
          (m.matchExplanation || '').replace(/,/g, ';').replace(/\n/g, ' '),
          (m.notes || '').replace(/,/g, ';').replace(/\n/g, ' '),
          m.createdAt ? new Date(m.createdAt).toISOString() : ''
        ]);
        
        const csvContent = [
          headers.join(','),
          ...rows.map((row: any[]) => row.map(cell => `"${String(cell || '').replace(/"/g, '""')}"` ).join(','))
        ].join('\n');
        
        return {
          csv: csvContent,
          filename: `matchpro-matches-${new Date().toISOString().split('T')[0]}.csv`,
          count: filteredMatches.length
        };
      }),

    // Get only qualified matches (both contacts verified)
    qualified: publicProcedure
      .input(z.object({ limit: z.number().default(50) }))
      .query(async ({ input }) => {
        return await getQualifiedMatches(input.limit);
      }),
    
    // Qualify a match - verify both contacts
    qualify: protectedProcedure
      .input(z.object({ matchId: z.number() }))
      .mutation(async ({ input }) => {
        const isQualified = await qualifyMatch(input.matchId);
        return { success: true, isQualified };
      }),

    // Submit match feedback for continuous learning
    feedback: protectedProcedure
      .input(z.object({
        matchId: z.number(),
        rating: z.number().min(1).max(5),
        comment: z.string().optional(),
        helpful: z.number().optional()
      }))
      .mutation(async ({ input, ctx }) => {
        const { addMatchFeedback } = await import("./db");
        const feedbackId = await addMatchFeedback({
          matchId: input.matchId,
          userId: ctx.user?.id,
          rating: input.rating,
          comment: input.comment,
          helpful: input.helpful || 0
        });
        return { success: true, feedbackId, message: "Feedback recorded" };
      }),
  }),

  // WhatsApp groups
  groups: router({
    active: publicProcedure.query(async () => {
      return getActiveGroups();
    }),
  }),

  // Notifications
  notifications: router({
    unread: publicProcedure
      .input(z.object({ limit: z.number().min(1).max(50).default(20) }).optional())
      .query(async ({ input }) => {
        return getUnreadNotifications(input?.limit || 20);
      }),

    count: publicProcedure.query(async () => {
      return getUnreadNotificationCount();
    }),

    markRead: protectedProcedure
      .input(z.object({ notificationId: z.number() }))
      .mutation(async ({ input }) => {
        await markNotificationRead(input.notificationId);
        return { success: true };
      }),

    markAllRead: protectedProcedure.mutation(async () => {
      await markAllNotificationsRead();
      return { success: true };
    }),

    // Send test notification
    sendTest: adminProcedure
      .input(z.object({
        channel: z.enum(['whatsapp', 'email', 'both']),
        phoneNumber: z.string().optional(),
        email: z.string().email().optional()
      }))
      .mutation(async ({ input }) => {
        const payload = {
          title: 'Test Notification from MatchPro',
          message: 'This is a test notification to verify your notification channels are working correctly.',
          matchScore: 95
        };

        // Outbound WhatsApp/email sending is disabled — MatchPro is a read-only dashboard
        // All notifications are displayed inside the dashboard only
        const results = { whatsapp: false, email: false, message: 'Outbound messaging is disabled. Notifications appear in the dashboard only.' };
        return results;
      }),
  }),

  // Notification Preferences
  notificationPrefs: router({
    get: protectedProcedure.query(async ({ ctx }) => {
      if (!ctx.user) return null;
      return getNotificationPreferences(ctx.user.id);
    }),

    update: protectedProcedure
      .input(z.object({
        emailEnabled: z.boolean().optional(),
        emailAddress: z.string().email().optional(),
        whatsappEnabled: z.boolean().optional(),
        whatsappNumber: z.string().optional(),
        highMatchThreshold: z.number().min(60).max(100).optional(),
        notifyNewSupply: z.boolean().optional(),
        notifyNewDemand: z.boolean().optional(),
        notifyHighMatch: z.boolean().optional()
      }))
      .mutation(async ({ ctx, input }) => {
        if (!ctx.user) return { success: false };
        
        await upsertNotificationPreferences({
          userId: ctx.user.id,
          emailEnabled: input.emailEnabled ? 1 : 0,
          emailAddress: input.emailAddress,
          whatsappEnabled: input.whatsappEnabled ? 1 : 0,
          whatsappNumber: input.whatsappNumber,
          highMatchThreshold: input.highMatchThreshold,
          notifyNewSupply: input.notifyNewSupply ? 1 : 0,
          notifyNewDemand: input.notifyNewDemand ? 1 : 0,
          notifyHighMatch: input.notifyHighMatch ? 1 : 0
        });
        
        return { success: true };
      }),
  }),

  // Bookmarks
  bookmarks: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      if (!ctx.user) return [];
      return getBookmarksWithDetails(ctx.user.id);
    }),

    add: protectedProcedure
      .input(z.object({
        supplyId: z.number().optional(),
        demandId: z.number().optional(),
        notes: z.string().optional()
      }))
      .mutation(async ({ ctx, input }) => {
        if (!ctx.user) return { success: false, message: 'Not authenticated' };
        const id = await addBookmark({
          userId: ctx.user.id,
          supplyId: input.supplyId,
          demandId: input.demandId,
          notes: input.notes
        });
        return { success: !!id, bookmarkId: id };
      }),

    remove: protectedProcedure
      .input(z.object({ bookmarkId: z.number() }))
      .mutation(async ({ input }) => {
        await removeBookmark(input.bookmarkId);
        return { success: true };
      }),

    check: protectedProcedure
      .input(z.object({
        supplyId: z.number().optional(),
        demandId: z.number().optional()
      }))
      .query(async ({ ctx, input }) => {
        if (!ctx.user) return false;
        return isBookmarked(ctx.user.id, input.supplyId, input.demandId);
      }),
  }),

  // Match Feedback
  feedback: router({
    add: protectedProcedure
      .input(z.object({
        matchId: z.number(),
        rating: z.number().min(1).max(5),
        comment: z.string().optional(),
        helpful: z.boolean().optional()
      }))
      .mutation(async ({ ctx, input }) => {
        if (!ctx.user) return { success: false, message: 'Not authenticated' };
        const id = await addMatchFeedback({
          matchId: input.matchId,
          userId: ctx.user.id,
          rating: input.rating,
          comment: input.comment,
          helpful: input.helpful ? 1 : 0
        });
        return { success: !!id, feedbackId: id };
      }),

    get: publicProcedure
      .input(z.object({ matchId: z.number() }))
      .query(async ({ input }) => {
        return getMatchFeedback(input.matchId);
      }),

    average: publicProcedure
      .input(z.object({ matchId: z.number() }))
      .query(async ({ input }) => {
        return getAverageMatchRating(input.matchId);
      }),

    userFeedback: protectedProcedure
      .input(z.object({ matchId: z.number() }))
      .query(async ({ ctx, input }) => {
        if (!ctx.user) return null;
        return getUserFeedbackForMatch(input.matchId, ctx.user.id);
      }),
  }),

  // Green API / WhatsApp
  whatsapp: router({
    status: publicProcedure.query(async () => {
      return getGreenApiStatus();
    }),

    qrCode: publicProcedure.query(async () => {
      return getGreenApiQRCode();
    }),

    logout: protectedProcedure.mutation(async () => {
      return logoutGreenApi();
    }),

    setWebhook: protectedProcedure
      .input(z.object({ webhookUrl: z.string().url() }))
      .mutation(async ({ input }) => {
        return setGreenApiWebhook(input.webhookUrl);
      }),
  }),

  // Market Intelligence (Admin-only)
  marketIntelligence: router({
    // Check if user has access
    hasAccess: protectedProcedure.query(async ({ ctx }) => {
      if (!ctx.user) return false;
      return hasMarketIntelligenceAccess(ctx.user.id, ctx.user.email || undefined);
    }),

    // Get market data by city
    getData: adminProcedure
      .input(z.object({ city: z.string().optional() }).optional())
      .query(async ({ input }) => {
        return getMarketIntelligence(input?.city);
      }),

    // Get heatmap data
    heatmap: adminProcedure.query(async () => {
      return getMarketHeatmap();
    }),

    // Refresh market intelligence data
    refresh: adminProcedure.mutation(async () => {
      await refreshMarketIntelligence();
      return { success: true, message: 'Market intelligence data refreshed' };
    }),

    // Get authorized admins list
    admins: adminProcedure.query(async () => {
      return getAuthorizedAdmins();
    }),

    // Live supply pins for map — returns location, price, bedrooms, contact per listing
    liveSupplyPins: adminProcedure.query(async () => {
      return getLiveSupplyPins();
    }),

    // Live demand pins for map — returns location, budget, bedrooms, contact per request
    liveDemandPins: adminProcedure.query(async () => {
      return getLiveDemandPins();
    }),

    // Live heatmap data — aggregated directly from supply/demand tables (always current)
    liveHeatmap: adminProcedure.query(async () => {
      return getLiveHeatmapData();
    }),

    // Broker stats — total registered users, active (with whatsapp number), and data last updated
    brokerStats: adminProcedure.query(async () => {
      const db = await getDb();
      if (!db) return { totalBrokers: 0, activeBrokers: 0, lastUpdated: null };
      const [rows] = await (db as any).$client.promise().execute(
        `SELECT 
           COUNT(*) AS totalBrokers,
           SUM(CASE WHEN whatsappNumber IS NOT NULL AND whatsappNumber != '' THEN 1 ELSE 0 END) AS activeBrokers,
           MAX(lastSignedIn) AS lastUpdated
         FROM users WHERE role != 'admin'`
      );
      const row = (rows as any[])[0] || {};
      return {
        totalBrokers: Number(row.totalBrokers || 0),
        activeBrokers: Number(row.activeBrokers || 0),
        lastUpdated: row.lastUpdated ? new Date(row.lastUpdated).toISOString() : null,
      };
    }),
  }),
  
  // User Profiles & Personalized Notifications
  userProfile: router({
    // Upsert user profile with preferences
    upsert: protectedProcedure
      .input(z.object({
        phoneNumber: z.string().optional(),
        whatsappNumber: z.string().optional(),
        userType: z.enum(['buyer', 'seller', 'investor', 'agent']),
        propertyType: z.string().optional(),
        location: z.string().optional(),
        area: z.string().optional(),
        city: z.string().optional(),
        priceMin: z.number().optional(),
        priceMax: z.number().optional(),
        sizeMin: z.number().optional(),
        sizeMax: z.number().optional(),
        bedrooms: z.number().optional(),
        bathrooms: z.number().optional(),
        purpose: z.enum(['sale', 'rent']).optional(),
        requirements: z.record(z.string(), z.any()).optional(),
        notifyOnMatch: z.boolean().optional(),
        notifyViaWhatsapp: z.boolean().optional(),
        notifyViaEmail: z.boolean().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        if (!ctx.user) throw new TRPCError({ code: 'UNAUTHORIZED' });
        
        const profileId = await upsertUserProfile({
          userId: ctx.user.id,
          phoneNumber: input.phoneNumber,
          whatsappNumber: input.whatsappNumber,
          userType: input.userType,
          propertyType: input.propertyType,
          location: input.location,
          area: input.area,
          city: input.city,
          priceMin: input.priceMin ? input.priceMin.toString() : undefined,
          priceMax: input.priceMax ? input.priceMax.toString() : undefined,
          sizeMin: input.sizeMin,
          sizeMax: input.sizeMax,
          bedrooms: input.bedrooms,
          bathrooms: input.bathrooms,
          purpose: input.purpose,
          requirements: input.requirements,
          notifyOnMatch: input.notifyOnMatch ? 1 : 0,
          notifyViaWhatsapp: input.notifyViaWhatsapp ? 1 : 0,
          notifyViaEmail: input.notifyViaEmail ? 1 : 0,
        });
        
        return { success: !!profileId, profileId };
      }),
    
    // Get user profile
    get: protectedProcedure.query(async ({ ctx }) => {
      if (!ctx.user) throw new TRPCError({ code: 'UNAUTHORIZED' });
      return getUserProfile(ctx.user.id);
    }),
  }),
  
  // Custom Notifications
  customNotifications: router({
    // Get user notifications
    list: protectedProcedure
      .input(z.object({ limit: z.number().default(50) }).optional())
      .query(async ({ ctx, input }) => {
        if (!ctx.user) throw new TRPCError({ code: 'UNAUTHORIZED' });
        return getUserNotifications(ctx.user.id, input?.limit || 50);
      }),
    
    // Get unread count
    unreadCount: protectedProcedure.query(async ({ ctx }) => {
      if (!ctx.user) throw new TRPCError({ code: 'UNAUTHORIZED' });
      return getUserUnreadNotificationCount(ctx.user.id);
    }),
    
    // Mark single notification as read
    markAsRead: protectedProcedure
      .input(z.object({ notificationId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        if (!ctx.user) throw new TRPCError({ code: 'UNAUTHORIZED' });
        await markNotificationAsRead(input.notificationId);
        return { success: true };
      }),
    
    // Mark all notifications as read
    markAllAsRead: protectedProcedure.mutation(async ({ ctx }) => {
      if (!ctx.user) throw new TRPCError({ code: 'UNAUTHORIZED' });
      await markAllNotificationsAsRead(ctx.user.id);
      return { success: true };
    }),
    
    // Create custom notification (admin only)
    create: adminProcedure
      .input(z.object({
        userId: z.number(),
        matchId: z.number().optional(),
        title: z.string(),
        message: z.string(),
        notificationType: z.enum(['personalized_match', 'price_update', 'new_property', 'custom']),
        channel: z.enum(['in_app', 'whatsapp', 'email', 'all']).default('in_app'),
      }))
      .mutation(async ({ input }) => {
        const notificationId = await createCustomNotification({
          userId: input.userId,
          matchId: input.matchId,
          title: input.title,
          message: input.message,
          notificationType: input.notificationType,
          channel: input.channel,
        });
        
        // TODO: Send via WhatsApp/Email if channel specifies
        
        return { success: !!notificationId, notificationId };
      }),
  }),
  
  // User Onboarding
  onboarding: router({
    // Generate WhatsApp QR code for user onboarding
    // Scans QR → WhatsApp deep link → user sends message → magic link sent back
    generateQR: protectedProcedure.mutation(async ({ ctx }) => {
      if (!ctx.user) throw new TRPCError({ code: 'UNAUTHORIZED' });

      // Use the WhatsApp magic link QR generator
      const result = await generateInviteQR(
        ctx.user.id,
        ctx.user.organizationId || undefined
      );

      // Also save to userOnboarding table for tracking
      const onboardingId = await createUserOnboarding({
        userId: ctx.user.id,
        invitationToken: result.token,
        invitationUrl: result.invitationUrl,
        qrCode: result.qrCodeDataUrl,
        qrCodeUrl: result.qrCodeUrl,
        signupSource: 'whatsapp_qr',
      });

      return {
        success: true,
        onboardingId,
        token: result.token,
        invitationUrl: result.invitationUrl,
        qrCodeDataUrl: result.qrCodeDataUrl,
        qrCodeUrl: result.qrCodeUrl,
        whatsappDeepLink: result.whatsappDeepLink,
        instructions: [
          '1. Display this QR code to the new user',
          '2. User scans QR with their phone camera',
          '3. WhatsApp opens with a pre-filled message',
          '4. User sends the message to our WhatsApp number',
          '5. We automatically send them a magic login link',
          '6. User clicks the link and is instantly logged in',
        ],
      };
    }),

    // Get onboarding by token
    getByToken: publicProcedure
      .input(z.object({ token: z.string() }))
      .query(async ({ input }) => {
        return getUserOnboardingByToken(input.token);
      }),

    // Complete onboarding
    complete: publicProcedure
      .input(z.object({ token: z.string() }))
      .mutation(async ({ input }) => {
        const onboarding = await getUserOnboardingByToken(input.token);
        if (!onboarding) throw new TRPCError({ code: 'NOT_FOUND', message: 'Onboarding token not found' });

        await completeUserOnboarding(onboarding.id);
        return { success: true, userId: onboarding.userId };
      }),
  }),

  // Organizations (Multi-Tenant)
  organizations: router({
    // Get current user's organization
    mine: protectedProcedure.query(async ({ ctx }) => {
      if (!ctx.user?.organizationId) return null;
      return getOrganizationById(ctx.user.organizationId);
    }),

    // List all organizations (admin only)
    list: adminProcedure.query(async () => {
      return getAllOrganizations();
    }),

    // Create a new organization (admin only)
    create: adminProcedure
      .input(z.object({
        name: z.string().min(2),
        slug: z.string().optional(),
        whatsappNumber: z.string().optional(),
        plan: z.enum(['free', 'basic', 'premium', 'enterprise']).default('free'),
      }))
      .mutation(async ({ input }) => {
        const id = await createOrganization({
          name: input.name,
          slug: input.slug || input.name.toLowerCase().replace(/\s+/g, '-'),
          whatsappNumber: input.whatsappNumber,
          plan: input.plan,
          isActive: 1,
        });
        return { success: !!id, organizationId: id };
      }),

    // Assign user to organization (admin only)
    assignUser: adminProcedure
      .input(z.object({ userId: z.number(), organizationId: z.number() }))
      .mutation(async ({ input }) => {
        await setUserOrganization(input.userId, input.organizationId);
        return { success: true };
      }),

    // Get org-scoped stats (multi-tenant dashboard)
    stats: protectedProcedure.query(async ({ ctx }) => {
      const orgId = ctx.user?.organizationId || null;
      const stats = await getDashboardStatsByOrg(orgId);
      return stats || {
        totalSupply: 0, totalDemand: 0, totalMatches: 0,
        highConfidenceMatches: 0, totalMessages: 0, todayMessages: 0, supplyDemandRatio: 0
      };
    }),

    // Get org-scoped supply
    supply: protectedProcedure
      .input(z.object({ limit: z.number().default(50) }).optional())
      .query(async ({ ctx, input }) => {
        const orgId = ctx.user?.organizationId || null;
        return getSupplyByOrg(orgId, input?.limit || 50);
      }),

    // Get org-scoped demand
    demand: protectedProcedure
      .input(z.object({ limit: z.number().default(50) }).optional())
      .query(async ({ ctx, input }) => {
        const orgId = ctx.user?.organizationId || null;
        return getDemandByOrg(orgId, input?.limit || 50);
      }),

    // Get org-scoped matches
    matches: protectedProcedure
      .input(z.object({ limit: z.number().default(100) }).optional())
      .query(async ({ ctx, input }) => {
        const orgId = ctx.user?.organizationId || null;
        return getMatchesByOrg(orgId, input?.limit || 100);
      }),
  }),

  // Broker analytics
  brokers: router({
    // Get top brokers by successful matches
    topBrokers: publicProcedure
      .input(z.object({ limit: z.number().default(10) }).optional())
      .query(async ({ input }) => {
        return await getTopBrokers(input?.limit || 10);
      }),
    
    // Get specific broker analytics
    analytics: publicProcedure
      .input(z.object({ brokerPhone: z.string() }).optional())
      .query(async ({ input }) => {
        if (!input?.brokerPhone) throw new Error('brokerPhone is required');
        return await getBrokerAnalytics(input.brokerPhone);
      }),

    // Get all brokers for management
    getAllBrokers: protectedProcedure.query(async ({ ctx }) => {
      const db = await getDb();
      if (!db) return [];
      try {
        const brokers = await db.select().from(brokersList);
        return brokers.map((b: any) => ({
          ...b,
          preferredAreas: b.preferredAreas ? JSON.parse(b.preferredAreas) : [],
          preferredTypes: b.preferredTypes ? JSON.parse(b.preferredTypes) : [],
        }));
      } catch (e) {
        console.error('[brokers.getAllBrokers] Error:', e);
        return [];
      }
    }),

    // Create new broker
    createBroker: protectedProcedure
      .input(z.object({
        name: z.string(),
        phone: z.string().optional(),
        email: z.string().optional(),
        whatsappNumber: z.string().optional(),
        preferredAreas: z.array(z.string()).optional(),
        preferredTypes: z.array(z.string()).optional(),
      }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new Error('Database not available');
        try {
          await db.insert(brokersList).values([{
            name: input.name,
            phone: input.phone,
            email: input.email,
            whatsappNumber: input.whatsappNumber,
            preferredAreas: input.preferredAreas ? JSON.stringify(input.preferredAreas) : null,
            preferredTypes: input.preferredTypes ? JSON.stringify(input.preferredTypes) : null,
          }]);
          return { success: true };
        } catch (e) {
          console.error('[brokers.createBroker] Error:', e);
          throw new Error('Failed to create broker');
        }
      }),

    // Delete broker
    deleteBroker: protectedProcedure
      .input(z.object({ brokerId: z.number() }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new Error('Database not available');
        try {
          await db.update(brokersList).set({ status: 'inactive' }).where(eq(brokersList.id, input.brokerId));
          return { success: true };
        } catch (e) {
          console.error('[brokers.deleteBroker] Error:', e);
          throw new Error('Failed to delete broker');
        }
      }),

    // Schedule 6-hour demand sheet send
    scheduleDemandSheet: protectedProcedure
      .input(z.object({ brokerId: z.number() }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new Error('Database not available');
        try {
          const nextRun = new Date(Date.now() + 6 * 60 * 60 * 1000);
          await db.insert(scheduledJobs).values([{
            jobType: 'broker_demand_sheet',
            status: 'pending',
            frequency: 'every 6 hours',
            recipientId: input.brokerId,
            nextRun,
          }]);
          return { success: true, nextRun };
        } catch (e) {
          console.error('[brokers.scheduleDemandSheet] Error:', e);
          throw new Error('Failed to schedule demand sheet');
        }
      }),
  }),

  // Market intelligence
  marketIntel: router({
    // Get hot zones (high investment score locations)
    hotZones: publicProcedure
      .input(z.object({ limit: z.number().default(20) }))
      .query(async ({ input }) => {
        return await getHotZones(input.limit);
      }),
    
    // Get market data for specific location
    byLocation: publicProcedure
      .input(z.object({ location: z.string() }))
      .query(async ({ input }) => {
        return await getMarketDataByLocation(input.location);
      }),
    
    // Get map data with supply/demand aggregation by location
    getMapData: publicProcedure
      .input(z.object({ location: z.string().optional() }))
      .query(async ({ input }) => {
        try {
          const db = await getDb();
          if (!db) return { locations: [] };
          
          // Query all supply records
          const supplyRecords = await db.select().from(supply).limit(1000);
          const demandRecords = await db.select().from(demand).limit(1000);
          
          console.log(`[marketIntel.getMapData] Found ${supplyRecords.length} supply and ${demandRecords.length} demand records`);
          
          // Group by location
          const locationMap = new Map<string, { supply: number; demand: number; supplyPrices: number[]; demandBudgets: number[] }>();
          
          for (const s of supplyRecords) {
            const loc = (s as any).location || (s as any).propertyLocation || 'Cairo';
            if (!locationMap.has(loc)) {
              locationMap.set(loc, { supply: 0, demand: 0, supplyPrices: [], demandBudgets: [] });
            }
            const data = locationMap.get(loc)!;
            data.supply++;
            if ((s as any).price) data.supplyPrices.push((s as any).price);
          }
          
          for (const d of demandRecords) {
            const loc = (d as any).location || (d as any).propertyLocation || 'Cairo';
            if (!locationMap.has(loc)) {
              locationMap.set(loc, { supply: 0, demand: 0, supplyPrices: [], demandBudgets: [] });
            }
            const data = locationMap.get(loc)!;
            data.demand++;
            if ((d as any).budgetMin) data.demandBudgets.push((d as any).budgetMin);
          }
          
          // Filter by location if provided
          if (input.location) {
            const filtered = new Map();
            const entries = Array.from(locationMap.entries());
            for (const [loc, data] of entries) {
              if (loc.toLowerCase().includes(input.location.toLowerCase())) {
                filtered.set(loc, data);
              }
            }
            locationMap.clear();
            const filteredEntries = Array.from(filtered.entries());
            for (const [loc, data] of filteredEntries) {
              locationMap.set(loc, data);
            }
          }
          
          const locations = Array.from(locationMap.entries())
            .map(([name, data]) => ({
              name,
              lat: 30.0444,
              lng: 31.2357,
              supplyCount: data.supply,
              demandCount: data.demand,
              avgSupplyPrice: data.supplyPrices.length > 0 ? Math.round(data.supplyPrices.reduce((a, b) => a + b, 0) / data.supplyPrices.length) : 0,
              avgDemandBudget: data.demandBudgets.length > 0 ? Math.round(data.demandBudgets.reduce((a, b) => a + b, 0) / data.demandBudgets.length) : 0,
              supplyDemandRatio: data.demand > 0 ? data.supply / data.demand : 1,
            }))
            .sort((a, b) => (b.supplyCount + b.demandCount) - (a.supplyCount + a.demandCount));
          
          console.log(`[marketIntel.getMapData] Returning ${locations.length} locations`);
          return { locations };
        } catch (error) {
          console.error('[marketIntel.getMapData] Error:', error);
          return { locations: [] };
        }
      }),
  }),

  // ============ P0: SYSTEM HEALTH ============
  // ============ ADMIN MANAGEMENT ============
  adminManagement: router({
    list: adminProcedure.query(async () => {
      return getAllAuthorizedAdmins();
    }),
    add: adminProcedure
      .input(z.object({
        email: z.string().email().optional().default(''),
        name: z.string().min(1).max(256),
        phone: z.string().min(5).max(32),
      }))
      .mutation(async ({ input }) => {
        // Build a synthetic email from phone if no email provided
        const email = input.email && input.email.length > 3
          ? input.email
          : `wa_${input.phone.replace(/\D/g, '')}@whatsapp`;
        const id = await addAuthorizedAdmin({ email, name: input.name, phone: input.phone.replace(/\D/g, '') });
        return { success: true, id };
      }),
    deactivate: adminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await deactivateAuthorizedAdmin(input.id);
        return { success: true };
      }),
    reactivate: adminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await reactivateAuthorizedAdmin(input.id);
        return { success: true };
      }),
  }),

  systemHealth: router({
    // Get current system health status
    getStatus: publicProcedure.query(async () => {
      return await getSystemHealth();
    }),

    // Update WhatsApp health status
    updateWhatsapp: protectedProcedure
      .input(z.object({
        status: z.enum(["connected", "disconnected", "error"]),
        errorMessage: z.string().optional()
      }))
      .mutation(async ({ input }) => {
        await updateWhatsappHealth(input.status, input.errorMessage);
        return { success: true };
      }),
  }),

  // ============ P1: AUDIT LOGS ============
  auditLogs: router({
    // Get audit logs with filters (admin only)
    getLogs: protectedProcedure
      .input(z.object({
        entityType: z.string().optional(),
        userId: z.number().optional(),
        startDate: z.date().optional(),
        endDate: z.date().optional(),
        limit: z.number().optional()
      }))
      .query(async ({ input, ctx }) => {
        // Check if user is admin
        if (ctx.user.role !== 'admin') {
          throw new TRPCError({ code: 'FORBIDDEN', message: 'Admin access required' });
        }
        return await getAuditLogs(input);
      }),

    // Create audit log entry
    createLog: protectedProcedure
      .input(z.object({
        entityType: z.enum(["supply", "demand", "match", "user", "notification"]),
        entityId: z.number(),
        action: z.enum(["created", "updated", "deleted", "contacted", "qualified"]),
        changes: z.record(z.string(), z.any()).optional(),
        metadata: z.record(z.string(), z.any()).optional()
      }))
      .mutation(async ({ input, ctx }) => {
        const log = await createAuditLog({
          ...input,
          createdBy: ctx.user.id
        });
        return log;
      }),
  }),

  // ============ P2: ANALYTICS & CONVERSION ============
  analytics: router({
    // Get conversion funnel metrics
    conversionMetrics: publicProcedure
      .input(z.object({
        startDate: z.date().optional(),
        endDate: z.date().optional()
      }))
      .query(async ({ input }) => {
        return await getConversionMetrics();
      }),

    // Get segmented analytics
    segmented: publicProcedure
      .input(z.object({
        area: z.string().optional(),
        propertyType: z.string().optional(),
        priceBand: z.string().optional(),
        period: z.string().optional(),
        limit: z.number().optional()
      }))
      .query(async ({ input }) => {
        return await getSegmentedAnalytics(input);
      }),

    // Get top opportunities (high demand, low supply)
    opportunities: publicProcedure
      .input(z.object({ limit: z.number().optional() }))
      .query(async ({ input }) => {
        return await getTopOpportunities(input.limit || 3);
      }),

    // Get oversupply areas
    oversupply: publicProcedure
      .input(z.object({ limit: z.number().optional() }))
      .query(async ({ input }) => {
        return await getOversupplyAreas(input.limit || 3);
      }),

    // Update conversion stage
    updateStage: protectedProcedure
      .input(z.object({
        matchId: z.number(),
        stage: z.enum(["generated", "sent", "replied", "viewing_scheduled", "viewing_completed", "negotiation", "deal_closed", "deal_lost"]),
        notes: z.string().optional()
      }))
      .mutation(async ({ input, ctx }) => {
        await updateConversionStage(input.matchId, input.stage, new Date());
        
        // Create audit log
        await createAuditLog({
          entityType: "match",
          entityId: input.matchId,
          action: "updated",
          changes: { stage: input.stage },
          createdBy: ctx.user.id
        });
        
        return { success: true };
      }),
  }),

  // ============ INVESTOR INSIGHTS ============
  investorInsights: router({
    dashboard: protectedProcedure.query(async () => {
      return await getInvestorDashboardData();
    }),

    areaAnalysis: protectedProcedure.query(async () => {
      return await getAreaAnalysis();
    }),

    exportInsightsCSV: protectedProcedure
      .input(z.object({ locale: z.enum(['en', 'ar']).default('en') }))
      .query(async ({ input }) => {
        const data = await getInvestorDashboardData();
        const locale = input.locale;

        // Crystal Power branded header
        const brandHeader = locale === 'ar'
          ? '"كريستال باور للاستثمارات - تقرير رؤى المستثمرين"'
          : '"Crystal Power Investments - Investor Insights Report"';
        const dateRow = locale === 'ar'
          ? `"تاريخ التقرير: ${new Date().toLocaleDateString('ar-EG')}"` 
          : `"Report Date: ${new Date().toLocaleDateString('en-EG')}"`;
        const contactRow = locale === 'ar'
          ? '"هاتف: +201066505665 | بريد: mmaisara@crystalpowerinvestment.com"'
          : '"Tel: +201066505665 | Email: mmaisara@crystalpowerinvestment.com"';

        // Area Analysis section
        const areaHeaders = locale === 'ar'
          ? ['الموقع', 'عدد العرض', 'عدد الطلب', 'نسبة الطلب/العرض', 'متوسط السعر', 'عدد التطابقات', 'متوسط التطابق', 'حرارة السوق']
          : ['Location', 'Supply', 'Demand', 'D/S Ratio', 'Avg Price (EGP)', 'Matches', 'Avg Score', 'Market Temp'];

        const areaRows = data.areaAnalysis.map(a => [
          a.location,
          a.supplyCount,
          a.demandCount,
          a.demandSupplyRatio.toFixed(2),
          a.avgSupplyPrice ? Math.round(a.avgSupplyPrice).toLocaleString() : 'N/A',
          a.matchCount,
          a.avgMatchScore ? a.avgMatchScore.toFixed(1) + '%' : 'N/A',
          a.temperature.toUpperCase()
        ]);

        // Insights section
        const insightHeaders = locale === 'ar'
          ? ['النوع', 'الأولوية', 'الموقع', 'الرسالة', 'التوصية']
          : ['Type', 'Priority', 'Location', 'Insight', 'Action'];

        const insightRows = data.insights.map(i => [
          i.type,
          i.priority,
          i.location,
          locale === 'ar' ? i.messageAr : i.messageEn,
          locale === 'ar' ? i.actionableAr : i.actionableEn
        ]);

        const escapeCSV = (val: any) => `"${String(val || '').replace(/"/g, '""').replace(/\n/g, ' ')}"`;

        const csvLines = [
          brandHeader,
          dateRow,
          contactRow,
          '',
          locale === 'ar' ? '"=== تحليل المناطق ==="' : '"=== Area Analysis ==="',
          areaHeaders.map(h => escapeCSV(h)).join(','),
          ...areaRows.map(row => row.map(cell => escapeCSV(cell)).join(',')),
          '',
          locale === 'ar' ? '"=== رؤى السوق ==="' : '"=== Market Insights ==="',
          insightHeaders.map(h => escapeCSV(h)).join(','),
          ...insightRows.map(row => row.map(cell => escapeCSV(cell)).join(',')),
          '',
          locale === 'ar'
            ? `"إجمالي المناطق: ${data.summary.totalAreas} | أسواق ساخنة: ${data.summary.hotMarkets} | أسواق دافئة: ${data.summary.warmMarkets} | أسواق باردة: ${data.summary.coldMarkets}"`
            : `"Total Areas: ${data.summary.totalAreas} | Hot: ${data.summary.hotMarkets} | Warm: ${data.summary.warmMarkets} | Cold: ${data.summary.coldMarkets}"`
        ];

        return {
          csv: csvLines.join('\n'),
          filename: `crystal-power-investor-insights-${new Date().toISOString().split('T')[0]}.csv`,
          count: data.areaAnalysis.length
        };
      }),

    exportMatchesCSV: protectedProcedure
      .input(z.object({
        locale: z.enum(['en', 'ar']).default('en'),
        minScore: z.number().min(0).max(100).default(85),
        limit: z.number().min(1).max(5000).default(1000)
      }))
      .query(async ({ input }) => {
        const allMatches = await getRecentMatches(input.limit);
        const filtered = allMatches.filter((m: any) => Number(m.matchScore) >= input.minScore);
        const locale = input.locale;

        const brandHeader = locale === 'ar'
          ? '"كريستال باور للاستثمارات - تقرير التطابقات عالية الثقة"'
          : '"Crystal Power Investments - High Confidence Matches Report"';
        const dateRow = locale === 'ar'
          ? `"تاريخ التقرير: ${new Date().toLocaleDateString('ar-EG')}"` 
          : `"Report Date: ${new Date().toLocaleDateString('en-EG')}"`;

        const headers = locale === 'ar'
          ? ['رقم', 'نسبة التطابق', 'الحالة', 'اسم البائع', 'هاتف البائع', 'اسم المشتري', 'هاتف المشتري', 'نسبة الموقع', 'نسبة السعر', 'نسبة المواصفات', 'الملخص', 'التاريخ']
          : ['ID', 'Score', 'Status', 'Seller Name', 'Seller Phone', 'Buyer Name', 'Buyer Phone', 'Location %', 'Price %', 'Specs %', 'Summary', 'Date'];

        const rows = filtered.map((m: any) => [
          m.id,
          Math.min(100, Number(m.matchScore || 0)).toFixed(1) + '%',
          m.status || 'new',
          m.supplyContactName || 'N/A',
          m.supplyContactPhone || 'N/A',
          m.demandContactName || 'N/A',
          m.demandContactPhone || 'N/A',
          Math.min(100, Number(m.locationScore || 0)).toFixed(0) + '%',
          Math.min(100, Number(m.priceScore || 0)).toFixed(0) + '%',
          Math.min(100, Number(m.specsScore || 0)).toFixed(0) + '%',
          (m.matchSummary || '').replace(/\n/g, ' '),
          m.createdAt ? new Date(m.createdAt).toLocaleDateString(locale === 'ar' ? 'ar-EG' : 'en-EG') : ''
        ]);

        const escapeCSV = (val: any) => `"${String(val || '').replace(/"/g, '""').replace(/\n/g, ' ')}"`;

        const csvLines = [
          brandHeader,
          dateRow,
          '',
          headers.map(h => escapeCSV(h)).join(','),
          ...rows.map((row: any[]) => row.map(cell => escapeCSV(cell)).join(','))
        ];

        return {
          csv: csvLines.join('\n'),
          filename: `crystal-power-matches-${input.minScore}pct-${new Date().toISOString().split('T')[0]}.csv`,
          count: filtered.length
        };
      }),

    exportSupplyCSV: protectedProcedure
      .input(z.object({ locale: z.enum(['en', 'ar']).default('en'), limit: z.number().default(1000) }))
      .query(async ({ input }) => {
        const items = await getRecentSupply(input.limit);
        const locale = input.locale;

        const headers = locale === 'ar'
          ? ['رقم', 'نوع العقار', 'الموقع', 'المنطقة', 'المدينة', 'السعر', 'المساحة', 'الغرف', 'الحمامات', 'الاسم', 'الهاتف', 'التاريخ']
          : ['ID', 'Type', 'Location', 'Area', 'City', 'Price (EGP)', 'Size (m²)', 'Beds', 'Baths', 'Contact', 'Phone', 'Date'];

        const rows = items.map((s: any) => [
          s.id,
          s.propertyType || '',
          s.location || '',
          s.area || '',
          s.city || 'Cairo',
          s.price || '',
          s.size || '',
          s.bedrooms || '',
          s.bathrooms || '',
          s.contactName || '',
          s.contactPhone || '',
          s.createdAt ? new Date(s.createdAt).toLocaleDateString(locale === 'ar' ? 'ar-EG' : 'en-EG') : ''
        ]);

        const escapeCSV = (val: any) => `"${String(val || '').replace(/"/g, '""')}"`;
        const brandHeader = locale === 'ar'
          ? '"كريستال باور للاستثمارات - تقرير العرض العقاري"'
          : '"Crystal Power Investments - Property Supply Report"';

        const csvLines = [
          brandHeader,
          `"${new Date().toLocaleDateString(locale === 'ar' ? 'ar-EG' : 'en-EG')}"`,
          '',
          headers.map(h => escapeCSV(h)).join(','),
          ...rows.map((row: any[]) => row.map(cell => escapeCSV(cell)).join(','))
        ];

        return {
          csv: csvLines.join('\n'),
          filename: `crystal-power-supply-${new Date().toISOString().split('T')[0]}.csv`,
          count: items.length
        };
      }),

    exportDemandCSV: protectedProcedure
      .input(z.object({ locale: z.enum(['en', 'ar']).default('en'), limit: z.number().default(1000) }))
      .query(async ({ input }) => {
        const items = await getRecentDemand(input.limit);
        const locale = input.locale;

        const headers = locale === 'ar'
          ? ['رقم', 'نوع العقار', 'الموقع', 'المنطقة', 'المدينة', 'الميزانية الأدنى', 'الميزانية الأقصى', 'الغرف', 'الاسم', 'الهاتف', 'التاريخ']
          : ['ID', 'Type', 'Location', 'Area', 'City', 'Min Budget', 'Max Budget', 'Beds', 'Contact', 'Phone', 'Date'];

        const rows = items.map((d: any) => [
          d.id,
          d.propertyType || '',
          d.location || '',
          d.area || '',
          d.city || 'Cairo',
          d.priceMin || '',
          d.priceMax || '',
          d.bedrooms || '',
          d.contactName || '',
          d.contactPhone || '',
          d.createdAt ? new Date(d.createdAt).toLocaleDateString(locale === 'ar' ? 'ar-EG' : 'en-EG') : ''
        ]);

        const escapeCSV = (val: any) => `"${String(val || '').replace(/"/g, '""')}"`;
        const brandHeader = locale === 'ar'
          ? '"كريستال باور للاستثمارات - تقرير الطلب العقاري"'
          : '"Crystal Power Investments - Property Demand Report"';

        const csvLines = [
          brandHeader,
          `"${new Date().toLocaleDateString(locale === 'ar' ? 'ar-EG' : 'en-EG')}"`,
          '',
          headers.map(h => escapeCSV(h)).join(','),
          ...rows.map((row: any[]) => row.map(cell => escapeCSV(cell)).join(','))
        ];

        return {
          csv: csvLines.join('\n'),
          filename: `crystal-power-demand-${new Date().toISOString().split('T')[0]}.csv`,
          count: items.length
        };
      }),
  }),

  // ============ CONTACT LABELS ============
  contacts: router({
    // Get all labels for the current user/org
    getLabels: protectedProcedure.query(async ({ ctx }) => {
      const { getDb } = await import('./db');
      const db = await getDb();
      if (!db) return [];
      const { contactLabels } = await import('../drizzle/schema');
      return db.select().from(contactLabels).orderBy(contactLabels.label);
    }),

    // Upsert a label for a phone number
    setLabel: protectedProcedure
      .input(z.object({
        phone: z.string().min(7).max(32),
        label: z.string().min(1).max(256),
      }))
      .mutation(async ({ ctx, input }) => {
        const { getDb } = await import('./db');
        const db = await getDb();
        if (!db) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'DB unavailable' });
        // Normalize phone: strip non-digits, ensure starts with 01 or 201
        const phone = input.phone.replace(/[^0-9]/g, '');
        // Upsert: INSERT ... ON DUPLICATE KEY UPDATE
        await (db as any).$client.promise().execute(
          `INSERT INTO contactLabels (phone, label, createdAt, updatedAt)
           VALUES (?, ?, NOW(), NOW())
           ON DUPLICATE KEY UPDATE label = VALUES(label), updatedAt = NOW()`,
          [phone, input.label]
        );
        // Update all supply/demand rows with this phone to use the new label
        await (db as any).$client.promise().execute(
          `UPDATE supply SET contactName = ? WHERE REGEXP_REPLACE(contact, '[^0-9]', '') = ?`,
          [input.label, phone]
        );
        await (db as any).$client.promise().execute(
          `UPDATE demand SET contactName = ? WHERE REGEXP_REPLACE(contact, '[^0-9]', '') = ?`,
          [input.label, phone]
        );
        // Sync matches table
        await (db as any).$client.promise().execute(
          `UPDATE matches m
           JOIN supply s ON m.supplyId = s.id
           SET m.supplyContactName = ?
           WHERE REGEXP_REPLACE(s.contact, '[^0-9]', '') = ?`,
          [input.label, phone]
        );
        await (db as any).$client.promise().execute(
          `UPDATE matches m
           JOIN demand d ON m.demandId = d.id
           SET m.demandContactName = ?
           WHERE REGEXP_REPLACE(d.contact, '[^0-9]', '') = ?`,
          [input.label, phone]
        );
        return { success: true, phone, label: input.label };
      }),

    // Delete a label
    deleteLabel: protectedProcedure
      .input(z.object({ phone: z.string() }))
      .mutation(async ({ ctx, input }) => {
        const { getDb } = await import('./db');
        const db = await getDb();
        if (!db) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'DB unavailable' });
        const phone = input.phone.replace(/[^0-9]/g, '');
        await (db as any).$client.promise().execute(
          `DELETE FROM contactLabels WHERE phone = ?`,
          [phone]
        );
        return { success: true };
      }),
  }),

  // ─── Daily Digest & Match Feedback ──────────────────────────────────────────
  digest: router({
    // Get daily digest stats for the last N days
    daily: protectedProcedure
      .input(z.object({ daysBack: z.number().min(1).max(90).default(1) }))
      .query(async ({ input }) => {
        return getDailyDigest(input.daysBack);
      }),

    // 30-day accuracy trend from match feedback
    accuracyTrend: protectedProcedure
      .input(z.object({ days: z.number().min(7).max(90).default(30) }))
      .query(async ({ input }) => {
        return getMatchAccuracyTrend(input.days);
      }),

    // Submit feedback on a match (good / false)
    submitFeedback: protectedProcedure
      .input(z.object({
        matchId: z.number(),
        rating: z.number().min(1).max(5),
        comment: z.string().optional(),
        helpful: z.boolean().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const id = await addMatchFeedback({
          matchId: input.matchId,
          userId: ctx.user.id,
          rating: input.rating,
          comment: input.comment ?? null,
          helpful: input.helpful ? 1 : 0,
        });
        return { success: !!id, feedbackId: id };
      }),

    // Get all feedback for a specific match
    forMatch: protectedProcedure
      .input(z.object({ matchId: z.number() }))
      .query(async ({ input }) => {
        return getMatchFeedback(input.matchId);
      }),
  }),
  settings: router({
    getAll: protectedProcedure.query(async () => {
      return getAllSettings();
    }),
    get: protectedProcedure
      .input(z.object({ key: z.string() }))
      .query(async ({ input }) => {
        const value = await getSetting(input.key);
        return { key: input.key, value };
      }),
    update: protectedProcedure
      .input(z.object({ key: z.string(), value: z.string() }))
      .mutation(async ({ ctx, input }) => {
        await upsertSetting(input.key, input.value, ctx.user.id);
        return { success: true };
      }),
    updateMany: protectedProcedure
      .input(z.array(z.object({ key: z.string(), value: z.string() })))
      .mutation(async ({ ctx, input }) => {
        for (const s of input) {
          await upsertSetting(s.key, s.value, ctx.user.id);
        }
        return { success: true, updated: input.length };
      }),
  }),

  // Web Push notifications
  push: router({
    // Get VAPID public key for frontend subscription
    vapidPublicKey: publicProcedure.query(() => {
      return {
        publicKey: process.env.VAPID_PUBLIC_KEY ?? process.env.VITE_VAPID_PUBLIC_KEY ?? "",
        enabled: isVapidReady(),
      };
    }),
    // Subscribe this device to push notifications
    subscribe: protectedProcedure
      .input(z.object({
        endpoint: z.string(),
        p256dh: z.string(),
        auth: z.string(),
        userAgent: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const id = await savePushSubscription(
          ctx.user.id,
          { endpoint: input.endpoint, keys: { p256dh: input.p256dh, auth: input.auth } },
          input.userAgent
        );
        return { success: !!id, subscriptionId: id };
      }),
    // Unsubscribe this device
    unsubscribe: protectedProcedure
      .input(z.object({ endpoint: z.string() }))
      .mutation(async ({ input }) => {
        await deletePushSubscription(input.endpoint);
        return { success: true };
      }),
    // Admin: send a test push to all subscribers
    testBroadcast: protectedProcedure
      .mutation(async () => {
        const result = await sendPushToAll({
          title: "MatchPro™ Test Alert",
          body: "Push notifications are working! You will receive match alerts on this device.",
          url: "/matches",
          tag: "matchpro-test",
        });
        return result;
      }),
  }),

  // Report management
  reports: router({
    trigger: protectedProcedure
      .input(z.object({ cycle: z.enum(["9AM", "10PM"]) }))
      .mutation(async ({ input }) => {
        const log = await runReport(input.cycle);
        return { success: log.status === "success", log };
      }),
    logs: protectedProcedure.query(async () => {
      return getReportLogs();
    }),
  }),

  // Smart Profile Intake
  intake: router({
    create: protectedProcedure
      .input(z.object({
        intentType: z.enum(["buying", "selling", "renting_out", "renting", "investing"]),
        propertyType: z.string().nullable().optional(),
        location: z.string().nullable().optional(),
        priceMin: z.number().nullable().optional(),
        priceMax: z.number().nullable().optional(),
        sizeMin: z.number().nullable().optional(),
        sizeMax: z.number().nullable().optional(),
        bedrooms: z.number().nullable().optional(),
        notes: z.string().nullable().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
        const result = await db.insert(profileIntakes).values({
          userId: ctx.user.id,
          intentType: input.intentType,
          propertyType: input.propertyType ?? null,
          location: input.location ?? null,
          priceMin: input.priceMin?.toString() ?? null,
          priceMax: input.priceMax?.toString() ?? null,
          sizeMin: input.sizeMin ?? null,
          sizeMax: input.sizeMax ?? null,
          bedrooms: input.bedrooms ?? null,
          purpose: ["buying", "selling"].includes(input.intentType) ? "sale" : "rent",
          notes: input.notes ?? null,
          status: "active",
        } as any);
        return { id: (result as any).insertId };
      }),
    list: protectedProcedure.query(async ({ ctx }) => {
      const db = await getDb();
      if (!db) return [];
      return db.select().from(profileIntakes)
        .where(eq(profileIntakes.userId, ctx.user.id))
        .orderBy(desc(profileIntakes.createdAt))
        .limit(20);
    }),
  }),

  // Appointments
  appointments: router({
    create: protectedProcedure
      .input(z.object({
        matchId: z.number().nullable().optional(),
        supplyId: z.number().nullable().optional(),
        demandId: z.number().nullable().optional(),
        title: z.string(),
        appointmentType: z.enum(["viewing", "meeting", "call", "site_visit"]).default("viewing"),
        scheduledAt: z.string(),
        durationMinutes: z.number().default(60),
        location: z.string().nullable().optional(),
        notes: z.string().nullable().optional(),
        supplyContactPhone: z.string().nullable().optional(),
        supplyContactName: z.string().nullable().optional(),
        demandContactPhone: z.string().nullable().optional(),
        demandContactName: z.string().nullable().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
        const result = await db.insert(appointments).values({
          matchId: input.matchId ?? null,
          supplyId: input.supplyId ?? null,
          demandId: input.demandId ?? null,
          createdByUserId: ctx.user.id,
          title: input.title,
          appointmentType: input.appointmentType,
          scheduledAt: new Date(input.scheduledAt),
          durationMinutes: input.durationMinutes,
          location: input.location ?? null,
          notes: input.notes ?? null,
          status: "scheduled",
          supplyContactPhone: input.supplyContactPhone ?? null,
          supplyContactName: input.supplyContactName ?? null,
          demandContactPhone: input.demandContactPhone ?? null,
          demandContactName: input.demandContactName ?? null,
        } as any);
        return { id: (result as any).insertId };
      }),
    list: protectedProcedure.query(async ({ ctx }) => {
      const db = await getDb();
      if (!db) return [];
      return db.select().from(appointments)
        .where(eq(appointments.createdByUserId, ctx.user.id))
        .orderBy(desc(appointments.scheduledAt))
        .limit(50);
    }),
    updateStatus: protectedProcedure
      .input(z.object({ id: z.number(), status: z.enum(["scheduled", "confirmed", "completed", "cancelled", "no_show"]) }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
        await db.update(appointments).set({ status: input.status }).where(eq(appointments.id, input.id));
        return { success: true };
      }),
  }),

  // ─── User Management (admin only) ─────────────────────────────────────────────
  userManagement: router({
    listUsers: adminProcedure.query(async () => {
      const db = await getDb();
      if (!db) return [];
      const [rows] = await (db as any).$client.promise().execute(
        'SELECT id, openId, name, email, role, whatsappNumber, subscriptionTier, subscriptionStarted, subscriptionExpiry, isActive, notes, phone, createdAt, lastSignedIn FROM users ORDER BY createdAt DESC LIMIT 200'
      );
      return rows as any[];
    }),
    updateUser: adminProcedure
      .input(z.object({
        id: z.number(),
        role: z.enum(['user', 'admin']).optional(),
        subscriptionTier: z.enum(['free', 'monthly', 'quarterly', 'yearly', 'lifetime']).optional(),
        subscriptionExpiry: z.string().optional(),
        isActive: z.number().min(0).max(1).optional(),
        notes: z.string().optional(),
        phone: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR' });
        const updates: Record<string, any> = {};
        if (input.role !== undefined) updates.role = input.role;
        if (input.subscriptionTier !== undefined) updates.subscriptionTier = input.subscriptionTier;
        if (input.subscriptionExpiry !== undefined) updates.subscriptionExpiry = new Date(input.subscriptionExpiry);
        if (input.isActive !== undefined) updates.isActive = input.isActive;
        if (input.notes !== undefined) updates.notes = input.notes;
        if (input.phone !== undefined) updates.phone = input.phone;
        if (Object.keys(updates).length === 0) return { success: true };
        const setClauses = Object.keys(updates).map(k => `${k} = ?`).join(', ');
        const values = [...Object.values(updates), input.id];
        await (db as any).$client.promise().execute(`UPDATE users SET ${setClauses} WHERE id = ?`, values);
        return { success: true };
      }),
    grantSubscription: adminProcedure
      .input(z.object({
        userId: z.number(),
        tier: z.enum(['monthly', 'quarterly', 'yearly', 'lifetime']),
        notes: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR' });
        const durationMap: Record<string, number> = { monthly: 30, quarterly: 90, yearly: 365, lifetime: 36500 };
        const days = durationMap[input.tier];
        const expiry = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
        await (db as any).$client.promise().execute(
          'UPDATE users SET subscriptionTier = ?, subscriptionStarted = NOW(), subscriptionExpiry = ?, isActive = 1, addedBy = ?, notes = COALESCE(?, notes) WHERE id = ?',
          [input.tier, expiry, ctx.user.id, input.notes ?? null, input.userId]
        );
        return { success: true, expiry: expiry.toISOString() };
      }),
    deactivateUser: adminProcedure
      .input(z.object({ userId: z.number() }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR' });
        await (db as any).$client.promise().execute('UPDATE users SET isActive = 0 WHERE id = ?', [input.userId]);
        return { success: true };
      }),
    // Return users whose subscription expires within the next 7 days
    expiringSoon: adminProcedure.query(async () => {
      const db = await getDb();
      if (!db) return [];
      const in7Days = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
      const [rows] = await (db as any).$client.promise().execute(
        `SELECT id, name, email, whatsappNumber, subscriptionTier, subscriptionExpiry
         FROM users
         WHERE subscriptionExpiry IS NOT NULL
           AND subscriptionExpiry > NOW()
           AND subscriptionExpiry <= ?
           AND isActive = 1
         ORDER BY subscriptionExpiry ASC`,
        [in7Days]
      ) as any[];
      return rows as any[];
    }),
  }),

  // ─── Classification Keywords (admin only) ────────────────────────────────
  keywords: router({
    list: adminProcedure.query(async () => {
      const db = await getDb();
      if (!db) return [];
      const [rows] = await (db as any).$client.promise().execute(
        'SELECT * FROM classificationKeywords ORDER BY type, language, keyword'
      );
      return rows as any[];
    }),
    add: adminProcedure
      .input(z.object({
        keyword: z.string().min(1).max(256),
        language: z.enum(['ar', 'en', 'both']),
        type: z.enum(['supply', 'demand', 'ignore', 'real_estate_group']),
        weight: z.number().min(1).max(10).default(2),
      }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR' });
        await (db as any).$client.promise().execute(
          'INSERT INTO classificationKeywords (keyword, language, type, weight) VALUES (?, ?, ?, ?)',
          [input.keyword, input.language, input.type, input.weight]
        );
        return { success: true };
      }),
    toggle: adminProcedure
      .input(z.object({ id: z.number(), isActive: z.number().min(0).max(1) }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR' });
        await (db as any).$client.promise().execute('UPDATE classificationKeywords SET isActive = ? WHERE id = ?', [input.isActive, input.id]);
        return { success: true };
      }),
    remove: adminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR' });
        await (db as any).$client.promise().execute('DELETE FROM classificationKeywords WHERE id = ?', [input.id]);
        return { success: true };
      }),
    updateWeight: adminProcedure
      .input(z.object({ id: z.number(), weight: z.number().min(1).max(10) }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR' });
        await (db as any).$client.promise().execute('UPDATE classificationKeywords SET weight = ? WHERE id = ?', [input.weight, input.id]);
        return { success: true };
      }),
    // Auto-suggest: scan last 500 messages and surface top unregistered words
    autoSuggest: adminProcedure.query(async () => {
      const db = await getDb();
      if (!db) return [];
      const [existing] = await (db as any).$client.promise().execute(
        'SELECT keyword FROM classificationKeywords'
      ) as any[];
      const existingSet = new Set((existing as any[]).map((r: any) => r.keyword.toLowerCase()));
      const [msgs] = await (db as any).$client.promise().execute(
        'SELECT messageText FROM messages ORDER BY createdAt DESC LIMIT 500'
      ) as any[];
      const wordCount: Record<string, number> = {};
      const stopWords = new Set(['\u0641\u064a','\u0645\u0646','\u0639\u0644\u0649','\u0625\u0644\u0649','\u0647\u0644','\u0645\u0639','\u0639\u0646','\u0644\u0648','\u0644\u064a','\u0644\u0643','\u0644\u0647\u0627','\u0644\u0647\u0645','\u0623\u0648','\u0648','\u0641','\u0628','\u0644','\u0643','\u0645\u0627','\u0647\u0630\u0627','\u0647\u0630\u0647','\u0630\u0644\u0643','the','a','an','is','in','of','to','for','and','or','with','at','by','this','that','it','be','are','was','were','i','you','we','they','he','she']);
      for (const row of (msgs as any[])) {
        const text = (row.messageText || '').replace(/[\u0610-\u061A\u064B-\u065F]/g, '');
        const words = text.match(/[\u0600-\u06FF]{3,}|[a-zA-Z]{4,}/g) || [];
        for (const w of words) {
          const lower = w.toLowerCase();
          if (!stopWords.has(lower) && !existingSet.has(lower) && lower.length >= 3) {
            wordCount[lower] = (wordCount[lower] || 0) + 1;
          }
        }
      }
      return Object.entries(wordCount)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 25)
        .map(([word, count]) => ({ word, count }));
    }),
  }),

  // ─── Owner Tasks (admin only) ─────────────────────────────────────────────
  ownerTasks: router({
    list: adminProcedure.query(async () => {
      const db = await getDb();
      if (!db) return [];
      const [rows] = await (db as any).$client.promise().execute(
        "SELECT * FROM ownerTasks ORDER BY FIELD(priority,'urgent','high','medium','low'), createdAt DESC LIMIT 100"
      );
      return rows as any[];
    }),
    updateStatus: adminProcedure
      .input(z.object({ id: z.number(), status: z.enum(['pending', 'done', 'dismissed']) }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR' });
        await (db as any).$client.promise().execute('UPDATE ownerTasks SET status = ? WHERE id = ?', [input.status, input.id]);
        return { success: true };
      }),
  }),
  myAssets: router({
    list: adminProcedure.query(async () => {
      const db = await getDb();
      if (!db) return [];
      try {
        const [rows] = await (db as any).$client.promise().execute(
          'SELECT * FROM myAssets WHERE status = "active" ORDER BY createdAt DESC'
        );
        return rows as any[];
      } catch (e) {
        return [];
      }
    }),
    getById: adminProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        const db = await getDb();
        if (!db) return null;
        try {
          const [rows] = await (db as any).$client.promise().execute(
            'SELECT * FROM myAssets WHERE id = ?',
            [input.id]
          );
          return (rows as any[])[0] || null;
        } catch (e) {
          return null;
        }
      }),
    create: adminProcedure
      .input(z.object({
        title: z.string().min(1).max(256),
        location: z.string().min(1).max(256),
        propertyType: z.string(),
        price: z.number(),
        priceUnit: z.enum(['EGP', 'per_sqm', 'per_month']),
        bedrooms: z.number().optional(),
        bathrooms: z.number().optional(),
        size: z.number().optional(),
        description: z.string().optional(),
       }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Database connection failed' });
        try {
          const result = await (db as any).$client.promise().execute(
            'INSERT INTO myAssets (title, location, propertyType, price, priceUnit, bedrooms, bathrooms, size, description, status, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, "active", NOW())',
            [input.title, input.location, input.propertyType, input.price, input.priceUnit, input.bedrooms || null, input.bathrooms || null, input.size || null, input.description || null]
          );
          const insertId = (result as any)[0]?.insertId;
          if (!insertId) throw new Error('No insert ID returned');
          return { id: insertId, success: true };
        } catch (e: any) {
          console.error('[myAssets.create] Error:', e.message);
          throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: `Failed to create asset: ${e.message}` });
        }
      }),
    findMatches: adminProcedure
      .input(z.object({ assetId: z.number() }))
      .query(async ({ input }) => {
        const db = await getDb();
        if (!db) return [];
        try {
          const [assets] = await (db as any).$client.promise().execute(
            'SELECT * FROM myAssets WHERE id = ?',
            [input.assetId]
          );
          if (!(assets as any[])[0]) return [];
          const asset = (assets as any[])[0];
          const [demands] = await (db as any).$client.promise().execute(
            'SELECT * FROM demand WHERE matched = 0 ORDER BY createdAt DESC LIMIT 500'
          );
          const matches = (demands as any[]).map((d: any) => {
            let locationScore = 50;
            if (asset.location && d.location) {
              const assetLoc = asset.location.toLowerCase();
              const demandLoc = d.location.toLowerCase();
              if (assetLoc === demandLoc) locationScore = 100;
              else if (assetLoc.includes(demandLoc) || demandLoc.includes(assetLoc)) locationScore = 75;
            }
            let priceScore = 50;
            if (asset.price && d.priceMin && d.priceMax) {
              if (asset.price >= d.priceMin && asset.price <= d.priceMax) priceScore = 100;
              else if (asset.price >= d.priceMin * 0.8 && asset.price <= d.priceMax * 1.2) priceScore = 75;
            }
            let typeScore = 50;
            if (asset.propertyType && d.propertyType) {
              const assetType = asset.propertyType.toLowerCase();
              const demandType = d.propertyType.toLowerCase();
              if (assetType === demandType) typeScore = 100;
              else if (assetType.includes(demandType) || demandType.includes(assetType)) typeScore = 75;
            }
            const matchScore = Math.min(100, Math.round(
              typeScore * 0.3 + locationScore * 0.4 + priceScore * 0.3
            ));
            return {
              matchScore,
              locationScore,
              priceScore,
              typeScore,
              demandId: d.id,
              buyerName: d.contactName,
              buyerPhone: d.contact,
              buyerLocation: d.location,
              buyerBudgetMin: d.priceMin,
              buyerBudgetMax: d.priceMax,
              buyerPropertyType: d.propertyType,
            };
          }).filter((m: any) => m.matchScore >= 50).sort((a: any, b: any) => b.matchScore - a.matchScore);
          return matches;
        } catch (e) {
          return [];
        }
      }),
  }),
  // ─── My Requests (buyer's own property requests) ─────────────────────────────────────────────
  myRequests: router({
    list: adminProcedure.query(async () => {
      const db = await getDb();
      if (!db) return [];
      try {
        const [rows] = await (db as any).$client.promise().execute(
          'SELECT * FROM myRequests WHERE status = "active" ORDER BY createdAt DESC'
        );
        return rows as any[];
      } catch (e) {
        return [];
      }
    }),
    create: adminProcedure
      .input(z.object({
        title: z.string().min(1).max(256),
        location: z.string().min(1).max(256),
        propertyType: z.string(),
        bedrooms: z.number().optional(),
        bathrooms: z.number().optional(),
        minPrice: z.number().optional(),
        maxPrice: z.number().optional(),
        minArea: z.number().optional(),
        maxArea: z.number().optional(),
        amenities: z.array(z.string()).optional(),
        furnished: z.boolean().optional(),
        notes: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR' });
        try {
          const result = await (db as any).$client.promise().execute(
            'INSERT INTO myRequests (title, location, propertyType, bedrooms, bathrooms, minPrice, maxPrice, minArea, maxArea, amenities, furnished, notes, status, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, "active", NOW())',
            [input.title, input.location, input.propertyType, input.bedrooms || null, input.bathrooms || null, input.minPrice || null, input.maxPrice || null, input.minArea || null, input.maxArea || null, JSON.stringify(input.amenities || []), input.furnished ? 1 : 0, input.notes || null]
          );
          return { id: (result as any)[0].insertId, success: true };
        } catch (e) {
          throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Failed to create request' });
        }
      }),
    getById: adminProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        const db = await getDb();
        if (!db) return null;
        try {
          const [rows] = await (db as any).$client.promise().execute(
            'SELECT * FROM myRequests WHERE id = ?',
            [input.id]
          );
          return (rows as any[])[0] || null;
        } catch (e) {
          return null;
        }
      }),
    findMatches: adminProcedure
      .input(z.object({ requestId: z.number() }))
      .query(async ({ input }) => {
        const db = await getDb();
        if (!db) return [];
        try {
          const [requests] = await (db as any).$client.promise().execute(
            'SELECT * FROM myRequests WHERE id = ?',
            [input.requestId]
          );
          if (!(requests as any[])[0]) return [];
          const request = (requests as any[])[0];
          const [supplies] = await (db as any).$client.promise().execute(
            'SELECT * FROM supply WHERE matched = 0 ORDER BY createdAt DESC LIMIT 500'
          );
          const matches = (supplies as any[]).map((s: any) => {
            let locationScore = 50;
            if (request.location && s.location) {
              const reqLoc = request.location.toLowerCase();
              const supLoc = s.location.toLowerCase();
              if (reqLoc === supLoc) locationScore = 100;
              else if (reqLoc.includes(supLoc) || supLoc.includes(reqLoc)) locationScore = 75;
            }
            let priceScore = 50;
            if (request.minPrice && request.maxPrice && s.price) {
              if (s.price >= request.minPrice && s.price <= request.maxPrice) priceScore = 100;
              else if (s.price >= request.minPrice * 0.8 && s.price <= request.maxPrice * 1.2) priceScore = 75;
            }
            let typeScore = 50;
            if (request.propertyType && s.propertyType) {
              const reqType = request.propertyType.toLowerCase();
              const supType = s.propertyType.toLowerCase();
              if (reqType === supType) typeScore = 100;
              else if (reqType.includes(supType) || supType.includes(reqType)) typeScore = 75;
            }
            let bedroomScore = 50;
            if (request.bedrooms && s.bedrooms) {
              if (s.bedrooms === request.bedrooms) bedroomScore = 100;
              else if (Math.abs(s.bedrooms - request.bedrooms) === 1) bedroomScore = 75;
            }
            const matchScore = Math.min(100, Math.round(
              typeScore * 0.25 + locationScore * 0.35 + priceScore * 0.25 + bedroomScore * 0.15
            ));
            return {
              matchScore,
              locationScore,
              priceScore,
              typeScore,
              bedroomScore,
              supplyId: s.id,
              sellerName: s.contactName,
              sellerPhone: s.contact,
              sellerLocation: s.location,
              propertyPrice: s.price,
              propertyType: s.propertyType,
              bedrooms: s.bedrooms,
              bathrooms: s.bathrooms,
              size: s.size,
            };
          }).filter((m: any) => m.matchScore >= 50).sort((a: any, b: any) => b.matchScore - a.matchScore);
          return matches;
        } catch (e) {
          return [];
        }
      }),
  }),
  // ─── Daily Lead Settings ─────────────────────────────────────────────
  dailyLeadSettings: router({
    get: adminProcedure.query(async ({ ctx }) => {
      const db = await getDb();
      if (!db) return null;
      try {
        const [rows] = await (db as any).$client.promise().execute(
          'SELECT * FROM dailyLeadSettings WHERE userId = ? LIMIT 1',
          [ctx.user?.id || 'default']
        );
        return (rows as any[])[0] || null;
      } catch (e) {
        return null;
      }
    }),
    save: adminProcedure
      .input(z.object({
        locations: z.array(z.string()),
        propertyTypes: z.array(z.string()),
        confidenceThreshold: z.number().min(0).max(100),
        excludeBrokers: z.boolean(),
        emailFrequency: z.string(),
        emailTime: z.string(),
        maxLeadsPerEmail: z.number(),
        includeDataLeads: z.boolean(),
      }))
      .mutation(async ({ input, ctx }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR' });
        try {
          const userId = ctx.user?.id || 'default';
          const [existing] = await (db as any).$client.promise().execute(
            'SELECT id FROM dailyLeadSettings WHERE userId = ?',
            [userId]
          );
          if ((existing as any[]).length > 0) {
            await (db as any).$client.promise().execute(
              'UPDATE dailyLeadSettings SET locations = ?, propertyTypes = ?, confidenceThreshold = ?, excludeBrokers = ?, emailFrequency = ?, emailTime = ?, maxLeadsPerEmail = ?, includeDataLeads = ?, updatedAt = NOW() WHERE userId = ?',
              [JSON.stringify(input.locations), JSON.stringify(input.propertyTypes), input.confidenceThreshold, input.excludeBrokers ? 1 : 0, input.emailFrequency, input.emailTime, input.maxLeadsPerEmail, input.includeDataLeads ? 1 : 0, userId]
            );
          } else {
            await (db as any).$client.promise().execute(
              'INSERT INTO dailyLeadSettings (userId, locations, propertyTypes, confidenceThreshold, excludeBrokers, emailFrequency, emailTime, maxLeadsPerEmail, includeDataLeads, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())',
              [userId, JSON.stringify(input.locations), JSON.stringify(input.propertyTypes), input.confidenceThreshold, input.excludeBrokers ? 1 : 0, input.emailFrequency, input.emailTime, input.maxLeadsPerEmail, input.includeDataLeads ? 1 : 0]
            );
          }
          return { success: true };
        } catch (e) {
          console.error('[dailyLeadSettings.save] Error:', e);
          throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Failed to save settings' });
        }
      }),
  }),

  // My Assets - User-managed properties (uses userAssets table)
  assets: router({
    // List all assets for the logged-in user
    getUserAssets: protectedProcedure
      .input(z.object({
        location: z.string().optional(),
        purpose: z.enum(['sale', 'rent', 'all']).default('all'),
      }).optional())
      .query(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) return [];
        try {
          let query = `SELECT ua.*,
            (SELECT COUNT(*) FROM assetMatches am WHERE am.assetId = ua.id) AS matchCount,
            (SELECT COUNT(*) FROM assetMatches am WHERE am.assetId = ua.id AND am.status = 'new') AS newMatchCount
            FROM userAssets ua WHERE ua.userId = ?`;
          const params: any[] = [ctx.user?.id];
          if (input?.location) { query += ' AND ua.location LIKE ?'; params.push(`%${input.location}%`); }
          if (input?.purpose && input.purpose !== 'all') { query += ' AND ua.priceType = ?'; params.push(input.purpose); }
          query += ' ORDER BY ua.createdAt DESC';
          const rows = await (db as any).$client.promise().execute(query, params);
          return (rows as any[])[0] || [];
        } catch (e) {
          console.error('[assets.getUserAssets] Error:', e);
          return [];
        }
      }),

    // Create a new asset in userAssets table
    createAsset: protectedProcedure
      .input(z.object({
        propertyType: z.string(),
        location: z.string(),
        area: z.string().optional(),
        price: z.number().optional(),
        priceMin: z.number().optional(),
        priceMax: z.number().optional(),
        bedrooms: z.number().optional(),
        bathrooms: z.number().optional(),
        size: z.number().optional(),
        purpose: z.enum(['sale', 'rent']),
        rentalPeriod: z.enum(['monthly', 'yearly']).optional(),
        description: z.string().optional(),
        contactName: z.string().optional(),
        contactPhone: z.string().optional(),
        amenities: z.array(z.string()).optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR' });
        try {
          const result = await (db as any).$client.promise().execute(
            `INSERT INTO userAssets (userId, propertyType, location, area, size, bedrooms, bathrooms, price, priceType, rentalPeriod, description, amenities, contactName, contactPhone, status, createdAt, updatedAt)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', NOW(), NOW())`,
            [
              ctx.user?.id,
              input.propertyType,
              input.location,
              input.area || null,
              input.size || null,
              input.bedrooms || null,
              input.bathrooms || null,
              input.price || input.priceMax || null,
              input.purpose,
              input.rentalPeriod || null,
              input.description || null,
              input.amenities ? JSON.stringify(input.amenities) : null,
              input.contactName || ctx.user?.name || null,
              input.contactPhone || null,
            ]
          );
          const assetId = (result as any)[0]?.insertId;
          // Immediately run matching for this new asset
          if (assetId) {
            try {
              await (db as any).$client.promise().execute(
                `INSERT IGNORE INTO assetMatches (assetId, demandId, matchScore, matchReason, status, createdAt, updatedAt)
                 SELECT ?, d.id,
                   LEAST(100, (
                     (CASE WHEN LOWER(d.location) LIKE LOWER(CONCAT('%', ?, '%')) OR LOWER(?) LIKE LOWER(CONCAT('%', d.location, '%')) THEN 40 ELSE 0 END) +
                     (CASE WHEN LOWER(d.propertyType) LIKE LOWER(CONCAT('%', ?, '%')) OR LOWER(?) LIKE LOWER(CONCAT('%', d.propertyType, '%')) THEN 30 ELSE 0 END) +
                     (CASE WHEN (d.priceMax IS NULL OR d.priceMax = 0 OR d.priceMax >= ?) AND (d.priceMin IS NULL OR d.priceMin = 0 OR d.priceMin <= ?) THEN 20 ELSE 0 END) +
                     (CASE WHEN d.bedrooms IS NULL OR d.bedrooms = 0 OR d.bedrooms = ? THEN 10 ELSE 0 END)
                   )) AS score,
                   'Auto-matched on asset creation', 'new', NOW(), NOW()
                 FROM demand d
                 WHERE (
                   LOWER(d.location) LIKE LOWER(CONCAT('%', ?, '%')) OR LOWER(?) LIKE LOWER(CONCAT('%', d.location, '%'))
                 )
                 AND (
                   LOWER(d.propertyType) LIKE LOWER(CONCAT('%', ?, '%')) OR LOWER(?) LIKE LOWER(CONCAT('%', d.propertyType, '%'))
                   OR d.propertyType IS NULL OR d.propertyType = ''
                 )
                 HAVING score >= 60
                 ORDER BY score DESC
                 LIMIT 200`,
                [
                  assetId,
                  input.location, input.location,
                  input.propertyType, input.propertyType,
                  input.price || 999999999, input.price || 0,
                  input.bedrooms || 0,
                  input.location, input.location,
                  input.propertyType, input.propertyType,
                ]
              );
            } catch (matchErr) {
              console.error('[assets.createAsset] Matching error (non-fatal):', matchErr);
            }
          }
          return { success: true, id: assetId };
        } catch (e) {
          console.error('[assets.createAsset] Error:', e);
          throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Failed to create asset' });
        }
      }),

    // Update asset status
    updateAsset: protectedProcedure
      .input(z.object({
        id: z.number(),
        status: z.enum(['active', 'sold', 'rented', 'inactive']).optional(),
        price: z.number().optional(),
        description: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR' });
        try {
          await (db as any).$client.promise().execute(
            'UPDATE userAssets SET status = COALESCE(?, status), price = COALESCE(?, price), description = COALESCE(?, description), updatedAt = NOW() WHERE id = ? AND userId = ?',
            [input.status || null, input.price || null, input.description || null, input.id, ctx.user?.id]
          );
          return { success: true };
        } catch (e) {
          console.error('[assets.updateAsset] Error:', e);
          throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR' });
        }
      }),

    // Delete an asset
    deleteAsset: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR' });
        try {
          await (db as any).$client.promise().execute(
            'DELETE FROM assetMatches WHERE assetId = ?', [input.id]
          );
          await (db as any).$client.promise().execute(
            'DELETE FROM userAssets WHERE id = ? AND userId = ?', [input.id, ctx.user?.id]
          );
          return { success: true };
        } catch (e) {
          console.error('[assets.deleteAsset] Error:', e);
          throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR' });
        }
      }),

    // Get matches for a specific asset with full demand details
    getAssetMatches: protectedProcedure
      .input(z.object({
        assetId: z.number(),
        status: z.enum(['new', 'contacted', 'interested', 'closed', 'all']).default('all'),
        limit: z.number().default(50),
      }))
      .query(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) return [];
        try {
          let query = `SELECT am.id AS matchId, am.matchScore, am.matchReason, am.status AS matchStatus, am.createdAt AS matchedAt,
            d.id AS demandId, d.contact, d.contactName, d.location, d.propertyType, d.bedrooms, d.bathrooms,
            d.priceMin, d.priceMax, d.size, d.purpose, d.rawMessageText, d.sourceGroup, d.createdAt AS requestDate
            FROM assetMatches am
            JOIN demand d ON am.demandId = d.id
            JOIN userAssets ua ON am.assetId = ua.id
            WHERE am.assetId = ? AND ua.userId = ?`;
          const params: any[] = [input.assetId, ctx.user?.id];
          if (input.status !== 'all') { query += ' AND am.status = ?'; params.push(input.status); }
          query += ' ORDER BY am.matchScore DESC, am.createdAt DESC LIMIT ?';
          params.push(input.limit);
          const rows = await (db as any).$client.promise().execute(query, params);
          return (rows as any[])[0] || [];
        } catch (e) {
          console.error('[assets.getAssetMatches] Error:', e);
          return [];
        }
      }),

    // Run matching for all user assets against all demand
    runMatching: protectedProcedure
      .mutation(async ({ ctx }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR' });
        try {
          // Get all active assets for this user
          const [assets] = await (db as any).$client.promise().execute(
            'SELECT * FROM userAssets WHERE userId = ? AND status = ?',
            [ctx.user?.id, 'active']
          ) as any[];
          let totalNew = 0;
          for (const asset of (assets as any[])) {
            const [res] = await (db as any).$client.promise().execute(
              `INSERT IGNORE INTO assetMatches (assetId, demandId, matchScore, matchReason, status, createdAt, updatedAt)
               SELECT ?, d.id,
                 LEAST(100, (
                   (CASE WHEN LOWER(d.location) LIKE LOWER(CONCAT('%', ?, '%')) OR LOWER(?) LIKE LOWER(CONCAT('%', d.location, '%')) THEN 40 ELSE 0 END) +
                   (CASE WHEN LOWER(d.propertyType) LIKE LOWER(CONCAT('%', ?, '%')) OR LOWER(?) LIKE LOWER(CONCAT('%', d.propertyType, '%')) THEN 30 ELSE 0 END) +
                   (CASE WHEN (d.priceMax IS NULL OR d.priceMax = 0 OR d.priceMax >= ?) AND (d.priceMin IS NULL OR d.priceMin = 0 OR d.priceMin <= ?) THEN 20 ELSE 0 END) +
                   (CASE WHEN d.bedrooms IS NULL OR d.bedrooms = 0 OR d.bedrooms = ? THEN 10 ELSE 0 END)
                 )) AS score,
                 CONCAT('Location: ', d.location, ' | Type: ', COALESCE(d.propertyType,'any'), ' | Budget: ', COALESCE(d.priceMax,0)),
                 'new', NOW(), NOW()
               FROM demand d
               WHERE (
                 LOWER(d.location) LIKE LOWER(CONCAT('%', ?, '%')) OR LOWER(?) LIKE LOWER(CONCAT('%', d.location, '%'))
               )
               HAVING score >= 60
               ORDER BY score DESC
               LIMIT 500`,
              [
                asset.id,
                asset.location, asset.location,
                asset.propertyType, asset.propertyType,
                asset.price || 999999999, asset.price || 0,
                asset.bedrooms || 0,
                asset.location, asset.location,
              ]
            ) as any[];
            totalNew += (res as any)?.affectedRows || 0;
          }
          return { success: true, newMatches: totalNew, assetsProcessed: (assets as any[]).length };
        } catch (e) {
          console.error('[assets.runMatching] Error:', e);
          throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Matching failed' });
        }
      }),

    // Mark a match as contacted
    updateMatchStatus: protectedProcedure
      .input(z.object({
        matchId: z.number(),
        status: z.enum(['new', 'contacted', 'interested', 'closed']),
      }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR' });
        try {
          await (db as any).$client.promise().execute(
            'UPDATE assetMatches SET status = ?, updatedAt = NOW() WHERE id = ?',
            [input.status, input.matchId]
          );
          return { success: true };
        } catch (e) {
          console.error('[assets.updateMatchStatus] Error:', e);
          throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR' });
        }
      }),

    // Legacy - kept for compatibility
    getDemandForAsset: protectedProcedure
      .input(z.object({
        assetId: z.number(),
        location: z.string().optional(),
        propertyType: z.string().optional(),
        minScore: z.number().default(60),
      }))
      .query(async ({ input }) => {
        const db = await getDb();
        if (!db) return [];
        try {
          const rows = await (db as any).$client.promise().execute(
            `SELECT d.* FROM demand d WHERE LOWER(d.location) LIKE LOWER(CONCAT('%', ?, '%')) ORDER BY d.createdAt DESC LIMIT 100`,
            [input.location || '']
          );
          return (rows as any[])[0] || [];
        } catch (e) {
          console.error('[assets.getDemandForAsset] Error:', e);
          return [];
        }
      }),
  }),

  // Matching demand for assets (legacy router kept for compatibility)
  assetMatches: router({
    getDemandForAsset: protectedProcedure
      .input(z.object({
        assetId: z.number(),
        minScore: z.number().default(60),
      }))
      .query(async ({ input }) => {
        const db = await getDb();
        if (!db) return [];
        try {
          const rows = await (db as any).$client.promise().execute(
            `SELECT am.*, d.contact, d.contactName, d.location, d.propertyType, d.priceMin, d.priceMax, d.rawMessageText, d.sourceGroup
             FROM assetMatches am JOIN demand d ON am.demandId = d.id
             WHERE am.assetId = ? AND am.matchScore >= ?
             ORDER BY am.matchScore DESC, am.createdAt DESC LIMIT 100`,
            [input.assetId, input.minScore]
          );
          return (rows as any[])[0] || [];
        } catch (e) {
          console.error('[assetMatches.getDemandForAsset] Error:', e);
          return [];
        }
      }),
  }),

  // Saved searches with email notifications
  savedSearches: savedSearchesRouter,
  
  // Report management
  report: reportRouter,

});
export type AppRouter = typeof appRouter;
