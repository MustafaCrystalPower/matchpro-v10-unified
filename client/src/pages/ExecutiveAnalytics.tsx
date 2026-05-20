import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TrendingUp, TrendingDown, Building2, Home, DollarSign, MapPin, BarChart3, Download } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export default function ExecutiveAnalytics() {
  const [areaFilter, setAreaFilter] = useState<string | undefined>();
  const [typeFilter, setTypeFilter] = useState<string | undefined>();
  const [priceBandFilter, setPriceBandFilter] = useState<string | undefined>();

  const { data: stats } = trpc.dashboard.stats.useQuery();
  const { data: conversionMetrics } = trpc.analytics.conversionMetrics.useQuery({});
  const { data: opportunities } = trpc.analytics.opportunities.useQuery({ limit: 5 });
  const { data: oversupply } = trpc.analytics.oversupply.useQuery({ limit: 5 });
  const { data: segmented } = trpc.analytics.segmented.useQuery({
    area: areaFilter,
    propertyType: typeFilter,
    priceBand: priceBandFilter,
    limit: 20
  });

  const exportToCSV = () => {
    if (!segmented || segmented.length === 0) return;
    
    const headers = ["Area", "Type", "Price Band", "Supply", "Demand", "Ratio", "Insight Type", "Insight"];
    const rows = segmented.map(s => [
      s.area,
      s.propertyType,
      s.priceBand,
      s.supplyCount,
      s.demandCount,
      s.supplyDemandRatio || "N/A",
      s.insightType,
      s.insight
    ]);
    
    const csv = [headers, ...rows].map(row => row.join(",")).join("\\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `analytics-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Executive Analytics</h1>
          <p className="text-muted-foreground">Market intelligence and performance metrics</p>
        </div>
        <Button onClick={exportToCSV} className="gap-2">
          <Download className="h-4 w-4" />
          Export CSV
        </Button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Total Supply</p>
              <p className="text-2xl font-bold">{stats?.totalSupply || 0}</p>
            </div>
            <Building2 className="h-8 w-8 text-blue-500" />
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Total Demand</p>
              <p className="text-2xl font-bold">{stats?.totalDemand || 0}</p>
            </div>
            <Home className="h-8 w-8 text-green-500" />
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Total Matches</p>
              <p className="text-2xl font-bold">{stats?.totalMatches || 0}</p>
            </div>
            <BarChart3 className="h-8 w-8 text-purple-500" />
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Supply/Demand Ratio</p>
              <p className="text-2xl font-bold">
                {stats?.totalSupply && stats?.totalDemand 
                  ? (stats.totalSupply / stats.totalDemand).toFixed(2)
                  : "N/A"}
              </p>
            </div>
            <DollarSign className="h-8 w-8 text-yellow-500" />
          </div>
        </Card>
      </div>

      {/* Conversion Funnel */}
      {conversionMetrics && (
        <Card className="p-6">
          <h2 className="text-xl font-semibold mb-4">Conversion Funnel</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center">
              <p className="text-3xl font-bold text-blue-500">{conversionMetrics.generated || 0}</p>
              <p className="text-sm text-muted-foreground">Generated</p>
            </div>
            <div className="text-center">
              <p className="text-3xl font-bold text-green-500">{conversionMetrics.replied || 0}</p>
              <p className="text-sm text-muted-foreground">Replied</p>
              <p className="text-xs text-muted-foreground">
                ({conversionMetrics.generated ? ((conversionMetrics.replied / conversionMetrics.generated) * 100).toFixed(1) : 0}%)
              </p>
            </div>
            <div className="text-center">
              <p className="text-3xl font-bold text-purple-500">{conversionMetrics.viewing || 0}</p>
              <p className="text-sm text-muted-foreground">Viewings</p>
              <p className="text-xs text-muted-foreground">
                ({conversionMetrics.replied ? ((conversionMetrics.viewing / conversionMetrics.replied) * 100).toFixed(1) : 0}%)
              </p>
            </div>
            <div className="text-center">
              <p className="text-3xl font-bold text-yellow-500">{conversionMetrics.closed || 0}</p>
              <p className="text-sm text-muted-foreground">Closed</p>
              <p className="text-xs text-muted-foreground">
                ({conversionMetrics.viewing ? ((conversionMetrics.closed / conversionMetrics.viewing) * 100).toFixed(1) : 0}%)
              </p>
            </div>
          </div>
        </Card>
      )}

      {/* Market Balance Highlights */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Top Opportunities */}
        <Card className="p-6">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp className="h-5 w-5 text-green-500" />
            <h2 className="text-xl font-semibold">Top Opportunities</h2>
          </div>
          <p className="text-sm text-muted-foreground mb-4">High demand, low supply areas</p>
          <div className="space-y-3">
            {opportunities && opportunities.length > 0 ? (
              opportunities.map((opp, idx) => (
                <div key={idx} className="flex items-center justify-between p-3 rounded-lg bg-green-500/10 border border-green-500/20">
                  <div className="flex-1">
                    <p className="font-medium">{opp.area}</p>
                    <p className="text-sm text-muted-foreground">{opp.propertyType} • {opp.priceBand}</p>
                  </div>
                  <div className="text-right">
                      <Badge variant="outline" className="bg-green-500/10 text-green-500 border-green-500/20">
                      {opp.insightType || "Opportunity"}
                    </Badge>
                    <p className="text-xs text-muted-foreground mt-1">
                      {opp.demandCount}D / {opp.supplyCount}S
                    </p>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-sm text-muted-foreground">No data available</p>
            )}
          </div>
        </Card>

        {/* Oversupply Areas */}
        <Card className="p-6">
          <div className="flex items-center gap-2 mb-4">
            <TrendingDown className="h-5 w-5 text-red-500" />
            <h2 className="text-xl font-semibold">Oversupply Areas</h2>
          </div>
          <p className="text-sm text-muted-foreground mb-4">High supply, low demand areas</p>
          <div className="space-y-3">
            {oversupply && oversupply.length > 0 ? (
              oversupply.map((over, idx) => (
                <div key={idx} className="flex items-center justify-between p-3 rounded-lg bg-red-500/10 border border-red-500/20">
                  <div className="flex-1">
                    <p className="font-medium">{over.area}</p>
                    <p className="text-sm text-muted-foreground">{over.propertyType} • {over.priceBand}</p>
                  </div>
                  <div className="text-right">
                      <Badge variant="outline" className="bg-red-500/10 text-red-500 border-red-500/20">
                      Oversupply
                    </Badge>
                    <p className="text-xs text-muted-foreground mt-1">
                      {over.supplyCount}S / {over.demandCount}D
                    </p>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-sm text-muted-foreground">No data available</p>
            )}
          </div>
        </Card>
      </div>

      {/* Segmented Analytics with Filters */}
      <Card className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold">Segmented Analytics</h2>
          <div className="flex gap-2">
            <Select value={areaFilter} onValueChange={(v) => setAreaFilter(v === "all" ? undefined : v)}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="All Areas" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Areas</SelectItem>
                <SelectItem value="التجمع الخامس">التجمع الخامس</SelectItem>
                <SelectItem value="مدينتي">مدينتي</SelectItem>
                <SelectItem value="الشيخ زايد">الشيخ زايد</SelectItem>
                <SelectItem value="6 أكتوبر">6 أكتوبر</SelectItem>
              </SelectContent>
            </Select>

            <Select value={typeFilter} onValueChange={(v) => setTypeFilter(v === "all" ? undefined : v)}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="All Types" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="apartment">Apartment</SelectItem>
                <SelectItem value="villa">Villa</SelectItem>
                <SelectItem value="commercial">Commercial</SelectItem>
              </SelectContent>
            </Select>

            <Select value={priceBandFilter} onValueChange={(v) => setPriceBandFilter(v === "all" ? undefined : v)}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="All Prices" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Prices</SelectItem>
                <SelectItem value="< 2M">&lt; 2M</SelectItem>
                <SelectItem value="2M - 5M">2M - 5M</SelectItem>
                <SelectItem value="5M - 10M">5M - 10M</SelectItem>
                <SelectItem value="> 10M">&gt; 10M</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b">
                <th className="text-left p-2">Area</th>
                <th className="text-left p-2">Type</th>
                <th className="text-left p-2">Price Band</th>
                <th className="text-right p-2">Supply</th>
                <th className="text-right p-2">Demand</th>
                <th className="text-right p-2">Ratio</th>
                <th className="text-center p-2">Temperature</th>
                <th className="text-right p-2">Score</th>
              </tr>
            </thead>
            <tbody>
              {segmented && segmented.length > 0 ? (
                segmented.map((seg, idx) => (
                  <tr key={idx} className="border-b hover:bg-muted/50">
                    <td className="p-2">{seg.area}</td>
                    <td className="p-2">{seg.propertyType}</td>
                    <td className="p-2">{seg.priceBand}</td>
                    <td className="text-right p-2">{seg.supplyCount}</td>
                    <td className="text-right p-2">{seg.demandCount}</td>
                    <td className="text-right p-2">{seg.supplyDemandRatio || "N/A"}</td>
                    <td className="text-center p-2">
                      <Badge variant="outline" className="bg-blue-500/10 text-blue-500 border-blue-500/20">
                        {seg.insightType || "N/A"}
                      </Badge>
                    </td>
                    <td className="text-right p-2 font-medium">{seg.matchCount || 0}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={8} className="text-center p-4 text-muted-foreground">
                    No data available
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
