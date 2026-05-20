import { router, protectedProcedure } from "../_core/trpc";

const INTEL_BASE = "https://lkdsbjzk.gensparkclaw.com/intel";
const INTEL_USER = "admin";
const INTEL_PASS = "N0pa$$5ara";

let cachedToken: string | null = null;
let tokenExpiry = 0;

async function getIntelToken(): Promise<string> {
  if (cachedToken && Date.now() < tokenExpiry) return cachedToken;
  const res = await fetch(`${INTEL_BASE}/api/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: INTEL_USER, password: INTEL_PASS }),
  });
  const data = await res.json() as { success?: boolean; token?: string };
  if (data.success && data.token) {
    cachedToken = data.token;
    tokenExpiry = Date.now() + 55 * 60 * 1000; // 55 min
    return cachedToken;
  }
  throw new Error("Failed to authenticate with Market Intelligence API");
}

async function intelFetch(path: string) {
  const token = await getIntelToken();
  const res = await fetch(`${INTEL_BASE}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`Intel API error: ${res.status}`);
  return res.json();
}

export const marketIntelligenceRouter = router({
  getMarketData: protectedProcedure.query(async () => {
    try {
      const data = await intelFetch("/api/market-data") as Record<string, unknown>;
      return { success: true, data };
    } catch (e) {
      console.error("[marketIntelligence] Error:", e);
      return { success: false, data: null, error: String(e) };
    }
  }),

  getPriceTrends: protectedProcedure.query(async () => {
    try {
      const data = await intelFetch("/api/price-trends") as Record<string, unknown>;
      return { success: true, data };
    } catch (e) {
      // fallback: return market data price info
      try {
        const md = await intelFetch("/api/market-data") as {
          supplyByArea?: Array<{ location: string; avg_price: number }>;
        };
        return {
          success: true,
          data: {
            priceByArea: md.supplyByArea?.map((a) => ({
              area: a.location,
              avgPrice: a.avg_price,
            })) ?? [],
          },
        };
      } catch {
        return { success: false, data: null, error: String(e) };
      }
    }
  }),
});
