import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Home, Search, Download, RefreshCw, MapPin, BedDouble,
  Ruler, Phone, MessageSquare, TrendingUp, Users, Building2, Star,
  AlertTriangle, CheckCircle2, Clock, Filter, Eye, ExternalLink
} from "lucide-react";
import * as XLSX from "xlsx";
import { toast } from "sonner";

// ── Helpers ──────────────────────────────────────────────────────────────────

function ConfBadge({ confidence }: { confidence: any }) {
  const val = typeof confidence === "string" ? parseFloat(confidence) : (confidence ?? 0);
  const pct = Math.round(val * 100);
  if (pct >= 70) return <Badge className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20 text-xs">{pct}%</Badge>;
  if (pct >= 50) return <Badge className="bg-amber-500/10 text-amber-500 border-amber-500/20 text-xs">{pct}%</Badge>;
  if (pct > 0) return <Badge className="bg-red-500/10 text-red-500 border-red-500/20 text-xs">{pct}%</Badge>;
  return null;
}

function ReviewBadge({ status }: { status: string | null }) {
  if (!status || status === "auto_approved") return <Badge className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20 text-xs">Auto</Badge>;
  if (status === "pending_review") return <Badge className="bg-amber-500/10 text-amber-500 border-amber-500/20 text-xs flex items-center gap-0.5"><AlertTriangle className="w-2.5 h-2.5" />Review</Badge>;
  if (status === "approved") return <Badge className="bg-blue-500/10 text-blue-500 border-blue-500/20 text-xs flex items-center gap-0.5"><CheckCircle2 className="w-2.5 h-2.5" />OK</Badge>;
  if (status === "rejected") return <Badge className="bg-red-500/10 text-red-500 border-red-500/20 text-xs">Rejected</Badge>;
  return null;
}

function PipelinePriorityBadge({ priority, matchCount }: { priority: string | null; matchCount: number }) {
  if (priority === "high" || matchCount >= 5) return <Badge className="bg-red-500 text-white text-xs">🔥 Hot</Badge>;
  if (priority === "medium" || matchCount >= 2) return <Badge className="bg-amber-500 text-white text-xs">⭐ High</Badge>;
  if (matchCount >= 1) return <Badge className="bg-blue-500 text-white text-xs">↑ Normal</Badge>;
  return <Badge variant="outline" className="text-xs text-muted-foreground">New</Badge>;
}

function OriginalMessageDialog({ record, open, onClose }: { record: any; open: boolean; onClose: () => void }) {
  const msg = record?.originalMessage || record?.rawMessageText;
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageSquare className="h-4 w-4 text-green-500" />
            Original WhatsApp Message
          </DialogTitle>
        </DialogHeader>
        <ScrollArea className="max-h-64">
          <div className="space-y-3">
            {msg ? (
              <p className="text-sm whitespace-pre-wrap" dir="auto">{msg}</p>
            ) : (
              <p className="text-sm text-muted-foreground">No original message linked to this record.</p>
            )}
            <div className="text-xs text-muted-foreground border-t pt-2 space-y-1">
              {record?.sourceGroup && <p>Group: {record.sourceGroup}</p>}
              {record?.msgGroup && <p>Group: {record.msgGroup}</p>}
              {record?.nlpVersion && <p>NLP version: {record.nlpVersion}</p>}
              {record?.createdAt && <p>Ingested: {new Date(record.createdAt).toLocaleString()}</p>}
            </div>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export function Properties() {
  const { data: allSupply = [], refetch: refetchSupply } = trpc.supply.recent.useQuery({ limit: 2000 });
  const { data: allDemand = [], refetch: refetchDemand } = trpc.demand.recent.useQuery({ limit: 2000 });
  const { data: allMatches = [] } = trpc.matches.recent.useQuery({ limit: 500 });
  const pendingCount = trpc.review.pendingCount.useQuery(undefined, { refetchInterval: 15000 });
  const { data: supplySourceGroups = [] } = trpc.supply.sourceGroups.useQuery();
  const { data: demandSourceGroups = [] } = trpc.demand.sourceGroups.useQuery();

  const [searchTerm, setSearchTerm] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [listingFilter, setListingFilter] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [reviewFilter, setReviewFilter] = useState("all");
  const [matchedFilter, setMatchedFilter] = useState("all");
  const [sourceGroupFilter, setSourceGroupFilter] = useState("all");
  const [sortBy, setSortBy] = useState("priority");
  const [priceTypeFilter, setPriceTypeFilter] = useState<"all" | "cash" | "installment">("all");
  const [locationFilter, setLocationFilter] = useState("all");
  const [activeTab, setActiveTab] = useState<"supply" | "demand">("supply");
  const [isExporting, setIsExporting] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState<any>(null);

  // Count matches per record
  const matchCountBySupply = useMemo(() => {
    const counts: Record<number, number> = {};
    (allMatches as any[]).forEach((m: any) => {
      if (m.supplyId) counts[m.supplyId] = (counts[m.supplyId] || 0) + 1;
    });
    return counts;
  }, [allMatches]);

  const matchCountByDemand = useMemo(() => {
    const counts: Record<number, number> = {};
    (allMatches as any[]).forEach((m: any) => {
      if (m.demandId) counts[m.demandId] = (counts[m.demandId] || 0) + 1;
    });
    return counts;
  }, [allMatches]);

  // Apply all filters to supply
  const filteredSupply = useMemo(() => {
    let items = [...(allSupply as any[])];
    if (searchTerm) {
      const t = searchTerm.toLowerCase();
      items = items.filter(s =>
        s.location?.toLowerCase().includes(t) ||
        s.contactName?.toLowerCase().includes(t) ||
        s.contact?.includes(t) ||
        s.propertyType?.toLowerCase().includes(t) ||
        s.sourceGroup?.toLowerCase().includes(t) ||
        s.groupName?.toLowerCase().includes(t)
      );
    }
    if (typeFilter !== "all") items = items.filter(s => s.propertyType?.toLowerCase() === typeFilter);
    if (listingFilter === "sale") items = items.filter(s => s.purpose?.toLowerCase() === "sale");
    if (listingFilter === "rent") items = items.filter(s => s.purpose?.toLowerCase() === "rent");
    if (priorityFilter !== "all") items = items.filter(s => s.priority === priorityFilter);
    if (reviewFilter !== "all") items = items.filter(s => (s.reviewStatus || "auto_approved") === reviewFilter);
    if (matchedFilter === "matched") items = items.filter(s => (matchCountBySupply[s.id] || 0) > 0);
    if (matchedFilter === "unmatched") items = items.filter(s => (matchCountBySupply[s.id] || 0) === 0);
    if (sourceGroupFilter !== "all") items = items.filter(s => (s.sourceGroup || s.groupName || "") === sourceGroupFilter);
    if (locationFilter !== "all") items = items.filter(s => s.location?.toLowerCase() === locationFilter.toLowerCase());
    if (priceTypeFilter === "cash") items = items.filter(s => s.priceType === "cash" || (!s.priceType && !s.downPayment));
    if (priceTypeFilter === "installment") items = items.filter(s => s.priceType === "installment" || !!s.downPayment);
    if (sortBy === "price_asc") items.sort((a, b) => (Number(a.price) || 0) - (Number(b.price) || 0));
    if (sortBy === "price_desc") items.sort((a, b) => (Number(b.price) || 0) - (Number(a.price) || 0));
    if (sortBy === "newest") items.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
    if (sortBy === "most_matched") items.sort((a, b) => (matchCountBySupply[b.id] || 0) - (matchCountBySupply[a.id] || 0));
    if (sortBy === "confidence_desc") items.sort((a, b) => (parseFloat(b.confidence) || 0) - (parseFloat(a.confidence) || 0));
    if (sortBy === "priority") {
      const pOrder: Record<string, number> = { high: 0, medium: 1, low: 2 };
      items.sort((a, b) => (pOrder[a.priority || "low"] ?? 2) - (pOrder[b.priority || "low"] ?? 2));
    }
    return items;
  }, [allSupply, searchTerm, typeFilter, listingFilter, priorityFilter, reviewFilter, matchedFilter, sourceGroupFilter, locationFilter, sortBy, matchCountBySupply]);

  // Apply all filters to demand
  const filteredDemand = useMemo(() => {
    let items = [...(allDemand as any[])];
    if (searchTerm) {
      const t = searchTerm.toLowerCase();
      items = items.filter(d =>
        d.location?.toLowerCase().includes(t) ||
        d.contactName?.toLowerCase().includes(t) ||
        d.contact?.includes(t) ||
        d.propertyType?.toLowerCase().includes(t) ||
        d.sourceGroup?.toLowerCase().includes(t) ||
        d.groupName?.toLowerCase().includes(t)
      );
    }
    if (typeFilter !== "all") items = items.filter(d => d.propertyType?.toLowerCase() === typeFilter);
    if (listingFilter === "buy") items = items.filter(d => d.purpose?.toLowerCase() === "buy" || d.purpose?.toLowerCase() === "sale");
    if (listingFilter === "rent") items = items.filter(d => d.purpose?.toLowerCase() === "rent");
    if (priorityFilter !== "all") items = items.filter(d => d.priority === priorityFilter);
    if (reviewFilter !== "all") items = items.filter(d => (d.reviewStatus || "auto_approved") === reviewFilter);
    if (matchedFilter === "matched") items = items.filter(d => (matchCountByDemand[d.id] || 0) > 0);
    if (matchedFilter === "unmatched") items = items.filter(d => (matchCountByDemand[d.id] || 0) === 0);
    if (sourceGroupFilter !== "all") items = items.filter(d => (d.sourceGroup || d.groupName || "") === sourceGroupFilter);
    if (sortBy === "price_asc") items.sort((a, b) => (Number(a.priceMax) || 0) - (Number(b.priceMax) || 0));
    if (sortBy === "price_desc") items.sort((a, b) => (Number(b.priceMax) || 0) - (Number(a.priceMax) || 0));
    if (sortBy === "newest") items.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
    if (sortBy === "most_matched") items.sort((a, b) => (matchCountByDemand[b.id] || 0) - (matchCountByDemand[a.id] || 0));
    if (sortBy === "confidence_desc") items.sort((a, b) => (parseFloat(b.confidence) || 0) - (parseFloat(a.confidence) || 0));
    if (sortBy === "priority") {
      const pOrder: Record<string, number> = { high: 0, medium: 1, low: 2 };
      items.sort((a, b) => (pOrder[a.priority || "low"] ?? 2) - (pOrder[b.priority || "low"] ?? 2));
    }
    return items;
  }, [allDemand, searchTerm, typeFilter, listingFilter, priorityFilter, reviewFilter, matchedFilter, sourceGroupFilter, sortBy, matchCountByDemand]);

  const handleRefresh = () => {
    refetchSupply();
    refetchDemand();
    toast.success("Properties refreshed");
  };

  const handleExportCSV = async () => {
    setIsExporting(true);
    try {
      const selectedData = activeTab === 'supply' ? filteredSupply : filteredDemand;
      
      if (selectedData.length === 0) {
        toast.error('No data to export');
        setIsExporting(false);
        return;
      }

      const csvData = selectedData.map((item: any) => ({
        Contact: item.contactName || 'N/A',
        Phone: item.contact || 'N/A',
        Type: item.propertyType || 'N/A',
        Location: item.location || 'N/A',
        City: item.city || 'N/A',
        ...(activeTab === 'supply' ? {
          Price_EGP: item.price ? Number(item.price).toLocaleString() : 'N/A',
        } : {
          Budget_Min_EGP: item.priceMin ? Number(item.priceMin).toLocaleString() : 'N/A',
          Budget_Max_EGP: item.priceMax ? Number(item.priceMax).toLocaleString() : 'N/A',
        }),
        Size_sqm: item.size || 'N/A',
        Bedrooms: item.bedrooms || 'N/A',
        Bathrooms: item.bathrooms || 'N/A',
        Priority: item.priority || 'N/A',
        Confidence: item.confidence ? Math.round(parseFloat(item.confidence) * 100) + '%' : 'N/A',
        Status: item.reviewStatus || 'auto_approved',
        Matches: (activeTab === 'supply' ? matchCountBySupply[item.id] : matchCountByDemand[item.id]) || 0,
        Date: item.createdAt ? new Date(item.createdAt).toLocaleDateString() : 'N/A',
      }));

      // Convert to CSV
      const headers = Object.keys(csvData[0]);
      const csvContent = [
        headers.join(','),
        ...csvData.map(row => headers.map(h => {
          const val = row[h as keyof typeof row];
          return typeof val === 'string' && val.includes(',') ? `"${val}"` : val;
        }).join(','))
      ].join('\n');

      const blob = new Blob([csvContent], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `matchpro-${activeTab}-${new Date().toISOString().split('T')[0]}.csv`;
      a.click();
      window.URL.revokeObjectURL(url);

      toast.success(`Exported ${selectedData.length} ${activeTab} records as CSV`);
    } catch (error) {
      console.error('CSV export error:', error);
      toast.error('CSV export failed');
    } finally {
      setIsExporting(false);
    }
  };

  const handleExport = async () => {
    setIsExporting(true);
    try {
      const supplyData = (allSupply as any[]).map(s => ({
        Tab: "Supply / For Sale",
        Contact: s.contactName || "N/A",
        Phone: s.contact || "N/A",
        Type: s.propertyType || "N/A",
        Purpose: s.purpose?.toUpperCase() || "SALE",
        Location: s.location || "N/A",
        City: s.city || "N/A",
        Price_EGP: s.price ? Number(s.price).toLocaleString() : "N/A",
        Size_sqm: s.size || "N/A",
        Bedrooms: s.bedrooms || "N/A",
        Bathrooms: s.bathrooms || "N/A",
        Priority: s.priority || "N/A",
        Confidence_Pct: s.confidence ? Math.round(parseFloat(s.confidence) * 100) + "%" : "N/A",
        Review_Status: s.reviewStatus || "auto_approved",
        Source_Group: s.sourceGroup || s.groupName || "WhatsApp",
        Matches: matchCountBySupply[s.id] || 0,
        Date: s.createdAt ? new Date(s.createdAt).toLocaleDateString() : "N/A",
      }));
      const demandData = (allDemand as any[]).map(d => ({
        Tab: "Demand / Buyer Request",
        Contact: d.contactName || "N/A",
        Phone: d.contact || "N/A",
        Type: d.propertyType || "N/A",
        Purpose: d.purpose?.toUpperCase() || "BUY",
        Location: d.location || "N/A",
        City: d.city || "N/A",
        Budget_Max_EGP: d.priceMax ? Number(d.priceMax).toLocaleString() : "N/A",
        Size_sqm: d.size || "N/A",
        Bedrooms: d.bedrooms || "N/A",
        Bathrooms: d.bathrooms || "N/A",
        Priority: d.priority || "N/A",
        Confidence_Pct: d.confidence ? Math.round(parseFloat(d.confidence) * 100) + "%" : "N/A",
        Review_Status: d.reviewStatus || "auto_approved",
        Source_Group: d.sourceGroup || d.groupName || "WhatsApp",
        Matches: matchCountByDemand[d.id] || 0,
        Date: d.createdAt ? new Date(d.createdAt).toLocaleDateString() : "N/A",
      }));
      const ws = XLSX.utils.json_to_sheet([...supplyData, ...demandData]);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "All Properties");
      XLSX.writeFile(wb, `matchpro-properties-${new Date().toISOString().split("T")[0]}.xlsx`);
      toast.success(`Exported ${supplyData.length + demandData.length} properties`);
    } catch {
      toast.error("Export failed");
    } finally {
      setIsExporting(false);
    }
  };

  const formatPrice = (price: any) => {
    const p = Number(price);
    if (!p) return "—";
    if (p >= 1_000_000) return `${(p / 1_000_000).toFixed(1)}M`;
    if (p >= 1_000) return `${(p / 1_000).toFixed(0)}K`;
    return p.toString();
  };

  const currentItems = activeTab === "supply" ? filteredSupply : filteredDemand;
  const currentMatchCount = activeTab === "supply" ? matchCountBySupply : matchCountByDemand;
  const pendingReviewCount = pendingCount.data?.total || 0;

  return (
    <div className="space-y-0">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Properties</h1>
          <p className="text-sm text-muted-foreground">MatchPro™ / Properties</p>
        </div>
        <div className="flex items-center gap-2">
          {pendingReviewCount > 0 && (
            <Badge className="bg-amber-500/20 text-amber-500 border-amber-500/30 gap-1">
              <AlertTriangle className="w-3 h-3" />
              {pendingReviewCount} pending review
            </Badge>
          )}
          <Button variant="outline" size="sm" onClick={() => setShowFilters(f => !f)} className="gap-1.5">
            <Filter className="w-3.5 h-3.5" /> {showFilters ? "Hide Filters" : "Filters"}
          </Button>
          <Button variant="outline" size="sm" onClick={handleRefresh} className="gap-1.5">
            <RefreshCw className="w-3.5 h-3.5" /> Refresh
          </Button>
          <Button size="sm" onClick={handleExportCSV} disabled={isExporting} className="gap-1.5 bg-blue-600 hover:bg-blue-700 text-white">
            <Download className="w-3.5 h-3.5" />
            {isExporting ? "Exporting..." : "Export CSV"}
          </Button>
          <Button size="sm" onClick={handleExport} disabled={isExporting} className="gap-1.5 bg-green-600 hover:bg-green-700 text-white">
            <Download className="w-3.5 h-3.5" />
            {isExporting ? "Exporting..." : "Export Excel"}
          </Button>
        </div>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-card border rounded-xl p-4 flex items-center gap-3">
          <div className="p-2 rounded-lg bg-blue-500/10">
            <Home className="w-5 h-5 text-blue-500" />
          </div>
          <div>
            <p className="text-2xl font-bold">{(allSupply as any[]).length}</p>
            <p className="text-xs text-muted-foreground">Active Listings</p>
            <p className="text-xs text-green-500">↑ Supply</p>
          </div>
        </div>
        <div className="bg-card border rounded-xl p-4 flex items-center gap-3">
          <div className="p-2 rounded-lg bg-green-500/10">
            <MessageSquare className="w-5 h-5 text-green-500" />
          </div>
          <div>
            <p className="text-2xl font-bold">{(allDemand as any[]).length}</p>
            <p className="text-xs text-muted-foreground">Buyer Requests</p>
            <p className="text-xs text-amber-500">↑ High demand</p>
          </div>
        </div>
        <div className="bg-card border rounded-xl p-4 flex items-center gap-3">
          <div className="p-2 rounded-lg bg-purple-500/10">
            <TrendingUp className="w-5 h-5 text-purple-500" />
          </div>
          <div>
            <p className="text-2xl font-bold">{(allMatches as any[]).length}</p>
            <p className="text-xs text-muted-foreground">Total Matches</p>
            <p className="text-xs text-purple-500">AI-powered</p>
          </div>
        </div>
        <div className="bg-card border rounded-xl p-4 flex items-center gap-3">
          <div className="p-2 rounded-lg bg-amber-500/10">
            <Star className="w-5 h-5 text-amber-500" />
          </div>
          <div>
            <p className="text-2xl font-bold">
              {(allMatches as any[]).length > 0
                ? Math.round(((allMatches as any[]).filter((m: any) => Number(m.matchScore || 0) >= 85).length / (allMatches as any[]).length) * 100)
                : 0}%
            </p>
            <p className="text-xs text-muted-foreground">Match Rate</p>
            <p className="text-xs text-amber-500">≥85% quality</p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-4 border-b">
        <button
          onClick={() => setActiveTab("supply")}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === "supply"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <span className="flex items-center gap-1.5">
            <Building2 className="w-4 h-4" />
            Property Listings
            <Badge variant="secondary" className="text-xs">{(allSupply as any[]).length}</Badge>
          </span>
        </button>
        <button
          onClick={() => setActiveTab("demand")}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === "demand"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <span className="flex items-center gap-1.5">
            <Users className="w-4 h-4" />
            Buyer Requests
            <Badge variant="secondary" className="text-xs">{(allDemand as any[]).length}</Badge>
          </span>
        </button>
      </div>

      {/* Title + count */}
      <div className="flex items-center justify-between mb-3">
        <div>
          <h2 className="text-lg font-semibold">
            {activeTab === "supply" ? "Property Listings" : "Active Buyer Requests"}
          </h2>
          <p className="text-xs text-muted-foreground">
            {currentItems.length} total · {currentItems.filter((i: any) => (currentMatchCount[i.id] || 0) > 0).length} matched
          </p>
        </div>
        <p className="text-xs text-muted-foreground">Showing {currentItems.length} of {currentItems.length}</p>
      </div>

      {/* Primary filters */}
      <div className="flex flex-wrap gap-2 mb-2 items-center">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <Input
            placeholder="Search location, contact, type, group…"
            className="pl-8 h-8 text-sm"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-32 h-8 text-xs"><SelectValue placeholder="All Types" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            <SelectItem value="villa">Villa</SelectItem>
            <SelectItem value="apartment">Apartment</SelectItem>
            <SelectItem value="duplex">Duplex</SelectItem>
            <SelectItem value="penthouse">Penthouse</SelectItem>
            <SelectItem value="studio">Studio</SelectItem>
            <SelectItem value="townhouse">Townhouse</SelectItem>
          </SelectContent>
        </Select>
        <Select value={listingFilter} onValueChange={setListingFilter}>
          <SelectTrigger className="w-28 h-8 text-xs"><SelectValue placeholder="Sale & Rent" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Sale & Rent</SelectItem>
            <SelectItem value="sale">For Sale</SelectItem>
            <SelectItem value="rent">For Rent</SelectItem>
          </SelectContent>
        </Select>
        <Select value={locationFilter} onValueChange={setLocationFilter}>
          <SelectTrigger className="w-40 h-8 text-xs"><SelectValue placeholder="All Locations" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Locations</SelectItem>
            {Array.from(new Set([...(allSupply as any[]).map(s => s.location).filter(Boolean), ...(allDemand as any[]).map(d => d.location).filter(Boolean)])).sort().map(loc => (
              <SelectItem key={loc} value={loc}>{loc}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        {/* Price Type Filter — only relevant for supply/listings */}
        {activeTab === "supply" && (
          <div className="flex gap-1">
            {(["all", "cash", "installment"] as const).map(pt => (
              <Button
                key={pt}
                size="sm"
                variant={priceTypeFilter === pt ? "default" : "outline"}
                className={`h-8 text-xs px-3 ${
                  priceTypeFilter === pt
                    ? pt === "cash" ? "bg-emerald-600 hover:bg-emerald-700 text-white border-emerald-600"
                    : pt === "installment" ? "bg-blue-600 hover:bg-blue-700 text-white border-blue-600"
                    : ""
                    : ""
                }`}
                onClick={() => setPriceTypeFilter(pt)}
              >
                {pt === "all" ? "💰 All" : pt === "cash" ? "💵 Cash" : "📅 Installment"}
              </Button>
            ))}
          </div>
        )}
        <Select value={sortBy} onValueChange={setSortBy}>
          <SelectTrigger className="w-40 h-8 text-xs"><SelectValue placeholder="Sort: Priority" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="priority">Sort: Priority</SelectItem>
            <SelectItem value="confidence_desc">Confidence ↓</SelectItem>
            <SelectItem value="price_asc">Price ↑</SelectItem>
            <SelectItem value="price_desc">Price ↓</SelectItem>
            <SelectItem value="newest">Newest</SelectItem>
            <SelectItem value="most_matched">Most Matched</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Advanced filters panel */}
      {showFilters && (
        <div className="flex flex-wrap gap-2 mb-4 p-3 bg-muted/30 rounded-lg border">
          <Select value={priorityFilter} onValueChange={setPriorityFilter}>
            <SelectTrigger className="w-32 h-8 text-xs"><SelectValue placeholder="All Priority" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Priority</SelectItem>
              <SelectItem value="high">🔥 High</SelectItem>
              <SelectItem value="medium">⭐ Medium</SelectItem>
              <SelectItem value="low">Low</SelectItem>
            </SelectContent>
          </Select>
          <Select value={reviewFilter} onValueChange={setReviewFilter}>
            <SelectTrigger className="w-36 h-8 text-xs"><SelectValue placeholder="Review Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="auto_approved">Auto Approved</SelectItem>
              <SelectItem value="pending_review">⚠ Pending Review</SelectItem>
              <SelectItem value="approved">✓ Approved</SelectItem>
              <SelectItem value="rejected">✗ Rejected</SelectItem>
            </SelectContent>
          </Select>
          <Select value={matchedFilter} onValueChange={setMatchedFilter}>
            <SelectTrigger className="w-32 h-8 text-xs"><SelectValue placeholder="Match Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Records</SelectItem>
              <SelectItem value="matched">Matched</SelectItem>
              <SelectItem value="unmatched">Unmatched</SelectItem>
            </SelectContent>
          </Select>
          {/* Source Group Filter — populated dynamically from DB */}
          <Select value={sourceGroupFilter} onValueChange={setSourceGroupFilter}>
            <SelectTrigger className="w-48 h-8 text-xs">
              <SelectValue placeholder="All Groups" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">📱 All Groups</SelectItem>
              {(activeTab === "supply" ? supplySourceGroups : demandSourceGroups).map((g: string) => (
                <SelectItem key={g} value={g}>
                  {g.length > 30 ? g.substring(0, 28) + "…" : g}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            variant="ghost"
            size="sm"
            className="h-8 text-xs text-muted-foreground"
            onClick={() => {
              setPriorityFilter("all");
              setReviewFilter("all");
              setMatchedFilter("all");
              setSourceGroupFilter("all");
              setTypeFilter("all");
              setListingFilter("all");
              setSearchTerm("");
            }}
          >
            Clear All
          </Button>
        </div>
      )}

      {/* Table */}
      <div className="bg-card border rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/30">
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Property</th>
                <th className="text-left px-3 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Type</th>
                <th className="text-left px-3 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Location</th>
                <th className="text-left px-3 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Price</th>
                <th className="text-left px-3 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Specs</th>
                <th className="text-left px-3 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Status</th>
                <th className="text-left px-3 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Priority / AI</th>
                <th className="text-left px-3 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Matches</th>
                <th className="text-left px-3 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Source</th>
                <th className="text-left px-3 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Actions</th>
              </tr>
            </thead>
            <tbody>
              {currentItems.length === 0 ? (
                <tr>
                  <td colSpan={10} className="text-center py-16 text-muted-foreground">
                    <div className="flex flex-col items-center gap-2">
                      <Home className="w-10 h-10 opacity-20" />
                      <p>No properties found.</p>
                    </div>
                  </td>
                </tr>
              ) : (
                currentItems.map((item: any, idx: number) => {
                  const matchCount = currentMatchCount[item.id] || 0;
                  const price = activeTab === "supply" ? item.price : item.priceMax;
                  return (
                    <tr key={item.id || idx} className="border-b last:border-0 hover:bg-muted/20 transition-colors">
                      {/* Property */}
                      <td className="px-4 py-3">
                        <div className="font-medium text-sm">
                          {item.contactName || "Unknown"}
                        </div>
                        <div className="flex items-center gap-1 mt-0.5">
                          <Phone className="w-3 h-3 text-muted-foreground" />
                          <span className="text-xs text-muted-foreground">{item.contact || "—"}</span>
                        </div>
                        <div className="flex flex-wrap items-center gap-1 mt-1">
                          <Badge
                            className={`text-xs ${activeTab === "supply" ? "bg-blue-500/10 text-blue-600 border-blue-200" : "bg-green-500/10 text-green-600 border-green-200"}`}
                            variant="outline"
                          >
                            {activeTab === "supply" ? (item.purpose?.toLowerCase() === "rent" ? "For Rent" : "For Sale") : "Buyer"}
                          </Badge>
                          {(item.sourceGroup || item.groupName) && (
                            <Badge
                              className="text-xs bg-amber-500/10 text-amber-700 border-amber-200 flex items-center gap-0.5 max-w-[120px]"
                              variant="outline"
                              title={item.sourceGroup || item.groupName}
                            >
                              <MessageSquare className="w-2.5 h-2.5 flex-shrink-0" />
                              <span className="truncate">{(item.sourceGroup || item.groupName || "").substring(0, 16)}{(item.sourceGroup || item.groupName || "").length > 16 ? "…" : ""}</span>
                            </Badge>
                          )}
                        </div>
                      </td>
                      {/* Type */}
                      <td className="px-3 py-3">
                        <span className="text-sm capitalize">{item.propertyType || "—"}</span>
                      </td>
                      {/* Location */}
                      <td className="px-3 py-3">
                        <div className="flex items-center gap-1">
                          <MapPin className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                          <span className="text-sm truncate max-w-[120px]" title={item.location}>{item.location || "—"}</span>
                        </div>
                        {item.city && <p className="text-xs text-muted-foreground ml-4">{item.city}</p>}
                      </td>
                      {/* Price */}
                      <td className="px-3 py-3">
                        {activeTab === "supply" ? (
                          <div className="flex flex-col gap-0.5">
                            {/* Price type badge */}
                            {item.priceType && item.priceType !== 'cash' ? (
                              <span className={`inline-flex items-center text-[10px] font-semibold px-1.5 py-0.5 rounded-full w-fit ${
                                item.priceType === 'installment' ? 'bg-blue-500/10 text-blue-600 border border-blue-200' : 'bg-purple-500/10 text-purple-600 border border-purple-200'
                              }`}>
                                {item.priceType === 'installment' ? '📅 Installment' : '💰 Cash & Install'}
                              </span>
                            ) : (
                              <span className="inline-flex items-center text-[10px] font-semibold px-1.5 py-0.5 rounded-full w-fit bg-green-500/10 text-green-600 border border-green-200">💵 Cash</span>
                            )}
                            {/* Cash price */}
                            {(item.cashPrice || item.price) && (
                              <span className="font-semibold text-sm">{formatPrice(item.cashPrice || item.price)} EGP</span>
                            )}
                            {/* Installment breakdown */}
                            {(item.priceType === 'installment' || item.priceType === 'both') && (
                              <div className="text-xs text-muted-foreground space-y-0.5">
                                {item.downPayment && <p>↳ Down: {formatPrice(item.downPayment)} EGP</p>}
                                {item.installmentAmount && <p>↳ Installment: {formatPrice(item.installmentAmount)} EGP</p>}
                                {item.installmentYears && <p>↳ {item.installmentYears} yr{item.installmentYears > 1 ? 's' : ''}</p>}
                              </div>
                            )}
                          </div>
                        ) : (
                          <div>
                            <span className="font-semibold text-sm">{formatPrice(price)} EGP</span>
                            {item.priceMin && (
                              <p className="text-xs text-muted-foreground">Min: {formatPrice(item.priceMin)}</p>
                            )}
                          </div>
                        )}
                      </td>
                      {/* Specs */}
                      <td className="px-3 py-3">
                        <div className="flex flex-col gap-0.5 text-xs text-muted-foreground">
                          {item.bedrooms && (
                            <span className="flex items-center gap-1">
                              <BedDouble className="w-3 h-3" />{item.bedrooms} bed
                            </span>
                          )}
                          {item.size && (
                            <span className="flex items-center gap-1">
                              <Ruler className="w-3 h-3" />{item.size} sqm
                            </span>
                          )}
                          {!item.bedrooms && !item.size && <span>—</span>}
                        </div>
                      </td>
                      {/* Status */}
                      <td className="px-3 py-3">
                        <Badge
                          className={`text-xs ${matchCount > 0 ? "bg-green-500/10 text-green-600 border-green-200" : "bg-gray-500/10 text-gray-500 border-gray-200"}`}
                          variant="outline"
                        >
                          {matchCount > 0 ? "Matched" : "Available"}
                        </Badge>
                      </td>
                      {/* Priority / AI */}
                      <td className="px-3 py-3">
                        <div className="flex flex-col gap-1">
                          <PipelinePriorityBadge priority={item.priority} matchCount={matchCount} />
                          <ConfBadge confidence={item.confidence} />
                          <ReviewBadge status={item.reviewStatus} />
                        </div>
                      </td>
                      {/* Matches */}
                      <td className="px-3 py-3">
                        <span className={`font-bold text-sm ${matchCount > 0 ? "text-primary" : "text-muted-foreground"}`}>
                          {matchCount}
                        </span>
                      </td>
                      {/* Source */}
                      <td className="px-3 py-3">
                        <div className="flex items-center gap-1">
                          <MessageSquare className="w-3.5 h-3.5 text-green-500" />
                          <span className="text-xs text-muted-foreground truncate max-w-[80px]" title={item.sourceGroup || item.groupName}>
                            {(item.sourceGroup || item.groupName || "WhatsApp").substring(0, 15) + ((item.sourceGroup || item.groupName || "").length > 15 ? "…" : "")}
                          </span>
                        </div>
                        <div className="flex items-center gap-1 ml-4">
                          <Clock className="w-2.5 h-2.5 text-muted-foreground" />
                          <p className="text-xs text-muted-foreground">
                            {item.createdAt ? new Date(item.createdAt).toLocaleDateString("en-GB", { day: "2-digit", month: "short" }) : "—"}
                          </p>
                        </div>
                      </td>
                      {/* Actions */}
                      <td className="px-3 py-3">
                        <div className="flex items-center gap-1">
                          {item.contact && (
                            <a
                              href={`https://wa.me/${item.contact?.replace(/\D/g, "")}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="p-1.5 rounded-md bg-green-500/10 hover:bg-green-500/20 text-green-600 transition-colors"
                              title="WhatsApp"
                            >
                              <MessageSquare className="w-3.5 h-3.5" />
                            </a>
                          )}
                          <button
                            className="p-1.5 rounded-md bg-blue-500/10 hover:bg-blue-500/20 text-blue-500 transition-colors"
                            title="View original message"
                            onClick={() => setSelectedRecord(item)}
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                          <button
                            className="p-1.5 rounded-md bg-muted hover:bg-muted/80 text-muted-foreground transition-colors"
                            title="Copy contact"
                            onClick={() => { navigator.clipboard.writeText(item.contact || ""); toast.success("Copied!"); }}
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
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

      {/* Original message dialog */}
      {selectedRecord && (
        <OriginalMessageDialog
          record={selectedRecord}
          open={!!selectedRecord}
          onClose={() => setSelectedRecord(null)}
        />
      )}
    </div>
  );
}
