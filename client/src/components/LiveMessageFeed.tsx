import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  MessageSquare, RefreshCw, User, Building2, Home,
  HelpCircle, Shield, Phone, Clock, Users, ChevronDown, ChevronUp
} from "lucide-react";

const ACTIVE_WA_NUMBER = "+201066505665";
const ACTIVE_WA_NAME = "Mo'men Maisara";

function formatTimeAgo(date: Date | string | null): string {
  if (!date) return "Never";
  const d = new Date(date);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function formatPhone(sender: string | null): string {
  if (!sender) return "Unknown";
  const num = sender.replace(/@.*$/, "");
  return `+${num}`;
}

function ClassificationBadge({ cls }: { cls: string | null }) {
  if (cls === "supply") {
    return (
      <Badge className="text-xs bg-emerald-500/15 text-emerald-400 border-emerald-500/30 border flex items-center gap-1 shrink-0">
        <Home className="h-3 w-3" /> Supply
      </Badge>
    );
  }
  if (cls === "demand") {
    return (
      <Badge className="text-xs bg-blue-500/15 text-blue-400 border-blue-500/30 border flex items-center gap-1 shrink-0">
        <Building2 className="h-3 w-3" /> Demand
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="text-xs flex items-center gap-1 shrink-0">
      <HelpCircle className="h-3 w-3" /> General
    </Badge>
  );
}

function MessageCard({ msg }: { msg: any }) {
  const [expanded, setExpanded] = useState(false);
  const isMe = msg.sender === "201066505665@c.us";
  const phone = formatPhone(msg.sender);
  const text = msg.messageText || "";
  const isLong = text.length > 120;

  return (
    <div className={`rounded-lg border p-3 space-y-2 transition-colors ${isMe ? "border-green-500/30 bg-green-500/5" : "border-border/50 bg-card/30 hover:bg-muted/30"}`}>
      {/* Row 1: Group name */}
      {msg.groupName && (
        <div className="flex items-center gap-1.5">
          <Users className="h-3 w-3 text-muted-foreground shrink-0" />
          <span className="text-xs font-medium text-muted-foreground truncate">{msg.groupName}</span>
        </div>
      )}

      {/* Row 2: Contact number + name + classification + time */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <Phone className={`h-3 w-3 shrink-0 ${isMe ? "text-green-400" : "text-primary"}`} />
          <span className={`font-mono text-xs font-semibold shrink-0 ${isMe ? "text-green-400" : "text-foreground"}`}>
            {phone}
          </span>
          {isMe && (
            <Badge className="text-xs bg-green-500/20 text-green-400 border-green-500/30 border px-1.5 py-0 shrink-0">You</Badge>
          )}
          {msg.senderName && !isMe && (
            <span className="text-xs text-muted-foreground truncate">{msg.senderName}</span>
          )}
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <ClassificationBadge cls={msg.classification} />
          <span className="text-xs text-muted-foreground whitespace-nowrap">{formatTimeAgo(msg.createdAt)}</span>
        </div>
      </div>

      {/* Row 3: Message content */}
      <div className="text-sm text-foreground/85 leading-relaxed">
        {isLong && !expanded ? (
          <>
            <span>{text.slice(0, 120)}…</span>
            <button
              onClick={() => setExpanded(true)}
              className="ml-1 text-xs text-primary hover:underline inline-flex items-center gap-0.5"
            >
              more <ChevronDown className="h-3 w-3" />
            </button>
          </>
        ) : (
          <>
            <span>{text}</span>
            {isLong && (
              <button
                onClick={() => setExpanded(false)}
                className="ml-1 text-xs text-primary hover:underline inline-flex items-center gap-0.5"
              >
                less <ChevronUp className="h-3 w-3" />
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export function LiveMessageFeed() {
  const { user } = useAuth();
  const [showMyMessages, setShowMyMessages] = useState(false);
  const role = (user as any)?.role ?? "user";

  const { data: feed, refetch, isFetching } = trpc.dashboard.liveFeed.useQuery(
    showMyMessages
      ? { limit: 20, senderFilter: ACTIVE_WA_NUMBER }
      : { limit: 20 },
    { refetchInterval: 30000 }
  );

  const { data: stats } = trpc.dashboard.stats.useQuery(undefined, {
    refetchInterval: 30000,
  });

  return (
    <Card className="flex flex-col bg-card/50 backdrop-blur-sm border-border/50">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between gap-2 text-base">
          <div className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5 text-primary" />
            <span>Live Message Feed</span>
            {isFetching && <RefreshCw className="h-3 w-3 text-muted-foreground animate-spin" />}
          </div>
          <div className="flex items-center gap-2">
            {role === "admin" ? (
              <Badge className="text-xs bg-amber-500/20 text-amber-400 border-amber-500/30 border flex items-center gap-1">
                <Shield className="h-3 w-3" /> Admin
              </Badge>
            ) : (
              <Badge variant="outline" className="text-xs flex items-center gap-1">
                <User className="h-3 w-3" /> User
              </Badge>
            )}
            <Button variant="ghost" size="sm" onClick={() => refetch()} className="h-7 px-2">
              <RefreshCw className="h-3 w-3" />
            </Button>
          </div>
        </CardTitle>
      </CardHeader>

      <CardContent className="flex flex-col gap-3 pt-0">
        {/* Active WhatsApp account */}
        <div className="rounded-md bg-green-500/5 border border-green-500/20 px-3 py-2 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="relative">
              <Phone className="h-4 w-4 text-green-400" />
              <span className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-green-500 border border-background" />
            </div>
            <div>
              <p className="text-xs font-semibold text-green-400">{ACTIVE_WA_NAME}</p>
              <p className="text-xs font-mono text-foreground">{ACTIVE_WA_NUMBER}</p>
            </div>
          </div>
          <Badge className="text-xs bg-green-500/20 text-green-400 border-green-500/30 border">Connected</Badge>
        </div>

        {/* Last message + last match summary */}
        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-md bg-primary/5 border border-primary/20 px-3 py-2">
            <div className="flex items-center gap-1.5 mb-1">
              <Clock className="h-3 w-3 text-primary" />
              <span className="text-xs font-medium text-primary">Last Message</span>
            </div>
            <span className="text-sm font-bold block">
              {stats?.lastMessageAt ? formatTimeAgo(stats.lastMessageAt) : "—"}
            </span>
            {stats?.lastMessageSender && (
              <span className="text-xs font-mono text-muted-foreground block truncate">
                {formatPhone(stats.lastMessageSender)}
              </span>
            )}
            {stats?.lastMessageGroup && (
              <span className="text-xs text-muted-foreground/70 block truncate" title={stats.lastMessageGroup}>
                {stats.lastMessageGroup}
              </span>
            )}
          </div>
          <div className="rounded-md bg-emerald-500/5 border border-emerald-500/20 px-3 py-2">
            <div className="flex items-center gap-1.5 mb-1">
              <Clock className="h-3 w-3 text-emerald-400" />
              <span className="text-xs font-medium text-emerald-400">Last Match</span>
            </div>
            <span className="text-sm font-bold block">
              {stats?.lastMatchAt ? formatTimeAgo(stats.lastMatchAt) : "—"}
            </span>
            <span className="text-xs text-muted-foreground block">
              {stats?.totalMatches?.toLocaleString() ?? 0} total
            </span>
          </div>
        </div>

        {/* Filter toggle */}
        <div className="flex items-center gap-2">
          <Button
            variant={!showMyMessages ? "default" : "outline"}
            size="sm"
            className="h-7 text-xs"
            onClick={() => setShowMyMessages(false)}
          >
            All Messages
          </Button>
          <Button
            variant={showMyMessages ? "default" : "outline"}
            size="sm"
            className="h-7 text-xs"
            onClick={() => setShowMyMessages(true)}
          >
            <User className="h-3 w-3 mr-1" /> My Messages
          </Button>
          <span className="text-xs text-muted-foreground ml-auto">
            {stats?.todayMessages?.toLocaleString() ?? 0} today
          </span>
        </div>

        {/* Feed */}
        <ScrollArea className="h-[380px] pr-1">
          <div className="space-y-2">
            {!feed || feed.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-40 text-muted-foreground text-sm gap-2">
                <MessageSquare className="h-8 w-8 opacity-30" />
                <span>{showMyMessages ? `No messages from ${ACTIVE_WA_NUMBER}` : "No messages yet"}</span>
              </div>
            ) : (
              feed.map((msg) => <MessageCard key={msg.id} msg={msg} />)
            )}
          </div>
        </ScrollArea>

        {/* Footer */}
        <div className="flex items-center justify-between text-xs text-muted-foreground border-t border-border/50 pt-2">
          <span>{stats?.todayMessages?.toLocaleString() ?? 0} messages today</span>
          <span>{stats?.totalMessages?.toLocaleString() ?? 0} total processed</span>
        </div>
      </CardContent>
    </Card>
  );
}
