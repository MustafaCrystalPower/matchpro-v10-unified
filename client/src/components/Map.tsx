/**
 * MAP COMPONENT - MatchPro Market Intelligence
 *
 * Features:
 * - Google Maps with Leaflet fallback
 * - Real-time heatmap for property density
 * - Supply (green) / Demand (blue) pins with click-to-view details
 * - onPinClick callback passes full property data to parent
 * - Optimised for 2000+ markers (batched rendering)
 */

import { useEffect, useRef, useState, useCallback } from "react";
import { cn } from "@/lib/utils";
import { AlertCircle, Loader2 } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

declare global {
  interface Window {
    google?: any;
    L?: any;
  }
}

interface PinData {
  lat: number;
  lng: number;
  title: string;
  type: "supply" | "demand";
  data?: any;
}

interface MapViewProps {
  className?: string;
  initialCenter?: { lat: number; lng: number };
  initialZoom?: number;
  onMapReady?: (map: any) => void;
  heatmapData?: Array<{ lat: number; lng: number; weight: number }>;
  supplyPins?: PinData[];
  demandPins?: PinData[];
  onPinClick?: (pin: PinData) => void;
}

const API_KEY = import.meta.env.VITE_FRONTEND_FORGE_API_KEY;
const FORGE_BASE_URL =
  import.meta.env.VITE_FRONTEND_FORGE_API_URL ||
  "https://forge.butterfly-effect.dev";
const MAPS_PROXY_URL = `${FORGE_BASE_URL}/v1/maps/proxy`;

// ── Script loaders ────────────────────────────────────────────────────────────
async function loadGoogleMapsScript(): Promise<boolean> {
  return new Promise((resolve) => {
    if (window.google?.maps) { resolve(true); return; }
    if (!API_KEY) { resolve(false); return; }
    const script = document.createElement("script");
    script.src = `${MAPS_PROXY_URL}/maps/api/js?key=${API_KEY}&v=weekly&libraries=marker,visualization`;
    script.async = true;
    script.crossOrigin = "anonymous";
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.head.appendChild(script);
    setTimeout(() => { if (!window.google?.maps) resolve(false); }, 6000);
  });
}

async function loadLeafletScript(): Promise<boolean> {
  return new Promise((resolve) => {
    if (window.L) { resolve(true); return; }
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css";
    document.head.appendChild(link);
    const script = document.createElement("script");
    script.src = "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js";
    script.async = true;
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.head.appendChild(script);
  });
}

// ── Marker SVG helpers ────────────────────────────────────────────────────────
function makeLeafletIcon(color: string, letter: string) {
  return `
    <div style="
      background:${color};border:2px solid rgba(255,255,255,0.8);
      border-radius:50%;width:22px;height:22px;
      display:flex;align-items:center;justify-content:center;
      font-weight:700;color:white;font-size:10px;
      box-shadow:0 1px 4px rgba(0,0,0,0.4);cursor:pointer;
    ">${letter}</div>
  `;
}

// ── Main Component ────────────────────────────────────────────────────────────
export function MapView({
  className,
  initialCenter = { lat: 30.0800, lng: 31.5500 },
  initialZoom = 11,
  onMapReady,
  heatmapData = [],
  supplyPins = [],
  demandPins = [],
  onPinClick,
}: MapViewProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const [mapType, setMapType] = useState<"google" | "leaflet" | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const heatmapLayerRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);
  const mapTypeRef = useRef<"google" | "leaflet" | null>(null);

  // ── Clear all markers ──────────────────────────────────────────────────────
  const clearMarkers = useCallback(() => {
    markersRef.current.forEach((m) => {
      if (m?.setMap) m.setMap(null);
      else if (m?.remove) m.remove();
      else if (mapRef.current && mapTypeRef.current === "leaflet" && m?.removeFrom) m.removeFrom(mapRef.current);
    });
    markersRef.current = [];
  }, []);

  // ── Render Leaflet pins ────────────────────────────────────────────────────
  const renderLeafletPins = useCallback((sPins: PinData[], dPins: PinData[]) => {
    if (!mapRef.current || !window.L?.Marker) return;
    clearMarkers();
    const map = mapRef.current;

    const addPin = (pin: PinData, color: string, letter: string) => {
      const icon = window.L.divIcon({
        html: makeLeafletIcon(color, letter),
        iconSize: [22, 22],
        className: "",
      });
      const marker = window.L.marker([pin.lat, pin.lng], { icon, title: pin.title });
      if (onPinClick) {
        marker.on("click", () => onPinClick(pin));
      }
      marker.bindPopup(`<div style="font-size:11px;max-width:180px"><b>${pin.type === "supply" ? "🟢 Supply" : "🔵 Demand"}</b><br/>${pin.title}</div>`);
      marker.addTo(map);
      markersRef.current.push(marker);
    };

    // Batch to avoid blocking UI
    const BATCH = 200;
    let idx = 0;
    const allPins: { pin: PinData; color: string; letter: string }[] = [
      ...sPins.map(p => ({ pin: p, color: "#10b981", letter: "S" })),
      ...dPins.map(p => ({ pin: p, color: "#3b82f6", letter: "D" })),
    ];
    const renderBatch = () => {
      const end = Math.min(idx + BATCH, allPins.length);
      for (; idx < end; idx++) {
        const { pin, color, letter } = allPins[idx];
        addPin(pin, color, letter);
      }
      if (idx < allPins.length) requestAnimationFrame(renderBatch);
    };
    requestAnimationFrame(renderBatch);
  }, [clearMarkers, onPinClick]);

  // ── Render Google Maps pins ────────────────────────────────────────────────
  const renderGooglePins = useCallback((sPins: PinData[], dPins: PinData[]) => {
    if (!mapRef.current || !window.google?.maps) return;
    clearMarkers();
    const map = mapRef.current;

    const addPin = (pin: PinData, color: string) => {
      const marker = new window.google.maps.Marker({
        map,
        position: { lat: pin.lat, lng: pin.lng },
        title: pin.title,
        icon: {
          path: window.google.maps.SymbolPath.CIRCLE,
          scale: 7,
          fillColor: color,
          fillOpacity: 0.9,
          strokeColor: "#ffffff",
          strokeWeight: 1.5,
        },
      });
      if (onPinClick) {
        marker.addListener("click", () => onPinClick(pin));
      }
      markersRef.current.push(marker);
    };

    const BATCH = 200;
    let sIdx = 0, dIdx = 0;
    const renderBatch = () => {
      const sEnd = Math.min(sIdx + BATCH, sPins.length);
      for (; sIdx < sEnd; sIdx++) addPin(sPins[sIdx], "#10b981");
      const dEnd = Math.min(dIdx + BATCH, dPins.length);
      for (; dIdx < dEnd; dIdx++) addPin(dPins[dIdx], "#3b82f6");
      if (sIdx < sPins.length || dIdx < dPins.length) requestAnimationFrame(renderBatch);
    };
    requestAnimationFrame(renderBatch);
  }, [clearMarkers, onPinClick]);

  // ── Render heatmap (Leaflet) ───────────────────────────────────────────────
  const renderLeafletHeatmap = useCallback((data: typeof heatmapData) => {
    if (!mapRef.current || !window.L || data.length === 0) return;
    const map = mapRef.current;
    if (heatmapLayerRef.current) { map.removeLayer(heatmapLayerRef.current); }
    const points = data.map(p => [p.lat, p.lng, p.weight || 1]);
    const doRender = () => {
      heatmapLayerRef.current = window.L.heat(points, { radius: 35, blur: 20, maxZoom: 17 }).addTo(map);
    };
    if (window.L.heat) { doRender(); return; }
    const s = document.createElement("script");
    s.src = "https://cdnjs.cloudflare.com/ajax/libs/leaflet-heat/0.2.0/leaflet-heat.js";
    s.onload = doRender;
    document.head.appendChild(s);
  }, []);

  // ── Render heatmap (Google) ────────────────────────────────────────────────
  const renderGoogleHeatmap = useCallback((data: typeof heatmapData) => {
    if (!mapRef.current || !window.google?.maps?.visualization?.HeatmapLayer || data.length === 0) return;
    if (heatmapLayerRef.current) heatmapLayerRef.current.setMap(null);
    const points = data.map(p => ({ location: new window.google.maps.LatLng(p.lat, p.lng), weight: p.weight || 1 }));
    heatmapLayerRef.current = new window.google.maps.visualization.HeatmapLayer({
      data: points, map: mapRef.current, radius: 35, opacity: 0.6,
    });
  }, []);

  // ── Init map ───────────────────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    const init = async () => {
      try {
        setLoading(true);
        setError(null);
        if (!mapContainer.current) throw new Error("Container missing");

        let useGoogle = false;
        if (API_KEY) useGoogle = await loadGoogleMapsScript();

        if (useGoogle && window.google?.maps) {
          mapRef.current = new window.google.maps.Map(mapContainer.current, {
            zoom: initialZoom,
            center: initialCenter,
            mapTypeControl: false,
            fullscreenControl: true,
            zoomControl: true,
            streetViewControl: false,
            styles: [{ featureType: "poi", stylers: [{ visibility: "off" }] }],
          });
          mapTypeRef.current = "google";
          setMapType("google");
          if (onMapReady) onMapReady(mapRef.current);
        } else {
          const ok = await loadLeafletScript();
          if (!ok || !window.L) throw new Error("Map libraries failed to load");
          mapRef.current = window.L.map(mapContainer.current).setView(
            [initialCenter.lat, initialCenter.lng], initialZoom
          );
          window.L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
            attribution: "© OpenStreetMap contributors", maxZoom: 19,
          }).addTo(mapRef.current);
          mapTypeRef.current = "leaflet";
          setMapType("leaflet");
          if (onMapReady) onMapReady(mapRef.current);
        }
        if (!cancelled) setLoading(false);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Map failed to load");
          setLoading(false);
        }
      }
    };
    init();
    return () => { cancelled = true; clearMarkers(); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Re-render pins when data or mapType changes ────────────────────────────
  useEffect(() => {
    if (!mapType || loading) return;
    if (mapType === "leaflet") {
      renderLeafletPins(supplyPins, demandPins);
      if (heatmapData.length > 0) renderLeafletHeatmap(heatmapData);
    } else {
      renderGooglePins(supplyPins, demandPins);
      if (heatmapData.length > 0) renderGoogleHeatmap(heatmapData);
    }
  }, [mapType, loading, supplyPins, demandPins, heatmapData, renderLeafletPins, renderGooglePins, renderLeafletHeatmap, renderGoogleHeatmap]);

  if (error) {
    return (
      <Alert variant="destructive" className={className}>
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>Map failed to load: {error}</AlertDescription>
      </Alert>
    );
  }

  return (
    <div className={cn("relative w-full h-full bg-slate-900", className)}>
      <div ref={mapContainer} className="w-full h-full" style={{ minHeight: 400 }} />
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-lg">
          <div className="flex flex-col items-center gap-2">
            <Loader2 className="h-8 w-8 animate-spin text-white" />
            <p className="text-white text-sm">Loading map…</p>
          </div>
        </div>
      )}
    </div>
  );
}
