import { useState, useEffect, useRef } from "react";
import { trpc } from "@/lib/trpc";
import { usePushNotifications } from "@/hooks/usePushNotifications";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { 
  Bell, 
  BellRing, 
  Check, 
  CheckCheck, 
  Target, 
  MessageSquare, 
  AlertCircle,
  Building,
  Loader2,
  BellOff,
  Smartphone
} from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";

type NotificationType = "high_match" | "new_supply" | "new_demand" | "system";

const notificationIcons: Record<NotificationType, typeof Target> = {
  high_match: Target,
  new_supply: Building,
  new_demand: MessageSquare,
  system: AlertCircle,
};

const notificationColors: Record<NotificationType, string> = {
  high_match: "text-green-500 bg-green-500/10",
  new_supply: "text-blue-500 bg-blue-500/10",
  new_demand: "text-purple-500 bg-purple-500/10",
  system: "text-yellow-500 bg-yellow-500/10",
};

const notificationLabels: Record<NotificationType, string> = {
  high_match: "High-Confidence Match",
  new_supply: "New Supply",
  new_demand: "New Demand",
  system: "System",
};

export default function NotificationBell() {
  const [open, setOpen] = useState(false);
  const { isSubscribed, isSupported, isLoading: pushLoading, subscribe, unsubscribe } = usePushNotifications();
  const lastNotificationIdRef = useRef<number | null>(null);
  const utils = trpc.useUtils();

  // Fetch notifications
  const { data: notifications, isLoading } = trpc.notifications.unread.useQuery(
    { limit: 20 },
    { refetchInterval: 10000 } // Refresh every 10 seconds
  );

  const { data: unreadCount } = trpc.notifications.count.useQuery(undefined, {
    refetchInterval: 5000, // Refresh count every 5 seconds
  });

  const count = typeof unreadCount === 'number' ? unreadCount : 0;

  // Mark single notification as read
  const markReadMutation = trpc.notifications.markRead.useMutation({
    onSuccess: () => {
      utils.notifications.unread.invalidate();
      utils.notifications.count.invalidate();
    },
    onError: () => {
      toast.error("Failed to mark notification as read");
    },
  });

  // Mark all as read
  const markAllReadMutation = trpc.notifications.markAllRead.useMutation({
    onSuccess: () => {
      utils.notifications.unread.invalidate();
      utils.notifications.count.invalidate();
      toast.success("All notifications marked as read");
    },
    onError: () => {
      toast.error("Failed to mark all as read");
    },
  });

  // Show toast for new high-confidence matches
  useEffect(() => {
    if (notifications && notifications.length > 0) {
      const latestNotification = notifications[0];
      if (latestNotification && !latestNotification.isRead && latestNotification.type === "high_match") {
        // Only show toast if this is a new notification we haven't seen
        if (lastNotificationIdRef.current !== latestNotification.id) {
          const createdAt = new Date(latestNotification.createdAt);
          const now = new Date();
          const diffSeconds = (now.getTime() - createdAt.getTime()) / 1000;
          
          if (diffSeconds < 60) {
            toast.success(latestNotification.title, {
              description: latestNotification.content || "New high-confidence match found!",
              duration: 5000,
            });
            lastNotificationIdRef.current = latestNotification.id;
          }
        }
      }
    }
  }, [notifications]);

  const handleMarkRead = (notificationId: number) => {
    markReadMutation.mutate({ notificationId });
  };

  const handleMarkAllRead = () => {
    markAllReadMutation.mutate();
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button 
          variant="ghost" 
          size="icon" 
          className="relative h-9 w-9"
          aria-label={`Notifications ${count > 0 ? `(${count} unread)` : ""}`}
        >
          {count > 0 ? (
            <BellRing className="h-5 w-5 text-primary animate-pulse" />
          ) : (
            <Bell className="h-5 w-5 text-muted-foreground" />
          )}
          {count > 0 && (
            <Badge 
              variant="destructive" 
              className="absolute -top-1 -right-1 h-5 min-w-5 px-1 text-xs flex items-center justify-center"
            >
              {count > 99 ? "99+" : count}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="end">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <div className="flex items-center gap-2">
            <Bell className="h-4 w-4" />
            <h4 className="font-semibold">Notifications</h4>
            {count > 0 && (
              <Badge variant="secondary" className="text-xs">
                {count} new
              </Badge>
            )}
          </div>
          {count > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="h-8 text-xs"
              onClick={handleMarkAllRead}
              disabled={markAllReadMutation.isPending}
            >
              {markAllReadMutation.isPending ? (
                <Loader2 className="h-3 w-3 animate-spin mr-1" />
              ) : (
                <CheckCheck className="h-3 w-3 mr-1" />
              )}
              Mark all read
            </Button>
          )}
        </div>

        {/* Push Notification Toggle */}
        {isSupported && (
          <>
            <div className="flex items-center justify-between px-4 py-2 bg-muted/30 border-b">
              <div className="flex items-center gap-2">
                <Smartphone className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-xs text-muted-foreground">
                  {isSubscribed ? "Push alerts: On" : "Push alerts: Off"}
                </span>
              </div>
              <Button
                variant={isSubscribed ? "outline" : "default"}
                size="sm"
                className="h-7 text-xs px-3"
                onClick={async () => {
                  if (isSubscribed) {
                    await unsubscribe();
                    toast.info("Push notifications disabled");
                  } else {
                    const ok = await subscribe();
                    if (ok) toast.success("Push notifications enabled! You'll receive match alerts on this device.");
                    else toast.error("Could not enable push notifications. Please allow notifications in your browser.");
                  }
                }}
                disabled={pushLoading}
              >
                {pushLoading ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : isSubscribed ? (
                  <><BellOff className="h-3 w-3 mr-1" />Disable</>
                ) : (
                  <><Bell className="h-3 w-3 mr-1" />Enable</>
                )}
              </Button>
            </div>
          </>
        )}
        {/* Notification List */}
        <ScrollArea className="h-80">
          {isLoading ? (
            <div className="flex items-center justify-center h-32">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : notifications && notifications.length > 0 ? (
            <div className="divide-y">
              {notifications.map((notification) => {
                const type = notification.type as NotificationType;
                const Icon = notificationIcons[type] || AlertCircle;
                const colorClass = notificationColors[type] || "text-gray-500 bg-gray-500/10";
                
                return (
                  <div
                    key={notification.id}
                    className={`p-4 hover:bg-muted/50 transition-colors ${
                      !notification.isRead ? "bg-primary/5" : ""
                    }`}
                  >
                    <div className="flex gap-3">
                      <div className={`p-2 rounded-full shrink-0 ${colorClass}`}>
                        <Icon className="h-4 w-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <p className="font-medium text-sm truncate">
                            {notification.title}
                          </p>
                          {!notification.isRead && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6 shrink-0"
                              onClick={() => handleMarkRead(notification.id)}
                              disabled={markReadMutation.isPending}
                            >
                              <Check className="h-3 w-3" />
                            </Button>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                          {notification.content || notificationLabels[type]}
                        </p>
                        <p className="text-xs text-muted-foreground mt-2">
                          {formatDistanceToNow(new Date(notification.createdAt), { addSuffix: true })}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-32 text-center p-4">
              <Bell className="h-8 w-8 text-muted-foreground mb-2" />
              <p className="text-sm text-muted-foreground">No notifications yet</p>
              <p className="text-xs text-muted-foreground mt-1">
                You'll be notified when new matches are found
              </p>
            </div>
          )}
        </ScrollArea>

        {/* Footer */}
        {notifications && notifications.length > 0 && (
          <>
            <Separator />
            <div className="p-2">
              <Button
                variant="ghost"
                className="w-full text-xs h-8"
                onClick={() => setOpen(false)}
              >
                Close
              </Button>
            </div>
          </>
        )}
      </PopoverContent>
    </Popover>
  );
}
