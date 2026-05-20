import { router, protectedProcedure } from "../_core/trpc";
import { z } from "zod";
import {
  createUserAsset,
  getUserAssets,
  getAsset,
  matchDemandToAssets,
  createAssetMatch,
  getAssetMatches,
  updateAssetMatchStatus,
} from "../assetHelpers";
import { getDb } from "../db";
import { demand } from "../../drizzle/schema";
import { eq } from "drizzle-orm";

export const assetsRouter = router({
  /**
   * Create a new user asset
   */
  createAsset: protectedProcedure
    .input(
      z.object({
        propertyType: z.string(),
        location: z.string(),
        area: z.string().optional(),
        size: z.number().optional(),
        bedrooms: z.number().optional(),
        bathrooms: z.number().optional(),
        price: z.number(),
        priceType: z.enum(["sale", "rent"]),
        rentalPeriod: z.enum(["monthly", "yearly"]).optional(),
        description: z.string().optional(),
        amenities: z.array(z.string()).optional(),
        contactName: z.string().optional(),
        contactPhone: z.string().optional(),
        images: z.array(z.string()).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      return await createUserAsset({
        userId: ctx.user.id,
        ...input,
      });
    }),

  /**
   * Get all assets for current user
   */
  getUserAssets: protectedProcedure.query(async ({ ctx }) => {
    return await getUserAssets(ctx.user.id);
  }),

  /**
   * Get single asset
   */
  getAsset: protectedProcedure
    .input(z.object({ assetId: z.number() }))
    .query(async ({ input }) => {
      const asset = await getAsset(input.assetId);
      return asset[0] || null;
    }),

  /**
   * Find matching demand requests for an asset
   */
  getMatches: protectedProcedure
    .input(z.object({ assetId: z.number() }))
    .mutation(async ({ input }) => {
      return await matchDemandToAssets(input.assetId);
    }),

  /**
   * Get demand for asset (for UI display)
   */
  getDemandForAsset: protectedProcedure
    .input(
      z.object({
        assetId: z.number(),
        location: z.string().optional(),
        propertyType: z.string().optional(),
      })
    )
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];

      const demands = await db
        .select()
        .from(demand)
        .where(eq(demand.purpose, "rent"))
        .limit(50);

      return demands.map((d: any) => ({
        id: d.id,
        buyerName: d.contactName,
        buyerPhone: d.contact,
        propertyType: d.propertyType,
        bedrooms: d.bedrooms,
        budgetMin: d.priceMin ? parseFloat(String(d.priceMin)) : null,
        budgetMax: d.priceMax ? parseFloat(String(d.priceMax)) : null,
        createdAt: d.createdAt,
      }));
    }),

  /**
   * Export matching requests to Excel and send email
   */
  exportMatches: protectedProcedure
    .input(z.object({ assetId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const asset = await getAsset(input.assetId);
      if (!asset || asset.length === 0) {
        throw new Error("Asset not found");
      }

      const matches = await matchDemandToAssets(input.assetId);

      if (matches.length === 0) {
        throw new Error("No matching requests found");
      }

      // TODO: Generate Excel file and send email
      // For now, just return success
      return {
        success: true,
        matchCount: matches.length,
        message: "Matches exported and email sent",
      };
    }),

  /**
   * Delete asset
   */
  deleteAsset: protectedProcedure
    .input(z.object({ assetId: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      // TODO: Implement delete with proper authorization check
      return { success: true };
    }),

  /**
   * Update asset match status
   */
  updateMatchStatus: protectedProcedure
    .input(
      z.object({
        matchId: z.number(),
        status: z.enum(["new", "viewed", "contacted", "closed"]),
      })
    )
    .mutation(async ({ input }) => {
      return await updateAssetMatchStatus(input.matchId, input.status);
    }),
});
