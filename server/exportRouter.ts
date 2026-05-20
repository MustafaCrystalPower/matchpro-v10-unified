import { z } from "zod";
import {
  exportMatches,
  exportSupply,
  exportDemand,
  exportMessages,
  getBrokerAnalytics,
  getMarketTrends,
} from "./exportServiceRawSQL";

// Export router will be integrated into main routers.ts
export const createExportRouter = (publicProcedure: any, protectedProcedure: any, router: any) => {
  return router({
    matches: protectedProcedure
      .input(
        z.object({
          format: z.enum(["csv", "pdf"]),
          locations: z.array(z.string()).optional(),
        })
      )
      .mutation(async ({ input }: any) => {
        const filepath = await exportMatches({
          format: input.format,
          type: "matches",
          filters: { location: input.locations },
        });
        return {
          success: true,
          filepath,
          filename: `matches-export-${Date.now()}.${input.format}`,
        };
      }),

    supply: protectedProcedure
      .input(
        z.object({
          format: z.enum(["csv", "pdf"]),
          locations: z.array(z.string()).optional(),
          priceMin: z.number().optional(),
          priceMax: z.number().optional(),
        })
      )
      .mutation(async ({ input }: any) => {
        const filepath = await exportSupply({
          format: input.format,
          type: "supply",
          filters: {
            location: input.locations,
            priceMin: input.priceMin,
            priceMax: input.priceMax,
          },
        });
        return {
          success: true,
          filepath,
          filename: `supply-export-${Date.now()}.${input.format}`,
        };
      }),

    demand: protectedProcedure
      .input(
        z.object({
          format: z.enum(["csv", "pdf"]),
          locations: z.array(z.string()).optional(),
        })
      )
      .mutation(async ({ input }: any) => {
        const filepath = await exportDemand({
          format: input.format,
          type: "demand",
          filters: { location: input.locations },
        });
        return {
          success: true,
          filepath,
          filename: `demand-export-${Date.now()}.${input.format}`,
        };
      }),

    messages: protectedProcedure
      .input(
        z.object({
          format: z.enum(["csv", "pdf"]),
          locations: z.array(z.string()).optional(),
        })
      )
      .mutation(async ({ input }: any) => {
        const filepath = await exportMessages({
          format: input.format,
          type: "messages",
          filters: { location: input.locations },
        });
        return {
          success: true,
          filepath,
          filename: `messages-export-${Date.now()}.${input.format}`,
        };
      }),

    brokerAnalytics: protectedProcedure.query(async () => {
      const data = await getBrokerAnalytics();
      return {
        success: true,
        data,
      };
    }),

    marketTrends: protectedProcedure
      .input(z.object({ days: z.number().default(30) }))
      .query(async ({ input }: any) => {
        const data = await getMarketTrends(input.days);
        return {
          success: true,
          data,
        };
      }),
  });
};
