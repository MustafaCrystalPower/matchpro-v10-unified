import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  BarChart3, 
  TrendingUp, 
  MapPin,
  Building2,
  RefreshCw
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell
} from "recharts";

const COLORS = ["#3b82f6", "#22c55e", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899", "#14b8a6", "#f97316"];

export default function Analytics() {
  const { data: stats, refetch } = trpc.dashboard.stats.useQuery();
  const { data: locationStats } = trpc.dashboard.locationStats.useQuery();
  const { data: propertyTypeStats } = trpc.dashboard.propertyTypeStats.useQuery();
  const { data: priceStats } = trpc.dashboard.priceStats.useQuery();
  const { data: groups } = trpc.groups.active.useQuery();

  const formatPrice = (price: number) => {
    if (price >= 1000000) return `${(price / 1000000).toFixed(1)}M`;
    if (price >= 1000) return `${(price / 1000).toFixed(0)}K`;
    return price.toString();
  };

  // Prepare chart data
  const locationChartData = locationStats?.map(loc => ({
    name: loc.location?.substring(0, 15) || "Unknown",
    count: Number(loc.count)
  })) || [];

  const supplyTypeData = propertyTypeStats?.supply?.map((item, idx) => ({
    name: item.propertyType || "Unknown",
    value: Number(item.count),
    color: COLORS[idx % COLORS.length]
  })) || [];

  const demandTypeData = propertyTypeStats?.demand?.map((item, idx) => ({
    name: item.propertyType || "Unknown",
    value: Number(item.count),
    color: COLORS[idx % COLORS.length]
  })) || [];

  const priceChartData = priceStats?.map(item => ({
    name: item.propertyType || "Unknown",
    avg: Number(item.avgPrice) || 0,
    min: Number(item.minPrice) || 0,
    max: Number(item.maxPrice) || 0
  })) || [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Market Analytics</h1>
          <p className="text-muted-foreground">Real estate market insights from WhatsApp data</p>
        </div>
        <Button variant="outline" onClick={() => refetch()}>
          <RefreshCw className="w-4 h-4 mr-2" /> Refresh
        </Button>
      </div>

      {/* Overview Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Supply/Demand Ratio</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {stats?.supplyDemandRatio ? Number(stats.supplyDemandRatio).toFixed(2) : "N/A"}
            </div>
            <p className="text-xs text-muted-foreground">
              {(stats?.supplyDemandRatio || 0) > 1 ? "More supply than demand" : "More demand than supply"}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Supply</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-500">{stats?.totalSupply || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Demand</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-500">{stats?.totalDemand || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Match Rate</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-500">
              {stats?.totalMatches && stats?.totalSupply 
                ? (Number(stats.totalMatches) / Number(stats.totalSupply) * 100).toFixed(0) 
                : 0}%
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row 1 */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Hot Locations */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MapPin className="h-5 w-5" />
              Hot Locations
            </CardTitle>
          </CardHeader>
          <CardContent>
            {locationChartData.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-[300px] text-muted-foreground">
                <MapPin className="h-12 w-12 mb-4 opacity-50" />
                <p>No location data yet</p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={locationChartData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" />
                  <YAxis dataKey="name" type="category" width={100} />
                  <Tooltip />
                  <Bar dataKey="count" fill="#3b82f6" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Price by Property Type */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Average Price by Property Type
            </CardTitle>
          </CardHeader>
          <CardContent>
            {priceChartData.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-[300px] text-muted-foreground">
                <TrendingUp className="h-12 w-12 mb-4 opacity-50" />
                <p>No price data yet</p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={priceChartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis tickFormatter={(v) => formatPrice(v)} />
                  <Tooltip formatter={(v: number) => formatPrice(v) + " EGP"} />
                  <Legend />
                  <Bar dataKey="avg" name="Average" fill="#22c55e" />
                  <Bar dataKey="min" name="Min" fill="#3b82f6" />
                  <Bar dataKey="max" name="Max" fill="#ef4444" />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Charts Row 2 */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Supply by Property Type */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              Supply by Property Type
            </CardTitle>
          </CardHeader>
          <CardContent>
            {supplyTypeData.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-[300px] text-muted-foreground">
                <Building2 className="h-12 w-12 mb-4 opacity-50" />
                <p>No supply data yet</p>
              </div>
            ) : (
              <div className="flex items-center">
                <ResponsiveContainer width="60%" height={300}>
                  <PieChart>
                    <Pie
                      data={supplyTypeData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={100}
                      paddingAngle={2}
                      dataKey="value"
                    >
                      {supplyTypeData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
                <div className="w-40 space-y-2">
                  {supplyTypeData.map((item, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <div 
                        className="w-3 h-3 rounded-full" 
                        style={{ backgroundColor: item.color }}
                      />
                      <span className="text-sm">{item.name}: {item.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Demand by Property Type */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              Demand by Property Type
            </CardTitle>
          </CardHeader>
          <CardContent>
            {demandTypeData.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-[300px] text-muted-foreground">
                <BarChart3 className="h-12 w-12 mb-4 opacity-50" />
                <p>No demand data yet</p>
              </div>
            ) : (
              <div className="flex items-center">
                <ResponsiveContainer width="60%" height={300}>
                  <PieChart>
                    <Pie
                      data={demandTypeData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={100}
                      paddingAngle={2}
                      dataKey="value"
                    >
                      {demandTypeData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
                <div className="w-40 space-y-2">
                  {demandTypeData.map((item, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <div 
                        className="w-3 h-3 rounded-full" 
                        style={{ backgroundColor: item.color }}
                      />
                      <span className="text-sm">{item.name}: {item.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Active Groups */}
      <Card>
        <CardHeader>
          <CardTitle>Active WhatsApp Groups</CardTitle>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[300px]">
            {!groups || groups.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                <p>No active groups yet</p>
              </div>
            ) : (
              <div className="space-y-3">
                {groups.map((group) => (
                  <div key={group.id} className="flex items-center justify-between p-3 border rounded-lg">
                    <div>
                      <p className="font-medium">{group.groupName || "Unknown Group"}</p>
                      <p className="text-sm text-muted-foreground">
                        Last active: {group.lastMessageAt ? new Date(group.lastMessageAt).toLocaleString() : "Never"}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Badge variant="outline">{group.messageCount} msgs</Badge>
                      <Badge className="bg-blue-600">{group.supplyCount} supply</Badge>
                      <Badge className="bg-green-600">{group.demandCount} demand</Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}
