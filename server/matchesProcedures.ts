import { protectedProcedure } from './_core/trpc';
import { z } from 'zod';
import { notifyAllHighConfidenceMatches, getNotificationHistory } from './matchNotificationService';
import { getDb } from './db';

export const matchesRouter = {
  /**
   * Get top matches with optional filtering
   */
  getTopMatches: protectedProcedure
    .input(
      z.object({
        limit: z.number().default(100),
        minScore: z.number().default(75),
        location: z.string().optional(),
      })
    )
    .query(async ({ input }) => {
      try {
        const db = await getDb();
        if (!db) throw new Error('Database connection failed');

        let query = `
          SELECT 
            m.id as matchId,
            m.supplyId,
            m.demandId,
            m.matchScore,
            m.matchReason,
            s.contact as supplyPhone,
            s.contactName as supplyName,
            s.propertyType,
            s.location,
            s.price as supplyPrice,
            d.contact as demandPhone,
            d.contactName as demandName,
            d.priceMin as demandBudgetMin,
            d.priceMax as demandBudgetMax,
            s.rawMessageText as supplyMessage,
            d.rawMessageText as demandMessage
          FROM matches m
          JOIN supply s ON m.supplyId = s.id
          JOIN demand d ON m.demandId = d.id
          WHERE m.matchScore >= ?
        `;

        const params: any[] = [input.minScore];

        if (input.location) {
          query += ` AND s.location = ?`;
          params.push(input.location);
        }

        query += ` ORDER BY m.matchScore DESC LIMIT ?`;
        params.push(input.limit);

        const result = await (db as any).$client.promise().execute(query, params);
        const matches = (result as any[])[0] || [];

        return {
          success: true,
          count: matches.length,
          matches: matches,
        };
      } catch (error: any) {
        console.error('Error getting top matches:', error.message);
        return {
          success: false,
          count: 0,
          matches: [],
          error: error.message,
        };
      }
    }),

  /**
   * Get matches by location
   */
  getMatchesByLocation: protectedProcedure
    .input(
      z.object({
        location: z.string(),
        limit: z.number().default(50),
      })
    )
    .query(async ({ input }) => {
      try {
        const db = await getDb();
        if (!db) throw new Error('Database connection failed');

        const result = await (db as any).$client.promise().execute(
          `SELECT 
            m.id as matchId,
            m.supplyId,
            m.demandId,
            m.matchScore,
            m.matchReason,
            s.contact as supplyPhone,
            s.contactName as supplyName,
            s.propertyType,
            s.location,
            s.price as supplyPrice,
            d.contact as demandPhone,
            d.contactName as demandName,
            d.priceMin as demandBudgetMin,
            d.priceMax as demandBudgetMax
          FROM matches m
          JOIN supply s ON m.supplyId = s.id
          JOIN demand d ON m.demandId = d.id
          WHERE s.location = ?
          ORDER BY m.matchScore DESC
          LIMIT ?`,
          [input.location, input.limit]
        );

        const matches = (result as any[])[0] || [];

        return {
          success: true,
          location: input.location,
          count: matches.length,
          matches: matches,
        };
      } catch (error: any) {
        console.error('Error getting matches by location:', error.message);
        return {
          success: false,
          location: input.location,
          count: 0,
          matches: [],
          error: error.message,
        };
      }
    }),

  /**
   * Trigger high-confidence match notifications
   */
  triggerHighConfidenceNotifications: protectedProcedure.mutation(async () => {
    try {
      console.log('[Matches] Triggering high-confidence notifications...');
      const notifiedCount = await notifyAllHighConfidenceMatches();

      return {
        success: true,
        notifiedCount: notifiedCount,
        message: `${notifiedCount} high-confidence matches notified`,
      };
    } catch (error: any) {
      console.error('Error triggering notifications:', error.message);
      return {
        success: false,
        notifiedCount: 0,
        error: error.message,
      };
    }
  }),

  /**
   * Get notification history
   */
  getNotificationHistory: protectedProcedure
    .input(
      z.object({
        limit: z.number().default(50),
      })
    )
    .query(async ({ input }) => {
      try {
        const history = await getNotificationHistory(input.limit);

        return {
          success: true,
          count: history.length,
          notifications: history,
        };
      } catch (error: any) {
        console.error('Error getting notification history:', error.message);
        return {
          success: false,
          count: 0,
          notifications: [],
          error: error.message,
        };
      }
    }),

  /**
   * Get match statistics
   */
  getMatchStatistics: protectedProcedure.query(async () => {
    try {
      const db = await getDb();
      if (!db) throw new Error('Database connection failed');

      const result = await (db as any).$client.promise().execute(
        `SELECT 
          COUNT(*) as totalMatches,
          AVG(matchScore) as avgScore,
          MAX(matchScore) as maxScore,
          MIN(matchScore) as minScore,
          SUM(CASE WHEN matchScore >= 90 THEN 1 ELSE 0 END) as perfectMatches,
          SUM(CASE WHEN matchScore >= 85 THEN 1 ELSE 0 END) as highConfidenceMatches
        FROM matches`
      );

      const stats = ((result as any[])[0] || [{}])[0];

      return {
        success: true,
        statistics: {
          totalMatches: stats.totalMatches || 0,
          avgScore: Math.round((stats.avgScore || 0) * 100) / 100,
          maxScore: stats.maxScore || 0,
          minScore: stats.minScore || 0,
          perfectMatches: stats.perfectMatches || 0,
          highConfidenceMatches: stats.highConfidenceMatches || 0,
        },
      };
    } catch (error: any) {
      console.error('Error getting match statistics:', error.message);
      return {
        success: false,
        statistics: {},
        error: error.message,
      };
    }
  }),
};
