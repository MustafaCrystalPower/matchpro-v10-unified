import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import {
  MessageSquare, TrendingUp, TrendingDown, Star, CheckCircle2, XCircle,
  AlertTriangle, BarChart3, Target, Zap, RefreshCw, ThumbsUp, ThumbsDown,
  Calendar, Clock, MapPin, Users, Activity
} from "lucide-react";
import { toast } from "sonner";

// ── Star Rating ───────────────────────────────────────────────────────────────
function StarRating({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map(s => (
        <button
          key={s}
          onClick={() => onChange(s)}
          className={`transition-colors ${s <= value ? "text-amber-400" : "text-muted-foreground/30"} hover:text-amber-400`}
        >
          <Star className="w-5 h-5 fill-current" />
        </button>
      ))}
    </div>
  );
}

// ── Stat Card ─────────────────────────────────────────────────────────────────
function StatCard({
  icon: Icon, label, value, sub, color = "blue", trend
}: {
  icon: any; label: string; value: string | number; sub?: string;
  color?: "blue" | "green" | "amber" | "red" | "purple"; trend?: "up" | "down" | "neutral";
}) {
  const colors = {
    blue: "bg-blue-500/10 text-blue-600 border-blue-200",
    green: "bg-emerald-500/10 text-emerald-600 border-emerald-200",
    amber: "bg-amber-500/10 text-amber-600 border-amber-200",
    red: "bg-red-500/10 text-red-600 border-red-200",
    purple: "bg-purple-500/10 text-purple-600 border-purple-200",
  };
  return (
    <Card className="border shadow-sm">
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div className={`p-2 rounded-lg border ${colors[color]}`}>
            <Icon className="w-4 h-4" />
          </div>
          {trend && (
            <div className={trend === "up" ? "text-emerald-500" : trend === "down" ? "text-red-500" : "text-muted-foreground"}>
              {trend === "up" ? <TrendingUp className="w-4 h-4" /> : trend === "down" ? <TrendingDown className="w-4 h-4" /> : null}
            </div>
          )}
        </div>
        <div className="mt-3">
          <p className="text-2xl font-bold">{value}</p>
          <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
          {sub && <p className="text-xs text-muted-foreground/70 mt-0.5">{sub}</p>}
        </div>
      </CardContent>
    </Card>
  );
}

// ── Mini Bar ──────────────────────────────────────────────────────────────────
function MiniBar({ label, count, max, color }: { label: string; count: number; max: number; color: string }) {
  const pct = max > 0 ? Math.round((count / max) * 100) : 0;
  return (
    <div className="flex items-center gap-2 text-sm">
      <span className="text-muted-foreground truncate w-32 text-xs" title={label}>{label}</span>
      <div className="flex-1 bg-muted rounded-full h-2 overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs font-medium w-6 text-right">{count}</span>
    </div>
  );
}

// ── Accuracy Gauge ────────────────────────────────────────────────────────────
function AccuracyGauge({ pct }: { pct: number }) {
  const color = pct >= 70 ? "text-emerald-500" : pct >= 50 ? "text-amber-500" : "text-red-500";
  const ring = pct >= 70 ? "stroke-emerald-500" : pct >= 50 ? "stroke-amber-500" : "stroke-red-500";
  const circumference = 2 * Math.PI * 36;
  const offset = circumference - (pct / 100) * circumference;
  return (
    <div className="flex flex-col items-center gap-1">
      <svg width="100" height="100" viewBox="0 0 100 100">
        <circle cx="50" cy="50" r="36" fill="none" stroke="currentColor" strokeWidth="8" className="text-muted/30" />
        <circle
          cx="50" cy="50" r="36" fill="none" strokeWidth="8"
          strokeDasharray={circumference} strokeDashoffset={offset}
          strokeLinecap="round" transform="rotate(-90 50 50)"
          className={ring}
        />
        <text x="50" y="55" textAnchor="middle" className={`text-sm font-bold fill-current ${color}`} fontSize="18">
          {pct}%
        </text>
      </svg>
      <p className="text-xs text-muted-foreground">Match Accuracy</p>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────
export function DailyDigest() {
  const [daysBack, setDaysBack] = useState(1);
  const [feedbackMatchId, setFeedbackMatchId] = useState<number | null>(null);
  const [feedbackRating, setFeedbackRating] = useState(0);
  const [feedbackComment, setFeedbackComment] = useState("");
  const [feedbackHelpful, setFeedbackHelpful] = useState<boolean | null>(null);

  const { data: digest, isLoading, refetch } = trpc.digest.daily.useQuery(
    { daysBack },
    { refetchInterval: 60000 }
  );
  const { data: trend = [] } = trpc.digest.accuracyTrend.useQuery({ days: 30 });
  const { data: recentMatches = [] } = trpc.matches.recent.useQuery({ limit: 20 });

  const submitFeedback = trpc.digest.submitFeedback.useMutation({
    onSuccess: () => {
      toast.success("Feedback recorded — this will improve future matches");
      setFeedbackMatchId(null);
      setFeedbackRating(0);
      setFeedbackComment("");
      setFeedbackHelpful(null);
      refetch();
    },
    onError: () => toast.error("Failed to submit feedback"),
  });

  const handleSubmitFeedback = () => {
    if (!feedbackMatchId || feedbackRating === 0) {
      toast.error("Please select a rating");
      return;
    }
    submitFeedback.mutate({
      matchId: feedbackMatchId,
      rating: feedbackRating,
      comment: feedbackComment || undefined,
      helpful: feedbackHelpful ?? undefined,
    });
  };

  const d = digest;
  const fb = d?.feedbackStats;
  const accuracyPct = fb && fb.totalRated > 0
    ? Math.round((fb.goodMatches / fb.totalRated) * 100)
    : 0;

  const periodLabel = daysBack === 1 ? "Today" : daysBack === 7 ? "Last 7 Days" : `Last ${daysBack} Days`;

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <BarChart3 className="w-6 h-6 text-primary" />
            Daily Digest
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Pipeline performance, match quality, and accuracy feedback
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={String(daysBack)} onValueChange={v => setDaysBack(Number(v))}>
            <SelectTrigger className="w-36">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1">Today</SelectItem>
              <SelectItem value="7">Last 7 Days</SelectItem>
              <SelectItem value="14">Last 14 Days</SelectItem>
              <SelectItem value="30">Last 30 Days</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isLoading}>
            <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </div>

      {/* KPI Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
        <StatCard icon={MessageSquare} label="Messages" value={d?.messagesReceived ?? "—"} color="blue" />
        <StatCard icon={TrendingUp} label="Listings" value={d?.listingsCreated ?? "—"} color="green" />
        <StatCard icon={Users} label="Requests" value={d?.requestsCreated ?? "—"} color="purple" />
        <StatCard icon={Zap} label="Matches" value={d?.matchesFound ?? "—"} color="amber" />
        <StatCard icon={XCircle} label="Spam" value={d?.spamRejected ?? "—"} color="red" />
        <StatCard icon={AlertTriangle} label="Pending Review" value={d?.pendingReview ?? "—"} color="amber" />
        <StatCard icon={Activity} label="Avg Confidence" value={d ? `${d.avgConfidence}%` : "—"} color="blue" />
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Accuracy + Feedback Stats */}
        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Target className="w-4 h-4 text-primary" />
                Match Accuracy
              </CardTitle>
            </CardHeader>
            <CardContent>
              {fb && fb.totalRated > 0 ? (
                <div className="flex items-center gap-6">
                  <AccuracyGauge pct={accuracyPct} />
                  <div className="space-y-2 flex-1">
                    <div className="flex items-center gap-2 text-sm">
                      <ThumbsUp className="w-4 h-4 text-emerald-500" />
                      <span className="text-muted-foreground">Good matches</span>
                      <span className="ml-auto font-semibold text-emerald-600">{fb.goodMatches}</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <ThumbsDown className="w-4 h-4 text-red-500" />
                      <span className="text-muted-foreground">False matches</span>
                      <span className="ml-auto font-semibold text-red-600">{fb.badMatches}</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <Star className="w-4 h-4 text-amber-400" />
                      <span className="text-muted-foreground">Avg rating</span>
                      <span className="ml-auto font-semibold">{fb.avgRating}/5</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <CheckCircle2 className="w-4 h-4 text-blue-500" />
                      <span className="text-muted-foreground">Total rated</span>
                      <span className="ml-auto font-semibold">{fb.totalRated}</span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center py-6 text-muted-foreground text-sm">
                  <Target className="w-8 h-8 mx-auto mb-2 opacity-30" />
                  <p>No feedback yet for {periodLabel.toLowerCase()}.</p>
                  <p className="text-xs mt-1">Rate matches below to improve accuracy.</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* 7-day trend mini chart */}
          {trend.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-primary" />
                  30-Day Accuracy Trend
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-1.5">
                  {trend.slice(-7).map((t: any) => (
                    <div key={t.date} className="flex items-center gap-2 text-xs">
                      <span className="text-muted-foreground w-20">{new Date(t.date).toLocaleDateString("en-GB", { day: "2-digit", month: "short" })}</span>
                      <div className="flex-1 bg-muted rounded-full h-2 overflow-hidden">
                        <div
                          className={`h-full rounded-full ${t.goodPct >= 70 ? "bg-emerald-500" : t.goodPct >= 50 ? "bg-amber-500" : "bg-red-500"}`}
                          style={{ width: `${t.goodPct || t.accuracy}%` }}
                        />
                      </div>
                      <span className="w-8 text-right font-medium">{t.goodPct || t.accuracy}%</span>
                      <span className="text-muted-foreground w-8">({t.total})</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Middle: Top Locations + Groups */}
        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <MapPin className="w-4 h-4 text-primary" />
                Top Locations — {periodLabel}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {d?.topLocations && d.topLocations.length > 0 ? (
                <div className="space-y-2">
                  {d.topLocations.map((l: any) => (
                    <MiniBar
                      key={l.location}
                      label={l.location}
                      count={l.count}
                      max={d.topLocations[0]?.count || 1}
                      color="bg-blue-500"
                    />
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-4">No data for this period</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-green-500" />
                Top WhatsApp Groups
              </CardTitle>
            </CardHeader>
            <CardContent>
              {d?.topGroups && d.topGroups.length > 0 ? (
                <div className="space-y-2">
                  {d.topGroups.map((g: any) => (
                    <MiniBar
                      key={g.group}
                      label={g.group}
                      count={g.count}
                      max={d.topGroups[0]?.count || 1}
                      color="bg-green-500"
                    />
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-4">No group data for this period</p>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right: Rate Recent Matches */}
        <div>
          <Card className="h-full">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Star className="w-4 h-4 text-amber-400" />
                Rate Recent Matches
              </CardTitle>
              <p className="text-xs text-muted-foreground">
                Mark good or false matches to tune the engine
              </p>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 max-h-[420px] overflow-y-auto pr-1">
                {(recentMatches as any[]).slice(0, 12).map((m: any) => (
                  <div
                    key={m.id}
                    className="border rounded-lg p-3 hover:bg-muted/30 transition-colors cursor-pointer"
                    onClick={() => {
                      setFeedbackMatchId(m.id);
                      setFeedbackRating(0);
                      setFeedbackComment("");
                      setFeedbackHelpful(null);
                    }}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium truncate">
                          {m.supplyContactName || m.supplyContact || "Seller"} ↔ {m.demandContactName || m.demandContact || "Buyer"}
                        </p>
                        <p className="text-xs text-muted-foreground truncate">{m.location || "—"}</p>
                      </div>
                      <Badge
                        className={`text-xs flex-shrink-0 ${
                          Number(m.matchScore) >= 80 ? "bg-emerald-500/10 text-emerald-600 border-emerald-200" :
                          Number(m.matchScore) >= 60 ? "bg-amber-500/10 text-amber-600 border-amber-200" :
                          "bg-gray-500/10 text-gray-500 border-gray-200"
                        }`}
                        variant="outline"
                      >
                        {m.matchScore}%
                      </Badge>
                    </div>
                    <div className="flex items-center gap-2 mt-2">
                      <button
                        className="flex items-center gap-1 text-xs text-emerald-600 hover:text-emerald-700 bg-emerald-500/10 hover:bg-emerald-500/20 px-2 py-0.5 rounded transition-colors"
                        onClick={e => {
                          e.stopPropagation();
                          submitFeedback.mutate({ matchId: m.id, rating: 5, helpful: true });
                        }}
                      >
                        <ThumbsUp className="w-3 h-3" /> Good
                      </button>
                      <button
                        className="flex items-center gap-1 text-xs text-red-600 hover:text-red-700 bg-red-500/10 hover:bg-red-500/20 px-2 py-0.5 rounded transition-colors"
                        onClick={e => {
                          e.stopPropagation();
                          submitFeedback.mutate({ matchId: m.id, rating: 1, helpful: false });
                        }}
                      >
                        <ThumbsDown className="w-3 h-3" /> False
                      </button>
                      <button
                        className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 bg-blue-500/10 hover:bg-blue-500/20 px-2 py-0.5 rounded transition-colors"
                        onClick={e => {
                          e.stopPropagation();
                          setFeedbackMatchId(m.id);
                        }}
                      >
                        <Star className="w-3 h-3" /> Rate
                      </button>
                    </div>
                  </div>
                ))}
                {(recentMatches as any[]).length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-8">No recent matches to rate</p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Feedback Dialog */}
      <Dialog open={!!feedbackMatchId} onOpenChange={open => !open && setFeedbackMatchId(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Star className="w-4 h-4 text-amber-400" />
              Rate This Match
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <p className="text-sm text-muted-foreground mb-2">How accurate was this match?</p>
              <StarRating value={feedbackRating} onChange={setFeedbackRating} />
              <div className="flex gap-2 mt-3">
                {[
                  { label: "1 – Wrong match", v: 1 },
                  { label: "3 – Partial", v: 3 },
                  { label: "5 – Perfect", v: 5 },
                ].map(({ label, v }) => (
                  <button
                    key={v}
                    onClick={() => setFeedbackRating(v)}
                    className={`text-xs px-2 py-1 rounded border transition-colors ${feedbackRating === v ? "bg-primary text-primary-foreground border-primary" : "border-border hover:bg-muted"}`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <p className="text-sm text-muted-foreground mb-1">Was this match helpful?</p>
              <div className="flex gap-2">
                <button
                  onClick={() => setFeedbackHelpful(true)}
                  className={`flex items-center gap-1 text-sm px-3 py-1.5 rounded border transition-colors ${feedbackHelpful === true ? "bg-emerald-500 text-white border-emerald-500" : "border-border hover:bg-muted"}`}
                >
                  <ThumbsUp className="w-3.5 h-3.5" /> Yes
                </button>
                <button
                  onClick={() => setFeedbackHelpful(false)}
                  className={`flex items-center gap-1 text-sm px-3 py-1.5 rounded border transition-colors ${feedbackHelpful === false ? "bg-red-500 text-white border-red-500" : "border-border hover:bg-muted"}`}
                >
                  <ThumbsDown className="w-3.5 h-3.5" /> No
                </button>
              </div>
            </div>
            <div>
              <p className="text-sm text-muted-foreground mb-1">Comment (optional)</p>
              <Textarea
                placeholder="Why was this a good or bad match?"
                value={feedbackComment}
                onChange={e => setFeedbackComment(e.target.value)}
                rows={3}
                className="text-sm"
              />
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setFeedbackMatchId(null)}>Cancel</Button>
              <Button
                onClick={handleSubmitFeedback}
                disabled={feedbackRating === 0 || submitFeedback.isPending}
              >
                {submitFeedback.isPending ? "Saving..." : "Submit Feedback"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
