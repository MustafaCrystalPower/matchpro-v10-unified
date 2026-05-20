import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { trpc } from "@/lib/trpc";
import { 
  Settings as SettingsIcon,
  Wifi,
  WifiOff,
  RefreshCw,
  Send,
  QrCode,
  LogOut,
  Copy,
  CheckCircle,
  AlertCircle,
  Smartphone,
  Loader2,
  ShieldCheck,
  Mail,
  Zap,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Save,
  Bell,
  TrendingUp,
  Settings2
} from "lucide-react";
import { toast } from "sonner";

export default function Settings() {
  const [testMessage, setTestMessage] = useState("");
  const [testGroup, setTestGroup] = useState("Test Group");
  const [qrRefreshKey, setQrRefreshKey] = useState(0);

  // tRPC queries
  const { data: whatsappStatus, isLoading: statusLoading, refetch: refetchStatus } = trpc.whatsapp.status.useQuery(undefined, {
    refetchInterval: 10000 // Refresh every 10 seconds
  });
  
  const { data: qrCodeData, isLoading: qrLoading, refetch: refetchQR } = trpc.whatsapp.qrCode.useQuery(undefined, {
    enabled: whatsappStatus?.status !== 'authorized',
    refetchInterval: whatsappStatus?.status !== 'authorized' ? 5000 : false // Refresh QR every 5 seconds if not connected
  });

  const logoutMutation = trpc.whatsapp.logout.useMutation({
    onSuccess: (data) => {
      if (data.success) {
        toast.success("WhatsApp logged out successfully");
        refetchStatus();
        refetchQR();
      } else {
        toast.error(data.message || "Failed to logout");
      }
    },
    onError: () => {
      toast.error("Failed to logout from WhatsApp");
    }
  });

  const setWebhookMutation = trpc.whatsapp.setWebhook.useMutation({
    onSuccess: (data) => {
      if (data.success) {
        toast.success("Webhook configured successfully");
      } else {
        toast.error(data.message || "Failed to configure webhook");
      }
    },
    onError: () => {
      toast.error("Failed to configure webhook");
    }
  });

  const sendTestMessage = async () => {
    if (!testMessage.trim()) {
      toast.error("Please enter a test message");
      return;
    }

    try {
      const response = await fetch("/api/whatsapp/test-message", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: testMessage, groupName: testGroup })
      });
      const data = await response.json();
      
      if (data.success) {
        toast.success("Test message processed successfully");
        setTestMessage("");
      } else {
        toast.error(data.error || "Failed to process test message");
      }
    } catch (error) {
      toast.error("Failed to send test message");
    }
  };

  const copyWebhookUrl = () => {
    const url = `${window.location.origin}/api/whatsapp/webhook`;
    navigator.clipboard.writeText(url);
    toast.success("Webhook URL copied to clipboard");
  };

  const configureWebhook = () => {
    const url = `${window.location.origin}/api/whatsapp/webhook`;
    setWebhookMutation.mutate({ webhookUrl: url });
  };

  const refreshQRCode = () => {
    setQrRefreshKey(prev => prev + 1);
    refetchQR();
  };

  const isConnected = whatsappStatus?.status === 'authorized';

  // ── Confidence Threshold & Digest Settings ──
  const { data: allSettings, refetch: refetchSettings } = trpc.settings.getAll.useQuery();
  const updateMany = trpc.settings.updateMany.useMutation({
    onSuccess: () => { toast.success("Settings saved"); refetchSettings(); setDirty(false); },
    onError: (e) => toast.error(`Save failed: ${e.message}`),
  });
  const [autoApprove, setAutoApprove] = useState(70);
  const [flagReview, setFlagReview] = useState(50);
  const [autoReject, setAutoReject] = useState(20);
  const [matchMinScore, setMatchMinScore] = useState(40);
  const [notifyThreshold, setNotifyThreshold] = useState(85);
  const [digestEnabled, setDigestEnabled] = useState(true);
  const [digestDay, setDigestDay] = useState("1");
  const [digestHour, setDigestHour] = useState("8");
  const [digestEmail, setDigestEmail] = useState("maisaramoamen@gmail.com");
  const [dirty, setDirty] = useState(false);
  const DAY_NAMES = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
  useEffect(() => {
    if (!allSettings) return;
    const map = Object.fromEntries((allSettings as any[]).map((s) => [s.key, s.value]));
    if (map.confidence_auto_approve) setAutoApprove(Math.round(parseFloat(map.confidence_auto_approve) * 100));
    if (map.confidence_flag_review) setFlagReview(Math.round(parseFloat(map.confidence_flag_review) * 100));
    if (map.confidence_auto_reject) setAutoReject(Math.round(parseFloat(map.confidence_auto_reject) * 100));
    if (map.match_min_score) setMatchMinScore(Math.round(parseFloat(map.match_min_score) * 100));
    if (map.notify_high_match_threshold) setNotifyThreshold(Math.round(parseFloat(map.notify_high_match_threshold) * 100));
    if (map.weekly_digest_enabled) setDigestEnabled(map.weekly_digest_enabled === "true");
    if (map.weekly_digest_day) setDigestDay(map.weekly_digest_day);
    if (map.weekly_digest_hour) setDigestHour(map.weekly_digest_hour);
    if (map.weekly_digest_email) setDigestEmail(map.weekly_digest_email);
    setDirty(false);
  }, [allSettings]);
  function markDirty() { setDirty(true); }
  function handleSaveThresholds() {
    updateMany.mutate([
      { key: "confidence_auto_approve", value: (autoApprove / 100).toFixed(2) },
      { key: "confidence_flag_review", value: (flagReview / 100).toFixed(2) },
      { key: "confidence_auto_reject", value: (autoReject / 100).toFixed(2) },
      { key: "match_min_score", value: (matchMinScore / 100).toFixed(2) },
      { key: "notify_high_match_threshold", value: (notifyThreshold / 100).toFixed(2) },
      { key: "weekly_digest_enabled", value: String(digestEnabled) },
      { key: "weekly_digest_day", value: digestDay },
      { key: "weekly_digest_hour", value: digestHour },
      { key: "weekly_digest_email", value: digestEmail },
    ]);
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground">Configure WhatsApp integration and system settings</p>
      </div>

      {/* WhatsApp Connection with QR Code */}
      <Card className="border-2 border-primary/20">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {isConnected ? (
              <Wifi className="h-5 w-5 text-green-500" />
            ) : (
              <WifiOff className="h-5 w-5 text-red-500" />
            )}
            WhatsApp Connection
          </CardTitle>
          <CardDescription>
            Connect your WhatsApp account to receive real estate messages
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Status Section */}
          <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="font-medium">Status:</span>
                <Badge variant={isConnected ? "default" : "secondary"} className="capitalize">
                  {isConnected ? "Connected" : "Ready"}
                </Badge>
              </div>
              {whatsappStatus?.instanceId && (
                <p className="text-sm text-muted-foreground">
                  Instance ID: {whatsappStatus.instanceId}
                </p>
              )}
              {isConnected && (
                <p className="text-sm text-green-600 font-medium">
                  ✓ WhatsApp integration active
                </p>
              )}
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => refetchStatus()} disabled={statusLoading}>
                <RefreshCw className={`w-4 h-4 mr-2 ${statusLoading ? "animate-spin" : ""}`} />
                Refresh
              </Button>
              {isConnected && (
                <Button 
                  variant="destructive" 
                  onClick={() => logoutMutation.mutate()}
                  disabled={logoutMutation.isPending}
                >
                  <LogOut className="w-4 h-4 mr-2" />
                  Disconnect
                </Button>
              )}
            </div>
          </div>

          {/* QR Code Section - Only show if not connected */}
          {!isConnected && (
            <div className="space-y-4">
              <Separator />
              <div className="text-center space-y-4">
                <div className="flex items-center justify-center gap-2">
                  <QrCode className="h-5 w-5" />
                  <h3 className="font-semibold text-lg">Scan QR Code to Connect</h3>
                </div>
                <p className="text-sm text-muted-foreground max-w-md mx-auto">
                  Open WhatsApp on your phone (+201066505665), go to Settings → Linked Devices → Link a Device, then scan this QR code
                </p>
                
                <div className="flex justify-center">
                  <div className="relative bg-white p-4 rounded-xl shadow-lg">
                    {qrLoading ? (
                      <div className="w-64 h-64 flex items-center justify-center">
                        <Loader2 className="w-8 h-8 animate-spin text-primary" />
                      </div>
                    ) : qrCodeData?.qrCode ? (
                      <img 
                        src={`data:image/png;base64,${qrCodeData.qrCode}`}
                        alt="WhatsApp QR Code"
                        className="w-64 h-64"
                        key={qrRefreshKey}
                      />
                    ) : (
                      <div className="w-64 h-64 flex flex-col items-center justify-center text-center p-4">
                        <Smartphone className="w-12 h-12 text-muted-foreground mb-4" />
                        <p className="text-sm text-muted-foreground">
                          {whatsappStatus?.status === 'authorized' 
                            ? "Already connected!" 
                            : "QR code not available. Click refresh to generate a new one."}
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                <Button variant="outline" onClick={refreshQRCode} disabled={qrLoading}>
                  <RefreshCw className={`w-4 h-4 mr-2 ${qrLoading ? "animate-spin" : ""}`} />
                  Refresh QR Code
                </Button>

                <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                  <AlertCircle className="w-4 h-4" />
                  QR code expires in 60 seconds. Click refresh if it doesn't work.
                </div>
              </div>
            </div>
          )}

          {/* Connected Success Message */}
          {isConnected && (
            <div className="flex items-center gap-3 p-4 bg-green-500/10 border border-green-500/20 rounded-lg">
              <CheckCircle className="w-6 h-6 text-green-500" />
              <div>
                <p className="font-medium text-green-500">WhatsApp Connected Successfully!</p>
                <p className="text-sm text-muted-foreground">
                  Your WhatsApp account is now connected and ready to receive messages.
                </p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Webhook Configuration */}
      <Card>
        <CardHeader>
          <CardTitle>Webhook Configuration</CardTitle>
          <CardDescription>
            Configure your WhatsApp connection to send messages to this webhook URL
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Webhook URL</Label>
            <div className="flex gap-2">
              <Input 
                value={`${window.location.origin}/api/whatsapp/webhook`}
                readOnly
                className="font-mono text-sm"
              />
              <Button variant="outline" onClick={copyWebhookUrl}>
                <Copy className="w-4 h-4" />
              </Button>
            </div>
          </div>

          <Button 
            onClick={configureWebhook} 
            disabled={setWebhookMutation.isPending || !isConnected}
            className="w-full"
          >
            {setWebhookMutation.isPending ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <CheckCircle className="w-4 h-4 mr-2" />
            )}
            Auto-Configure Webhook
          </Button>

          {!isConnected && (
            <p className="text-sm text-yellow-500 text-center">
              Connect WhatsApp first to configure the webhook automatically
            </p>
          )}
        </CardContent>
      </Card>

      {/* Test Message */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Send className="h-5 w-5" />
            Test Message Processing
          </CardTitle>
          <CardDescription>
            Simulate an incoming WhatsApp message to test the NLP parser
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Group Name</Label>
            <Input 
              value={testGroup}
              onChange={(e) => setTestGroup(e.target.value)}
              placeholder="Test Group"
            />
          </div>
          <div className="space-y-2">
            <Label>Message Text</Label>
            <Input 
              value={testMessage}
              onChange={(e) => setTestMessage(e.target.value)}
              placeholder="e.g., شقة للبيع في التجمع الخامس 150 متر 3 غرف 2.5 مليون"
            />
          </div>
          <Button onClick={sendTestMessage}>
            <Send className="w-4 h-4 mr-2" /> Process Test Message
          </Button>

          <Separator />

          <div className="space-y-2">
            <h4 className="font-medium">Example Messages</h4>
            <div className="grid gap-2">
              <Button 
                variant="outline" 
                className="justify-start text-left h-auto py-2"
                onClick={() => setTestMessage("شقة للبيع في التجمع الخامس 150 متر 3 غرف نوم بلكونة وحمام سباحة 2.5 مليون جنيه - 01066505665")}
              >
                <Badge className="mr-2">Supply AR</Badge>
                شقة للبيع في التجمع الخامس 150 متر (with pool & balcony)
              </Button>
              <Button 
                variant="outline" 
                className="justify-start text-left h-auto py-2"
                onClick={() => setTestMessage("Apartment for sale in New Cairo, 200 sqm, 3 bedrooms, balcony, parking, AC, 3.5 million EGP")}
              >
                <Badge className="mr-2">Supply EN</Badge>
                Apartment for sale in New Cairo, 200 sqm (with amenities)
              </Button>
              <Button 
                variant="outline" 
                className="justify-start text-left h-auto py-2"
                onClick={() => setTestMessage("مطلوب شقة للإيجار في الشيخ زايد 100-150 متر بحد أقصى 15 ألف شهريا مع بلكونة")}
              >
                <Badge variant="secondary" className="mr-2">Demand AR</Badge>
                مطلوب شقة للإيجار في الشيخ زايد (with balcony)
              </Button>
              <Button 
                variant="outline" 
                className="justify-start text-left h-auto py-2"
                onClick={() => setTestMessage("Looking for a villa in 6th October with pool and garden, budget 5-8 million, minimum 4 bedrooms")}
              >
                <Badge variant="secondary" className="mr-2">Demand EN</Badge>
                Looking for a villa in 6th October (with pool & garden)
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Matching Engine */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <RefreshCw className="h-5 w-5" />
            Matching Engine
          </CardTitle>
          <CardDescription>
            Re-run the matching cycle to apply phone-pair deduplication and generate fresh matches.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="flex items-center justify-between p-4 rounded-lg border bg-muted/30">
              <div>
                <p className="font-medium">Re-run Full Matching Cycle</p>
                <p className="text-sm text-muted-foreground">Scans all supply/demand pairs, upserts by phone pair, generates fresh matches.</p>
              </div>
              <ReRunMatchingButton />
            </div>
            <div className="flex items-center justify-between p-4 rounded-lg border bg-muted/30">
              <div>
                <p className="font-medium">Deduplicate Existing Matches</p>
                <p className="text-sm text-muted-foreground">Scans all 5,891 existing matches, keeps highest-scoring row per phone pair, soft-deletes duplicates.</p>
              </div>
              <DeduplicateMatchesButton />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* System Info */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <SettingsIcon className="h-5 w-5" />
            System Information
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-1">
              <span className="text-sm text-muted-foreground">Matching Algorithm</span>
              <p className="font-medium">Weighted Scoring (Location 40%, Price 35%, Specs 25%)</p>
            </div>
            <div className="space-y-1">
              <span className="text-sm text-muted-foreground">Minimum Match Threshold</span>
              <p className="font-medium">60%</p>
            </div>
            <div className="space-y-1">
              <span className="text-sm text-muted-foreground">High Confidence Threshold</span>
              <p className="font-medium">85%</p>
            </div>
            <div className="space-y-1">
              <span className="text-sm text-muted-foreground">NLP Engine</span>
              <p className="font-medium">LLM-powered with regex fallback</p>
            </div>
            <div className="space-y-1">
              <span className="text-sm text-muted-foreground">Supported Languages</span>
              <p className="font-medium">Arabic, English, Mixed</p>
            </div>
            <div className="space-y-1">
              <span className="text-sm text-muted-foreground">Target Phone</span>
              <p className="font-medium">+201066505665</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── Confidence Thresholds ── */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <ShieldCheck className="w-5 h-5 text-blue-500" />
            Confidence Thresholds
          </CardTitle>
          <CardDescription>
            Control how the Review Queue auto-manages incoming records based on NLP confidence scores.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/40 rounded-lg p-3 flex-wrap">
            <span className="font-medium text-foreground">Incoming message</span>
            <span>→</span>
            <Badge variant="outline" className="text-red-500 border-red-300">&lt; {autoReject}% → Auto-Reject</Badge>
            <span>→</span>
            <Badge variant="outline" className="text-yellow-600 border-yellow-300">{autoReject}–{flagReview}% → Review Queue</Badge>
            <span>→</span>
            <Badge variant="outline" className="text-orange-500 border-orange-300">{flagReview}–{autoApprove}% → Flag &amp; Review</Badge>
            <span>→</span>
            <Badge variant="outline" className="text-green-600 border-green-300">≥ {autoApprove}% → Auto-Approve</Badge>
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-green-500" />Auto-Approve Threshold</Label>
              <span className="text-lg font-bold text-green-600">{autoApprove}%</span>
            </div>
            <Slider min={50} max={99} step={1} value={[autoApprove]} onValueChange={([v]) => { setAutoApprove(v); markDirty(); }} />
            <p className="text-xs text-muted-foreground">Records ≥ {autoApprove}% are automatically approved into the live pool.</p>
          </div>
          <Separator />
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="flex items-center gap-2"><AlertTriangle className="w-4 h-4 text-yellow-500" />Flag for Review Threshold</Label>
              <span className="text-lg font-bold text-yellow-600">{flagReview}%</span>
            </div>
            <Slider min={20} max={autoApprove - 1} step={1} value={[flagReview]} onValueChange={([v]) => { setFlagReview(v); markDirty(); }} />
            <p className="text-xs text-muted-foreground">Records between {flagReview}% and {autoApprove}% go to the Review Queue for manual approval.</p>
          </div>
          <Separator />
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="flex items-center gap-2"><XCircle className="w-4 h-4 text-red-500" />Auto-Reject Threshold</Label>
              <span className="text-lg font-bold text-red-500">{autoReject}%</span>
            </div>
            <Slider min={5} max={flagReview - 1} step={1} value={[autoReject]} onValueChange={([v]) => { setAutoReject(v); markDirty(); }} />
            <p className="text-xs text-muted-foreground">Records below {autoReject}% are automatically rejected as spam.</p>
          </div>
        </CardContent>
      </Card>

      {/* ── Match Scoring ── */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <TrendingUp className="w-5 h-5 text-purple-500" />
            Match Scoring
          </CardTitle>
          <CardDescription>Tune the matching engine minimum score and notification trigger.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="flex items-center gap-2"><Zap className="w-4 h-4 text-blue-500" />Minimum Match Score</Label>
              <span className="text-lg font-bold text-blue-600">{matchMinScore}%</span>
            </div>
            <Slider min={10} max={80} step={5} value={[matchMinScore]} onValueChange={([v]) => { setMatchMinScore(v); markDirty(); }} />
            <p className="text-xs text-muted-foreground">Pairs below {matchMinScore}% are discarded. Lower = more (noisier) matches; higher = precision.</p>
          </div>
          <Separator />
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="flex items-center gap-2"><Bell className="w-4 h-4 text-amber-500" />High-Match Notification Threshold</Label>
              <span className="text-lg font-bold text-amber-600">{notifyThreshold}%</span>
            </div>
            <Slider min={60} max={99} step={1} value={[notifyThreshold]} onValueChange={([v]) => { setNotifyThreshold(v); markDirty(); }} />
            <p className="text-xs text-muted-foreground">Matches ≥ {notifyThreshold}% trigger an immediate in-app notification with the coins sound.</p>
          </div>
        </CardContent>
      </Card>

      {/* ── Weekly Digest Email ── */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Mail className="w-5 h-5 text-green-500" />
            Weekly Digest Email
          </CardTitle>
          <CardDescription>Automated weekly summary: accuracy trend, top locations, pending review count.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="flex items-center justify-between">
            <div>
              <Label className="font-medium">Enable Weekly Digest</Label>
              <p className="text-xs text-muted-foreground mt-0.5">Send a weekly summary email automatically</p>
            </div>
            <Switch checked={digestEnabled} onCheckedChange={(v) => { setDigestEnabled(v); markDirty(); }} />
          </div>
          {digestEnabled && (
            <>
              <Separator />
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="space-y-1.5">
                  <Label>Day of Week</Label>
                  <Select value={digestDay} onValueChange={(v) => { setDigestDay(v); markDirty(); }}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {DAY_NAMES.map((d, i) => <SelectItem key={i} value={String(i)}>{d}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Hour (UTC)</Label>
                  <Select value={digestHour} onValueChange={(v) => { setDigestHour(v); markDirty(); }}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {Array.from({ length: 24 }, (_, i) => <SelectItem key={i} value={String(i)}>{String(i).padStart(2,"0")}:00 UTC</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Recipient Email</Label>
                  <Input type="email" value={digestEmail} onChange={(e) => { setDigestEmail(e.target.value); markDirty(); }} placeholder="your@email.com" />
                </div>
              </div>
              <div className="bg-muted/40 rounded-lg p-3 text-xs text-muted-foreground">
                <strong className="text-foreground">Next digest:</strong> Every {DAY_NAMES[parseInt(digestDay)]} at {String(parseInt(digestHour)).padStart(2,"0")}:00 UTC → {digestEmail}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Save Thresholds Button */}
      <div className="flex justify-end pb-4">
        <Button onClick={handleSaveThresholds} disabled={!dirty || updateMany.isPending} size="lg" className="gap-2">
          {updateMany.isPending ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          {dirty ? "Save All Settings" : "All Settings Saved"}
        </Button>
      </div>
    </div>
  );
}
function DeduplicateMatchesButton() {
  const [result, setResult] = useState<{ kept: number; removed: number; totalBefore: number } | null>(null);
  const dedupMutation = trpc.matches.deduplicateMatches.useMutation({
    onSuccess: (data: any) => {
      setResult(data);
      toast.success(`Deduplication complete — ${data.removed} duplicates removed, ${data.kept} unique pairs kept`);
    },
    onError: () => toast.error("Deduplication failed. Try again."),
  });
  return (
    <div className="flex flex-col items-end gap-1">
      <Button
        variant="outline"
        onClick={() => { setResult(null); dedupMutation.mutate(); }}
        disabled={dedupMutation.isPending}
        className="min-w-[160px]"
      >
        {dedupMutation.isPending ? (
          <><RefreshCw className="w-4 h-4 mr-2 animate-spin" /> Deduplicating...</>
        ) : (
          <><RefreshCw className="w-4 h-4 mr-2" /> Deduplicate Matches</>
        )}
      </Button>
      {result && (
        <span className="text-xs text-green-500">{result.removed} removed · {result.kept} unique pairs</span>
      )}
    </div>
  );
}

function ReRunMatchingButton() {
  const [result, setResult] = useState<{ newMatches: number } | null>(null);
  const runMutation = trpc.matches.runMatching.useMutation({
    onSuccess: (data: any) => {
      const count = data?.newMatches ?? 0;
      setResult({ newMatches: count });
      toast.success(`Matching complete — ${count} new matches found`);
    },
    onError: () => toast.error("Matching cycle failed. Try again."),
  });
  return (
    <div className="flex flex-col items-end gap-1">
      <Button
        onClick={() => { setResult(null); runMutation.mutate(); }}
        disabled={runMutation.isPending}
        className="min-w-[140px]"
      >
        {runMutation.isPending ? (
          <><RefreshCw className="w-4 h-4 mr-2 animate-spin" /> Running...</>
        ) : (
          <><RefreshCw className="w-4 h-4 mr-2" /> Re-run Matching</>
        )}
      </Button>
      {result && (
        <span className="text-xs text-green-500">{result.newMatches} new matches found</span>
      )}
    </div>
  );
}
