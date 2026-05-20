import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Search, RefreshCw, Download, MessageSquare, Phone, MapPin,
  BedDouble, Ruler, DollarSign, Users, Target, TrendingUp, Plus
} from "lucide-react";
import * as XLSX from "xlsx";
import { toast } from "sonner";

export function BuyerRequests() {
  const { data: allDemand = [], refetch } = trpc.demand.recent.useQuery({ limit: 2000 });
  const { data: allMatches = [] } = trpc.matches.recent.useQuery({ limit: 500 });

  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [listingFilter, setListingFilter] = useState("all");
  const [tierFilter, setTierFilter] = useState<"all" | "A" | "B" | "C">("all");
  const [isExporting, setIsExporting] = useState(false);

  // Count matches per demand item
  const matchCountByDemand = useMemo(() => {
    const counts: Record<number, number> = {};
    (allMatches as any[]).forEach((m: any) => {
      if (m.demandId) counts[m.demandId] = (counts[m.demandId] || 0) + 1;
    });
    return counts;
  }, [allMatches]);

  // Filter demand
  const filteredDemand = useMemo(() => {
    let items = [...(allDemand as any[])];

    if (searchTerm) {
      const t = searchTerm.toLowerCase();
      items = items.filter(d =>
        d.contactName?.toLowerCase().includes(t) ||
        d.location?.toLowerCase().includes(t) ||
        d.propertyType?.toLowerCase().includes(t) ||
        d.contact?.includes(t)
      );
    }

    if (typeFilter !== "all") {
      items = items.filter(d => d.propertyType?.toLowerCase() === typeFilter);
    }

    if (listingFilter === "buy") {
      items = items.filter(d => d.purpose?.toLowerCase() === "buy" || d.purpose?.toLowerCase() === "sale");
    } else if (listingFilter === "rent") {
      items = items.filter(d => d.purpose?.toLowerCase() === "rent");
    }

    if (tierFilter !== "all") {
      items = items.filter(d => {
        const score = d.buyerIntentScore ?? 0;
        const tier = d.buyerTier;
        if (tierFilter === "A") return tier === "A" || score >= 70;
        if (tierFilter === "B") return tier === "B" || (score >= 40 && score < 70);
        if (tierFilter === "C") return tier === "C" || score < 40;
        return true;
      });
    }

    if (statusFilter === "matched") {
      items = items.filter(d => (matchCountByDemand[d.id] || 0) > 0);
    } else if (statusFilter === "active") {
      items = items.filter(d => (matchCountByDemand[d.id] || 0) === 0);
    }

    return items;
  }, [allDemand, searchTerm, typeFilter, listingFilter, statusFilter, tierFilter, matchCountByDemand]);

  const matchedCount = (allDemand as any[]).filter(d => (matchCountByDemand[d.id] || 0) > 0).length;
  const activeCount = (allDemand as any[]).filter(d => (matchCountByDemand[d.id] || 0) === 0).length;

  const handleRefresh = () => {
    refetch();
    toast.success("Buyer requests refreshed");
  };

  const handleExport = async () => {
    setIsExporting(true);
    try {
      const data = filteredDemand.map((d: any) => ({
        Customer: d.contactName || "N/A",
        Phone: d.contact || "N/A",
        "Property Type": d.propertyType || "N/A",
        "Buy or Rent": d.purpose?.toUpperCase() || "BUY",
        Location: d.location || "N/A",
        City: d.city || "N/A",
        "Budget Min (EGP)": d.priceMin ? Number(d.priceMin).toLocaleString() : "N/A",
        "Budget Max (EGP)": d.priceMax ? Number(d.priceMax).toLocaleString() : "N/A",
        Bedrooms: d.bedrooms || "N/A",
        "Area (sqm)": d.size || "N/A",
        Matches: matchCountByDemand[d.id] || 0,
        Status: (matchCountByDemand[d.id] || 0) > 0 ? "Matched" : "Active",
        Source: d.groupName || "WhatsApp",
        Date: d.createdAt ? new Date(d.createdAt).toLocaleDateString() : "N/A",
        "Original Message": d.rawMessage ? d.rawMessage.substring(0, 200) : "N/A",
      }));
      const ws = XLSX.utils.json_to_sheet(data);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Buyer Requests");
      XLSX.writeFile(wb, `matchpro-buyer-requests-${new Date().toISOString().split("T")[0]}.xlsx`);
      toast.success(`Exported ${data.length} buyer requests`);
    } catch {
      toast.error("Export failed");
    } finally {
      setIsExporting(false);
    }
  };

  const formatBudget = (min: any, max: any) => {
    const fmtM = (v: any) => {
      const n = Number(v);
      if (!n) return null;
      if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
      if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
      return n.toString();
    };
    const minStr = fmtM(min);
    const maxStr = fmtM(max);
    if (minStr && maxStr) return `${minStr} – ${maxStr}`;
    if (maxStr) return `Up to ${maxStr}`;
    if (minStr) return `From ${minStr}`;
    return "—";
  };

  return (
    <div className="space-y-0">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Buyer Requests</h1>
          <p className="text-sm text-muted-foreground">MatchPro™ / Requests</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleRefresh} className="gap-1.5">
            <RefreshCw className="w-3.5 h-3.5" /> Refresh
          </Button>
          <Button
            size="sm"
            className="gap-1.5 bg-green-600 hover:bg-green-700 text-white"
            onClick={() => toast.info("Add Request — coming soon")}
          >
            <Plus className="w-3.5 h-3.5" /> Add Request
          </Button>
        </div>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-card border rounded-xl p-4 flex items-center gap-3">
          <div className="p-2 rounded-lg bg-blue-500/10">
            <Users className="w-5 h-5 text-blue-500" />
          </div>
          <div>
            <p className="text-2xl font-bold">{(allDemand as any[]).length}</p>
            <p className="text-xs text-muted-foreground">Total Requests</p>
          </div>
        </div>
        <div className="bg-card border rounded-xl p-4 flex items-center gap-3">
          <div className="p-2 rounded-lg bg-green-500/10">
            <TrendingUp className="w-5 h-5 text-green-500" />
          </div>
          <div>
            <p className="text-2xl font-bold text-green-500">{activeCount}</p>
            <p className="text-xs text-muted-foreground">Active</p>
          </div>
        </div>
        <div className="bg-card border rounded-xl p-4 flex items-center gap-3">
          <div className="p-2 rounded-lg bg-purple-500/10">
            <Target className="w-5 h-5 text-purple-500" />
          </div>
          <div>
            <p className="text-2xl font-bold text-purple-500">{matchedCount}</p>
            <p className="text-xs text-muted-foreground">Matched</p>
          </div>
        </div>
        <div className="bg-card border rounded-xl p-4 flex items-center gap-3">
          <div className="p-2 rounded-lg bg-amber-500/10">
            <DollarSign className="w-5 h-5 text-amber-500" />
          </div>
          <div>
            <p className="text-2xl font-bold text-amber-500">
              {(allDemand as any[]).length > 0
                ? Math.round((matchedCount / (allDemand as any[]).length) * 100)
                : 0}%
            </p>
            <p className="text-xs text-muted-foreground">Match Rate</p>
          </div>
        </div>
      </div>

      {/* Title + count */}
      <div className="flex items-center justify-between mb-3">
        <div>
          <h2 className="text-lg font-semibold">Active Buyer Requests</h2>
          <p className="text-xs text-muted-foreground">
            {filteredDemand.length} total · {activeCount} active · {matchedCount} matched
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={handleExport} disabled={isExporting} className="gap-1.5 text-xs h-8">
          <Download className="w-3.5 h-3.5" />
          {isExporting ? "Exporting..." : "Export Excel"}
        </Button>
      </div>

      {/* Tier Filter Buttons */}
      <div className="flex gap-2 mb-3">
        {(["all", "A", "B", "C"] as const).map((t) => {
          const labels: Record<string, string> = { all: "All Tiers", A: "A — Direct Buyer", B: "B — Broker Request", C: "C — Speculative" };
          const colors: Record<string, string> = {
            all: tierFilter === "all" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground",
            A: tierFilter === "A" ? "bg-green-600 text-white" : "bg-green-500/10 text-green-600 hover:bg-green-500/20",
            B: tierFilter === "B" ? "bg-amber-500 text-white" : "bg-amber-500/10 text-amber-600 hover:bg-amber-500/20",
            C: tierFilter === "C" ? "bg-red-500 text-white" : "bg-red-500/10 text-red-600 hover:bg-red-500/20",
          };
          const counts: Record<string, number> = {
            all: (allDemand as any[]).length,
            A: (allDemand as any[]).filter((d: any) => (d.buyerTier === "A" || (d.buyerIntentScore ?? 0) >= 70)).length,
            B: (allDemand as any[]).filter((d: any) => (d.buyerTier === "B" || ((d.buyerIntentScore ?? 0) >= 40 && (d.buyerIntentScore ?? 0) < 70))).length,
            C: (allDemand as any[]).filter((d: any) => (d.buyerTier === "C" || (d.buyerIntentScore ?? 0) < 40)).length,
          };
          return (
            <button
              key={t}
              onClick={() => setTierFilter(t)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${colors[t]}`}
            >
              {labels[t]} <span className="ml-1 opacity-70">({counts[t]})</span>
            </button>
          );
        })}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 mb-4 items-center">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <Input
            placeholder="Search by name, location, type…"
            className="pl-8 h-8 text-sm"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-32 h-8 text-xs">
            <SelectValue placeholder="All Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="matched">Matched</SelectItem>
          </SelectContent>
        </Select>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-32 h-8 text-xs">
            <SelectValue placeholder="All Types" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            <SelectItem value="villa">Villa</SelectItem>
            <SelectItem value="apartment">Apartment</SelectItem>
            <SelectItem value="duplex">Duplex</SelectItem>
            <SelectItem value="penthouse">Penthouse</SelectItem>
            <SelectItem value="studio">Studio</SelectItem>
          </SelectContent>
        </Select>
        <Select value={listingFilter} onValueChange={setListingFilter}>
          <SelectTrigger className="w-32 h-8 text-xs">
            <SelectValue placeholder="Buy & Rent" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Buy & Rent</SelectItem>
            <SelectItem value="buy">Buyers</SelectItem>
            <SelectItem value="rent">Renters</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <div className="bg-card border rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/30">
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Intent</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Customer</th>
                <th className="text-left px-3 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Looking For</th>
                <th className="text-left px-3 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Location</th>
                <th className="text-left px-3 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Budget</th>
                <th className="text-left px-3 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Bedrooms</th>
                <th className="text-left px-3 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Status</th>
                <th className="text-left px-3 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Matches</th>
                <th className="text-left px-3 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Original Message</th>
                <th className="text-left px-3 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredDemand.length === 0 ? (
                <tr>
                  <td colSpan={10} className="text-center py-16 text-muted-foreground">
                    <div className="flex flex-col items-center gap-2">
                      <Search className="w-10 h-10 opacity-20" />
                      <p>No requests found.</p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredDemand.map((d: any, idx: number) => {
                  const matchCount = matchCountByDemand[d.id] || 0;
                  return (
                    <tr key={d.id || idx} className="border-b last:border-0 hover:bg-muted/20 transition-colors">
                      {/* Intent Badge */}
                      <td className="px-3 py-3">
                        {(() => {
                          const score = d.buyerIntentScore ?? 50;
                          const tier = d.buyerTier ?? 'broker_with_request';
                          if (tier === 'direct_buyer') return (
                            <div className="flex flex-col items-start gap-0.5">
                              <Badge className="text-xs bg-green-500/15 text-green-600 border-green-300 font-semibold">A — Buyer</Badge>
                              <span className="text-xs text-green-600 font-bold">{score}/100</span>
                            </div>
                          );
                          if (tier === 'broker_with_request') return (
                            <div className="flex flex-col items-start gap-0.5">
                              <Badge className="text-xs bg-amber-500/15 text-amber-600 border-amber-300 font-semibold">B — Broker</Badge>
                              <span className="text-xs text-amber-600 font-bold">{score}/100</span>
                            </div>
                          );
                          return (
                            <div className="flex flex-col items-start gap-0.5">
                              <Badge className="text-xs bg-red-500/15 text-red-500 border-red-300 font-semibold">C — Spec</Badge>
                              <span className="text-xs text-red-500 font-bold">{score}/100</span>
                            </div>
                          );
                        })()}
                      </td>
                      {/* Customer */}
                      <td className="px-4 py-3">
                        <div className="font-medium text-sm">{d.contactName || "Unknown"}</div>
                        <div className="flex items-center gap-1 mt-0.5">
                          <Phone className="w-3 h-3 text-muted-foreground" />
                          <span className="text-xs text-muted-foreground">{d.contact || "—"}</span>
                        </div>
                        <div className="text-xs text-muted-foreground mt-0.5 truncate max-w-[120px]" title={d.groupName}>
                          {d.groupName ? d.groupName.substring(0, 18) + (d.groupName.length > 18 ? "…" : "") : "WhatsApp"}
                        </div>
                      </td>
                      {/* Looking For */}
                      <td className="px-3 py-3">
                        <div className="text-sm capitalize">{d.propertyType || "—"}</div>
                        <Badge
                          className={`text-xs mt-1 ${d.purpose?.toLowerCase() === "rent" ? "bg-amber-500/10 text-amber-600 border-amber-200" : "bg-blue-500/10 text-blue-600 border-blue-200"}`}
                          variant="outline"
                        >
                          {d.purpose?.toLowerCase() === "rent" ? "Rent" : "Buy"}
                        </Badge>
                      </td>
                      {/* Location */}
                      <td className="px-3 py-3">
                        <div className="flex items-center gap-1">
                          <MapPin className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                          <span className="text-sm truncate max-w-[110px]" title={d.location}>{d.location || "—"}</span>
                        </div>
                        {d.city && <p className="text-xs text-muted-foreground ml-4">{d.city}</p>}
                      </td>
                      {/* Budget */}
                      <td className="px-3 py-3">
                        <span className="font-semibold text-sm">
                          {formatBudget(d.priceMin, d.priceMax)} EGP
                        </span>
                      </td>
                      {/* Bedrooms */}
                      <td className="px-3 py-3">
                        <div className="flex flex-col gap-0.5 text-xs text-muted-foreground">
                          {d.bedrooms && (
                            <span className="flex items-center gap-1">
                              <BedDouble className="w-3 h-3" />{d.bedrooms}+
                            </span>
                          )}
                          {d.size && (
                            <span className="flex items-center gap-1">
                              <Ruler className="w-3 h-3" />{d.size} sqm
                            </span>
                          )}
                          {!d.bedrooms && !d.size && <span>—</span>}
                        </div>
                      </td>
                      {/* Status */}
                      <td className="px-3 py-3">
                        <Badge
                          className={`text-xs ${
                            matchCount > 0
                              ? "bg-green-500/10 text-green-600 border-green-200"
                              : "bg-blue-500/10 text-blue-600 border-blue-200"
                          }`}
                          variant="outline"
                        >
                          {matchCount > 0 ? "Matched" : "Active"}
                        </Badge>
                      </td>
                      {/* Matches */}
                      <td className="px-3 py-3">
                        <span className={`font-bold text-sm ${matchCount > 0 ? "text-primary" : "text-muted-foreground"}`}>
                          {matchCount}
                        </span>
                      </td>
                      {/* Original Message */}
                      <td className="px-3 py-3 max-w-[160px]">
                        {d.rawMessage ? (
                          <p className="text-xs text-muted-foreground truncate" title={d.rawMessage}>
                            {d.rawMessage.substring(0, 60)}{d.rawMessage.length > 60 ? "…" : ""}
                          </p>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </td>
                      {/* Actions */}
                      <td className="px-3 py-3">
                        <div className="flex items-center gap-1">
                          {d.contact && (
                            <a
                              href={`https://wa.me/${d.contact?.replace(/\D/g, "")}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="p-1.5 rounded-md bg-green-500/10 hover:bg-green-500/20 text-green-600 transition-colors"
                              title="WhatsApp"
                            >
                              <MessageSquare className="w-3.5 h-3.5" />
                            </a>
                          )}
                          <button
                            className="p-1.5 rounded-md bg-muted hover:bg-muted/80 text-muted-foreground transition-colors"
                            title="View details"
                            onClick={() => toast.info(`${d.contactName || "Contact"}: ${d.contact || "No phone"} — Budget: ${formatBudget(d.priceMin, d.priceMax)} EGP`)}
                          >
                            <Search className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
