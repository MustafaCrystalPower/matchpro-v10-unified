import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CheckCircle, XCircle, Clock, RefreshCw, MessageSquare, Inbox } from "lucide-react";

const PRIORITY_COLORS: Record<string, string> = {
  urgent: "destructive",
  high: "default",
  medium: "secondary",
  low: "outline",
};

const PRIORITY_LABELS: Record<string, string> = {
  urgent: "🔴 Urgent",
  high: "🟠 High",
  medium: "🟡 Medium",
  low: "🟢 Low",
};

function formatTime(d: string | Date) {
  return new Date(d).toLocaleString("en-EG", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

export default function OwnerTasks() {
  const { data: tasks = [], refetch, isLoading } = trpc.ownerTasks.list.useQuery();
  const updateStatus = trpc.ownerTasks.updateStatus.useMutation({
    onSuccess: () => { toast.success("Task updated"); refetch(); },
  });

  const pending = tasks.filter((t: any) => t.status === "pending");
  const done = tasks.filter((t: any) => t.status === "done");

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Inbox className="w-6 h-6 text-primary" />
            Owner Tasks
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Tasks extracted automatically from your personal WhatsApp messages
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()}>
          <RefreshCw className="w-4 h-4 mr-2" /> Refresh
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-card border rounded-lg p-4 flex items-center gap-3">
          <Clock className="w-8 h-8 text-yellow-500" />
          <div><div className="text-2xl font-bold">{pending.length}</div><div className="text-xs text-muted-foreground">Pending</div></div>
        </div>
        <div className="bg-card border rounded-lg p-4 flex items-center gap-3">
          <CheckCircle className="w-8 h-8 text-green-500" />
          <div><div className="text-2xl font-bold">{done.length}</div><div className="text-xs text-muted-foreground">Done</div></div>
        </div>
        <div className="bg-card border rounded-lg p-4 flex items-center gap-3">
          <MessageSquare className="w-8 h-8 text-blue-500" />
          <div><div className="text-2xl font-bold">{tasks.length}</div><div className="text-xs text-muted-foreground">Total</div></div>
        </div>
      </div>

      {/* Pending tasks */}
      {pending.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
            <Clock className="w-5 h-5 text-yellow-500" /> Pending Tasks
          </h2>
          <div className="space-y-3">
            {pending.map((task: any) => (
              <div key={task.id} className="bg-card border rounded-lg p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <Badge variant={(PRIORITY_COLORS[task.priority] || "secondary") as any}>
                        {PRIORITY_LABELS[task.priority] || task.priority}
                      </Badge>
                      {task.isPersonal ? (
                        <Badge variant="outline">💬 Personal</Badge>
                      ) : (
                        <Badge variant="outline">👥 {task.sourceGroupName || "Group"}</Badge>
                      )}
                      <span className="text-xs text-muted-foreground">{formatTime(task.createdAt)}</span>
                    </div>
                    <div className="font-medium text-sm leading-relaxed">{task.title}</div>
                    {task.sourceSenderName && (
                      <div className="text-xs text-muted-foreground mt-1">From: {task.sourceSenderName}</div>
                    )}
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-green-600 border-green-200 hover:bg-green-50"
                      onClick={() => updateStatus.mutate({ id: task.id, status: "done" })}
                    >
                      <CheckCircle className="w-4 h-4 mr-1" /> Done
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-muted-foreground"
                      onClick={() => updateStatus.mutate({ id: task.id, status: "dismissed" })}
                    >
                      <XCircle className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {isLoading && (
        <div className="text-center py-12 text-muted-foreground">Loading tasks...</div>
      )}

      {!isLoading && tasks.length === 0 && (
        <div className="text-center py-16 text-muted-foreground">
          <Inbox className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <div className="font-medium">No tasks yet</div>
          <div className="text-sm mt-1">Tasks are auto-created from your personal WhatsApp messages</div>
        </div>
      )}

      {/* Done tasks (collapsed) */}
      {done.length > 0 && (
        <details className="group">
          <summary className="cursor-pointer text-sm text-muted-foreground hover:text-foreground flex items-center gap-2 py-2">
            <CheckCircle className="w-4 h-4 text-green-500" />
            {done.length} completed tasks
          </summary>
          <div className="space-y-2 mt-2">
            {done.map((task: any) => (
              <div key={task.id} className="bg-muted/30 border rounded-lg p-3 opacity-60">
                <div className="text-sm line-through">{task.title}</div>
                <div className="text-xs text-muted-foreground mt-1">{formatTime(task.createdAt)}</div>
              </div>
            ))}
          </div>
        </details>
      )}
    </div>
  );
}
