import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import {
  Download,
  TrendingUp,
  TrendingDown,
  Flame,
  Sun,
  Snowflake,
  Scale,
  AlertTriangle,
  Lightbulb,
  Info,
  BarChart3,
  MapPin,
  Building2,
  Users,
  DollarSign,
  Target,
  FileSpreadsheet,
  Globe,
} from "lucide-react";

type Locale = 'en' | 'ar';

function formatEGP(amount: number | null | undefined): string {
  if (amount == null || isNaN(amount)) return 'N/A';
  if (amount >= 1_000_000) {
    return `${(amount / 1_000_000).toFixed(1).replace(/\.0$/, '')}M EGP`;
  }
  if (amount >= 1_000) {
    return `${Math.round(amount / 1_000)}K EGP`;
  }
  return `${amount} EGP`;
}

function TemperatureBadge({ temp }: { temp: string }) {
  const config: Record<string, { icon: any; color: string; label: string }> = {
    hot: { icon: Flame, color: 'bg-red-500/20 text-red-400 border-red-500/30', label: 'Hot' },
    warm: { icon: Sun, color: 'bg-amber-500/20 text-amber-400 border-amber-500/30', label: 'Warm' },
    cool: { icon: Scale, color: 'bg-blue-500/20 text-blue-400 border-blue-500/30', label: 'Balanced' },
    cold: { icon: Snowflake, color: 'bg-gray-500/20 text-gray-400 border-gray-500/30', label: 'Cold' },
  };
  const c = config[temp] || config.cool;
  const Icon = c.icon;
  return (
    <Badge variant="outline" className={`${c.color} gap-1`}>
      <Icon className="h-3 w-3" />
      {c.label}
    </Badge>
  );
}

function InsightIcon({ type }: { type: string }) {
  switch (type) {
    case 'opportunity': return <Lightbulb className="h-5 w-5 text-green-400" />;
    case 'warning': return <AlertTriangle className="h-5 w-5 text-amber-400" />;
    case 'trend': return <TrendingUp className="h-5 w-5 text-blue-400" />;
    default: return <Info className="h-5 w-5 text-gray-400" />;
  }
}

function PriorityBadge({ priority }: { priority: string }) {
  const colors: Record<string, string> = {
    high: 'bg-red-500/20 text-red-400 border-red-500/30',
    medium: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
    low: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  };
  return (
    <Badge variant="outline" className={colors[priority] || colors.low}>
      {priority.toUpperCase()}
    </Badge>
  );
}

function downloadCSV(csv: string, filename: string) {
  const BOM = '\uFEFF';
  const blob = new Blob([BOM + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export default function InvestorDashboard() {
  const [locale, setLocale] = useState<Locale>('en');

  const { data: dashboardData, isLoading } = trpc.investorInsights.dashboard.useQuery();

  const exportInsights = trpc.investorInsights.exportInsightsCSV.useQuery(
    { locale },
    { enabled: false }
  );
  const exportMatches = trpc.investorInsights.exportMatchesCSV.useQuery(
    { locale, minScore: 85, limit: 1000 },
    { enabled: false }
  );
  const exportSupply = trpc.investorInsights.exportSupplyCSV.useQuery(
    { locale, limit: 1000 },
    { enabled: false }
  );
  const exportDemand = trpc.investorInsights.exportDemandCSV.useQuery(
    { locale, limit: 1000 },
    { enabled: false }
  );

  async function handleExport(type: 'insights' | 'matches' | 'supply' | 'demand') {
    try {
      let result;
      switch (type) {
        case 'insights':
          result = await exportInsights.refetch();
          break;
        case 'matches':
          result = await exportMatches.refetch();
          break;
        case 'supply':
          result = await exportSupply.refetch();
          break;
        case 'demand':
          result = await exportDemand.refetch();
          break;
      }
      if (result.data) {
        downloadCSV(result.data.csv, result.data.filename);
        toast.success(`Downloaded ${result.data.count} records as CSV with Crystal Power branding.`);
      }
    } catch (err) {
      toast.error("Could not generate the export. Please try again.");
    }
  }

  if (isLoading) {
    return (
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-10 w-32" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-28" />)}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Skeleton className="h-96" />
          <Skeleton className="h-96" />
        </div>
      </div>
    );
  }

  const data = dashboardData;
  if (!data) return <div className="p-6 text-muted-foreground">No data available.</div>;

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <TrendingUp className="h-7 w-7 text-emerald-400" />
            Investor Intelligence
          </h1>
          <p className="text-muted-foreground mt-1">
            Crystal Power Investments — Real Estate Market Analysis
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setLocale(locale === 'en' ? 'ar' : 'en')}
            className="gap-1"
          >
            <Globe className="h-4 w-4" />
            {locale === 'en' ? 'العربية' : 'English'}
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="bg-card/50 border-red-500/20">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wider">Hot Markets</p>
                <p className="text-3xl font-bold text-red-400 mt-1">{data.summary.hotMarkets}</p>
              </div>
              <Flame className="h-8 w-8 text-red-400/40" />
            </div>
          </CardContent>
        </Card>
        <Card className="bg-card/50 border-amber-500/20">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wider">Warm Markets</p>
                <p className="text-3xl font-bold text-amber-400 mt-1">{data.summary.warmMarkets}</p>
              </div>
              <Sun className="h-8 w-8 text-amber-400/40" />
            </div>
          </CardContent>
        </Card>
        <Card className="bg-card/50 border-blue-500/20">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wider">Balanced</p>
                <p className="text-3xl font-bold text-blue-400 mt-1">{data.summary.coolMarkets}</p>
              </div>
              <Scale className="h-8 w-8 text-blue-400/40" />
            </div>
          </CardContent>
        </Card>
        <Card className="bg-card/50 border-emerald-500/20">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wider">Total Areas</p>
                <p className="text-3xl font-bold text-emerald-400 mt-1">{data.summary.totalAreas}</p>
              </div>
              <MapPin className="h-8 w-8 text-emerald-400/40" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Top Opportunity Highlight */}
      {data.summary.topOpportunity && (
        <Card className="bg-gradient-to-r from-emerald-500/10 to-blue-500/10 border-emerald-500/30">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="p-3 rounded-full bg-emerald-500/20">
              <Target className="h-6 w-6 text-emerald-400" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Top Investment Opportunity</p>
              <p className="text-lg font-semibold text-foreground">{data.summary.topOpportunity}</p>
              {data.summary.highestDemandArea && data.summary.highestDemandArea !== data.summary.topOpportunity && (
                <p className="text-sm text-muted-foreground mt-0.5">
                  Highest demand area: <span className="text-foreground">{data.summary.highestDemandArea}</span>
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Market Insights */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Lightbulb className="h-5 w-5 text-amber-400" />
            Market Insights & Recommendations
          </CardTitle>
          <CardDescription>
            AI-generated insights based on supply/demand analysis across {data.summary.totalAreas} areas
          </CardDescription>
        </CardHeader>
        <CardContent>
          {data.insights.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">
              Not enough data to generate insights yet. More messages will unlock market intelligence.
            </p>
          ) : (
            <div className="space-y-3">
              {data.insights.map((insight, idx) => (
                <div
                  key={idx}
                  className="p-4 rounded-lg border bg-card/50 hover:bg-card/80 transition-colors"
                >
                  <div className="flex items-start gap-3">
                    <InsightIcon type={insight.type} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span className="font-semibold text-foreground">{insight.location}</span>
                        <PriorityBadge priority={insight.priority} />
                        <TemperatureBadge temp={insight.metrics.temperature} />
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {locale === 'ar' ? insight.messageAr : insight.messageEn}
                      </p>
                      <p className="text-sm text-emerald-400 mt-1 font-medium">
                        {locale === 'ar' ? insight.actionableAr : insight.actionableEn}
                      </p>
                      <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Building2 className="h-3 w-3" />
                          Supply: {insight.metrics.supplyCount}
                        </span>
                        <span className="flex items-center gap-1">
                          <Users className="h-3 w-3" />
                          Demand: {insight.metrics.demandCount}
                        </span>
                        <span className="flex items-center gap-1">
                          <BarChart3 className="h-3 w-3" />
                          Ratio: {insight.metrics.demandSupplyRatio.toFixed(1)}x
                        </span>
                        {insight.metrics.avgPrice && (
                          <span className="flex items-center gap-1">
                            <DollarSign className="h-3 w-3" />
                            {formatEGP(insight.metrics.avgPrice)}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Area Analysis Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MapPin className="h-5 w-5 text-blue-400" />
            Area Analysis
          </CardTitle>
          <CardDescription>
            Supply/demand breakdown by location — sorted by demand-to-supply ratio
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/50">
                  <th className="text-left py-3 px-2 text-muted-foreground font-medium">Location</th>
                  <th className="text-center py-3 px-2 text-muted-foreground font-medium">Supply</th>
                  <th className="text-center py-3 px-2 text-muted-foreground font-medium">Demand</th>
                  <th className="text-center py-3 px-2 text-muted-foreground font-medium">D/S Ratio</th>
                  <th className="text-center py-3 px-2 text-muted-foreground font-medium">Avg Price</th>
                  <th className="text-center py-3 px-2 text-muted-foreground font-medium">Matches</th>
                  <th className="text-center py-3 px-2 text-muted-foreground font-medium">Avg Score</th>
                  <th className="text-center py-3 px-2 text-muted-foreground font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {data.areaAnalysis.map((area, idx) => (
                  <tr key={idx} className="border-b border-border/20 hover:bg-muted/20">
                    <td className="py-3 px-2 font-medium text-foreground">{area.location}</td>
                    <td className="text-center py-3 px-2">{area.supplyCount}</td>
                    <td className="text-center py-3 px-2">{area.demandCount}</td>
                    <td className="text-center py-3 px-2">
                      <span className={
                        area.demandSupplyRatio > 2 ? 'text-red-400 font-semibold' :
                        area.demandSupplyRatio > 1.5 ? 'text-amber-400' :
                        area.demandSupplyRatio < 0.5 ? 'text-gray-400' : 'text-blue-400'
                      }>
                        {area.demandSupplyRatio.toFixed(2)}x
                      </span>
                    </td>
                    <td className="text-center py-3 px-2 text-muted-foreground">
                      {formatEGP(area.avgSupplyPrice)}
                    </td>
                    <td className="text-center py-3 px-2">{area.matchCount}</td>
                    <td className="text-center py-3 px-2">
                      {area.avgMatchScore ? `${area.avgMatchScore.toFixed(0)}%` : '—'}
                    </td>
                    <td className="text-center py-3 px-2">
                      <TemperatureBadge temp={area.temperature} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Property Type Breakdown */}
      {data.propertyTypeBreakdown.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5 text-purple-400" />
              Property Type Analysis
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {data.propertyTypeBreakdown.map((pt, idx) => (
                <div key={idx} className="p-3 rounded-lg border bg-card/50">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium text-foreground capitalize">{pt.type}</span>
                    <Badge variant="outline" className={
                      pt.ratio > 2 ? 'bg-red-500/20 text-red-400 border-red-500/30' :
                      pt.ratio > 1 ? 'bg-amber-500/20 text-amber-400 border-amber-500/30' :
                      'bg-blue-500/20 text-blue-400 border-blue-500/30'
                    }>
                      {pt.ratio.toFixed(1)}x
                    </Badge>
                  </div>
                  <div className="flex items-center gap-4 text-xs text-muted-foreground">
                    <span>Supply: {pt.supplyCount}</span>
                    <span>Demand: {pt.demandCount}</span>
                  </div>
                  <div className="mt-2 h-1.5 rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-blue-500"
                      style={{ width: `${Math.min(100, (pt.demandCount / Math.max(1, pt.supplyCount + pt.demandCount)) * 100)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Export Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5 text-green-400" />
            Export Reports
          </CardTitle>
          <CardDescription>
            Download Crystal Power branded CSV reports in English or Arabic
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <Button
              variant="outline"
              className="h-auto py-4 flex flex-col items-center gap-2"
              onClick={() => handleExport('insights')}
            >
              <TrendingUp className="h-6 w-6 text-emerald-400" />
              <span className="font-medium">Investor Insights</span>
              <span className="text-xs text-muted-foreground">Area analysis + recommendations</span>
            </Button>
            <Button
              variant="outline"
              className="h-auto py-4 flex flex-col items-center gap-2"
              onClick={() => handleExport('matches')}
            >
              <Target className="h-6 w-6 text-blue-400" />
              <span className="font-medium">High-Confidence Matches</span>
              <span className="text-xs text-muted-foreground">85%+ score with contacts</span>
            </Button>
            <Button
              variant="outline"
              className="h-auto py-4 flex flex-col items-center gap-2"
              onClick={() => handleExport('supply')}
            >
              <Building2 className="h-6 w-6 text-purple-400" />
              <span className="font-medium">Property Supply</span>
              <span className="text-xs text-muted-foreground">All listed properties</span>
            </Button>
            <Button
              variant="outline"
              className="h-auto py-4 flex flex-col items-center gap-2"
              onClick={() => handleExport('demand')}
            >
              <Users className="h-6 w-6 text-amber-400" />
              <span className="font-medium">Property Demand</span>
              <span className="text-xs text-muted-foreground">All buyer requests</span>
            </Button>
          </div>
          <p className="text-xs text-muted-foreground mt-3 text-center">
            All exports include Crystal Power Investments branding, date stamp, and contact info.
            {locale === 'ar' ? ' التقارير باللغة العربية' : ' Reports in English'}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
