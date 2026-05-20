import { useState, useEffect, useRef, useCallback } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, Flame, TrendingUp, DollarSign, Users, Map as MapIcon, Layers, Eye, EyeOff } from "lucide-react";
import { MapView } from "@/components/Map";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";

// Cairo district coordinates for heatmap (no geocoding API calls needed)
const CAIRO_DISTRICTS: Record<string, { lat: number; lng: number }> = {
  // ── English names ──────────────────────────────────────────────────
  "Maadi": { lat: 29.9602, lng: 31.2569 },
  "Heliopolis": { lat: 30.0911, lng: 31.3424 },
  "Nasr City": { lat: 30.0626, lng: 31.3400 },
  "New Cairo": { lat: 30.0300, lng: 31.4700 },
  "6th of October": { lat: 29.9285, lng: 30.9188 },
  "Zamalek": { lat: 30.0626, lng: 31.2197 },
  "Downtown Cairo": { lat: 30.0444, lng: 31.2357 },
  "Dokki": { lat: 30.0373, lng: 31.2122 },
  "Mohandessin": { lat: 30.0566, lng: 31.2012 },
  "Giza": { lat: 30.0131, lng: 31.2089 },
  "Shubra": { lat: 30.1139, lng: 31.2436 },
  "Ain Shams": { lat: 30.1139, lng: 31.3200 },
  "Shorouk": { lat: 30.1200, lng: 31.6100 },
  "Rehab": { lat: 30.0600, lng: 31.4900 },
  "Fifth Settlement": { lat: 29.9800, lng: 31.4600 },
  "Sheikh Zayed": { lat: 30.0100, lng: 30.9700 },
  "Tagamoa": { lat: 30.0300, lng: 31.4600 },
  // ── Compounds & new developments (English) ────────────────────────
  "Madinaty": { lat: 30.1200, lng: 31.6700 },
  "Mivida": { lat: 30.0100, lng: 31.4500 },
  "Hyde Park": { lat: 30.0000, lng: 31.4700 },
  "Katameya Heights": { lat: 29.9600, lng: 31.4200 },
  "Katameya": { lat: 29.9600, lng: 31.4200 },
  "Lake View": { lat: 30.0200, lng: 31.4600 },
  "Allegria": { lat: 30.0100, lng: 30.9600 },
  "SODIC West": { lat: 30.0100, lng: 30.9600 },
  "Fifth Square": { lat: 29.9700, lng: 31.4700 },
  "City Gate": { lat: 30.0400, lng: 31.5000 },
  "Privado": { lat: 30.0050, lng: 31.4800 },
  "Ali Park": { lat: 30.0050, lng: 31.4800 },
  "Casa": { lat: 30.0050, lng: 31.4800 },
  "North Coast": { lat: 31.0000, lng: 28.5000 },
  "Sahel": { lat: 31.0000, lng: 28.5000 },
  "Ain Sokhna": { lat: 29.5900, lng: 32.3500 },
  "New Administrative Capital": { lat: 30.0200, lng: 31.7500 },
  "Administrative Capital": { lat: 30.0200, lng: 31.7500 },
  "Mostakbal City": { lat: 30.1500, lng: 31.6800 },
  "Badr City": { lat: 30.1300, lng: 31.7400 },
  "10th of Ramadan": { lat: 30.2900, lng: 31.7400 },
  "B6": { lat: 30.1200, lng: 31.6700 },
  "B7": { lat: 30.1200, lng: 31.6700 },
  "B12": { lat: 30.1200, lng: 31.6700 },
  "B14": { lat: 30.1200, lng: 31.6700 },
  "B3": { lat: 30.1200, lng: 31.6700 },
  // ── Arabic names ──────────────────────────────────────────────────
  "مدينة نصر": { lat: 30.0626, lng: 31.3400 },
  "المعادي": { lat: 29.9602, lng: 31.2569 },
  "مصر الجديدة": { lat: 30.0911, lng: 31.3424 },
  "القاهرة الجديدة": { lat: 30.0300, lng: 31.4700 },
  "الزمالك": { lat: 30.0626, lng: 31.2197 },
  "الدقي": { lat: 30.0373, lng: 31.2122 },
  "المهندسين": { lat: 30.0566, lng: 31.2012 },
  "الجيزة": { lat: 30.0131, lng: 31.2089 },
  "الشيخ زايد": { lat: 30.0100, lng: 30.9700 },
  "التجمع": { lat: 30.0300, lng: 31.4600 },
  // ── Arabic compounds & new developments ───────────────────────────
  "مدينتي": { lat: 30.1200, lng: 31.6700 },
  "الرحاب": { lat: 30.0600, lng: 31.4900 },
  "التجمع الخامس": { lat: 29.9800, lng: 31.4600 },
  "الشروق": { lat: 30.1200, lng: 31.6100 },
  "المستقبل": { lat: 30.1500, lng: 31.6800 },
  "الساحل الشمالي": { lat: 31.0000, lng: 28.5000 },
  "الساحل": { lat: 31.0000, lng: 28.5000 },
  "العاصمة الادارية": { lat: 30.0200, lng: 31.7500 },
  "العاصمة الإدارية": { lat: 30.0200, lng: 31.7500 },
  "العاصمة": { lat: 30.0200, lng: 31.7500 },
  "العين السخنة": { lat: 29.5900, lng: 32.3500 },
  "بدر": { lat: 30.1300, lng: 31.7400 },
  "العاشر من رمضان": { lat: 30.2900, lng: 31.7400 },
  "6 اكتوبر": { lat: 29.9285, lng: 30.9188 },
  "أكتوبر": { lat: 29.9285, lng: 30.9188 },
  "بريفادو": { lat: 30.0050, lng: 31.4800 },
  "علي بارك": { lat: 30.0050, lng: 31.4800 },
  "كازا": { lat: 30.0050, lng: 31.4800 },
  "هايد بارك": { lat: 30.0000, lng: 31.4700 },
  "ليك فيو": { lat: 30.0200, lng: 31.4600 },
  "كاتميا": { lat: 29.9600, lng: 31.4200 },
  "أليجريا": { lat: 30.0100, lng: 30.9600 },
  "فيفث سكوير": { lat: 29.9700, lng: 31.4700 },
  "ميفيدا": { lat: 30.0100, lng: 31.4500 },
  "الحي السادس": { lat: 30.1200, lng: 31.6700 },
  "الحي الرابع": { lat: 30.1200, lng: 31.6700 },
  "الحي الثاني": { lat: 30.1200, lng: 31.6700 },
};

function getDistrictCoords(locationName: string): { lat: number; lng: number } | null {
  if (!locationName) return null;
  const normalized = locationName.trim();
  if (CAIRO_DISTRICTS[normalized]) return CAIRO_DISTRICTS[normalized];
  for (const [district, coords] of Object.entries(CAIRO_DISTRICTS)) {
    if (normalized.toLowerCase().includes(district.toLowerCase()) ||
        district.toLowerCase().includes(normalized.toLowerCase())) {
      return coords;
    }
  }
  return null;
}

interface HotZone {
  id: number;
  location: string;
  totalSupply: number;
  totalDemand: number;
  avgSupplyPrice: number | null;
  avgDemandBudget: number | null;
  marketTemperature: "hot" | "warm" | "cool" | "cold";
  investmentScore: number;
}

export default function HotZones() {
  const [zones, setZones] = useState<HotZone[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const mapRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);
  const heatmapMatchRef = useRef<any>(null);
  const heatmapSupplyRef = useRef<any>(null);
  const heatmapDemandRef = useRef<any>(null);

  // Layer visibility controls
  const [showMarkers, setShowMarkers] = useState(true);
  const [showMatchHeatmap, setShowMatchHeatmap] = useState(true);
  const [showSupplyHeatmap, setShowSupplyHeatmap] = useState(false);
  const [showDemandHeatmap, setShowDemandHeatmap] = useState(false);
  const [heatmapRadius, setHeatmapRadius] = useState([30]);
  const [heatmapOpacity, setHeatmapOpacity] = useState([70]);

  const { data: hotZonesData, isLoading: isLoadingZones } = trpc.marketIntel.getMapData.useQuery(
    {},
    { refetchInterval: 60000 } // Refresh every 60 seconds
  );

  // Fetch supply, demand, and match data for heatmap
  const { data: supplyData } = trpc.supply.recent.useQuery({ limit: 500 });
  const { data: demandData } = trpc.demand.recent.useQuery({ limit: 500 });
  const { data: matchesData } = trpc.matches.recent.useQuery({ limit: 500 });

  useEffect(() => {
    if (hotZonesData?.locations) {
      setZones((hotZonesData.locations as any) || []);
      setIsLoading(false);
    }
  }, [hotZonesData]);

  // Layer toggle effects
  useEffect(() => {
    if (heatmapMatchRef.current) heatmapMatchRef.current.setMap(showMatchHeatmap && mapRef.current ? mapRef.current : null);
  }, [showMatchHeatmap]);

  useEffect(() => {
    if (heatmapSupplyRef.current) heatmapSupplyRef.current.setMap(showSupplyHeatmap && mapRef.current ? mapRef.current : null);
  }, [showSupplyHeatmap]);

  useEffect(() => {
    if (heatmapDemandRef.current) heatmapDemandRef.current.setMap(showDemandHeatmap && mapRef.current ? mapRef.current : null);
  }, [showDemandHeatmap]);

  useEffect(() => {
    const r = heatmapRadius[0];
    heatmapMatchRef.current?.set("radius", r);
    heatmapSupplyRef.current?.set("radius", r);
    heatmapDemandRef.current?.set("radius", r);
  }, [heatmapRadius]);

  useEffect(() => {
    const o = heatmapOpacity[0] / 100;
    heatmapMatchRef.current?.set("opacity", o);
    heatmapSupplyRef.current?.set("opacity", o);
    heatmapDemandRef.current?.set("opacity", o);
  }, [heatmapOpacity]);

  useEffect(() => {
    markersRef.current.forEach(m => { m.map = showMarkers && mapRef.current ? mapRef.current : null; });
  }, [showMarkers]);

  const handleMapReady = useCallback(async (map: any) => {
    mapRef.current = map;
    map.setCenter({ lat: 30.0444, lng: 31.2357 });
    map.setZoom(11);

    // Clear existing markers
    markersRef.current.forEach(marker => { marker.map = null; });
    markersRef.current = [];

    // ── BUILD HEATMAP DATA ──────────────────────────────────────────

    // 1. Match density heatmap (investment opportunity hotspots)
    const matchHeatmapData: any[] = [];
    if (matchesData && matchesData.length > 0) {
      const locationMatchScore = new Map<string, number>();
      matchesData.forEach((m: any) => {
        const loc = (m.supplyLocation || m.location || "").trim();
        if (loc) {
          const score = Number(m.matchScore || m.confidenceScore || 50);
          locationMatchScore.set(loc, (locationMatchScore.get(loc) || 0) + score);
        }
      });
      for (const [location, weight] of Array.from(locationMatchScore.entries())) {
        const coords = getDistrictCoords(location);
        if (coords) {
          const intensity = Math.min(Math.ceil(weight / 10), 20);
          for (let i = 0; i < intensity; i++) {
            matchHeatmapData.push({
              location: new (window as any).google.maps.LatLng(
                coords.lat + (Math.random() - 0.5) * 0.02,
                coords.lng + (Math.random() - 0.5) * 0.02
              ),
              weight: weight / 100,
            });
          }
        }
      }
    }
    // Seed with hot zones investment scores
    if (hotZonesData && Array.isArray(hotZonesData)) {
      for (const zone of (hotZonesData as any)) {
        const coords = getDistrictCoords(zone.location);
        if (coords) {
          const weight = zone.investmentScore / 10;
          for (let i = 0; i < 5; i++) {
            matchHeatmapData.push({
              location: new (window as any).google.maps.LatLng(
                coords.lat + (Math.random() - 0.5) * 0.015,
                coords.lng + (Math.random() - 0.5) * 0.015
              ),
              weight,
            });
          }
        }
      }
    }

    // 2. Supply heatmap
    const supplyHeatmapData: any[] = [];
    if (supplyData && supplyData.length > 0) {
      const supplyByLoc = new Map<string, number>();
      supplyData.forEach((s: any) => {
        const loc = (s.location || s.area || "").trim();
        if (loc) supplyByLoc.set(loc, (supplyByLoc.get(loc) || 0) + 1);
      });
      for (const [location, count] of Array.from(supplyByLoc.entries())) {
        const coords = getDistrictCoords(location);
        if (coords) {
          for (let i = 0; i < Math.min(count, 15); i++) {
            supplyHeatmapData.push({
              location: new (window as any).google.maps.LatLng(
                coords.lat + (Math.random() - 0.5) * 0.02,
                coords.lng + (Math.random() - 0.5) * 0.02
              ),
              weight: count / 5,
            });
          }
        }
      }
    }

    // 3. Demand heatmap
    const demandHeatmapData: any[] = [];
    if (demandData && demandData.length > 0) {
      const demandByLoc = new Map<string, number>();
      demandData.forEach((d: any) => {
        const loc = (d.location || d.area || "").trim();
        if (loc) demandByLoc.set(loc, (demandByLoc.get(loc) || 0) + 1);
      });
      for (const [location, count] of Array.from(demandByLoc.entries())) {
        const coords = getDistrictCoords(location);
        if (coords) {
          for (let i = 0; i < Math.min(count, 15); i++) {
            demandHeatmapData.push({
              location: new (window as any).google.maps.LatLng(
                coords.lat + (Math.random() - 0.5) * 0.02,
                coords.lng + (Math.random() - 0.5) * 0.02
              ),
              weight: count / 5,
            });
          }
        }
      }
    }

    // ── CREATE HEATMAP LAYERS ──────────────────────────────────────

    heatmapMatchRef.current = new (window as any).google.maps.visualization.HeatmapLayer({
      map: showMatchHeatmap ? map : null,
      data: matchHeatmapData.length > 0 ? matchHeatmapData : [
        { location: new (window as any).google.maps.LatLng(30.0300, 31.4700), weight: 10 },
        { location: new (window as any).google.maps.LatLng(29.9602, 31.2569), weight: 8 },
        { location: new (window as any).google.maps.LatLng(30.0911, 31.3424), weight: 7 },
        { location: new (window as any).google.maps.LatLng(30.0626, 31.3400), weight: 6 },
        { location: new (window as any).google.maps.LatLng(29.9285, 30.9188), weight: 5 },
      ],
      radius: heatmapRadius[0],
      opacity: heatmapOpacity[0] / 100,
      gradient: [
        "rgba(0, 0, 255, 0)",
        "rgba(0, 128, 255, 0.5)",
        "rgba(0, 255, 128, 0.7)",
        "rgba(255, 255, 0, 0.8)",
        "rgba(255, 128, 0, 0.9)",
        "rgba(255, 0, 0, 1)",
      ],
    });

    heatmapSupplyRef.current = new (window as any).google.maps.visualization.HeatmapLayer({
      map: showSupplyHeatmap ? map : null,
      data: supplyHeatmapData,
      radius: heatmapRadius[0],
      opacity: heatmapOpacity[0] / 100,
      gradient: [
        "rgba(0, 0, 255, 0)",
        "rgba(0, 100, 255, 0.4)",
        "rgba(0, 180, 255, 0.7)",
        "rgba(100, 220, 255, 0.9)",
        "rgba(200, 240, 255, 1)",
      ],
    });

    heatmapDemandRef.current = new (window as any).google.maps.visualization.HeatmapLayer({
      map: showDemandHeatmap ? map : null,
      data: demandHeatmapData,
      radius: heatmapRadius[0],
      opacity: heatmapOpacity[0] / 100,
      gradient: [
        "rgba(255, 0, 0, 0)",
        "rgba(255, 50, 0, 0.4)",
        "rgba(255, 120, 0, 0.7)",
        "rgba(255, 200, 0, 0.9)",
        "rgba(255, 240, 100, 1)",
      ],
    });

    // ── ADD DISTRICT MARKERS (pre-built coords, no geocoding API calls) ──
    if (showMarkers) {
      // Supply markers (blue)
      if (supplyData && supplyData.length > 0) {
        const supplyLocations = new Map<string, number>();
        supplyData.forEach((item: any) => {
          const loc = item.location || item.area || "Unknown";
          supplyLocations.set(loc, (supplyLocations.get(loc) || 0) + 1);
        });
        const topSupply = Array.from(supplyLocations.entries()).sort((a, b) => b[1] - a[1]).slice(0, 20);
        for (const [location, count] of topSupply) {
          const coords = getDistrictCoords(location);
          if (coords) {
            const marker = new (window as any).google.maps.marker.AdvancedMarkerElement({ map, position: coords, title: `Supply: ${location} (${count})` });
            const el = document.createElement("div");
            el.style.cssText = "display:flex;align-items:center;justify-content:center;width:32px;height:32px;background:#2563eb;border-radius:50%;border:2px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.4);color:white;font-weight:bold;font-size:11px;cursor:pointer;";
            el.textContent = count.toString();
            marker.content = el;
            const iw = new (window as any).google.maps.InfoWindow({ content: `<div style="padding:8px"><b style="color:#2563eb">Supply: ${location}</b><br/><span style="font-size:12px">${count} properties</span></div>` });
            marker.addListener("click", () => iw.open(map, marker));
            markersRef.current.push(marker);
          }
        }
      }
      // Demand markers (red)
      if (demandData && demandData.length > 0) {
        const demandLocations = new Map<string, number>();
        demandData.forEach((item: any) => {
          const loc = item.location || item.area || "Unknown";
          demandLocations.set(loc, (demandLocations.get(loc) || 0) + 1);
        });
        const topDemand = Array.from(demandLocations.entries()).sort((a, b) => b[1] - a[1]).slice(0, 20);
        for (const [location, count] of topDemand) {
          const coords = getDistrictCoords(location);
          if (coords) {
            const marker = new (window as any).google.maps.marker.AdvancedMarkerElement({ map, position: { lat: coords.lat - 0.003, lng: coords.lng + 0.003 }, title: `Demand: ${location} (${count})` });
            const el = document.createElement("div");
            el.style.cssText = "display:flex;align-items:center;justify-content:center;width:32px;height:32px;background:#dc2626;border-radius:50%;border:2px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.4);color:white;font-weight:bold;font-size:11px;cursor:pointer;";
            el.textContent = count.toString();
            marker.content = el;
            const iw = new (window as any).google.maps.InfoWindow({ content: `<div style="padding:8px"><b style="color:#dc2626">Demand: ${location}</b><br/><span style="font-size:12px">${count} seekers</span></div>` });
            marker.addListener("click", () => iw.open(map, marker));
            markersRef.current.push(marker);
          }
        }
      }
      // Hot zone score markers (colored squares)
      if (hotZonesData && (hotZonesData as any).locations && (hotZonesData as any).locations.length > 0) {
        for (const zone of ((hotZonesData as any).locations || [])) {
          if (zone.investmentScore >= 60) {
            const coords = getDistrictCoords(zone.location);
            if (coords) {
              const marker = new (window as any).google.maps.marker.AdvancedMarkerElement({ map, position: { lat: coords.lat + 0.005, lng: coords.lng + 0.005 }, title: `Hot Zone: ${zone.location} (${zone.investmentScore})` });
              const tempColor = zone.marketTemperature === "hot" ? "#ef4444" : zone.marketTemperature === "warm" ? "#f97316" : zone.marketTemperature === "cool" ? "#3b82f6" : "#06b6d4";
              const el = document.createElement("div");
              el.style.cssText = `display:flex;align-items:center;justify-content:center;width:36px;height:36px;background:${tempColor};border-radius:8px;border:2px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.5);color:white;font-weight:bold;font-size:12px;cursor:pointer;`;
              el.textContent = zone.investmentScore.toString();
              marker.content = el;
              const iw = new (window as any).google.maps.InfoWindow({ content: `<div style="padding:10px;min-width:180px"><b style="font-size:14px">${zone.location}</b><br/><span style="font-size:12px">Score: ${zone.investmentScore} | ${zone.marketTemperature.toUpperCase()}</span><br/><span style="font-size:12px">Supply: ${zone.totalSupply} | Demand: ${zone.totalDemand}</span></div>` });
              marker.addListener("click", () => iw.open(map, marker));
              markersRef.current.push(marker);
            }
          }
        }
      }
    }
  }, [supplyData, demandData, matchesData, hotZonesData]);
  const getTemperatureBadge = (temp: string) => {
    switch (temp) {
      case "hot":
        return <Badge className="bg-red-600 animate-pulse">🔥 Hot</Badge>;
      case "warm":
        return <Badge className="bg-orange-500">🌡️ Warm</Badge>;
      case "cool":
        return <Badge className="bg-blue-500">❄️ Cool</Badge>;
      case "cold":
        return <Badge className="bg-cyan-600">🧊 Cold</Badge>;
      default:
        return <Badge variant="outline">Unknown</Badge>;
    }
  };

  const getInvestmentColor = (score: number) => {
    if (score >= 80) return "text-green-600";
    if (score >= 60) return "text-yellow-600";
    if (score >= 40) return "text-orange-600";
    return "text-red-600";
  };

  const formatPrice = (price: number | null) => {
    if (!price) return "N/A";
    return `${(price / 1000000).toFixed(1)}M EGP`;
  };

  const totalHotZones = zones.filter(z => z.marketTemperature === "hot" || z.marketTemperature === "warm").length;
  const avgInvestmentScore = zones.length > 0 ? Math.round(zones.reduce((sum, z) => sum + z.investmentScore, 0) / zones.length) : 0;

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-3xl font-bold">Hot Zones Map</h1>
        <p className="text-muted-foreground mt-1">Real-time heatmap of match density and investment opportunity hotspots across Cairo</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2"><Flame className="h-4 w-4 text-red-500" /> Hot Zones</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold text-red-600">{totalHotZones}</div></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2"><TrendingUp className="h-4 w-4 text-green-500" /> Avg Score</CardTitle></CardHeader><CardContent><div className={`text-2xl font-bold ${getInvestmentColor(avgInvestmentScore)}`}>{avgInvestmentScore}</div></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2"><Users className="h-4 w-4 text-blue-500" /> Supply</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold text-blue-600">{supplyData?.length || 0}</div></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2"><DollarSign className="h-4 w-4 text-red-500" /> Demand</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold text-red-600">{demandData?.length || 0}</div></CardContent></Card>
      </div>

      <Tabs defaultValue="map" className="w-full">
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="map"><MapIcon className="h-4 w-4 mr-2" />Map View</TabsTrigger>
          <TabsTrigger value="table"><Flame className="h-4 w-4 mr-2" />Table View</TabsTrigger>
        </TabsList>

        <TabsContent value="map" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
            {/* Layer Controls Panel */}
            <Card className="lg:col-span-1">
              <CardHeader><CardTitle className="text-sm flex items-center gap-2"><Layers className="h-4 w-4" /> Layer Controls</CardTitle></CardHeader>
              <CardContent className="space-y-5">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="match-heatmap" className="text-sm font-medium flex items-center gap-2">
                      <span className="w-3 h-3 rounded-full bg-gradient-to-r from-blue-500 to-red-500 inline-block"></span>Match Density
                    </Label>
                    <Switch id="match-heatmap" checked={showMatchHeatmap} onCheckedChange={setShowMatchHeatmap} />
                  </div>
                  <p className="text-xs text-muted-foreground">Investment opportunity hotspots</p>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="supply-heatmap" className="text-sm font-medium flex items-center gap-2">
                      <span className="w-3 h-3 rounded-full bg-blue-500 inline-block"></span>Supply Heat
                    </Label>
                    <Switch id="supply-heatmap" checked={showSupplyHeatmap} onCheckedChange={setShowSupplyHeatmap} />
                  </div>
                  <p className="text-xs text-muted-foreground">Property availability zones</p>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="demand-heatmap" className="text-sm font-medium flex items-center gap-2">
                      <span className="w-3 h-3 rounded-full bg-red-500 inline-block"></span>Demand Heat
                    </Label>
                    <Switch id="demand-heatmap" checked={showDemandHeatmap} onCheckedChange={setShowDemandHeatmap} />
                  </div>
                  <p className="text-xs text-muted-foreground">Buyer/renter demand zones</p>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="markers" className="text-sm font-medium flex items-center gap-2">
                      {showMarkers ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}Markers
                    </Label>
                    <Switch id="markers" checked={showMarkers} onCheckedChange={setShowMarkers} />
                  </div>
                  <p className="text-xs text-muted-foreground">Supply/demand/hot zone pins</p>
                </div>
                <div className="border-t pt-4 space-y-4">
                  <div className="space-y-2">
                    <Label className="text-xs font-medium text-muted-foreground">Heatmap Radius: {heatmapRadius[0]}px</Label>
                    <Slider value={heatmapRadius} onValueChange={setHeatmapRadius} min={10} max={80} step={5} className="w-full" />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs font-medium text-muted-foreground">Opacity: {heatmapOpacity[0]}%</Label>
                    <Slider value={heatmapOpacity} onValueChange={setHeatmapOpacity} min={20} max={100} step={5} className="w-full" />
                  </div>
                </div>
                <div className="border-t pt-4 space-y-2">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Legend</p>
                  <div className="space-y-1.5 text-xs">
                    <div className="flex items-center gap-2"><div className="w-12 h-2 rounded" style={{ background: "linear-gradient(to right, blue, yellow, red)" }}></div><span>Match intensity</span></div>
                    <div className="flex items-center gap-2"><div className="w-4 h-4 bg-blue-600 rounded-full border border-white"></div><span>Supply count</span></div>
                    <div className="flex items-center gap-2"><div className="w-4 h-4 bg-red-600 rounded-full border border-white"></div><span>Demand count</span></div>
                    <div className="flex items-center gap-2"><div className="w-4 h-4 bg-orange-500 rounded border border-white"></div><span>Hot zone score</span></div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Map */}
            <Card className="lg:col-span-3">
              <CardHeader>
                <CardTitle>Investment Opportunity Heatmap</CardTitle>
                <CardDescription>Brighter red = higher match density = stronger investment opportunity</CardDescription>
              </CardHeader>
              <CardContent>
                <MapView className="w-full h-[600px] rounded-lg" initialCenter={{ lat: 30.0444, lng: 31.2357 }} initialZoom={11} onMapReady={handleMapReady} />
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="table" className="space-y-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {zones.map((zone) => (
                <Card key={zone.id} className="hover:shadow-lg transition-shadow">
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div>
                        <CardTitle className="text-lg">{zone.location}</CardTitle>
                        <CardDescription className="mt-1">{getTemperatureBadge(zone.marketTemperature)}</CardDescription>
                      </div>
                      <div className={`text-2xl font-bold ${getInvestmentColor(zone.investmentScore)}`}>{zone.investmentScore}</div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground flex items-center gap-1"><Users className="h-4 w-4 text-blue-600" />Supply</span>
                      <span className="font-semibold">{zone.totalSupply}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground flex items-center gap-1"><TrendingUp className="h-4 w-4 text-red-600" />Demand</span>
                      <span className="font-semibold">{zone.totalDemand}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground flex items-center gap-1"><DollarSign className="h-4 w-4 text-green-600" />Avg Price</span>
                      <span className="font-semibold">{formatPrice(zone.avgSupplyPrice)}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground flex items-center gap-1"><DollarSign className="h-4 w-4 text-orange-600" />Avg Budget</span>
                      <span className="font-semibold">{formatPrice(zone.avgDemandBudget)}</span>
                    </div>
                    <div className="space-y-1">
                      <div className="flex justify-between text-xs text-muted-foreground"><span>Investment Score</span><span>{zone.investmentScore}/100</span></div>
                      <div className="w-full bg-secondary rounded-full h-2">
                        <div className={`h-2 rounded-full transition-all ${zone.investmentScore >= 80 ? "bg-red-500" : zone.investmentScore >= 60 ? "bg-orange-500" : zone.investmentScore >= 40 ? "bg-yellow-500" : "bg-blue-500"}`} style={{ width: `${zone.investmentScore}%` }} />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
