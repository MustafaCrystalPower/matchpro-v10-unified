import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/lib/trpc";
import { MapView } from "@/components/Map";
import {
  TrendingUp,
  MapPin,
  Building2,
  DollarSign,
  RefreshCw,
  Users,
  BarChart3,
  Home,
  Eye,
  X,
} from "lucide-react";
import { useState, useEffect, useCallback, useRef } from 'react';
import { toast } from "sonner";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";

// ── Comprehensive Cairo / New Cairo location coordinates ──────────────────────
const LOCATION_COORDS: Record<string, { lat: number; lng: number }> = {
  // Madinaty main + blocks
  "madinaty": { lat: 30.1070, lng: 31.6340 },
  "مدينتي": { lat: 30.1070, lng: 31.6340 },
  "b1": { lat: 30.1060, lng: 31.6210 },
  "b2": { lat: 30.1080, lng: 31.6250 },
  "b3": { lat: 30.1090, lng: 31.6300 },
  "b4": { lat: 30.1100, lng: 31.6350 },
  "b5": { lat: 30.1050, lng: 31.6380 },
  "b6": { lat: 30.1040, lng: 31.6420 },
  "b7": { lat: 30.1030, lng: 31.6460 },
  "b8": { lat: 30.1020, lng: 31.6500 },
  "b9": { lat: 30.1010, lng: 31.6540 },
  "b10": { lat: 30.1000, lng: 31.6580 },
  "b11": { lat: 30.0990, lng: 31.6620 },
  "b12": { lat: 30.0980, lng: 31.6660 },
  "b13": { lat: 30.0970, lng: 31.6700 },
  "b14": { lat: 30.0960, lng: 31.6740 },
  "b15": { lat: 30.0950, lng: 31.6780 },
  "b16": { lat: 30.0940, lng: 31.6820 },
  "madinaty b2": { lat: 30.1080, lng: 31.6250 },
  "madinaty b3": { lat: 30.1090, lng: 31.6300 },
  "madinaty b6": { lat: 30.1040, lng: 31.6420 },
  "madinaty b12": { lat: 30.0980, lng: 31.6660 },
  "madinaty b7": { lat: 30.1030, lng: 31.6460 },
  // New Cairo / Fifth Settlement
  "new cairo": { lat: 30.0074, lng: 31.4913 },
  "القاهرة الجديدة": { lat: 30.0074, lng: 31.4913 },
  "التجمع الخامس": { lat: 30.0074, lng: 31.4913 },
  "fifth settlement": { lat: 30.0074, lng: 31.4913 },
  "التجمع": { lat: 30.0074, lng: 31.4913 },
  // Rehab
  "الرحاب": { lat: 30.0619, lng: 31.4913 },
  "rehab": { lat: 30.0619, lng: 31.4913 },
  "rehab city": { lat: 30.0619, lng: 31.4913 },
  // Compounds & Developments
  "mountain view": { lat: 30.0200, lng: 31.4600 },
  "mountain view chillout park": { lat: 30.0200, lng: 31.4600 },
  "mountain view chillout": { lat: 30.0200, lng: 31.4600 },
  "mountain view city": { lat: 30.0200, lng: 31.4600 },
  "mountain view icity": { lat: 30.0200, lng: 31.4600 },
  "icity": { lat: 30.0200, lng: 31.4600 },
  "mivida": { lat: 30.0150, lng: 31.4700 },
  "مفيدا": { lat: 30.0150, lng: 31.4700 },
  "fifth square": { lat: 30.0100, lng: 31.5200 },
  "noor city": { lat: 30.0050, lng: 31.5500 },
  "privado": { lat: 30.1050, lng: 31.6500 },
  "brivado": { lat: 30.1050, lng: 31.6500 },
  "brivado - g92": { lat: 30.1050, lng: 31.6500 },
  "talaat mostafa": { lat: 30.1070, lng: 31.6340 },
  "craft zone": { lat: 30.1070, lng: 31.6400 },
  "tenth stage": { lat: 30.1070, lng: 31.6350 },
  "beverly hills compound - phase 1": { lat: 30.0131, lng: 31.2089 },
  "dara gardens compound": { lat: 30.0131, lng: 31.2200 },
  "the ark, south 90th street": { lat: 30.0074, lng: 31.4913 },
  "b6, group 61": { lat: 30.1040, lng: 31.6420 },
  // Sheikh Zayed / 6th October
  "الشيخ زايد": { lat: 30.0131, lng: 31.2089 },
  "sheikh zayed": { lat: 30.0131, lng: 31.2089 },
  "6th of october city": { lat: 29.9668, lng: 31.1134 },
  "6 october": { lat: 29.9668, lng: 31.1134 },
  // Giza / Cairo
  "الجيزة": { lat: 30.0131, lng: 31.2089 },
  "giza": { lat: 30.0131, lng: 31.2089 },
  "القاهرة": { lat: 30.0444, lng: 31.2357 },
  "cairo": { lat: 30.0444, lng: 31.2357 },
  "المعادي": { lat: 29.9668, lng: 31.2664 },
  "maadi": { lat: 29.9668, lng: 31.2664 },
  "مصر الجديدة": { lat: 30.0862, lng: 31.3217 },
  "heliopolis": { lat: 30.0862, lng: 31.3217 },
  "new administrative capital": { lat: 30.0200, lng: 31.7800 },
  "العاصمة الإدارية": { lat: 30.0200, lng: 31.7800 },
  "unknown": { lat: 30.0444, lng: 31.2357 },
};

function getCoords(location: string): { lat: number; lng: number } {
  if (!location) return { lat: 30.0444, lng: 31.2357 };
  const norm = location.toLowerCase().trim();
  // Exact match
  if (LOCATION_COORDS[norm]) return LOCATION_COORDS[norm];
  // Partial match
  for (const [key, coords] of Object.entries(LOCATION_COORDS)) {
    if (norm.includes(key) || key.includes(norm)) return coords;
  }
  return { lat: 30.0444, lng: 31.2357 };
}

// Small random jitter to prevent pins from stacking exactly
function jitter(val: number, range = 0.003): number {
  return val + (Math.random() - 0.5) * range;
}

// ── Property Detail Popup ─────────────────────────────────────────────────────
function PropertyPopup({ item, type, onClose }: { item: any; type: 'supply' | 'demand'; onClose: () => void }) {
  const isSupply = type === 'supply';
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={onClose}>
      <div className="bg-card border rounded-xl p-5 max-w-sm w-full mx-4 shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            {isSupply
              ? <Building2 className="w-4 h-4 text-emerald-500" />
              : <Users className="w-4 h-4 text-blue-500" />
            }
            <span className={`text-sm font-semibold ${isSupply ? 'text-emerald-500' : 'text-blue-500'}`}>
              {isSupply ? 'Supply Listing' : 'Demand Request'}
            </span>
          </div>
          <button onClick={onClose}><X className="w-4 h-4 text-muted-foreground" /></button>
        </div>
        <div className="space-y-2 text-sm">
          <div className="flex items-center gap-2">
            <MapPin className="w-3.5 h-3.5 text-muted-foreground" />
            <span>{item.location || '—'}{item.city ? `, ${item.city}` : ''}</span>
          </div>
          {isSupply ? (
            <>
              <div className="flex items-center gap-2">
                <Home className="w-3.5 h-3.5 text-muted-foreground" />
                <span className="capitalize">{item.propertyType || '—'} · {item.purpose === 'sale' ? 'For Sale' : 'For Rent'}</span>
              </div>
              {item.price && (
                <div className="flex items-center gap-2">
                  <DollarSign className="w-3.5 h-3.5 text-muted-foreground" />
                  <span>{Number(item.price).toLocaleString()} EGP</span>
                </div>
              )}
              {(item.bedrooms || item.size) && (
                <div className="text-muted-foreground text-xs">
                  {item.bedrooms ? `${item.bedrooms} bed · ` : ''}{item.size ? `${item.size} sqm` : ''}
                </div>
              )}
            </>
          ) : (
            <>
              <div className="flex items-center gap-2">
                <Home className="w-3.5 h-3.5 text-muted-foreground" />
                <span className="capitalize">{item.propertyType || '—'} · {item.purpose === 'rent' ? 'Rent' : 'Buy'}</span>
              </div>
              {(item.priceMin || item.priceMax) && (
                <div className="flex items-center gap-2">
                  <DollarSign className="w-3.5 h-3.5 text-muted-foreground" />
                  <span>
                    {item.priceMin ? Number(item.priceMin).toLocaleString() : '?'} –{' '}
                    {item.priceMax ? Number(item.priceMax).toLocaleString() : '?'} EGP
                  </span>
                </div>
              )}
              {item.bedrooms && <div className="text-muted-foreground text-xs">{item.bedrooms} bed requested</div>}
            </>
          )}
          {item.contactName && (
            <div className="border-t pt-2 mt-2 text-xs text-muted-foreground">
              {item.contactName} · {item.contact}
            </div>
          )}
          {item.confidence && (
            <Badge className="text-xs bg-emerald-500/10 text-emerald-500 border-emerald-500/20">
              {Math.round(parseFloat(item.confidence) * 100)}% confidence
            </Badge>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function MarketIntelligence() {
  const [mapLayer, setMapLayer] = useState<'heatmap' | 'supply' | 'demand' | 'both'>('both');
  const [selectedItem, setSelectedItem] = useState<{ item: any; type: 'supply' | 'demand' } | null>(null);
  const geocodeCache = useRef<Record<string, { lat: number; lng: number }>>({});

  // Fetch supply and demand data
  const { data: supplyData = [], isLoading: supplyLoading, refetch: refetchSupply } =
    trpc.supply.recent.useQuery({ limit: 2000 });
  const { data: demandData = [], isLoading: demandLoading, refetch: refetchDemand } =
    trpc.demand.recent.useQuery({ limit: 2000 });

  // Build map pins from real data
  const [heatmapData, setHeatmapData] = useState<Array<{ lat: number; lng: number; weight: number }>>([]);
  const [supplyPins, setSupplyPins] = useState<Array<{ lat: number; lng: number; title: string; type: 'supply'; data?: any }>>([]);
  const [demandPins, setDemandPins] = useState<Array<{ lat: number; lng: number; title: string; type: 'demand'; data?: any }>>([]);

  // Build location stats for charts
  const [locationStats, setLocationStats] = useState<Array<{ location: string; supply: number; demand: number }>>([]);

  useEffect(() => {
    const supply = supplyData as any[];
    const demand = demandData as any[];

    const heat: typeof heatmapData = [];
    const sPins: typeof supplyPins = [];
    const dPins: typeof demandPins = [];
    const locMap: Record<string, { supply: number; demand: number }> = {};

    for (const s of supply) {
      const loc = (s.location || s.area || 'Cairo').trim();
      const coords = getCoords(loc);
      const jLat = jitter(coords.lat);
      const jLng = jitter(coords.lng);
      heat.push({ lat: jLat, lng: jLng, weight: 0.6 });
      sPins.push({
        lat: jLat,
        lng: jLng,
        title: `${s.propertyType || 'Property'} · ${loc} · ${s.price ? Number(s.price).toLocaleString() + ' EGP' : '—'}`,
        type: 'supply',
        data: s,
      });
      const normLoc = loc.toLowerCase();
      if (!locMap[normLoc]) locMap[normLoc] = { supply: 0, demand: 0 };
      locMap[normLoc].supply++;
    }

    for (const d of demand) {
      const loc = (d.location || d.area || 'Cairo').trim();
      const coords = getCoords(loc);
      const jLat = jitter(coords.lat, 0.004);
      const jLng = jitter(coords.lng, 0.004);
      heat.push({ lat: jLat, lng: jLng, weight: 0.8 });
      dPins.push({
        lat: jLat,
        lng: jLng,
        title: `Request: ${d.propertyType || 'Any'} · ${loc} · Budget ${d.priceMax ? Number(d.priceMax).toLocaleString() + ' EGP' : '—'}`,
        type: 'demand',
        data: d,
      });
      const normLoc = loc.toLowerCase();
      if (!locMap[normLoc]) locMap[normLoc] = { supply: 0, demand: 0 };
      locMap[normLoc].demand++;
    }

    // Top 10 locations for chart
    const stats = Object.entries(locMap)
      .map(([location, v]) => ({ location, supply: v.supply, demand: v.demand, total: v.supply + v.demand }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 10)
      .map(({ location, supply, demand }) => ({
        location: location.length > 12 ? location.substring(0, 12) + '…' : location,
        supply,
        demand,
      }));

    setHeatmapData(heat);
    setSupplyPins(sPins);
    setDemandPins(dPins);
    setLocationStats(stats);
  }, [supplyData, demandData]);

  const handleRefresh = useCallback(() => {
    refetchSupply();
    refetchDemand();
    toast.success('Market data refreshed');
  }, [refetchSupply, refetchDemand]);

  const handlePinClick = useCallback((pin: any) => {
    if (pin?.data) {
      setSelectedItem({ item: pin.data, type: pin.type });
    }
  }, []);

  const isLoading = supplyLoading || demandLoading;
  const supply = supplyData as any[];
  const demand = demandData as any[];

  // Summary stats
  const totalSupply = supply.length;
  const totalDemand = demand.length;
  const uniqueLocations = new Set([
    ...supply.map((s: any) => (s.location || '').toLowerCase().trim()),
    ...demand.map((d: any) => (d.location || '').toLowerCase().trim()),
  ]).size;
  const avgPrice = supply.length > 0
    ? Math.round(supply.filter((s: any) => s.price).reduce((acc: number, s: any) => acc + Number(s.price), 0) / supply.filter((s: any) => s.price).length)
    : 0;

  const visibleSupplyPins = mapLayer === 'supply' || mapLayer === 'both' ? supplyPins : [];
  const visibleDemandPins = mapLayer === 'demand' || mapLayer === 'both' ? demandPins : [];
  const visibleHeatmap = mapLayer === 'heatmap' ? heatmapData : [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Market Intelligence</h1>
          <p className="text-sm text-muted-foreground">Live supply & demand map — {totalSupply + totalDemand} active records</p>
        </div>
        <Button onClick={handleRefresh} disabled={isLoading} variant="outline" size="sm" className="gap-2">
          <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-card border rounded-xl p-4 flex items-center gap-3">
          <div className="p-2 rounded-lg bg-emerald-500/10">
            <Building2 className="w-5 h-5 text-emerald-500" />
          </div>
          <div>
            <p className="text-2xl font-bold">{totalSupply.toLocaleString()}</p>
            <p className="text-xs text-muted-foreground">Supply Listings</p>
          </div>
        </div>
        <div className="bg-card border rounded-xl p-4 flex items-center gap-3">
          <div className="p-2 rounded-lg bg-blue-500/10">
            <Users className="w-5 h-5 text-blue-500" />
          </div>
          <div>
            <p className="text-2xl font-bold">{totalDemand.toLocaleString()}</p>
            <p className="text-xs text-muted-foreground">Demand Requests</p>
          </div>
        </div>
        <div className="bg-card border rounded-xl p-4 flex items-center gap-3">
          <div className="p-2 rounded-lg bg-purple-500/10">
            <MapPin className="w-5 h-5 text-purple-500" />
          </div>
          <div>
            <p className="text-2xl font-bold">{uniqueLocations}</p>
            <p className="text-xs text-muted-foreground">Unique Locations</p>
          </div>
        </div>
        <div className="bg-card border rounded-xl p-4 flex items-center gap-3">
          <div className="p-2 rounded-lg bg-amber-500/10">
            <DollarSign className="w-5 h-5 text-amber-500" />
          </div>
          <div>
            <p className="text-2xl font-bold">
              {avgPrice > 0 ? (avgPrice >= 1_000_000 ? `${(avgPrice / 1_000_000).toFixed(1)}M` : avgPrice >= 1_000 ? `${(avgPrice / 1_000).toFixed(0)}K` : avgPrice.toLocaleString()) : '—'}
            </p>
            <p className="text-xs text-muted-foreground">Avg Supply Price</p>
          </div>
        </div>
      </div>

      {/* Map Card */}
      <div className="bg-card border rounded-xl overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b">
          <div className="flex items-center gap-2">
            <MapPin className="w-4 h-4 text-emerald-500" />
            <span className="font-semibold">Live Property Map</span>
            {isLoading && <span className="text-xs text-muted-foreground animate-pulse">Loading...</span>}
          </div>
          {/* Layer Tabs */}
          <div className="flex gap-1 bg-muted rounded-lg p-1">
            {(['both', 'supply', 'demand', 'heatmap'] as const).map(layer => (
              <button
                key={layer}
                onClick={() => setMapLayer(layer)}
                className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                  mapLayer === layer
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {layer === 'both' ? '🗺️ Both' : layer === 'supply' ? '🟢 Supply' : layer === 'demand' ? '🔵 Demand' : '🔥 Heatmap'}
              </button>
            ))}
          </div>
        </div>

        {/* Legend */}
        <div className="flex items-center gap-4 px-4 py-2 border-b bg-muted/30 text-xs text-muted-foreground">
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-full bg-emerald-500" />
            <span>Supply ({visibleSupplyPins.length} listings)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-full bg-blue-500" />
            <span>Demand ({visibleDemandPins.length} requests)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Eye className="w-3 h-3" />
            <span>Click any pin to view details</span>
          </div>
        </div>

        <div className="w-full h-[600px]">
          <MapView
            initialCenter={{ lat: 30.0800, lng: 31.5500 }}
            initialZoom={11}
            heatmapData={visibleHeatmap}
            supplyPins={visibleSupplyPins}
            demandPins={visibleDemandPins}
            onPinClick={handlePinClick}
          />
        </div>
      </div>

      {/* Supply vs Demand Chart */}
      <div className="bg-card border rounded-xl p-4">
        <div className="flex items-center gap-2 mb-4">
          <BarChart3 className="w-4 h-4 text-blue-500" />
          <span className="font-semibold">Supply vs Demand by Location</span>
          <Badge variant="outline" className="text-xs ml-auto">Top 10 locations</Badge>
        </div>
        {locationStats.length > 0 ? (
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={locationStats} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="location" stroke="hsl(var(--muted-foreground))" tick={{ fontSize: 11 }} />
              <YAxis stroke="hsl(var(--muted-foreground))" tick={{ fontSize: 11 }} />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'hsl(var(--card))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '8px',
                  color: 'hsl(var(--foreground))',
                }}
              />
              <Legend />
              <Bar dataKey="supply" fill="#10b981" name="Supply" radius={[3, 3, 0, 0]} />
              <Bar dataKey="demand" fill="#3b82f6" name="Demand" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-[280px] flex items-center justify-center text-muted-foreground text-sm">
            {isLoading ? 'Loading chart data...' : 'No location data available'}
          </div>
        )}
      </div>

      {/* Market Balance Table */}
      <div className="bg-card border rounded-xl p-4">
        <div className="flex items-center gap-2 mb-4">
          <TrendingUp className="w-4 h-4 text-purple-500" />
          <span className="font-semibold">Market Balance by Location</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-muted-foreground">
                <th className="text-left py-2 pr-4">Location</th>
                <th className="text-right py-2 pr-4">Supply</th>
                <th className="text-right py-2 pr-4">Demand</th>
                <th className="text-right py-2">Balance</th>
              </tr>
            </thead>
            <tbody>
              {locationStats.slice(0, 8).map((row) => {
                const ratio = row.demand > 0 ? row.supply / row.demand : 1;
                const balanced = ratio >= 0.8 && ratio <= 1.2;
                const oversupply = ratio > 1.2;
                return (
                  <tr key={row.location} className="border-b border-border/50 hover:bg-muted/30">
                    <td className="py-2 pr-4 font-medium">{row.location}</td>
                    <td className="text-right py-2 pr-4 text-emerald-500">{row.supply}</td>
                    <td className="text-right py-2 pr-4 text-blue-500">{row.demand}</td>
                    <td className="text-right py-2">
                      <Badge className={`text-xs ${
                        balanced ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' :
                        oversupply ? 'bg-amber-500/10 text-amber-500 border-amber-500/20' :
                        'bg-blue-500/10 text-blue-500 border-blue-500/20'
                      }`}>
                        {balanced ? '⚖️ Balanced' : oversupply ? '📈 Oversupply' : '📉 High Demand'}
                      </Badge>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Property Detail Popup */}
      {selectedItem && (
        <PropertyPopup
          item={selectedItem.item}
          type={selectedItem.type}
          onClose={() => setSelectedItem(null)}
        />
      )}
    </div>
  );
}
