import { useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { Activity, Database, MessageSquare, AlertCircle, CheckCircle2, XCircle } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export function SystemHealthWidget() {
  const { data: health, refetch } = trpc.systemHealth.getStatus.useQuery(undefined, {
    refetchInterval: 30000, // Refetch every 30 seconds
  });

  const getStatusIcon = (status: string | null) => {
    if (status === "connected" || status === "healthy") {
      return <CheckCircle2 className="h-4 w-4 text-green-500" />;
    } else if (status === "error" || status === "unhealthy") {
      return <XCircle className="h-4 w-4 text-red-500" />;
    } else {
      return <AlertCircle className="h-4 w-4 text-yellow-500" />;
    }
  };

  const getStatusColor = (status: string | null) => {
    if (status === "connected" || status === "healthy") return "bg-green-500/10 text-green-500 border-green-500/20";
    if (status === "error" || status === "unhealthy") return "bg-red-500/10 text-red-500 border-red-500/20";
    return "bg-yellow-500/10 text-yellow-500 border-yellow-500/20";
  };

  const formatTime = (date: Date | string | null) => {
    if (!date) return "Never";
    const d = new Date(date);
    const now = new Date();
    const diff = now.getTime() - d.getTime();
    const minutes = Math.floor(diff / 60000);
    
    if (minutes < 1) return "Just now";
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  };

  return (
    <Card className="p-4 bg-card/50 backdrop-blur-sm border-border/50">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Activity className="h-5 w-5 text-primary" />
          <h3 className="font-semibold text-sm">System Health</h3>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => refetch()}
          className="h-7 px-2 text-xs"
        >
          Refresh
        </Button>
      </div>

      <div className="space-y-2">
        {/* WhatsApp Status */}
        <div className="flex items-center justify-between p-2 rounded-md bg-background/50">
          <div className="flex items-center gap-2">
            <MessageSquare className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm">WhatsApp</span>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className={getStatusColor(health?.whatsappStatus || null)}>
              {getStatusIcon(health?.whatsappStatus || null)}
              <span className="ml-1 text-xs">{health?.whatsappStatus || "Unknown"}</span>
            </Badge>
          </div>
        </div>

        {/* Database Status */}
        <div className="flex items-center justify-between p-2 rounded-md bg-background/50">
          <div className="flex items-center gap-2">
            <Database className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm">Database</span>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className={getStatusColor(health?.databaseStatus || null)}>
              {getStatusIcon(health?.databaseStatus || null)}
              <span className="ml-1 text-xs">{health?.databaseStatus || "Unknown"}</span>
            </Badge>
          </div>
        </div>

        {/* Last Message Time */}
        {health?.whatsappLastMessageAt && (
          <div className="flex items-center justify-between p-2 rounded-md bg-background/50">
            <span className="text-xs text-muted-foreground">Last Message</span>
            <span className="text-xs font-medium">{formatTime(health.whatsappLastMessageAt)}</span>
          </div>
        )}

        {/* Last Match Time */}
        {health?.matchingEngineLastRunAt && (
          <div className="flex items-center justify-between p-2 rounded-md bg-background/50">
            <span className="text-xs text-muted-foreground">Last Match</span>
            <span className="text-xs font-medium">{formatTime(health.matchingEngineLastRunAt)}</span>
          </div>
        )}

        {/* Error Message */}
        {health?.whatsappErrorMessage && (
          <div className="p-2 rounded-md bg-red-500/10 border border-red-500/20">
            <p className="text-xs text-red-500">{health.whatsappErrorMessage}</p>
          </div>
        )}
      </div>
    </Card>
  );
}
