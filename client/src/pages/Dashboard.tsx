import { useEffect, useState, useCallback, useRef } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  Building2, 
  TrendingUp, 
  Users, 
  MessageSquare, 
  Target, 
  Bell,
  Wifi,
  WifiOff,
  RefreshCw,
  Volume2,
  VolumeX,
  BellRing
} from "lucide-react";
import { io, Socket } from "socket.io-client";
import { toast } from "sonner";
import { useNotificationSound } from "@/hooks/useNotificationSound";
import { useSound } from "@/contexts/SoundContext";
import { Slider } from "@/components/ui/slider";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MatchAlertContainer, type MatchAlertData } from "@/components/HighConfidenceMatchAlert";
import { LiveMessageFeed } from "@/components/LiveMessageFeed";
import { HighPriorityTicker } from "@/components/HighPriorityTicker";
import { useLocation } from "wouter";
import { useAuth } from "@/_core/hooks/useAuth";

interface LiveMessage {
  id: number;
  text: string;
  group: string;
  sender: string;
  classification: "supply" | "demand" | "unknown";
  timestamp: string;
  contact?: {
    name?: string;
    phone?: string;
    phoneFormatted?: string;
    whatsappLink?: string;
  };
  data: {
    propertyType?: string;
    location?: string;
    price?: number;
    size?: number;
    bedrooms?: number;
    purpose?: string;
  };
  matches: number;
}

export default function Dashboard() {
  const { user } = useAuth();
  const role = (user as any)?.role ?? "user";
  const [socket, setSocket] = useState<Socket | null>(null);
  const [connected, setConnected] = useState(false);
  const [webhookStatus, setWebhookStatus] = useState<'connected' | 'disconnected'>('disconnected');
  const [liveMessages, setLiveMessages] = useState<LiveMessage[]>([]);
  const [matchAlerts, setMatchAlerts] = useState<MatchAlertData[]>([]);
  const { volume, setVolume, muted, toggleMute, playTestCoin, playCoins } = useSound();
  const soundEnabled = !muted && volume > 0;
  const [, navigate] = useLocation();
  const [selectedArea, setSelectedArea] = useState<string | null>(null);

  const { data: stats, refetch: refetchStats } = trpc.dashboard.stats.useQuery(
    selectedArea ? { area: selectedArea } : {},
    { refetchInterval: 30000 }
  );
  const { data: recentMatches, refetch: refetchMatches } = trpc.matches.highConfidence.useQuery({ minScore: 85, limit: 5 });
  const { data: notifications, refetch: refetchNotifications } = trpc.notifications.unread.useQuery({ limit: 5 });
  const { data: notificationCount } = trpc.notifications.count.useQuery();
  const { data: health } = trpc.systemHealth.getStatus.useQuery(undefined, { refetchInterval: 10000 });
  // Live match polling: track the last seen timestamp, poll every 30s for new high-confidence matches
  const [lastSeenTs, setLastSeenTs] = useState<number>(() => Date.now());
  const lastSeenTsRef = useRef(lastSeenTs);
  const prevPollCountRef = useRef<number | null>(null);
  useEffect(() => { lastSeenTsRef.current = lastSeenTs; }, [lastSeenTs]);

  const { data: newMatchData } = trpc.matches.newSince.useQuery(
    { sinceTimestamp: lastSeenTs, minScore: 85 },
    { refetchInterval: 30_000 }
  );

  useEffect(() => {
    if (!newMatchData) return;
    // Skip the very first result (baseline load)
    if (prevPollCountRef.current === null) {
      prevPollCountRef.current = newMatchData.count;
      return;
    }
    if (newMatchData.count > 0) {
      playCoins(newMatchData.count);
      const delay = Math.min(newMatchData.count, 12) * 160 + 200;
      setTimeout(() => {
        toast.success(
          `💰 ${newMatchData.count} new match${newMatchData.count === 1 ? '' : 'es'} found!`,
          {
            description: `${newMatchData.count} high-confidence match${newMatchData.count === 1 ? '' : 'es'} just arrived`,
            duration: 6000,
          }
        );
      }, delay);
      setLastSeenTs(Date.now());
      prevPollCountRef.current = 0;
      refetchMatches();
      refetchStats();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [newMatchData]);

  const { playMatchSound: _playMatchSound, playNotificationSound: _playNotificationSound, requestPermission, showBrowserNotification } = useNotificationSound();
  const playMatchSound = () => { if (soundEnabled) playCoins(1); };
  const playNotificationSound = () => { if (soundEnabled) playCoins(1); };

  // Request browser notification permission on mount
  // Request browser notification permission on mount
  useEffect(() => {
    requestPermission();
  }, [requestPermission]);

  // Update webhook status based on health data
  useEffect(() => {
    if (health?.whatsappStatus === 'connected') {
      setWebhookStatus('connected');
    } else {
      setWebhookStatus('disconnected');
    }
  }, [health?.whatsappStatus]);

  // Socket.IO connection with enhanced notification handling
  useEffect(() => {
    const socketInstance = io({
      path: "/api/socket.io",
      transports: ["websocket", "polling"]
    });

    socketInstance.on("connect", () => {
      setConnected(true);
      toast.success("Connected to live feed");
    });

    socketInstance.on("disconnect", () => {
      setConnected(false);
      toast.error("Disconnected from live feed");
    });

    socketInstance.on("new_message", (data: LiveMessage) => {
      setLiveMessages(prev => [data, ...prev].slice(0, 50));
      refetchStats();
      
      if (data.classification !== "unknown") {
        const contactInfo = data.contact?.name ? ` from ${data.contact.name}` : "";
        toast.info(
          `New ${data.classification}: ${data.data.propertyType || "Property"} in ${data.data.location || "Unknown"}${contactInfo}`,
          { duration: 4000 }
        );
        if (soundEnabled) playNotificationSound();
      }
    });

    // Enhanced: Listen for high-confidence match events
    socketInstance.on("high_confidence_match", (data: MatchAlertData) => {
      console.log("[Dashboard] High-confidence match received:", data);
      
      // Add to alert queue
      setMatchAlerts(prev => [data, ...prev].slice(0, 5));
      
      // Refetch data
      refetchStats();
      refetchMatches();
      refetchNotifications();
      
      // Play match sound
      if (soundEnabled) playMatchSound();
      
      // Show browser push notification
      showBrowserNotification(
        `High-Confidence Match: ${data.matchScore}%`,
        {
          body: `${data.supply.propertyType || "Property"} in ${data.supply.location || "N/A"}\nSeller: ${data.supply.contactName} | Buyer: ${data.demand.contactName}`,
          tag: `match-${data.matchId}`,
          requireInteraction: true
        }
      );

      // Also show a persistent toast
      toast.success(
        `${data.matchScore}% Match Found!`,
        {
          description: `${data.supply.propertyType || "Property"} in ${data.supply.location || "N/A"} - ${data.supply.contactName} → ${data.demand.contactName}`,
          duration: 10000,
          action: {
            label: "View",
            onClick: () => navigate(`/matches`)
          }
        }
      );
    });

    socketInstance.on("notification", (data: { type: string; title: string; message: string; matchId?: number; score?: number }) => {
      if (data.type === "high_confidence_match") {
        // Already handled by high_confidence_match event
        refetchNotifications();
      } else {
        toast(data.title, { description: data.message });
        refetchNotifications();
        if (soundEnabled) playNotificationSound();
      }
    });

    setSocket(socketInstance);

    return () => {
      socketInstance.disconnect();
    };
  }, [soundEnabled]);

  const handleDismissAlert = useCallback((matchId: number) => {
    setMatchAlerts(prev => prev.filter(a => a.matchId !== matchId));
  }, []);

  const handleViewMatchDetails = useCallback((matchId: number) => {
    setMatchAlerts(prev => prev.filter(a => a.matchId !== matchId));
    navigate("/matches");
  }, [navigate]);

  const formatPrice = (price: number) => {
    if (price >= 1000000) return `${(price / 1000000).toFixed(1)}M`;
    if (price >= 1000) return `${(price / 1000).toFixed(0)}K`;
    return price.toString();
  };

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
  };

  return (
    <>
      <HighPriorityTicker />
      <div className="space-y-6 pt-20">
      {/* High-Confidence Match Alert Overlay */}
      <MatchAlertContainer 
        alerts={matchAlerts}
        onDismiss={handleDismissAlert}
        onViewDetails={handleViewMatchDetails}
      />

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">MatchPro™ Dashboard</h1>
          <div className="flex items-center gap-2 mt-1">
            <p className="text-muted-foreground text-sm">Real Estate Supply/Demand Intelligence</p>
            {role === "admin" ? (
              <Badge className="text-xs bg-amber-500/20 text-amber-400 border-amber-500/30 border">Admin</Badge>
            ) : (
              <Badge variant="outline" className="text-xs">User</Badge>
            )}
          </div>
        </div>
        <div className="flex items-center gap-3">
          {/* Webhook Status Indicator */}
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-card/50 border border-border/50">
            <div className={`h-2 w-2 rounded-full ${webhookStatus === 'connected' ? 'bg-green-500' : 'bg-red-500'}`} />
            <span className="text-xs font-medium text-muted-foreground">
              {webhookStatus === 'connected' ? 'Connected' : 'Disconnected'}
            </span>
          </div>
          {/* Sound Controls: mute toggle + volume slider + test button */}
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                title={soundEnabled ? `Volume: ${Math.round(volume * 100)}%` : "Sound muted"}
              >
                {soundEnabled ? (
                  <Volume2 className="h-4 w-4 text-green-500" />
                ) : (
                  <VolumeX className="h-4 w-4 text-muted-foreground" />
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-64 p-4" align="end">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Match Sound Volume</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2 text-xs"
                    onClick={toggleMute}
                  >
                    {muted ? "Unmute" : "Mute"}
                  </Button>
                </div>
                <div className="flex items-center gap-3">
                  <VolumeX className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  <Slider
                    min={0}
                    max={100}
                    step={5}
                    value={[Math.round(volume * 100)]}
                    onValueChange={([v]) => setVolume(v / 100)}
                    disabled={muted}
                    className="flex-1"
                  />
                  <Volume2 className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">{muted ? "Muted" : `${Math.round(volume * 100)}%`}</span>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 px-3 text-xs gap-1.5"
                    onClick={playTestCoin}
                  >
                    <span>🪙</span> Test Sound
                  </Button>
                </div>
              </div>
            </PopoverContent>
          </Popover>
          <div className="flex items-center gap-2">
            {connected ? (
              <Badge variant="default" className="bg-green-600">
                <Wifi className="w-3 h-3 mr-1" /> Live
              </Badge>
            ) : (
              <Badge variant="destructive">
                <WifiOff className="w-3 h-3 mr-1" /> Offline
              </Badge>
            )}
          </div>
          <Button variant="outline" size="sm" onClick={() => { refetchStats(); refetchMatches(); }}>
            <RefreshCw className="w-4 h-4 mr-2" /> Refresh
          </Button>
        </div>
      </div>

      {/* Area Filter */}
      <div className="flex items-center gap-2">
        <label className="text-sm font-medium">Filter by Area:</label>
        <Select value={selectedArea || "all"} onValueChange={(v) => setSelectedArea(v === "all" ? null : v)}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Select area" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Areas</SelectItem>
            <SelectItem value="التجمع الخامس">التجمع الخامس (5th Settlement)</SelectItem>
            <SelectItem value="مدينتي">مدينتي (Madinaty)</SelectItem>
            <SelectItem value="الرحاب">الرحاب (Rehab)</SelectItem>
            <SelectItem value="القاهرة الجديدة">القاهرة الجديدة (New Cairo)</SelectItem>
            <SelectItem value="الشروق">الشروق (Shorouk)</SelectItem>
            <SelectItem value="بدر">بدر (Badr)</SelectItem>
            <SelectItem value="العبور">العبور (Obour)</SelectItem>
            <SelectItem value="القطامية">القطامية (Katamia)</SelectItem>
            <SelectItem value="الشيخ زايد">الشيخ زايد (Sheikh Zayed)</SelectItem>
            <SelectItem value="6 أكتوبر">6 أكتوبر (6th October)</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Supply</CardTitle>
            <Building2 className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.totalSupply || 0}</div>
            <p className="text-xs text-muted-foreground">Properties for sale/rent</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Demand</CardTitle>
            <Users className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.totalDemand || 0}</div>
            <p className="text-xs text-muted-foreground">Active property seekers</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Matches</CardTitle>
            <Target className="h-4 w-4 text-purple-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.totalMatches || 0}</div>
            <p className="text-xs text-muted-foreground">
              {stats?.highConfidenceMatches || 0} high confidence
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Today's Messages</CardTitle>
            <MessageSquare className="h-4 w-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.todayMessages || 0}</div>
            <p className="text-xs text-muted-foreground">
              {stats?.totalMessages || 0} total processed
            </p>
          </CardContent>
        </Card>
      </div>

      {/* My Assets Quick Card */}
      <Card className="bg-gradient-to-br from-amber-500/10 to-orange-500/10 border-amber-500/30">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <Building2 className="h-5 w-5 text-amber-500" />
              My Assets
            </CardTitle>
            <p className="text-xs text-muted-foreground mt-1">Manage your properties and track matches</p>
          </div>
          <Button 
            size="sm" 
            className="bg-amber-500 hover:bg-amber-600 text-white"
            onClick={() => navigate("/my-assets")}
          >
            + Add Asset
          </Button>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-amber-500">0</div>
              <p className="text-xs text-muted-foreground">Total Assets</p>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-500">0</div>
              <p className="text-xs text-muted-foreground">Matching Leads</p>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-500">0</div>
              <p className="text-xs text-muted-foreground">Pending Offers</p>
            </div>
          </div>
          <Button 
            variant="outline" 
            size="sm" 
            className="w-full mt-4"
            onClick={() => navigate("/my-assets")}
          >
            View My Assets
          </Button>
        </CardContent>
      </Card>

      {/* Main Content Grid */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Live Message Feed - Real DB data, auto-refreshes every 30s */}
        <LiveMessageFeed />

        {/* High Confidence Matches - Enhanced */}
        <Card className="bg-card/50 backdrop-blur-sm border-border/50">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center justify-between gap-2 text-base">
              <div className="flex items-center gap-2">
                <Target className="h-5 w-5 text-green-400" />
                <span>High-Confidence Matches</span>
                <Badge className="bg-green-500/20 text-green-400 border-green-500/30 border text-xs">
                  {recentMatches?.length || 0}
                </Badge>
                {matchAlerts.length > 0 && (
                  <span className="relative flex h-3 w-3">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500"></span>
                  </span>
                )}
              </div>
              <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={() => navigate("/matches")}>
                View All
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <ScrollArea className="h-[480px] pr-1">
              {!recentMatches || recentMatches.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-40 text-muted-foreground gap-2">
                  <Target className="h-10 w-10 opacity-30" />
                  <p className="text-sm">No high-confidence matches yet</p>
                  <p className="text-xs">Matches with 85%+ score will appear here</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {recentMatches.map((match: any, idx: number) => {
                    const score = Math.min(100, parseFloat(String(match.matchScore)));
                    const locScore = Math.min(100, parseFloat(String(match.locationScore || 0)));
                    const priceScore = Math.min(100, parseFloat(String(match.priceScore || 0)));
                    const specsScore = Math.min(100, parseFloat(String(match.specsScore || 0)));
                    const price = match.supplyPrice ? parseFloat(match.supplyPrice) : null;
                    const priceStr = price
                      ? price >= 1000000 ? `${(price / 1000000).toFixed(1)}M EGP`
                        : price >= 1000 ? `${(price / 1000).toFixed(0)}K EGP`
                        : `${price} EGP`
                      : null;
                    const demandBudget = match.demandPriceMax ? parseFloat(match.demandPriceMax) : null;
                    const budgetStr = demandBudget
                      ? demandBudget >= 1000000 ? `${(demandBudget / 1000000).toFixed(1)}M EGP`
                        : `${(demandBudget / 1000).toFixed(0)}K EGP`
                      : null;
                    const scoreColor = score >= 95 ? 'text-green-400' : score >= 85 ? 'text-emerald-400' : 'text-yellow-400';
                    const scoreBg = score >= 95 ? 'bg-green-500/10 border-green-500/25' : score >= 85 ? 'bg-emerald-500/10 border-emerald-500/25' : 'bg-yellow-500/10 border-yellow-500/25';
                    return (
                      <div
                        key={match.id}
                        className="rounded-lg border border-border/50 bg-card/30 hover:border-green-500/40 hover:bg-green-500/5 transition-all cursor-pointer"
                        onClick={() => navigate("/matches")}
                      >
                        {/* Header: match number + score + status + date */}
                        <div className={`flex items-center justify-between px-3 py-2 rounded-t-lg border-b border-border/30 ${scoreBg}`}>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-mono text-muted-foreground">#{idx + 1}</span>
                            <span className={`text-xl font-bold ${scoreColor}`}>{Number(score).toFixed(0)}%</span>
                            <span className="text-xs text-muted-foreground">match</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge
                              variant="outline"
                              className={`text-xs capitalize ${
                                match.status === 'new' ? 'border-primary/50 text-primary' :
                                match.status === 'contacted' ? 'border-blue-500/50 text-blue-400' :
                                'border-muted text-muted-foreground'
                              }`}
                            >
                              {match.status || 'new'}
                            </Badge>
                            <span className="text-xs text-muted-foreground">
                              {new Date(match.createdAt).toLocaleDateString()}
                            </span>
                          </div>
                        </div>

                        <div className="px-3 py-2 space-y-2">
                          {/* Property type + location */}
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <Building2 className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                            <span className="text-sm font-semibold">
                              {match.supplyPropertyType || match.demandPropertyType || 'Property'}
                            </span>
                            <span className="text-xs text-muted-foreground">in</span>
                            <span className="text-sm font-medium">
                              {match.supplyLocation || match.demandLocation || 'N/A'}
                            </span>
                            {(match.supplyArea || match.supplyCity) && (
                              <span className="text-xs text-muted-foreground">({match.supplyArea || match.supplyCity})</span>
                            )}
                          </div>

                          {/* Asset detail chips */}
                          <div className="flex flex-wrap gap-1.5">
                            {priceStr && (
                              <span className="text-xs bg-emerald-500/10 text-emerald-400 rounded-full px-2 py-0.5 font-medium border border-emerald-500/20">
                                Listed: {priceStr}
                              </span>
                            )}
                            {budgetStr && (
                              <span className="text-xs bg-blue-500/10 text-blue-400 rounded-full px-2 py-0.5 font-medium border border-blue-500/20">
                                Budget: {budgetStr}
                              </span>
                            )}
                            {match.supplyBedrooms && (
                              <span className="text-xs bg-muted/60 text-muted-foreground rounded-full px-2 py-0.5 border border-border/50">
                                {match.supplyBedrooms} BR
                              </span>
                            )}
                            {match.supplySize && (
                              <span className="text-xs bg-muted/60 text-muted-foreground rounded-full px-2 py-0.5 border border-border/50">
                                {match.supplySize} sqm
                              </span>
                            )}
                            {(match.supplyPurpose || match.demandPurpose) && (
                              <span className="text-xs bg-muted/60 text-muted-foreground rounded-full px-2 py-0.5 capitalize border border-border/50">
                                {match.supplyPurpose || match.demandPurpose}
                              </span>
                            )}
                          </div>

                          {/* Contacts */}
                          <div className="grid grid-cols-2 gap-2">
                            <div className="rounded-md bg-emerald-500/5 border border-emerald-500/20 px-2 py-1.5">
                              <p className="text-xs text-emerald-400 font-semibold mb-0.5">Seller</p>
                              <p className="text-xs font-medium truncate">{match.supplyContactName || 'Unknown'}</p>
                              {match.supplyContactPhone && match.supplyContactPhone !== 'Unknown' && (
                                <p className="text-xs font-mono text-emerald-300">{match.supplyContactPhone}</p>
                              )}
                            </div>
                            <div className="rounded-md bg-blue-500/5 border border-blue-500/20 px-2 py-1.5">
                              <p className="text-xs text-blue-400 font-semibold mb-0.5">Buyer</p>
                              <p className="text-xs font-medium truncate">{match.demandContactName || 'Unknown'}</p>
                              {match.demandContactPhone && match.demandContactPhone !== 'Unknown' && (
                                <p className="text-xs font-mono text-blue-300">{match.demandContactPhone}</p>
                              )}
                            </div>
                          </div>

                          {/* Score bars */}
                          <div className="grid grid-cols-3 gap-2">
                            {([['Location', locScore], ['Price', priceScore], ['Specs', specsScore]] as [string, number][]).map(([label, val]) => (
                              <div key={label}>
                                <div className="flex justify-between text-xs mb-1">
                                  <span className="text-muted-foreground">{label}</span>
                                  <span className="font-medium">{Number(val).toFixed(0)}%</span>
                                </div>
                                <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                                  <div
                                    className={`h-full rounded-full ${
                                      val >= 90 ? 'bg-green-500' :
                                      val >= 70 ? 'bg-emerald-400' :
                                      val >= 50 ? 'bg-yellow-400' : 'bg-red-400'
                                    }`}
                                    style={{ width: `${val}%` }}
                                  />
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </ScrollArea>
          </CardContent>
        </Card>
      </div>

      {/* Notifications */}
      {notifications && notifications.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bell className="h-5 w-5" />
              Recent Notifications
              {notificationCount && notificationCount > 0 && (
                <Badge variant="destructive">{notificationCount}</Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {notifications.slice(0, 5).map((notif) => (
                <div key={notif.id} className="flex items-start gap-3 p-2 rounded-lg bg-muted/50">
                  {notif.type === "high_match" ? (
                    <BellRing className="h-4 w-4 mt-1 text-green-500" />
                  ) : (
                    <Bell className="h-4 w-4 mt-1 text-muted-foreground" />
                  )}
                  <div className="flex-1">
                    <p className="text-sm font-medium">{notif.title}</p>
                    <p className="text-xs text-muted-foreground line-clamp-1">{notif.content}</p>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {new Date(notif.createdAt).toLocaleTimeString()}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Supply/Demand Ratio */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Market Balance
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span>Supply/Demand Ratio</span>
              <span className="text-2xl font-bold">
                {stats?.supplyDemandRatio ? Number(stats.supplyDemandRatio).toFixed(2) : "N/A"}
              </span>
            </div>
            <div className="h-4 bg-muted rounded-full overflow-hidden">
              <div 
                className="h-full bg-gradient-to-r from-blue-500 to-green-500"
                style={{ 
                  width: `${Math.min(100, (stats?.supplyDemandRatio || 0) * 50)}%` 
                }}
              />
            </div>
            <div className="flex justify-between text-sm text-muted-foreground">
              <span>More Demand</span>
              <span>Balanced</span>
              <span>More Supply</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
    </>
  );
}
