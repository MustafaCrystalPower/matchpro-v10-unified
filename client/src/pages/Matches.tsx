import { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Target, 
  RefreshCw,
  Eye,
  Phone,
  CheckCircle,
  Star,
  ThumbsUp,
  ThumbsDown,
  CheckCheck,
  Ban,
  MessageSquare,
  MapPin,
  Home,
  DollarSign,
  Ruler,
  BedDouble,
  ArrowRight,
  Calendar,
  User,
  Search,
  Filter,
  Sparkles,
  TrendingUp,
  Clock,
  ExternalLink,
  Download,
  History,
  BarChart3,
  ChevronRight,
  Loader2
} from "lucide-react";
import { toast } from "sonner";
import * as XLSX from "xlsx";
import { useSound } from "@/contexts/SoundContext";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Slider } from "@/components/ui/slider";
import { io, Socket } from "socket.io-client";
import { Volume2, VolumeX, BellOff, LayoutList, LayoutGrid } from "lucide-react";

// Shared AudioContext — reuse across all coin sounds
let _audioCtx: AudioContext | null = null;
function getAudioCtx(): AudioContext {
  if (!_audioCtx || _audioCtx.state === 'closed') {
    _audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
  }
  return _audioCtx;
}

// Single coin-drop sound: metallic ping with natural decay
function playCoinSound(delayMs = 0) {
  try {
    const ctx = getAudioCtx();
    const t = ctx.currentTime + delayMs / 1000;

    // --- Metallic ping (coin body) ---
    // Coins produce inharmonic partials — use 3 detuned oscillators
    const freqs = [2800, 3700, 5200]; // inharmonic coin frequencies
    freqs.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      // Slight detune per partial for realism
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq + (i * 37), t);
      // Fast attack, long metallic decay
      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(0.22 - i * 0.05, t + 0.003);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.55 + i * 0.1);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(t);
      osc.stop(t + 0.7);
    });

    // --- Impact click (coin hitting surface) ---
    const clickSamples = Math.floor(ctx.sampleRate * 0.008);
    const clickBuf = ctx.createBuffer(1, clickSamples, ctx.sampleRate);
    const clickData = clickBuf.getChannelData(0);
    for (let i = 0; i < clickSamples; i++) {
      clickData[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / clickSamples, 3);
    }
    const click = ctx.createBufferSource();
    const clickGain = ctx.createGain();
    click.buffer = clickBuf;
    clickGain.gain.setValueAtTime(0.35, t);
    clickGain.gain.exponentialRampToValueAtTime(0.001, t + 0.025);
    click.connect(clickGain);
    clickGain.connect(ctx.destination);
    click.start(t);

    // --- Rolling tail (coin spinning/settling) ---
    const rollSamples = Math.floor(ctx.sampleRate * 0.12);
    const rollBuf = ctx.createBuffer(1, rollSamples, ctx.sampleRate);
    const rollData = rollBuf.getChannelData(0);
    for (let i = 0; i < rollSamples; i++) {
      // Amplitude modulated noise — simulates coin wobble
      const wobble = Math.sin(i / rollSamples * Math.PI * 18) * 0.5 + 0.5;
      rollData[i] = (Math.random() * 2 - 1) * wobble * Math.pow(1 - i / rollSamples, 2);
    }
    const roll = ctx.createBufferSource();
    const rollGain = ctx.createGain();
    roll.buffer = rollBuf;
    rollGain.gain.setValueAtTime(0.08, t + 0.01);
    rollGain.gain.exponentialRampToValueAtTime(0.001, t + 0.14);
    roll.connect(rollGain);
    rollGain.connect(ctx.destination);
    roll.start(t + 0.01);
  } catch (e) { /* Audio not supported */ }
}

// Fire one coin sound per match, staggered 160ms apart (max 12 coins)
function playCoinsForMatches(count: number) {
  const coinCount = Math.min(count, 12);
  for (let i = 0; i < coinCount; i++) {
    playCoinSound(i * 160);
  }
}

// Inline sound control button for the Matches page header
function SoundControlButton() {
  const { volume, setVolume, muted, setMuted, snoozedUntil, snooze, unsnooze, playTestCoin, playCoins } = useSound();
  const isSnoozed = snoozedUntil !== null && snoozedUntil > Date.now();
  const snoozeRemaining = isSnoozed ? Math.ceil((snoozedUntil! - Date.now()) / 60000) : 0;

  return (
    <div className="flex items-center gap-1">
      {/* Snooze toggle */}
      <Button
        variant="outline"
        size="sm"
        onClick={isSnoozed ? unsnooze : () => snooze(60)}
        title={isSnoozed ? `Snoozed ${snoozeRemaining}m remaining — click to unsnoze` : 'Snooze alerts for 1 hour'}
        className={isSnoozed ? 'border-amber-500 text-amber-500 bg-amber-500/10' : ''}
      >
        <BellOff className="w-4 h-4" />
        {isSnoozed && <span className="ml-1 text-xs">{snoozeRemaining}m</span>}
      </Button>
      {/* Volume popover */}
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm" title="Sound volume">
            {muted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-64 p-4" align="end">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Coin Sound Volume</span>
              <span className="text-xs text-muted-foreground">{Math.round(volume * 100)}%</span>
            </div>
            <Slider
              min={0} max={1} step={0.05}
              value={[volume]}
              onValueChange={([v]) => { setVolume(v); if (v > 0) setMuted(false); }}
            />
            <div className="flex gap-2">
              <Button variant="outline" size="sm" className="flex-1" onClick={() => setMuted(!muted)}>
                {muted ? <Volume2 className="w-3 h-3 mr-1" /> : <VolumeX className="w-3 h-3 mr-1" />}
                {muted ? 'Unmute' : 'Mute'}
              </Button>
              <Button variant="outline" size="sm" className="flex-1" onClick={playTestCoin}>
                🪙 Test
              </Button>
            </div>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}

export default function Matches() {
  const { user, isAuthenticated } = useAuth();
  const [socket, setSocket] = useState<Socket | null>(null);
  const [selectedMatch, setSelectedMatch] = useState<number | null>(null);
  const [feedbackMatchId, setFeedbackMatchId] = useState<number | null>(null);
  const [quickFeedback, setQuickFeedback] = useState<Record<number, 'confirmed' | 'rejected'>>({});
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [comment, setComment] = useState("");
  const [helpful, setHelpful] = useState<boolean | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [scoreFilter, setScoreFilter] = useState<string>("all");
  const [exportMinScore, setExportMinScore] = useState<number>(0);
  const [searchTerm, setSearchTerm] = useState("");
  const [notes, setNotes] = useState("");
  const [viewingDate, setViewingDate] = useState("");

  const { data: matches, refetch, isLoading } = trpc.matches.recent.useQuery({ limit: 500 });
  const { playCoins } = useSound();

  // WebSocket listener for real-time match updates
  useEffect(() => {
    const socketInstance = io({
      path: "/api/socket.io",
      transports: ["websocket", "polling"]
    });

    socketInstance.on("connect", () => {
      console.log("[Matches] Connected to live feed");
    });

    socketInstance.on("high_confidence_match", (data: any) => {
      console.log("[Matches] New high-confidence match received:", data);
      refetch();
      playCoins(1);
      toast.success(
        `${data.matchScore}% Match Found!`,
        {
          description: `${data.supply.propertyType || "Property"} in ${data.supply.location || "N/A"}`,
          duration: 5000,
        }
      );
    });

    socketInstance.on("new_message", () => {
      refetch();
    });

    socketInstance.on("disconnect", () => {
      console.log("[Matches] Disconnected from live feed");
    });

    setSocket(socketInstance);

    return () => {
      socketInstance.disconnect();
    };
  }, [refetch, playCoins]);
  const { data: highMatches } = trpc.matches.highConfidence.useQuery({ minScore: 85, limit: 20 });
  const { data: matchDetails, isLoading: detailsLoading } = trpc.matches.details.useQuery(
    { matchId: selectedMatch! },
    { enabled: !!selectedMatch }
  );
  const { data: matchFeedback } = trpc.feedback.get.useQuery(
    { matchId: selectedMatch! },
    { enabled: !!selectedMatch }
  );
  const { data: avgRating } = trpc.feedback.average.useQuery(
    { matchId: selectedMatch! },
    { enabled: !!selectedMatch }
  );

  const [contactedOnly, setContactedOnly] = useState(false);
  const [statusNote, setStatusNote] = useState("");
  const [historyMatchId, setHistoryMatchId] = useState<number | null>(null);
  const { data: funnel } = trpc.matches.conversionFunnel.useQuery();
  const { data: statusHistory } = trpc.matches.getStatusHistory.useQuery(
    { matchId: historyMatchId! },
    { enabled: !!historyMatchId }
  );
  const utils = trpc.useUtils();

  const updateStatus = trpc.matches.updateStatus.useMutation({
    onSuccess: (res) => {
      toast.success(`Status: ${res.fromStatus ?? 'new'} → ${res.toStatus}`);
      refetch();
      utils.matches.conversionFunnel.invalidate();
    }
  });

  const updateNotes = trpc.matches.updateNotes.useMutation({
    onSuccess: () => {
      toast.success("Notes saved");
    }
  });

  const [lastContactedMap, setLastContactedMap] = useState<Record<number, string>>({});
  const updateLastContacted = trpc.matches.updateLastContacted.useMutation({
    onSuccess: (res, variables) => {
      setLastContactedMap(prev => ({ ...prev, [variables.matchId]: res.contactedAt }));
      toast.success('Marked as contacted', { description: new Date(res.contactedAt).toLocaleString() });
      refetch();
    }
  });

  const runMatching = trpc.matches.runMatching.useMutation({
    onSuccess: (result) => {
      if (result.newMatches > 0) {
        // One coin sound per match, staggered 160ms apart (max 12) — respects volume/snooze
        playCoins(result.newMatches);
        // Summary toast after all coins have played
        const delay = Math.min(result.newMatches, 12) * 160 + 200;
        setTimeout(() => {
          toast.success(
            `💰 ${result.newMatches} new match${result.newMatches === 1 ? '' : 'es'} found!`,
            {
              description: result.highConfidenceMatches > 0
                ? `${result.highConfidenceMatches} high-confidence (≥85%) — check them first`
                : 'Review your new matches below',
              duration: 6000,
            }
          );
        }, delay);
      } else {
        toast.info('Matching complete — no new matches found', { duration: 3000 });
      }
      refetch();
    }
  });

  const [isExporting, setIsExporting] = useState(false);
  const [propertyTypeFilter, setPropertyTypeFilter] = useState<string>("all");
  const [minTypeScore, setMinTypeScore] = useState<number>(0);
  const [viewMode, setViewMode] = useState<'list' | 'kanban'>('list');

  const handleExportXLSX = async () => {
    setIsExporting(true);
    try {
      const minScore = exportMinScore > 0 ? exportMinScore : (scoreFilter === 'excellent' ? 90 : scoreFilter === 'good' ? 75 : scoreFilter === 'moderate' ? 60 : 0);
      // Build rows from the already-loaded matches (client-side, no extra API call needed)
      const filtered = (matches || []).filter(m => {
        const score = parseFloat(String(m.matchScore));
        return score >= minScore && (statusFilter === 'all' || m.status === statusFilter);
      });
      
      // Crystal Power branded header rows
      const wb = XLSX.utils.book_new();
      const wsData: any[][] = [
        ['Crystal Power Investments — MatchPro™ Export'],
        [`Generated: ${new Date().toLocaleString('en-EG')} | Filters: Score ≥${minScore}% | Status: ${statusFilter}`],
        [],
        [
          'Match ID', 'Score %', 'Status', 'Transaction',
          'Seller Name', 'Seller Phone', 'Seller Group',
          'Property Type', 'Location', 'Price (EGP)', 'Bedrooms', 'Size (m²)',
          'Supply Request (Original Message)',
          'Buyer Name', 'Buyer Phone', 'Buyer Group',
          'Budget Max (EGP)', 'Buyer Bedrooms', 'Demand Location',
          'Demand Request (Original Message)',
          'Location Score %', 'Price Score %', 'Specs Score %',
          'Conversion Stage', 'Last Contacted', 'Match Date'
        ],
        ...filtered.map(m => {
          // Determine conversion stage label
          const status = m.status || 'new';
          const stageLabel = status === 'new' ? '🆕 New'
            : status === 'contacted' ? '📞 Contacted'
            : status === 'viewing' ? '👁️ Viewing'
            : status === 'closed' ? '✅ Closed'
            : status === 'rejected' ? '❌ Rejected'
            : status.charAt(0).toUpperCase() + status.slice(1);
          return [
          m.id,
          Number(parseFloat(String(m.matchScore))).toFixed(1),
          m.status || 'new',
          (m.supplyPurpose || m.demandPurpose || '').toUpperCase(),
          m.supplyContactName || (m as any).supplyName || '',
          m.supplyContactPhone || (m as any).supplyPhone || '',
          (m as any).supplyGroupName || '',
          (m as any).supplyPropertyType || '',
          (m as any).supplyLocation || (m as any).supplyArea || (m as any).supplyCity || '',
          (m as any).supplyPrice || '',
          (m as any).supplyBedrooms || '',
          (m as any).supplySize || '',
          (m as any).supplyOriginalMessage || '',
          m.demandContactName || (m as any).demandName || '',
          m.demandContactPhone || (m as any).demandPhone || '',
          (m as any).demandGroupName || '',
          (m as any).demandPriceMax || '',
          (m as any).demandBedrooms || '',
          (m as any).demandLocation || (m as any).demandArea || (m as any).demandCity || '',
          (m as any).demandOriginalMessage || '',
          Number(parseFloat(String(m.locationScore || 0))).toFixed(1),
          Number(parseFloat(String(m.priceScore || 0))).toFixed(1),
          Number(parseFloat(String(m.specsScore || 0))).toFixed(1),
          stageLabel,
          (m as any).lastContactedAt ? new Date((m as any).lastContactedAt).toLocaleDateString('en-EG') : '',
          m.createdAt ? new Date(m.createdAt).toLocaleDateString('en-EG') : ''
          ];
        })
      ];
      
      const ws = XLSX.utils.aoa_to_sheet(wsData);
      // Style: merge title row, set column widths
      ws['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 25 } }, { s: { r: 1, c: 0 }, e: { r: 1, c: 25 } }];
      ws['!cols'] = [8,8,10,12,20,16,25,14,20,14,8,8,50,20,16,25,14,8,20,50,10,10,10,18,14,12].map(w => ({ wch: w }));
      XLSX.utils.book_append_sheet(wb, ws, 'Matches');
      
      const filename = `CrystalPower-MatchPro-${new Date().toISOString().split('T')[0]}.xlsx`;
      XLSX.writeFile(wb, filename);
      toast.success(`📊 Exported ${filtered.length} matches to Excel`);
    } catch (error) {
      toast.error('Failed to export Excel');
    } finally {
      setIsExporting(false);
    }
  };

  // Quick one-click confirm / reject
  const quickConfirm = trpc.feedback.add.useMutation({
    onSuccess: (_, vars) => {
      setQuickFeedback(prev => ({ ...prev, [vars.matchId]: 'confirmed' }));
      toast.success('Match confirmed — algorithm will learn from this.');
    },
    onError: () => toast.error('Failed to record feedback'),
  });
  const quickReject = trpc.feedback.add.useMutation({
    onSuccess: (_, vars) => {
      setQuickFeedback(prev => ({ ...prev, [vars.matchId]: 'rejected' }));
      toast.success('Match rejected — will improve future results.');
    },
    onError: () => toast.error('Failed to record feedback'),
  });

  const addFeedback = trpc.feedback.add.useMutation({
    onSuccess: () => {
      toast.success("Feedback submitted! Thank you for helping improve match quality.");
      setFeedbackMatchId(null);
      setRating(0);
      setComment("");
      setHelpful(null);
    },
    onError: () => {
      toast.error("Failed to submit feedback");
    }
  });

  const formatPrice = (price: string | number | null) => {
    if (!price) return "N/A";
    const num = parseFloat(String(price));
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M EGP`;
    if (num >= 1000) return `${(num / 1000).toFixed(0)}K EGP`;
    return `${num} EGP`;
  };

  const getScoreColor = (score: number) => {
    if (score >= 90) return "from-emerald-500 to-emerald-600";
    if (score >= 75) return "from-blue-500 to-blue-600";
    if (score >= 60) return "from-amber-500 to-amber-600";
    return "from-red-500 to-red-600";
  };

  const getScoreLabel = (score: number) => {
    if (score >= 90) return { text: "Excellent Match", icon: Sparkles };
    if (score >= 75) return { text: "Good Match", icon: TrendingUp };
    if (score >= 60) return { text: "Moderate Match", icon: Target };
    return { text: "Weak Match", icon: Target };
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "new": return "bg-blue-500/10 text-blue-500 border-blue-500/20";
      case "viewed": return "bg-purple-500/10 text-purple-500 border-purple-500/20";
      case "contacted": return "bg-amber-500/10 text-amber-500 border-amber-500/20";
      case "viewing_scheduled": return "bg-cyan-500/10 text-cyan-500 border-cyan-500/20";
      case "negotiating": return "bg-orange-500/10 text-orange-500 border-orange-500/20";
      case "closed": return "bg-green-500/10 text-green-500 border-green-500/20";
      default: return "bg-gray-500/10 text-gray-500 border-gray-500/20";
    }
  };

  const submitFeedback = () => {
    if (!feedbackMatchId || rating === 0) {
      toast.error("Please select a rating");
      return;
    }
    if (!isAuthenticated) {
      toast.error("Please login to submit feedback");
      return;
    }
    addFeedback.mutate({
      matchId: feedbackMatchId,
      rating,
      comment: comment || undefined,
      helpful: helpful ?? undefined
    });
  };

  const openWhatsApp = (phone: string | null) => {
    if (!phone) {
      toast.error("No phone number available");
      return;
    }
    const cleanPhone = phone.replace(/\D/g, '');
    const intlPhone = cleanPhone.startsWith('0') ? '20' + cleanPhone.slice(1) : cleanPhone;
    window.open(`https://wa.me/${intlPhone}`, '_blank');
  };

  // Filter matches
  const filteredMatches = matches?.filter(match => {
    const score = Math.min(100, parseFloat(String(match.matchScore)));
    const typeScore = Math.min(100, parseFloat(String(match.typeScore || "0")));
    
    // Status filter
    if (statusFilter !== "all" && match.status !== statusFilter) return false;
    
    // Score filter
    if (scoreFilter === "excellent" && score < 90) return false;
    if (scoreFilter === "highconf" && score < 85) return false;
    if (scoreFilter === "good" && (score < 75 || score >= 90)) return false;
    if (scoreFilter === "moderate" && (score < 60 || score >= 75)) return false;
    
    // Type score filter (hide bad property type matches)
    if (typeScore < minTypeScore) return false;
    
    // Property type filter
    if (propertyTypeFilter !== "all") {
      const supplyType = (match as any).supplyPropertyType?.toLowerCase() || "";
      const demandType = (match as any).demandPropertyType?.toLowerCase() || "";
      if (supplyType !== propertyTypeFilter.toLowerCase() && demandType !== propertyTypeFilter.toLowerCase()) {
        return false;
      }
    }
    
    // Contacted-only filter
    if (contactedOnly && !(match as any).lastContactedAt) return false;

    // Search filter (search in summary if available)
    if (searchTerm && match.matchSummary) {
      const searchLower = searchTerm.toLowerCase();
      if (!match.matchSummary.toLowerCase().includes(searchLower)) return false;
    }
    
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Property Matches</h1>
          <p className="text-muted-foreground">AI-powered supply/demand matching with contact details</p>
        </div>
        <div className="flex gap-2 items-center">
          {/* Volume Control */}
          <SoundControlButton />
          {/* Export threshold selector */}
          <div className="flex items-center gap-1 border rounded-md px-2 py-1 bg-muted/30">
            <span className="text-xs text-muted-foreground whitespace-nowrap">Export ≥</span>
            <select
              value={exportMinScore}
              onChange={e => setExportMinScore(Number(e.target.value))}
              className="text-xs bg-transparent border-none outline-none cursor-pointer font-medium"
            >
              <option value={0}>All</option>
              <option value={60}>60%</option>
              <option value={75}>75%</option>
              <option value={85}>85%</option>
              <option value={90}>90%+</option>
              <option value={95}>95%+</option>
            </select>
          </div>
          <Button variant="outline" onClick={handleExportXLSX} disabled={isExporting}>
            <Download className="w-4 h-4 mr-2" />
            {isExporting ? "Exporting..." : "Export Excel (.xlsx)"}
          </Button>
          <div className="flex items-center border rounded-md overflow-hidden">
            <Button
              variant={viewMode === 'list' ? 'default' : 'ghost'}
              size="sm"
              className="rounded-none h-9 px-3"
              onClick={() => setViewMode('list')}
              title="List view"
            >
              <LayoutList className="w-4 h-4" />
            </Button>
            <Button
              variant={viewMode === 'kanban' ? 'default' : 'ghost'}
              size="sm"
              className="rounded-none h-9 px-3"
              onClick={() => setViewMode('kanban')}
              title="Pipeline board view"
            >
              <LayoutGrid className="w-4 h-4" />
            </Button>
          </div>
          <Button variant="outline" onClick={() => refetch()}>
            <RefreshCw className="w-4 h-4 mr-2" /> Refresh
          </Button>
          <Button onClick={() => runMatching.mutate()} disabled={runMatching.isPending}>
            <Target className="w-4 h-4 mr-2" />
            {runMatching.isPending ? "Running..." : "Run Matching"}
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card className="bg-gradient-to-br from-blue-500/10 to-blue-600/5 border-blue-500/20">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Target className="w-4 h-4 text-blue-500" />
              Total Matches
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{matches?.length || 0}</div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-emerald-500/10 to-emerald-600/5 border-emerald-500/20">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-emerald-500" />
              Excellent (90%+)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-emerald-500">
              {matches?.filter(m => Math.min(100, parseFloat(String(m.matchScore))) >= 90).length || 0}
            </div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-amber-500/10 to-amber-600/5 border-amber-500/20">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Clock className="w-4 h-4 text-amber-500" />
              Pending Review
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-amber-500">
              {matches?.filter(m => m.status === "new").length || 0}
            </div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-green-500/10 to-green-600/5 border-green-500/20">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-green-500" />
              Contacted
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-green-500">
              {matches?.filter(m => m.status === "contacted" || m.status === "closed").length || 0}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* CRM Conversion Funnel */}
      {funnel && (
        <Card className="border-primary/20">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-primary" />
              CRM Pipeline — Conversion Funnel
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-1 flex-wrap">
              {([
                { key: 'new', label: 'New', color: 'bg-blue-500', count: funnel.new },
                { key: 'viewed', label: 'Viewed', color: 'bg-purple-500', count: funnel.viewed },
                { key: 'contacted', label: 'Contacted', color: 'bg-amber-500', count: funnel.contacted },
                { key: 'viewing_scheduled', label: 'Viewing', color: 'bg-cyan-500', count: funnel.viewingScheduled },
                { key: 'negotiating', label: 'Negotiating', color: 'bg-orange-500', count: funnel.negotiating },
                { key: 'closed', label: 'Closed', color: 'bg-green-500', count: funnel.closed },
              ] as const).map((stage, i, arr) => (
                <>
                  <button
                    key={stage.key}
                    onClick={() => setStatusFilter(stage.key)}
                    className={`flex flex-col items-center px-4 py-2 rounded-lg border transition-all hover:scale-105 cursor-pointer ${
                      statusFilter === stage.key ? 'border-primary bg-primary/10 ring-1 ring-primary' : 'border-border bg-muted/30'
                    }`}
                  >
                    <div className={`w-3 h-3 rounded-full ${stage.color} mb-1`} />
                    <div className="text-xl font-bold">{stage.count.toLocaleString()}</div>
                    <div className="text-xs text-muted-foreground">{stage.label}</div>
                    {stage.count > 0 && funnel.total > 0 && (
                      <div className="text-xs text-muted-foreground">{(Number(stage.count) / Number(funnel.total) * 100).toFixed(1)}%</div>
                    )}
                  </button>
                  {i < arr.length - 1 && <ChevronRight className="w-4 h-4 text-muted-foreground flex-shrink-0" />}
                </>
              ))}
              <div className="ml-auto text-right">
                <div className="text-xs text-muted-foreground">Conversion</div>
                <div className="text-lg font-bold text-green-500">
                  {funnel.total > 0 ? (Number(funnel.closed) / Number(funnel.total) * 100).toFixed(1) : '0.0'}%
                </div>
                <div className="text-xs text-muted-foreground">{funnel.closed} closed</div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-wrap gap-4 items-center">
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm font-medium">Filters:</span>
            </div>
            <div className="relative flex-1 max-w-xs">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input 
                placeholder="Search matches..." 
                className="pl-9"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <Select value={scoreFilter} onValueChange={setScoreFilter}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Score" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Scores</SelectItem>
                <SelectItem value="excellent">Excellent (90%+)</SelectItem>
                <SelectItem value="highconf">High Confidence (85%+)</SelectItem>
                <SelectItem value="good">Good (75-89%)</SelectItem>
                <SelectItem value="moderate">Moderate (60-74%)</SelectItem>
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="new">New</SelectItem>
                <SelectItem value="viewed">Viewed</SelectItem>
                <SelectItem value="contacted">Contacted</SelectItem>
                <SelectItem value="viewing_scheduled">Viewing Scheduled</SelectItem>
                <SelectItem value="negotiating">Negotiating</SelectItem>
                <SelectItem value="closed">Closed</SelectItem>
              </SelectContent>
            </Select>
            <Select value={propertyTypeFilter} onValueChange={setPropertyTypeFilter}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Property Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="apartment">Apartment</SelectItem>
                <SelectItem value="villa">Villa</SelectItem>
                <SelectItem value="duplex">Duplex</SelectItem>
                <SelectItem value="penthouse">Penthouse</SelectItem>
                <SelectItem value="studio">Studio</SelectItem>
                <SelectItem value="townhouse">Townhouse</SelectItem>
              </SelectContent>
            </Select>
            <Select value={minTypeScore.toString()} onValueChange={(v) => setMinTypeScore(Number(v))}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Type Match" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="0">Any Type Match</SelectItem>
                <SelectItem value="50">Type Match ≥50%</SelectItem>
                <SelectItem value="60">Type Match ≥60%</SelectItem>
                <SelectItem value="100">Exact Type Match</SelectItem>
              </SelectContent>
            </Select>
            <Button
              variant={contactedOnly ? "default" : "outline"}
              size="sm"
              onClick={() => setContactedOnly(v => !v)}
              title="Show only matches you have already contacted"
              className={contactedOnly ? 'bg-amber-500 hover:bg-amber-600 text-white border-amber-500' : ''}
            >
              <CheckCheck className="w-4 h-4 mr-1" />
              Contacted Only
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Kanban Board View */}
      {viewMode === 'kanban' && (
        <div className="overflow-x-auto pb-4">
          <div className="flex gap-4 min-w-max">
            {([
              { key: 'new', label: '🆕 New', color: 'border-blue-500/40 bg-blue-500/5' },
              { key: 'contacted', label: '📞 Contacted', color: 'border-amber-500/40 bg-amber-500/5' },
              { key: 'viewing_scheduled', label: '👁️ Viewing', color: 'border-cyan-500/40 bg-cyan-500/5' },
              { key: 'negotiating', label: '🤝 Negotiating', color: 'border-orange-500/40 bg-orange-500/5' },
              { key: 'closed', label: '✅ Closed', color: 'border-green-500/40 bg-green-500/5' },
            ] as const).map(stage => {
              const stageMatches = filteredMatches?.filter(m => (m.status || 'new') === stage.key) || [];
              return (
                <div key={stage.key} className={`w-72 flex-shrink-0 rounded-xl border-2 ${stage.color} p-3`}>
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-semibold text-sm">{stage.label}</h3>
                    <Badge variant="secondary" className="text-xs">{stageMatches.length}</Badge>
                  </div>
                  <div className="space-y-2 max-h-[600px] overflow-y-auto">
                    {stageMatches.length === 0 ? (
                      <div className="text-center text-muted-foreground text-xs py-8 opacity-60">No matches</div>
                    ) : stageMatches.map(match => {
                      const score = Math.min(100, parseFloat(String(match.matchScore)));
                      return (
                        <Card key={match.id} className="p-3 cursor-pointer hover:shadow-md transition-shadow bg-background">
                          <div className="flex items-center justify-between mb-2">
                            <Badge className={`text-xs font-bold ${
                              score >= 90 ? 'bg-emerald-500 text-white' :
                              score >= 85 ? 'bg-blue-500 text-white' :
                              score >= 75 ? 'bg-amber-500 text-white' : 'bg-muted text-muted-foreground'
                            }`}>{score.toFixed(0)}%</Badge>
                            <span className="text-xs text-muted-foreground">{match.supplyPurpose === 'rent' ? '🔑 Rent' : '🏷️ Sale'}</span>
                          </div>
                          <div className="text-xs space-y-1">
                            <div className="font-medium truncate">{match.sellerName || 'Seller'}</div>
                            <div className="text-muted-foreground truncate">{match.buyerName || 'Buyer'}</div>
                            {match.supplyLocation && (
                              <div className="flex items-center gap-1 text-muted-foreground">
                                <MapPin className="w-3 h-3" />
                                <span className="truncate">{match.supplyLocation}</span>
                              </div>
                            )}
                          </div>
                          <div className="flex gap-1 mt-2">
                            {match.sellerPhone && (
                              <a href={`https://wa.me/${match.sellerPhone.replace(/[^0-9]/g, '')}`} target="_blank" rel="noopener noreferrer">
                                <Button size="sm" variant="outline" className="h-6 px-2 text-xs">
                                  <Phone className="w-3 h-3" />
                                </Button>
                              </a>
                            )}
                          </div>
                        </Card>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Matches List */}
      <div className="space-y-4" style={{ display: viewMode === 'list' ? undefined : 'none' }}>
        {isLoading ? (
          <Card>
            <CardContent className="flex items-center justify-center h-40">
              <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
            </CardContent>
          </Card>
        ) : !filteredMatches || filteredMatches.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center h-40 text-muted-foreground">
              <Target className="h-12 w-12 mb-4 opacity-50" />
              <p>No matches found</p>
              <p className="text-sm">Run the matching algorithm to find matches</p>
            </CardContent>
          </Card>
        ) : (
          filteredMatches.map((match) => {
            const score = Math.min(100, parseFloat(String(match.matchScore)));
            const scoreInfo = getScoreLabel(score);
            const ScoreIcon = scoreInfo.icon;
            const matchAge = match.createdAt ? Date.now() - new Date(match.createdAt).getTime() : Infinity;
            const isNew = matchAge < 3600000; // < 1 hour
            const timeLabel = matchAge < 60000 ? 'Just now'
              : matchAge < 3600000 ? `${Math.floor(matchAge / 60000)}m ago`
              : matchAge < 86400000 ? `${Math.floor(matchAge / 3600000)}h ago`
              : new Date(match.createdAt).toLocaleDateString('en-EG', { day: 'numeric', month: 'short' });

            return (
              <Card key={match.id} className={`overflow-hidden hover:shadow-lg transition-shadow ${isNew ? 'ring-2 ring-emerald-400/60' : ''}`}>
                {/* Score Header */}
                <div className={`bg-gradient-to-r ${getScoreColor(score)} p-4 text-white`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="bg-white/20 rounded-full p-2">
                        <ScoreIcon className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="text-2xl font-bold">{Number(score).toFixed(0)}%</div>
                        <div className="text-sm opacity-90">{scoreInfo.text}</div>
                        <div className="text-xs opacity-75 mt-0.5 flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          <span>{timeLabel}</span>
                          {isNew && <span className="bg-white/30 text-white text-xs px-1.5 py-0.5 rounded-full font-bold ml-1">NEW</span>}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      {(match.supplyPurpose || match.demandPurpose) && (
                        <Badge className={`border font-bold uppercase tracking-wide ${
                          (match.supplyPurpose || match.demandPurpose) === 'rent'
                            ? 'bg-purple-600 text-white border-purple-400'
                            : 'bg-amber-600 text-white border-amber-400'
                        }`}>
                          {(match.supplyPurpose || match.demandPurpose) === 'rent' ? '🔑 RENT' : '🏷️ SALE'}
                        </Badge>
                      )}
                      <Badge className={`${getStatusColor(match.status || 'new')} border`}>
                        {(match.status || 'new').replace('_', ' ')}
                      </Badge>
                      {match.notified === 1 && (
                        <div className="flex flex-col gap-0.5">
                          <Badge variant="outline" className="bg-green-500/20 border-green-400/40 text-green-300 flex items-center gap-1">
                            ✅ Notified
                          </Badge>
                          {match.brokerPhone && (
                            <span className="text-xs text-white/50 pl-1">→ +{match.brokerPhone}</span>
                          )}
                          {match.notifiedAt && (
                            <span className="text-xs text-white/40 pl-1">{new Date(match.notifiedAt).toLocaleString()}</span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <CardContent className="p-6">
                  {/* ===== CONTACTS - ALWAYS VISIBLE ===== */}
                  <div className="mb-6 grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* SUPPLY CONTACT */}
                    <div className="p-4 rounded-xl border-2 border-emerald-500/30 bg-emerald-500/5">
                      <div className="flex items-center gap-2 mb-2">
                        <div className="w-8 h-8 rounded-full bg-emerald-500 flex items-center justify-center">
                          <Home className="w-4 h-4 text-white" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-xs font-semibold text-emerald-600 uppercase tracking-wider flex items-center gap-1">
                            SELLER / SUPPLY
                            {match.supplyPurpose && (
                              <span className={`ml-1 px-1.5 py-0.5 rounded text-xs font-bold ${
                                match.supplyPurpose === 'rent' ? 'bg-purple-100 text-purple-700' : 'bg-amber-100 text-amber-700'
                              }`}>{match.supplyPurpose === 'rent' ? 'FOR RENT' : 'FOR SALE'}</span>
                            )}
                          </div>
                          <div className="font-bold text-lg truncate">{match.supplyContactName || (match as any).supplyName || 'N/A'}</div>
                          {(match as any).supplyGroupName && (
                            <div className="flex items-center gap-1 mt-0.5">
                              <span className="text-xs">📢</span>
                              <span className="text-xs text-emerald-600 dark:text-emerald-400 font-medium truncate max-w-[180px]" title={(match as any).supplyGroupName}>{(match as any).supplyGroupName}</span>
                            </div>
                          )}
                        </div>
                      </div>
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="w-full justify-center gap-2 border-emerald-500/30 text-emerald-700 hover:bg-emerald-500/10 font-bold text-base py-3 mb-2"
                        onClick={() => openWhatsApp(match.supplyContactPhone || (match as any).supplyPhone)}
                      >
                        <Phone className="w-5 h-5" />
                        {match.supplyContactPhone || (match as any).supplyPhone || 'No phone'}
                        <ExternalLink className="w-4 h-4 ml-1" />
                      </Button>
                      {(match as any).supplyOriginalMessage && (
                        <div className="mt-1 p-2 bg-emerald-50 dark:bg-emerald-950/30 rounded-lg border border-emerald-200 dark:border-emerald-800">
                          <div className="text-xs text-emerald-600 font-semibold mb-1 flex items-center gap-1">
                            <MessageSquare className="w-3 h-3" /> Original Message
                          </div>
                          <p className="text-xs text-foreground/80 leading-relaxed line-clamp-3">{(match as any).supplyOriginalMessage}</p>
                        </div>
                      )}
                    </div>
                    {/* DEMAND CONTACT */}
                    <div className="p-4 rounded-xl border-2 border-blue-500/30 bg-blue-500/5">
                      <div className="flex items-center gap-2 mb-2">
                        <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center">
                          <User className="w-4 h-4 text-white" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-xs font-semibold text-blue-600 uppercase tracking-wider flex items-center gap-1">
                            BUYER / DEMAND
                            {match.demandPurpose && (
                              <span className={`ml-1 px-1.5 py-0.5 rounded text-xs font-bold ${
                                match.demandPurpose === 'rent' ? 'bg-purple-100 text-purple-700' : 'bg-amber-100 text-amber-700'
                              }`}>{match.demandPurpose === 'rent' ? 'WANTS RENT' : 'WANTS BUY'}</span>
                            )}
                          </div>
                          <div className="font-bold text-lg truncate">{match.demandContactName || (match as any).demandName || 'N/A'}</div>
                          {(match as any).demandGroupName && (
                            <div className="flex items-center gap-1 mt-0.5">
                              <span className="text-xs">📢</span>
                              <span className="text-xs text-blue-600 dark:text-blue-400 font-medium truncate max-w-[180px]" title={(match as any).demandGroupName}>{(match as any).demandGroupName}</span>
                            </div>
                          )}
                        </div>
                      </div>
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="w-full justify-center gap-2 border-blue-500/30 text-blue-700 hover:bg-blue-500/10 font-bold text-base py-3 mb-2"
                        onClick={() => openWhatsApp(match.demandContactPhone || (match as any).demandPhone)}
                      >
                        <Phone className="w-5 h-5" />
                        {match.demandContactPhone || (match as any).demandPhone || 'No phone'}
                        <ExternalLink className="w-4 h-4 ml-1" />
                      </Button>
                      {(match as any).demandOriginalMessage && (
                        <div className="mt-1 p-2 bg-blue-50 dark:bg-blue-950/30 rounded-lg border border-blue-200 dark:border-blue-800">
                          <div className="text-xs text-blue-600 font-semibold mb-1 flex items-center gap-1">
                            <MessageSquare className="w-3 h-3" /> Original Message
                          </div>
                          <p className="text-xs text-foreground/80 leading-relaxed line-clamp-3">{(match as any).demandOriginalMessage}</p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Match Summary */}
                  {match.matchSummary && (
                    <div className="mb-6 p-4 bg-muted/50 rounded-lg border-l-4 border-primary">
                      <p className="text-sm whitespace-pre-line font-medium">{match.matchSummary}</p>
                    </div>
                  )}

                  {/* Score Breakdown */}
                  <div className="mb-6">
                    <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Match Breakdown</div>
                    <div className="space-y-2">
                      {[
                        { label: 'Location', icon: MapPin, score: Math.min(100, parseFloat(String(match.locationScore || 0))), weight: '30%' },
                        { label: 'Price', icon: DollarSign, score: Math.min(100, parseFloat(String(match.priceScore || 0))), weight: '25%' },
                        { label: 'Property Type', icon: Home, score: Math.min(100, parseFloat(String((match as any).typeScore || 0))), weight: '30%' },
                        { label: 'Specs', icon: Target, score: Math.min(100, parseFloat(String(match.specsScore || 0))), weight: '10%' },
                        { label: 'Amenities', icon: CheckCircle, score: Math.min(100, parseFloat(String((match as any).amenityScore || 0))), weight: '5%' },
                      ].map(({ label, icon: Icon, score: s, weight }) => (
                        <div key={label} className="flex items-center gap-3">
                          <div className="flex items-center gap-1.5 w-32 shrink-0">
                            <Icon className="w-3.5 h-3.5 text-muted-foreground" />
                            <span className="text-xs text-muted-foreground">{label}</span>
                            <span className="text-xs text-muted-foreground/50">({weight})</span>
                          </div>
                          <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all ${
                                s >= 90 ? 'bg-green-500' : s >= 75 ? 'bg-emerald-400' : s >= 60 ? 'bg-yellow-400' : s >= 40 ? 'bg-orange-400' : 'bg-red-400'
                              }`}
                              style={{ width: `${s}%` }}
                            />
                          </div>
                          <div className={`text-sm font-bold w-10 text-right ${
                            s >= 90 ? 'text-green-600' : s >= 75 ? 'text-emerald-600' : s >= 60 ? 'text-yellow-600' : 'text-red-500'
                          }`}>{Number(s).toFixed(0)}%</div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Match Explanation */}
                  {match.matchExplanation && (
                    <div className="mb-4 p-3 bg-primary/5 border border-primary/20 rounded-lg flex items-start gap-2">
                      <CheckCircle className="w-4 h-4 text-primary mt-0.5 shrink-0" />
                      <p className="text-sm font-medium">{match.matchExplanation}</p>
                    </div>
                  )}
                  {/* Quick Confirm / Reject */}
                  <div className="flex items-center gap-2 mb-4 p-3 bg-muted/40 rounded-lg">
                    <span className="text-xs text-muted-foreground mr-1">Is this a good match?</span>
                    {quickFeedback[match.id] === 'confirmed' ? (
                      <Badge className="bg-green-600 text-white gap-1"><CheckCheck className="w-3 h-3" /> Confirmed</Badge>
                    ) : quickFeedback[match.id] === 'rejected' ? (
                      <Badge variant="destructive" className="gap-1"><Ban className="w-3 h-3" /> Rejected</Badge>
                    ) : (
                      <>
                        <Button
                          size="sm" variant="outline"
                          className="h-7 text-xs border-green-500/50 text-green-600 hover:bg-green-500/10"
                          disabled={quickConfirm.isPending}
                          onClick={() => quickConfirm.mutate({ matchId: match.id, rating: 5, helpful: true })}
                        >
                          <ThumbsUp className="w-3 h-3 mr-1" /> Good match
                        </Button>
                        <Button
                          size="sm" variant="outline"
                          className="h-7 text-xs border-red-500/50 text-red-600 hover:bg-red-500/10"
                          disabled={quickReject.isPending}
                          onClick={() => quickReject.mutate({ matchId: match.id, rating: 1, helpful: false })}
                        >
                          <ThumbsDown className="w-3 h-3 mr-1" /> False match
                        </Button>
                      </>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex flex-wrap gap-2 pt-4 border-t">
                    <Dialog>
                      <DialogTrigger asChild>
                        <Button variant="outline" size="sm" onClick={() => setSelectedMatch(match.id)}>
                          <Eye className="w-4 h-4 mr-2" /> View Full Details
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
                        <DialogHeader>
                          <DialogTitle className="flex items-center gap-2">
                            <Target className="w-5 h-5" />
                            Match Details - {Number(score).toFixed(0)}% Match
                            {avgRating && (
                              <Badge variant="outline" className="ml-2">
                                <Star className="w-3 h-3 mr-1 fill-yellow-500 text-yellow-500" />
                                {Number(avgRating).toFixed(1)} avg rating
                              </Badge>
                            )}
                          </DialogTitle>
                        </DialogHeader>
                        {detailsLoading ? (
                          <div className="flex items-center justify-center py-12">
                            <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
                            <span className="ml-3 text-muted-foreground">Loading match details...</span>
                          </div>
                        ) : matchDetails ? (
                          <div className="space-y-6">
                            {/* Summary Card */}
                            {matchDetails.match?.matchSummary && (
                              <div className="p-4 bg-primary/5 rounded-lg border border-primary/20">
                                <h3 className="font-semibold mb-2">Match Summary</h3>
                                <p className="whitespace-pre-line">{matchDetails.match.matchSummary}</p>
                              </div>
                            )}

                            {/* Buyer & Seller Cards */}
                            <div className="grid md:grid-cols-2 gap-4">
                              {/* Buyer (Demand) */}
                              <Card className="border-2 border-blue-500/20">
                                <CardHeader className="pb-2 bg-blue-500/5">
                                  <CardTitle className="text-base flex items-center gap-2">
                                    <User className="w-4 h-4 text-blue-500" />
                                    Buyer / Looking For
                                  </CardTitle>
                                </CardHeader>
                                <CardContent className="pt-4">
                                  {matchDetails.demand ? (
                                    <div className="space-y-3">
                                      <div className="flex items-center gap-2 text-lg font-semibold">
                                        {matchDetails.demand.contactName || "Anonymous Buyer"}
                                      </div>
                                      {matchDetails.demand.contact && (
                                        <Button 
                                          variant="outline" 
                                          size="sm" 
                                          className="w-full justify-start text-blue-500"
                                          onClick={() => openWhatsApp(matchDetails.demand?.contact || null)}
                                        >
                                          <Phone className="w-4 h-4 mr-2" />
                                          {matchDetails.demand.contact}
                                          <ExternalLink className="w-3 h-3 ml-auto" />
                                        </Button>
                                      )}
                                      <div className="grid grid-cols-2 gap-2 text-sm">
                                        <div className="flex items-center gap-2">
                                          <Home className="w-4 h-4 text-muted-foreground" />
                                          {matchDetails.demand.propertyType || "Any"}
                                        </div>
                                        <div className="flex items-center gap-2">
                                          <MapPin className="w-4 h-4 text-muted-foreground" />
                                          {matchDetails.demand.location || "Any"}
                                        </div>
                                        <div className="flex items-center gap-2">
                                          <DollarSign className="w-4 h-4 text-muted-foreground" />
                                          Budget: {formatPrice(matchDetails.demand.priceMax)}
                                        </div>
                                        <div className="flex items-center gap-2">
                                          <BedDouble className="w-4 h-4 text-muted-foreground" />
                                          {matchDetails.demand.bedrooms || "Any"} BR
                                        </div>
                                      </div>
                                    </div>
                                  ) : (
                                    <p className="text-muted-foreground">No demand data</p>
                                  )}
                                </CardContent>
                              </Card>

                              {/* Seller (Supply) */}
                              <Card className="border-2 border-emerald-500/20">
                                <CardHeader className="pb-2 bg-emerald-500/5">
                                  <CardTitle className="text-base flex items-center gap-2">
                                    <Home className="w-4 h-4 text-emerald-500" />
                                    Seller / Property
                                  </CardTitle>
                                </CardHeader>
                                <CardContent className="pt-4">
                                  {matchDetails.supply ? (
                                    <div className="space-y-3">
                                      <div className="flex items-center gap-2 text-lg font-semibold">
                                        {matchDetails.supply.contactName || "Anonymous Seller"}
                                      </div>
                                      {matchDetails.supply.contact && (
                                        <Button 
                                          variant="outline" 
                                          size="sm" 
                                          className="w-full justify-start text-emerald-500"
                                          onClick={() => openWhatsApp(matchDetails.supply?.contact || null)}
                                        >
                                          <Phone className="w-4 h-4 mr-2" />
                                          {matchDetails.supply.contact}
                                          <ExternalLink className="w-3 h-3 ml-auto" />
                                        </Button>
                                      )}
                                      <div className="grid grid-cols-2 gap-2 text-sm">
                                        <div className="flex items-center gap-2">
                                          <Home className="w-4 h-4 text-muted-foreground" />
                                          {matchDetails.supply.propertyType || "N/A"}
                                        </div>
                                        <div className="flex items-center gap-2">
                                          <MapPin className="w-4 h-4 text-muted-foreground" />
                                          {matchDetails.supply.location || "N/A"}
                                        </div>
                                        <div className="flex items-center gap-2">
                                          <DollarSign className="w-4 h-4 text-muted-foreground" />
                                          {formatPrice(matchDetails.supply.price)}
                                        </div>
                                        <div className="flex items-center gap-2">
                                          <Ruler className="w-4 h-4 text-muted-foreground" />
                                          {matchDetails.supply.size || "N/A"} m²
                                        </div>
                                        <div className="flex items-center gap-2">
                                          <BedDouble className="w-4 h-4 text-muted-foreground" />
                                          {matchDetails.supply.bedrooms || "N/A"} BR
                                        </div>
                                      </div>
                                    </div>
                                  ) : (
                                    <p className="text-muted-foreground">No supply data</p>
                                  )}
                                </CardContent>
                              </Card>
                            </div>

                            {/* Match Explanation */}
                            {matchDetails.match?.matchExplanation && (
                              <Card>
                                <CardHeader className="pb-2">
                                  <CardTitle className="text-base">Match Analysis</CardTitle>
                                </CardHeader>
                                <CardContent>
                                  <pre className="text-sm whitespace-pre-wrap font-mono bg-muted p-4 rounded-lg">
                                    {matchDetails.match.matchExplanation}
                                  </pre>
                                </CardContent>
                              </Card>
                            )}

                            {/* Notes & Actions */}
                            <Card>
                              <CardHeader className="pb-2">
                                <CardTitle className="text-base">Notes & Follow-up</CardTitle>
                              </CardHeader>
                              <CardContent className="space-y-4">
                                <div>
                                  <Label>Notes</Label>
                                  <Textarea 
                                    placeholder="Add notes about this match..."
                                    defaultValue={matchDetails.match?.notes || ""}
                                    onChange={(e) => setNotes(e.target.value)}
                                  />
                                </div>
                                <div className="flex gap-2">
                                  <Button 
                                    variant="outline" 
                                    size="sm"
                                    onClick={() => {
                                      if (selectedMatch) {
                                        updateNotes.mutate({ matchId: selectedMatch, notes });
                                      }
                                    }}
                                  >
                                    Save Notes
                                  </Button>
                                </div>
                              </CardContent>
                            </Card>

                            {/* Feedback */}
                            {matchFeedback && matchFeedback.length > 0 && (
                              <Card>
                                <CardHeader className="pb-2">
                                  <CardTitle className="text-base">User Feedback</CardTitle>
                                </CardHeader>
                                <CardContent>
                                  <div className="space-y-2">
                                    {matchFeedback.map((fb: any, idx: number) => (
                                      <div key={idx} className="flex items-center gap-2 text-sm">
                                        <div className="flex">
                                          {[1,2,3,4,5].map(s => (
                                            <Star key={s} className={`w-3 h-3 ${s <= fb.rating ? 'fill-yellow-500 text-yellow-500' : 'text-gray-300'}`} />
                                          ))}
                                        </div>
                                        {fb.comment && <span className="text-muted-foreground">- {fb.comment}</span>}
                                      </div>
                                    ))}
                                  </div>
                                </CardContent>
                              </Card>
                            )}
                          </div>
                        ) : null}
                        <DialogFooter>
                          <Button variant="outline" onClick={() => setSelectedMatch(null)}>
                            Close
                          </Button>
                        </DialogFooter>
                      </DialogContent>
                    </Dialog>

                    <Select 
                      value={match.status || "new"} 
                      onValueChange={(value) => updateStatus.mutate({ matchId: match.id, status: value as any, note: statusNote || undefined })}
                    >
                      <SelectTrigger className="w-40">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="new">New</SelectItem>
                        <SelectItem value="viewed">Viewed</SelectItem>
                        <SelectItem value="contacted">Contacted</SelectItem>
                        <SelectItem value="viewing_scheduled">Viewing Scheduled</SelectItem>
                        <SelectItem value="negotiating">Negotiating</SelectItem>
                        <SelectItem value="closed">Closed</SelectItem>
                      </SelectContent>
                    </Select>

                    {/* History Dialog */}
                    <Dialog onOpenChange={(open) => { if (open) setHistoryMatchId(match.id); else setHistoryMatchId(null); }}>
                      <DialogTrigger asChild>
                        <Button variant="outline" size="sm">
                          <History className="w-4 h-4 mr-1" /> History
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="max-w-md">
                        <DialogHeader>
                          <DialogTitle>Status History — Match #{match.id}</DialogTitle>
                        </DialogHeader>
                        <div className="space-y-2 max-h-80 overflow-y-auto">
                          {!statusHistory || statusHistory.length === 0 ? (
                            <p className="text-sm text-muted-foreground text-center py-4">No history yet. Status changes will appear here.</p>
                          ) : statusHistory.map((h: any) => (
                            <div key={h.id} className="flex gap-3 text-sm border-l-2 border-primary/30 pl-3 py-1">
                              <div className="flex-1">
                                <div className="flex items-center gap-2">
                                  <span className="font-medium">{h.fromStatus ?? 'new'}</span>
                                  <ChevronRight className="w-3 h-3" />
                                  <span className="font-bold text-primary">{h.toStatus}</span>
                                </div>
                                {h.note && <div className="text-muted-foreground text-xs mt-0.5">{h.note}</div>}
                                <div className="text-xs text-muted-foreground mt-0.5">
                                  {h.changedByName} · {new Date(h.createdAt).toLocaleString()}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                        <DialogFooter>
                          <Button variant="outline" size="sm" onClick={() => setHistoryMatchId(null)}>Close</Button>
                        </DialogFooter>
                      </DialogContent>
                    </Dialog>

                    <Dialog>
                      <DialogTrigger asChild>
                        <Button variant="outline" size="sm" onClick={() => setFeedbackMatchId(match.id)}>
                          <Star className="w-4 h-4 mr-2" /> Rate Match
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Rate This Match</DialogTitle>
                        </DialogHeader>
                        <div className="space-y-4">
                          <div>
                            <Label>Rating</Label>
                            <div className="flex gap-1 mt-2">
                              {[1,2,3,4,5].map((s) => (
                                <button
                                  key={s}
                                  onClick={() => setRating(s)}
                                  onMouseEnter={() => setHoverRating(s)}
                                  onMouseLeave={() => setHoverRating(0)}
                                  className="p-1"
                                >
                                  <Star className={`w-8 h-8 transition-colors ${
                                    s <= (hoverRating || rating) 
                                      ? 'fill-yellow-500 text-yellow-500' 
                                      : 'text-gray-300'
                                  }`} />
                                </button>
                              ))}
                            </div>
                          </div>
                          <div>
                            <Label>Was this match helpful?</Label>
                            <div className="flex gap-2 mt-2">
                              <Button 
                                variant={helpful === true ? "default" : "outline"} 
                                size="sm"
                                onClick={() => setHelpful(true)}
                              >
                                <ThumbsUp className="w-4 h-4 mr-2" /> Yes
                              </Button>
                              <Button 
                                variant={helpful === false ? "default" : "outline"} 
                                size="sm"
                                onClick={() => setHelpful(false)}
                              >
                                <ThumbsDown className="w-4 h-4 mr-2" /> No
                              </Button>
                            </div>
                          </div>
                          <div>
                            <Label>Comments (optional)</Label>
                            <Textarea 
                              placeholder="Share your feedback..."
                              value={comment}
                              onChange={(e) => setComment(e.target.value)}
                            />
                          </div>
                        </div>
                        <DialogFooter>
                          <Button variant="outline" onClick={() => setFeedbackMatchId(null)}>Cancel</Button>
                          <Button onClick={submitFeedback}>Submit Feedback</Button>
                        </DialogFooter>
                      </DialogContent>
                    </Dialog>

                    <div className="ml-auto flex flex-col items-end gap-1">
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 text-xs border-green-500/50 text-green-600 hover:bg-green-500/10"
                        disabled={updateLastContacted.isPending}
                        onClick={() => updateLastContacted.mutate({ matchId: match.id })}
                      >
                        <Phone className="w-3 h-3 mr-1" />
                        Mark Contacted
                      </Button>
                      {(lastContactedMap[match.id] || (match as any).lastContactedAt) && (
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          Last: {new Date(lastContactedMap[match.id] || (match as any).lastContactedAt).toLocaleString()}
                        </span>
                      )}
                      <span className="text-xs text-muted-foreground">
                        {new Date(match.createdAt).toLocaleString()}
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
}
