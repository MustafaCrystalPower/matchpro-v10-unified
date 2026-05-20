import { getRecentMatches, getRecentDemand, getRecentSupply } from './db';

/**
 * Report Analytics & Monitoring System
 * Tracks report generation, delivery, and quality metrics
 */

export interface ReportMetrics {
  generatedAt: Date;
  matchesCount: number;
  demandCount: number;
  supplyCount: number;
  averageMatchScore: number;
  highQualityMatches: number; // score >= 75
  excellentMatches: number; // score >= 85
  areaBreakdown: Record<string, number>;
  generationTimeMs: number;
  emailsSent: number;
  emailsFailed: number;
  brokerDistributionStats: {
    totalBrokers: number;
    reportsDistributed: number;
    distributionErrors: number;
  };
}

/**
 * Generate comprehensive report metrics
 */
export async function generateReportMetrics(generationTimeMs: number): Promise<ReportMetrics> {
  try {
    console.log('[Analytics] Generating report metrics...');

    // Fetch data
    const matches = await getRecentMatches(500);
    const demand = await getRecentDemand(1000);
    const supply = await getRecentSupply(500);

    // Calculate metrics
    const matchScores = matches
      .map((m: any) => {
        const score = parseFloat(m.matchScore?.toString() || '0');
        return isNaN(score) ? 0 : score;
      })
      .filter((s: number) => s > 0);

    const averageScore = matchScores.length > 0 ? matchScores.reduce((a: number, b: number) => a + b) / matchScores.length : 0;
    const highQuality = matches.filter((m: any) => {
      const score = parseFloat(m.matchScore?.toString() || '0');
      return score >= 75;
    }).length;
    const excellent = matches.filter((m: any) => {
      const score = parseFloat(m.matchScore?.toString() || '0');
      return score >= 85;
    }).length;

    // Area breakdown
    const areaBreakdown: Record<string, number> = {};
    for (const d of demand) {
      const area = d.area || 'Unknown';
      areaBreakdown[area] = (areaBreakdown[area] || 0) + 1;
    }

    const metrics: ReportMetrics = {
      generatedAt: new Date(),
      matchesCount: matches.length,
      demandCount: demand.length,
      supplyCount: supply.length,
      averageMatchScore: Math.round(averageScore * 100) / 100,
      highQualityMatches: highQuality,
      excellentMatches: excellent,
      areaBreakdown,
      generationTimeMs,
      emailsSent: 0, // Will be updated by scheduler
      emailsFailed: 0,
      brokerDistributionStats: {
        totalBrokers: 0,
        reportsDistributed: 0,
        distributionErrors: 0,
      },
    };

    console.log('[Analytics] Metrics generated:', metrics);
    return metrics;
  } catch (error) {
    console.error('[Analytics] Error generating metrics:', error);
    throw error;
  }
}

/**
 * Get report generation history
 */
export async function getReportHistory(limit: number = 10): Promise<ReportMetrics[]> {
  // TODO: Implement database storage for historical metrics
  console.log('[Analytics] Fetching report history (limit: ' + limit + ')');
  return [];
}

/**
 * Get report quality score (0-100)
 */
export function calculateQualityScore(metrics: ReportMetrics): number {
  let score = 50; // Base score

  // Match quality (0-30 points)
  const matchQualityRatio = metrics.highQualityMatches / Math.max(metrics.matchesCount, 1);
  score += matchQualityRatio * 30;

  // Data volume (0-20 points)
  const totalLeads = metrics.demandCount + metrics.supplyCount;
  const volumeScore = Math.min((totalLeads / 100) * 20, 20);
  score += volumeScore;

  // Generation efficiency (0-10 points)
  if (metrics.generationTimeMs < 5000) score += 10;
  else if (metrics.generationTimeMs < 10000) score += 5;

  // Delivery success (0-10 points)
  const deliveryRate = metrics.emailsSent / Math.max(metrics.emailsSent + metrics.emailsFailed, 1);
  score += deliveryRate * 10;

  return Math.min(Math.round(score), 100);
}

/**
 * Get area performance metrics
 */
export function getAreaPerformance(metrics: ReportMetrics): Array<{
  area: string;
  leads: number;
  percentage: number;
}> {
  const totalLeads = Object.values(metrics.areaBreakdown).reduce((a, b) => a + b, 0);

  return Object.entries(metrics.areaBreakdown)
    .map(([area, count]) => ({
      area,
      leads: count,
      percentage: Math.round((count / totalLeads) * 100),
    }))
    .sort((a, b) => b.leads - a.leads);
}

/**
 * Get match quality distribution
 */
export async function getMatchQualityDistribution(): Promise<{
  excellent: number;
  high: number;
  medium: number;
  low: number;
}> {
  try {
    const matches = await getRecentMatches(500);

    const distribution = {
      excellent: 0, // >= 85
      high: 0, // 75-84
      medium: 0, // 60-74
      low: 0, // < 60
    };

    for (const match of matches) {
      const score = parseFloat(match.matchScore?.toString() || '0');
      if (score >= 85) distribution.excellent++;
      else if (score >= 75) distribution.high++;
      else if (score >= 60) distribution.medium++;
      else distribution.low++;
    }

    return distribution;
  } catch (error) {
    console.error('[Analytics] Error getting match quality distribution:', error);
    return { excellent: 0, high: 0, medium: 0, low: 0 };
  }
}

/**
 * Get supply vs demand ratio
 */
export async function getSupplyDemandRatio(): Promise<{
  supply: number;
  demand: number;
  ratio: number;
}> {
  try {
    const supply = await getRecentSupply(500);
    const demand = await getRecentDemand(500);

    const ratio = supply.length > 0 ? supply.length / demand.length : 0;

    return {
      supply: supply.length,
      demand: demand.length,
      ratio: Math.round(ratio * 100) / 100,
    };
  } catch (error) {
    console.error('[Analytics] Error calculating supply/demand ratio:', error);
    return { supply: 0, demand: 0, ratio: 0 };
  }
}

/**
 * Generate analytics summary for dashboard
 */
export async function generateAnalyticsSummary(): Promise<{
  metrics: ReportMetrics;
  qualityScore: number;
  areaPerformance: Array<{ area: string; leads: number; percentage: number }>;
  matchQuality: { excellent: number; high: number; medium: number; low: number };
  supplyDemand: { supply: number; demand: number; ratio: number };
}> {
  try {
    const startTime = Date.now();
    const metrics = await generateReportMetrics(0);
    const generationTime = Date.now() - startTime;
    metrics.generationTimeMs = generationTime;

    const qualityScore = calculateQualityScore(metrics);
    const areaPerformance = getAreaPerformance(metrics);
    const matchQuality = await getMatchQualityDistribution();
    const supplyDemand = await getSupplyDemandRatio();

    return {
      metrics,
      qualityScore,
      areaPerformance,
      matchQuality,
      supplyDemand,
    };
  } catch (error) {
    console.error('[Analytics] Error generating summary:', error);
    throw error;
  }
}
