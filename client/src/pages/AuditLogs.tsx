import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { FileText, User, Package, MessageSquare, Bell, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export default function AuditLogs() {
  const [entityTypeFilter, setEntityTypeFilter] = useState<string | undefined>();
  const [searchQuery, setSearchQuery] = useState("");

  const { data: logs, isLoading } = trpc.auditLogs.getLogs.useQuery({
    entityType: entityTypeFilter,
    limit: 100
  });

  const getEntityIcon = (entityType: string) => {
    switch (entityType) {
      case "supply": return <Package className="h-4 w-4" />;
      case "demand": return <Search className="h-4 w-4" />;
      case "match": return <FileText className="h-4 w-4" />;
      case "user": return <User className="h-4 w-4" />;
      case "notification": return <Bell className="h-4 w-4" />;
      default: return <FileText className="h-4 w-4" />;
    }
  };

  const getActionColor = (action: string) => {
    switch (action) {
      case "created": return "bg-green-500/10 text-green-500 border-green-500/20";
      case "updated": return "bg-blue-500/10 text-blue-500 border-blue-500/20";
      case "deleted": return "bg-red-500/10 text-red-500 border-red-500/20";
      case "contacted": return "bg-purple-500/10 text-purple-500 border-purple-500/20";
      case "qualified": return "bg-yellow-500/10 text-yellow-500 border-yellow-500/20";
      default: return "bg-gray-500/10 text-gray-500 border-gray-500/20";
    }
  };

  const formatDate = (date: Date | string) => {
    const d = new Date(date);
    return d.toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    });
  };

  const filteredLogs = logs?.filter(log => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      log.entityType.toLowerCase().includes(query) ||
      log.action.toLowerCase().includes(query) ||
      (log.createdBy?.toString() || "").includes(query) ||
      (log.changes && JSON.stringify(log.changes).toLowerCase().includes(query))
    );
  });

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Audit Logs</h1>
        <p className="text-muted-foreground">Track all system activities and changes</p>
      </div>

      {/* Filters */}
      <Card className="p-4">
        <div className="flex gap-4">
          <div className="flex-1">
            <Input
              placeholder="Search logs..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full"
            />
          </div>
          <Select value={entityTypeFilter} onValueChange={(v) => setEntityTypeFilter(v === "all" ? undefined : v)}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="All Entity Types" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              <SelectItem value="supply">Supply</SelectItem>
              <SelectItem value="demand">Demand</SelectItem>
              <SelectItem value="match">Match</SelectItem>
              <SelectItem value="user">User</SelectItem>
              <SelectItem value="notification">Notification</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </Card>

      {/* Logs Table */}
      <Card className="p-6">
        {isLoading ? (
          <div className="text-center py-8 text-muted-foreground">Loading audit logs...</div>
        ) : filteredLogs && filteredLogs.length > 0 ? (
          <div className="space-y-2">
            {filteredLogs.map((log) => (
              <div
                key={log.id}
                className="flex items-start gap-4 p-4 rounded-lg border border-border hover:bg-muted/50 transition-colors"
              >
                {/* Icon */}
                <div className="mt-1">
                  {getEntityIcon(log.entityType)}
                </div>

                {/* Main Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <Badge variant="outline" className={getActionColor(log.action)}>
                      {log.action}
                    </Badge>
                    <span className="font-medium">{log.entityType}</span>
                    <span className="text-muted-foreground">#{log.entityId}</span>
                  </div>

                  {/* Changes */}
                  {log.changes !== null && log.changes !== undefined && (
                    <div className="mt-2 text-xs text-muted-foreground">
                      <span className="font-medium">Changes recorded</span>
                    </div>
                  )}


                </div>

                {/* Right Side Info */}
                <div className="text-right text-sm">
                  <div className="flex items-center gap-1 text-muted-foreground mb-1">
                    <User className="h-3 w-3" />
                    <span>User #{log.createdBy}</span>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {formatDate(log.createdAt)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            No audit logs found
          </div>
        )}
      </Card>

      {/* Summary Stats */}
      {logs && logs.length > 0 && (
        <Card className="p-4">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-center">
            <div>
              <p className="text-2xl font-bold">{logs.length}</p>
              <p className="text-sm text-muted-foreground">Total Logs</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-green-500">
                {logs.filter(l => l.action === "created").length}
              </p>
              <p className="text-sm text-muted-foreground">Created</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-blue-500">
                {logs.filter(l => l.action === "updated").length}
              </p>
              <p className="text-sm text-muted-foreground">Updated</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-red-500">
                {logs.filter(l => l.action === "deleted").length}
              </p>
              <p className="text-sm text-muted-foreground">Deleted</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-purple-500">
                {logs.filter(l => l.action === "contacted" || l.action === "qualified").length}
              </p>
              <p className="text-sm text-muted-foreground">Actions</p>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}
