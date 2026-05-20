import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  Building2, MapPin, DollarSign, Users, Plus, MessageSquare, Clock,
  Phone, RefreshCw, Trash2, CheckCircle2, Eye, Home,
  BedDouble, Bath, Ruler, Tag, Zap
} from "lucide-react";
import { toast } from "sonner";

// ─── Types ────────────────────────────────────────────────────────────────────
interface Asset {
  id: number;
  propertyType: string;
  location: string;
  area?: string;
  size?: number;
  bedrooms?: number;
  bathrooms?: number;
  price?: number;
  purpose: "sale" | "rent";
  rentalPeriod?: string;
  description?: string;
  contactPhone?: string;
  status: "active" | "sold" | "rented" | "inactive";
  matchCount: number;
  newMatchCount: number;
  createdAt: string;
}

interface AssetMatch {
  matchId: number;
  matchScore: number;
  matchReason: string;
  matchStatus: string;
  matchedAt: string;
  demandId: number;
  contact: string;
  contactName?: string;
  location: string;
  propertyType: string;
  bedrooms?: number;
  bathrooms?: number;
  priceMin?: number;
  priceMax?: number;
  size?: number;
  purpose?: string;
  rawMessageText?: string;
  sourceGroup?: string;
  requestDate: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function fmtPrice(v?: number) {
  if (!v || v === 0) return "—";
  if (v >= 1_000_000) return `EGP ${(v / 1_000_000).toFixed(2)}M`;
  if (v >= 1000) return `EGP ${(v / 1000).toFixed(0)}K`;
  return `EGP ${v}`;
}

function scoreColor(s: number) {
  return s >= 85 ? "bg-emerald-500" : s >= 70 ? "bg-blue-500" : "bg-amber-500";
}

// ─── Match Side Panel ─────────────────────────────────────────────────────────
function AssetMatchPanel({ asset, onClose }: { asset: Asset; onClose: () => void }) {
  const [statusFilter, setStatusFilter] = useState<"all" | "new" | "contacted" | "interested" | "closed">("all");

  const { data: matches, isLoading, refetch } = trpc.assets.getAssetMatches.useQuery(
    { assetId: asset.id, status: statusFilter, limit: 200 },
    { refetchInterval: 15_000 }
  );

  const updateStatus = trpc.assets.updateMatchStatus.useMutation({
    onSuccess: () => { refetch(); toast.success("Status updated"); },
  });

  const matchList = (matches as AssetMatch[] | undefined) ?? [];

  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="flex-1 bg-black/60" onClick={onClose} />
      <div className="w-full max-w-xl bg-[#0D1B2A] border-l border-[#C9A84C]/20 flex flex-col h-full">
        {/* Header */}
        <div className="p-5 border-b border-[#C9A84C]/20 flex items-start justify-between shrink-0">
          <div>
            <h2 className="text-[#C9A84C] font-bold text-lg">
              {asset.propertyType} — {asset.location}{asset.area ? ` · ${asset.area}` : ""}
            </h2>
            <p className="text-gray-400 text-sm mt-1">
              {asset.purpose === "sale" ? "For Sale" : "For Rent"}
              {asset.size ? ` · ${asset.size}m²` : ""}
              {asset.bedrooms ? ` · ${asset.bedrooms}BR` : ""}
              {asset.price ? ` · ${fmtPrice(asset.price)}` : ""}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Badge className="bg-[#C9A84C]/20 text-[#C9A84C] border-[#C9A84C]/30">
              {matchList.length} Leads
            </Badge>
            <Button variant="ghost" size="sm" onClick={onClose} className="text-gray-400 hover:text-white">✕</Button>
          </div>
        </div>

        {/* Status Filter */}
        <div className="px-5 py-3 border-b border-white/5 flex gap-2 flex-wrap shrink-0">
          {(["all", "new", "contacted", "interested", "closed"] as const).map(s => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-all ${
                statusFilter === s
                  ? "bg-[#C9A84C] text-[#0D1B2A]"
                  : "bg-white/5 text-gray-400 hover:bg-white/10"
              }`}
            >
              {s.charAt(0).toUpperCase() + s.slice(1)}
            </button>
          ))}
        </div>

        {/* Match List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {isLoading && (
            <div className="flex items-center justify-center py-12">
              <RefreshCw className="w-6 h-6 animate-spin text-[#C9A84C]" />
            </div>
          )}
          {!isLoading && matchList.length === 0 && (
            <div className="text-center py-12 text-gray-500">
              <Users className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p className="text-sm">No leads yet for this asset</p>
              <p className="text-xs mt-1 text-gray-600">New demand messages are matched automatically</p>
            </div>
          )}
          {matchList.map((m) => (
            <div key={m.matchId} className="bg-white/5 rounded-xl p-4 border border-white/5 hover:border-[#C9A84C]/20 transition-all">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className={`w-10 h-10 rounded-full ${scoreColor(m.matchScore)} flex items-center justify-center text-white font-bold text-sm shrink-0`}>
                    {Math.round(m.matchScore)}%
                  </div>
                  <div>
                    <p className="text-white font-semibold text-sm">{m.contactName || "Buyer / Renter"}</p>
                    <p className="text-[#C9A84C] text-xs font-mono">{m.contact || "—"}</p>
                  </div>
                </div>
                <Badge className={`text-xs shrink-0 ${
                  m.matchStatus === "new" ? "bg-blue-500/20 text-blue-400 border-blue-500/30" :
                  m.matchStatus === "contacted" ? "bg-amber-500/20 text-amber-400 border-amber-500/30" :
                  m.matchStatus === "interested" ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30" :
                  "bg-gray-500/20 text-gray-400 border-gray-500/30"
                }`}>
                  {m.matchStatus}
                </Badge>
              </div>

              <div className="grid grid-cols-3 gap-2 mb-3 text-xs">
                <div className="bg-white/5 rounded-lg p-2">
                  <p className="text-gray-500">Location</p>
                  <p className="text-white font-medium truncate">{m.location || "—"}</p>
                </div>
                <div className="bg-white/5 rounded-lg p-2">
                  <p className="text-gray-500">Budget</p>
                  <p className="text-white font-medium">{m.priceMax ? `≤ ${fmtPrice(m.priceMax)}` : "—"}</p>
                </div>
                <div className="bg-white/5 rounded-lg p-2">
                  <p className="text-gray-500">Specs</p>
                  <p className="text-white font-medium">{m.bedrooms ? `${m.bedrooms}BR` : "Any"} · {m.size ? `${m.size}m²` : "Any"}</p>
                </div>
              </div>

              {m.rawMessageText && (
                <p className="text-gray-400 text-xs bg-white/3 rounded-lg p-2 mb-3 line-clamp-2 italic">
                  "{m.rawMessageText.slice(0, 160)}{m.rawMessageText.length > 160 ? "…" : ""}"
                </p>
              )}

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1 text-gray-500 text-xs">
                  <Clock className="w-3 h-3" />
                  {new Date(m.requestDate).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}
                  {m.sourceGroup && <span className="ml-2 text-gray-600 truncate max-w-[120px]">· {m.sourceGroup}</span>}
                </div>
                <div className="flex gap-1">
                  {m.matchStatus === "new" && (
                    <Button size="sm" variant="outline"
                      className="h-6 text-xs px-2 border-amber-500/30 text-amber-400 hover:bg-amber-500/10"
                      onClick={() => updateStatus.mutate({ matchId: m.matchId, status: "contacted" })}>
                      <Phone className="w-3 h-3 mr-1" /> Contacted
                    </Button>
                  )}
                  {m.matchStatus === "contacted" && (
                    <Button size="sm" variant="outline"
                      className="h-6 text-xs px-2 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10"
                      onClick={() => updateStatus.mutate({ matchId: m.matchId, status: "interested" })}>
                      <CheckCircle2 className="w-3 h-3 mr-1" /> Interested
                    </Button>
                  )}
                  {m.matchStatus === "interested" && (
                    <Button size="sm" variant="outline"
                      className="h-6 text-xs px-2 border-blue-500/30 text-blue-400 hover:bg-blue-500/10"
                      onClick={() => updateStatus.mutate({ matchId: m.matchId, status: "closed" })}>
                      <CheckCircle2 className="w-3 h-3 mr-1" /> Closed
                    </Button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Add Asset Dialog ─────────────────────────────────────────────────────────
function AddAssetDialog({ open, onClose, onSuccess }: { open: boolean; onClose: () => void; onSuccess: () => void }) {
  const [form, setForm] = useState({
    propertyType: "", location: "", area: "", size: "",
    bedrooms: "", bathrooms: "", price: "",
    purpose: "sale" as "sale" | "rent",
    rentalPeriod: "monthly" as "monthly" | "yearly",
    description: "", contactPhone: "",
  });

  const createAsset = trpc.assets.createAsset.useMutation({
    onSuccess: (data: any) => {
      toast.success(`Asset added! ${data?.newMatches ? `${data.newMatches} matches found instantly.` : "Matching in progress..."}`);
      onSuccess();
      onClose();
      setForm({ propertyType: "", location: "", area: "", size: "", bedrooms: "", bathrooms: "", price: "", purpose: "sale", rentalPeriod: "monthly", description: "", contactPhone: "" });
    },
    onError: (e) => toast.error(e.message),
  });

  const f = (k: string, v: string) => setForm(p => ({ ...p, [k]: v }));

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="bg-[#0D1B2A] border-[#C9A84C]/30 text-white max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-[#C9A84C] flex items-center gap-2">
            <Plus className="w-5 h-5" /> Add My Asset
          </DialogTitle>
          <p className="text-gray-400 text-sm">The system will automatically match incoming demand messages to this asset in real-time</p>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-gray-300 text-xs mb-1 block">Property Type *</Label>
              <Select value={form.propertyType} onValueChange={v => f("propertyType", v)}>
                <SelectTrigger className="bg-white/5 border-white/10 text-white">
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent className="bg-[#0D1B2A] border-white/10">
                  {["Apartment", "Villa", "Townhouse", "Twin House", "Studio", "Duplex", "Penthouse", "Chalet", "Office", "Shop"].map(t => (
                    <SelectItem key={t} value={t} className="text-white">{t}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-gray-300 text-xs mb-1 block">Purpose *</Label>
              <Select value={form.purpose} onValueChange={v => f("purpose", v)}>
                <SelectTrigger className="bg-white/5 border-white/10 text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-[#0D1B2A] border-white/10">
                  <SelectItem value="sale" className="text-white">For Sale</SelectItem>
                  <SelectItem value="rent" className="text-white">For Rent</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-gray-300 text-xs mb-1 block">Compound / Location *</Label>
              <Input value={form.location} onChange={e => f("location", e.target.value)}
                placeholder="e.g. Privado, Madinaty, Dreamland"
                className="bg-white/5 border-white/10 text-white placeholder:text-gray-500" />
            </div>
            <div>
              <Label className="text-gray-300 text-xs mb-1 block">Area / Block / Group</Label>
              <Input value={form.area} onChange={e => f("area", e.target.value)}
                placeholder="e.g. Group 131, B7, Phase 2"
                className="bg-white/5 border-white/10 text-white placeholder:text-gray-500" />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label className="text-gray-300 text-xs mb-1 block">Size (m²)</Label>
              <Input type="number" value={form.size} onChange={e => f("size", e.target.value)}
                placeholder="116" className="bg-white/5 border-white/10 text-white placeholder:text-gray-500" />
            </div>
            <div>
              <Label className="text-gray-300 text-xs mb-1 block">Bedrooms</Label>
              <Input type="number" value={form.bedrooms} onChange={e => f("bedrooms", e.target.value)}
                placeholder="3" className="bg-white/5 border-white/10 text-white placeholder:text-gray-500" />
            </div>
            <div>
              <Label className="text-gray-300 text-xs mb-1 block">Bathrooms</Label>
              <Input type="number" value={form.bathrooms} onChange={e => f("bathrooms", e.target.value)}
                placeholder="2" className="bg-white/5 border-white/10 text-white placeholder:text-gray-500" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-gray-300 text-xs mb-1 block">
                {form.purpose === "rent" ? "Monthly Rent (EGP)" : "Asking Price (EGP)"}
              </Label>
              <Input type="number" value={form.price} onChange={e => f("price", e.target.value)}
                placeholder="5500000" className="bg-white/5 border-white/10 text-white placeholder:text-gray-500" />
            </div>
            {form.purpose === "rent" && (
              <div>
                <Label className="text-gray-300 text-xs mb-1 block">Rental Period</Label>
                <Select value={form.rentalPeriod} onValueChange={v => f("rentalPeriod", v)}>
                  <SelectTrigger className="bg-white/5 border-white/10 text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-[#0D1B2A] border-white/10">
                    <SelectItem value="monthly" className="text-white">Monthly</SelectItem>
                    <SelectItem value="yearly" className="text-white">Yearly</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          <div>
            <Label className="text-gray-300 text-xs mb-1 block">Your Phone (for match alerts)</Label>
            <Input value={form.contactPhone} onChange={e => f("contactPhone", e.target.value)}
              placeholder="+201066505665"
              className="bg-white/5 border-white/10 text-white placeholder:text-gray-500" />
          </div>

          <div>
            <Label className="text-gray-300 text-xs mb-1 block">Notes / Description</Label>
            <Textarea value={form.description} onChange={e => f("description", e.target.value)}
              placeholder="e.g. Ready to move, garden view, immediate delivery, fully finished..."
              className="bg-white/5 border-white/10 text-white placeholder:text-gray-500 resize-none" rows={3} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} className="border-white/10 text-gray-400 hover:bg-white/5">Cancel</Button>
          <Button
            onClick={() => createAsset.mutate({
              propertyType: form.propertyType,
              location: form.location,
              area: form.area || undefined,
              size: form.size ? parseInt(form.size) : undefined,
              bedrooms: form.bedrooms ? parseInt(form.bedrooms) : undefined,
              bathrooms: form.bathrooms ? parseInt(form.bathrooms) : undefined,
              price: form.price ? parseFloat(form.price) : undefined,
              purpose: form.purpose,
              rentalPeriod: form.purpose === "rent" ? form.rentalPeriod : undefined,
              description: form.description || undefined,
              contactPhone: form.contactPhone || undefined,
            })}
            disabled={!form.propertyType || !form.location || createAsset.isPending}
            className="bg-[#C9A84C] hover:bg-[#B8973B] text-[#0D1B2A] font-bold"
          >
            {createAsset.isPending ? (
              <><RefreshCw className="w-4 h-4 mr-2 animate-spin" /> Adding & Matching...</>
            ) : (
              <><Plus className="w-4 h-4 mr-2" /> Add Asset</>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Asset Card ───────────────────────────────────────────────────────────────
function AssetCard({ asset, onViewMatches, onDelete, onStatusChange }: {
  asset: Asset;
  onViewMatches: (a: Asset) => void;
  onDelete: (id: number) => void;
  onStatusChange: (id: number, status: string) => void;
}) {
  const statusColors: Record<string, string> = {
    active: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
    sold: "bg-blue-500/20 text-blue-400 border-blue-500/30",
    rented: "bg-purple-500/20 text-purple-400 border-purple-500/30",
    inactive: "bg-gray-500/20 text-gray-400 border-gray-500/30",
  };

  return (
    <Card className="bg-[#0D1B2A] border-[#C9A84C]/20 hover:border-[#C9A84C]/40 transition-all">
      <CardContent className="p-5">
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#C9A84C]/10 flex items-center justify-center shrink-0">
              <Home className="w-5 h-5 text-[#C9A84C]" />
            </div>
            <div>
              <h3 className="text-white font-semibold">{asset.propertyType}</h3>
              <p className="text-gray-400 text-sm flex items-center gap-1">
                <MapPin className="w-3 h-3" />
                {asset.location}{asset.area ? ` · ${asset.area}` : ""}
              </p>
            </div>
          </div>
          <div className="flex flex-col items-end gap-1">
            <Badge className={statusColors[asset.status] ?? statusColors.inactive}>
              {asset.status}
            </Badge>
            <Badge className={asset.purpose === "sale"
              ? "bg-amber-500/20 text-amber-400 border-amber-500/30"
              : "bg-teal-500/20 text-teal-400 border-teal-500/30"}>
              {asset.purpose === "sale" ? "For Sale" : "For Rent"}
            </Badge>
          </div>
        </div>

        {/* Specs */}
        <div className="grid grid-cols-4 gap-2 mb-4">
          {[
            { icon: DollarSign, label: "Price", value: fmtPrice(asset.price) },
            { icon: BedDouble, label: "Beds", value: asset.bedrooms ? `${asset.bedrooms} BR` : "—" },
            { icon: Bath, label: "Baths", value: asset.bathrooms ? `${asset.bathrooms} BA` : "—" },
            { icon: Ruler, label: "Size", value: asset.size ? `${asset.size}m²` : "—" },
          ].map(({ icon: Icon, label, value }) => (
            <div key={label} className="bg-white/5 rounded-lg p-2 text-center">
              <Icon className="w-3 h-3 text-[#C9A84C] mx-auto mb-1" />
              <p className="text-white text-xs font-semibold truncate">{value}</p>
              <p className="text-gray-500 text-xs">{label}</p>
            </div>
          ))}
        </div>

        {/* Match CTA */}
        <div
          className="flex items-center justify-between bg-[#C9A84C]/5 border border-[#C9A84C]/20 rounded-xl p-3 mb-4 cursor-pointer hover:bg-[#C9A84C]/10 transition-all"
          onClick={() => onViewMatches(asset)}
        >
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-[#C9A84C]" />
            <span className="text-white font-semibold text-sm">{asset.matchCount ?? 0} Matching Leads</span>
            {(asset.newMatchCount ?? 0) > 0 && (
              <span className="bg-red-500 text-white text-xs px-2 py-0.5 rounded-full animate-pulse">
                {asset.newMatchCount} NEW
              </span>
            )}
          </div>
          <Eye className="w-4 h-4 text-[#C9A84C]" />
        </div>

        {/* Description */}
        {asset.description && (
          <p className="text-gray-400 text-xs mb-4 line-clamp-2">{asset.description}</p>
        )}

        {/* Actions */}
        <div className="flex gap-2">
          <Button
            size="sm"
            className="flex-1 bg-[#C9A84C] hover:bg-[#B8973B] text-[#0D1B2A] font-semibold text-xs"
            onClick={() => onViewMatches(asset)}
          >
            <MessageSquare className="w-3 h-3 mr-1" /> View {asset.matchCount ?? 0} Leads
          </Button>
          {asset.status === "active" && (
            <Button size="sm" variant="outline"
              className="border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10 text-xs"
              onClick={() => onStatusChange(asset.id, asset.purpose === "sale" ? "sold" : "rented")}>
              <CheckCircle2 className="w-3 h-3 mr-1" />
              {asset.purpose === "sale" ? "Sold" : "Rented"}
            </Button>
          )}
          <Button size="sm" variant="outline"
            className="border-red-500/20 text-red-400 hover:bg-red-500/10"
            onClick={() => onDelete(asset.id)}>
            <Trash2 className="w-3 h-3" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function MyAssets() {
  const [addOpen, setAddOpen] = useState(false);
  const [selectedAsset, setSelectedAsset] = useState<Asset | null>(null);
  const [purposeFilter, setPurposeFilter] = useState<"all" | "sale" | "rent">("all");

  const { data: assets, isLoading, refetch } = trpc.assets.getUserAssets.useQuery(
    { purpose: purposeFilter },
    { refetchInterval: 30_000 }
  );

  const deleteAsset = trpc.assets.deleteAsset.useMutation({
    onSuccess: () => { toast.success("Asset removed"); refetch(); },
    onError: (e) => toast.error(e.message),
  });

  const updateAsset = trpc.assets.updateAsset.useMutation({
    onSuccess: () => { toast.success("Asset updated"); refetch(); },
    onError: (e) => toast.error(e.message),
  });

  const runMatching = trpc.assets.runMatching.useMutation({
    onSuccess: (data: any) => {
      toast.success(`Matching complete! ${data?.newMatches ?? 0} new leads found across ${data?.assetsProcessed ?? 0} assets.`);
      refetch();
    },
    onError: (e) => toast.error(e.message),
  });

  const assetList = (assets as Asset[] | undefined) ?? [];
  const totalMatches = assetList.reduce((s, a) => s + (a.matchCount ?? 0), 0);
  const newMatches = assetList.reduce((s, a) => s + (a.newMatchCount ?? 0), 0);
  const activeAssets = assetList.filter(a => a.status === "active").length;
  const saleAssets = assetList.filter(a => a.purpose === "sale").length;
  const rentAssets = assetList.filter(a => a.purpose === "rent").length;

  return (
    <div className="min-h-screen bg-[#060D16] text-white p-4 md:p-6">
      {/* Header */}
      <div className="flex items-start justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Building2 className="w-6 h-6 text-[#C9A84C]" /> My Assets
          </h1>
          <p className="text-gray-400 text-sm mt-1">
            Your properties — auto-matched against live WhatsApp demand in real-time
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline" size="sm"
            onClick={() => runMatching.mutate()}
            disabled={runMatching.isPending || assetList.length === 0}
            className="border-white/10 text-gray-300 hover:bg-white/5 text-xs"
          >
            {runMatching.isPending
              ? <RefreshCw className="w-3 h-3 mr-1 animate-spin" />
              : <Zap className="w-3 h-3 mr-1" />}
            Re-run Matching
          </Button>
          <Button
            onClick={() => setAddOpen(true)}
            className="bg-[#C9A84C] hover:bg-[#B8973B] text-[#0D1B2A] font-bold text-sm"
          >
            <Plus className="w-4 h-4 mr-1" /> Add Asset
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
        {[
          { label: "Total Assets", value: assetList.length, icon: Building2, color: "text-[#C9A84C]" },
          { label: "Active", value: activeAssets, icon: CheckCircle2, color: "text-emerald-400" },
          { label: "For Sale", value: saleAssets, icon: Tag, color: "text-amber-400" },
          { label: "For Rent", value: rentAssets, icon: Home, color: "text-teal-400" },
          { label: "Total Leads", value: totalMatches, icon: Users, color: "text-blue-400", badge: newMatches > 0 ? `${newMatches} new` : undefined },
        ].map(({ label, value, icon: Icon, color, badge }) => (
          <Card key={label} className="bg-[#0D1B2A] border-white/5">
            <CardContent className="p-4 flex items-center gap-3">
              <Icon className={`w-8 h-8 ${color} opacity-80 shrink-0`} />
              <div>
                <p className="text-white text-xl font-bold">{value}</p>
                <p className="text-gray-500 text-xs">{label}</p>
                {badge && <span className="text-xs text-red-400 font-semibold">{badge}</span>}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Purpose Filter */}
      <div className="flex gap-2 mb-5">
        {(["all", "sale", "rent"] as const).map(f => (
          <button key={f} onClick={() => setPurposeFilter(f)}
            className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all ${
              purposeFilter === f
                ? "bg-[#C9A84C] text-[#0D1B2A]"
                : "bg-white/5 text-gray-400 hover:bg-white/10"
            }`}>
            {f === "all" ? "All" : f === "sale" ? "For Sale" : "For Rent"}
          </button>
        ))}
      </div>

      {/* Assets Grid */}
      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <RefreshCw className="w-8 h-8 animate-spin text-[#C9A84C]" />
        </div>
      ) : assetList.length === 0 ? (
        <div className="text-center py-20">
          <Building2 className="w-16 h-16 mx-auto mb-4 text-gray-600" />
          <h3 className="text-white text-xl font-semibold mb-2">No assets yet</h3>
          <p className="text-gray-400 mb-6 max-w-md mx-auto text-sm">
            Add your properties and the system will automatically scan all incoming WhatsApp messages,
            alerting you the moment a matching buyer or renter appears.
          </p>
          <Button onClick={() => setAddOpen(true)}
            className="bg-[#C9A84C] hover:bg-[#B8973B] text-[#0D1B2A] font-bold">
            <Plus className="w-4 h-4 mr-2" /> Add Your First Asset
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {assetList.map(asset => (
            <AssetCard
              key={asset.id}
              asset={asset}
              onViewMatches={setSelectedAsset}
              onDelete={(id) => { if (confirm("Remove this asset?")) deleteAsset.mutate({ id }); }}
              onStatusChange={(id, status) => updateAsset.mutate({ id, status: status as any })}
            />
          ))}
        </div>
      )}

      {/* Add Dialog */}
      <AddAssetDialog open={addOpen} onClose={() => setAddOpen(false)} onSuccess={refetch} />

      {/* Match Side Panel */}
      {selectedAsset && (
        <AssetMatchPanel asset={selectedAsset} onClose={() => setSelectedAsset(null)} />
      )}
    </div>
  );
}
