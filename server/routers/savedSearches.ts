/**
 * Saved Searches Router
 * Handles CRUD operations for saved search criteria and email notifications
 */
import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import { getDb } from "../db";
import { TRPCError } from "@trpc/server";

// ─── validation schemas ────────────────────────────────────────────────────────
const SaveSearchInput = z.object({
  name: z.string().min(1).max(256),
  mode: z.enum(["sell", "buy", "urgent"]),
  location: z.string().optional(),
  propertyType: z.string().optional(),
  priceMin: z.number().int().positive().optional(),
  priceMax: z.number().int().positive().optional(),
  bedroomsMin: z.number().int().nonnegative().optional(),
  bedroomsMax: z.number().int().nonnegative().optional(),
  sizeMin: z.number().int().nonnegative().optional(),
  sizeMax: z.number().int().nonnegative().optional(),
  notifyEmail: z.string().email(),
  notifyOnNewMatches: z.boolean().default(true),
  minScoreThreshold: z.number().int().min(0).max(100).default(70),
});

const UpdateSearchInput = SaveSearchInput.partial().extend({
  id: z.number().int().positive(),
});

// ─── procedures ────────────────────────────────────────────────────────────────
export const savedSearchesRouter = router({
  /**
   * Create a new saved search
   */
  create: protectedProcedure
    .input(SaveSearchInput)
    .mutation(async ({ ctx, input }) => {
      if (!ctx.user?.id) {
        throw new TRPCError({ code: "UNAUTHORIZED" });
      }

      try {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
        const result = await (db as any).$client.promise().execute(
          `INSERT INTO savedSearches (
            userId, name, mode, location, propertyType, 
            priceMin, priceMax, bedroomsMin, bedroomsMax, 
            sizeMin, sizeMax, notifyEmail, notifyOnNewMatches, minScoreThreshold
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            ctx.user.id,
            input.name,
            input.mode,
            input.location || null,
            input.propertyType || null,
            input.priceMin || null,
            input.priceMax || null,
            input.bedroomsMin || null,
            input.bedroomsMax || null,
            input.sizeMin || null,
            input.sizeMax || null,
            input.notifyEmail,
            input.notifyOnNewMatches ? 1 : 0,
            input.minScoreThreshold,
          ]
        );

        return { success: true, id: (result as any).insertId };
      } catch (error) {
        console.error("[SavedSearches] Create error:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to create saved search",
        });
      }
    }),

  /**
   * Get all saved searches for current user
   */
  list: protectedProcedure.query(async ({ ctx }) => {
    if (!ctx.user?.id) {
      throw new TRPCError({ code: "UNAUTHORIZED" });
    }

    try {
      const db = await getDb();
      if (!db) return [];
      const result = await (db as any).$client.promise().execute(
        `SELECT * FROM savedSearches WHERE userId = ? AND isActive = 1 ORDER BY createdAt DESC`,
        [ctx.user.id]
      );

      return (result as any)[0] || [];
    } catch (error) {
      console.error("[SavedSearches] List error:", error);
      return [];
    }
  }),

  /**
   * Get a single saved search by ID
   */
  get: protectedProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .query(async ({ ctx, input }) => {
      if (!ctx.user?.id) {
        throw new TRPCError({ code: "UNAUTHORIZED" });
      }

      try {
        const db = await getDb();
        if (!db) return null;
        const result = await (db as any).$client.promise().execute(
          `SELECT * FROM savedSearches WHERE id = ? AND userId = ?`,
          [input.id, ctx.user.id]
        );

        const rows = (result as any)[0];
        return rows && rows.length > 0 ? rows[0] : null;
      } catch (error) {
        console.error("[SavedSearches] Get error:", error);
        return null;
      }
    }),

  /**
   * Update a saved search
   */
  update: protectedProcedure
    .input(UpdateSearchInput)
    .mutation(async ({ ctx, input }) => {
      if (!ctx.user?.id) {
        throw new TRPCError({ code: "UNAUTHORIZED" });
      }

      const { id, ...updates } = input;

      try {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
        // Verify ownership
        const existing = await (db as any).$client.promise().execute(
          `SELECT id FROM savedSearches WHERE id = ? AND userId = ?`,
          [id, ctx.user.id]
        );

        if (!(existing as any)[0] || (existing as any)[0].length === 0) {
          throw new TRPCError({ code: "NOT_FOUND" });
        }

        const setClause = Object.keys(updates)
          .map((key) => `${key} = ?`)
          .join(", ");
        const values = Object.values(updates);

        await (db as any).$client.promise().execute(
          `UPDATE savedSearches SET ${setClause}, updatedAt = NOW() WHERE id = ?`,
          [...values, id]
        );

        return { success: true };
      } catch (error) {
        console.error("[SavedSearches] Update error:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to update saved search",
        });
      }
    }),

  /**
   * Delete a saved search (soft delete)
   */
  delete: protectedProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      if (!ctx.user?.id) {
        throw new TRPCError({ code: "UNAUTHORIZED" });
      }

      try {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
        // Verify ownership
        const existing = await (db as any).$client.promise().execute(
          `SELECT id FROM savedSearches WHERE id = ? AND userId = ?`,
          [input.id, ctx.user.id]
        );

        if (!(existing as any)[0] || (existing as any)[0].length === 0) {
          throw new TRPCError({ code: "NOT_FOUND" });
        }

        await (db as any).$client.promise().execute(
          `UPDATE savedSearches SET isActive = 0 WHERE id = ?`,
          [input.id]
        );

        return { success: true };
      } catch (error) {
        console.error("[SavedSearches] Delete error:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to delete saved search",
        });
      }
    }),

  /**
   * Get matches for a saved search
   */
  getMatches: protectedProcedure
    .input(z.object({ savedSearchId: z.number().int().positive() }))
    .query(async ({ ctx, input }) => {
      if (!ctx.user?.id) {
        throw new TRPCError({ code: "UNAUTHORIZED" });
      }

      try {
        const db = await getDb();
        if (!db) return [];
        // Verify ownership
        const search = await (db as any).$client.promise().execute(
          `SELECT id FROM savedSearches WHERE id = ? AND userId = ?`,
          [input.savedSearchId, ctx.user.id]
        );

        if (!(search as any)[0] || (search as any)[0].length === 0) {
          throw new TRPCError({ code: "NOT_FOUND" });
        }

        const result = await (db as any).$client.promise().execute(
          `SELECT * FROM searchMatches WHERE savedSearchId = ? ORDER BY matchScore DESC, createdAt DESC`,
          [input.savedSearchId]
        );

        return (result as any)[0] || [];
      } catch (error) {
        console.error("[SavedSearches] GetMatches error:", error);
        return [];
      }
    }),

  /**
   * Mark matches as notified
   */
  markNotified: protectedProcedure
    .input(
      z.object({
        matchIds: z.array(z.number().int().positive()),
      })
    )
    .mutation(async ({ ctx, input }) => {
      if (!ctx.user?.id) {
        throw new TRPCError({ code: "UNAUTHORIZED" });
      }

      try {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
        const placeholders = input.matchIds.map(() => "?").join(",");
        await (db as any).$client.promise().execute(
          `UPDATE searchMatches SET notificationSent = 1, notificationSentAt = NOW() 
           WHERE id IN (${placeholders})`,
          input.matchIds
        );

        return { success: true };
      } catch (error) {
        console.error("[SavedSearches] MarkNotified error:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to mark matches as notified",
        });
      }
    }),
});
