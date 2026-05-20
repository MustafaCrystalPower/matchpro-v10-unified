import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { trpc } from '@/lib/trpc';
import { formatDistanceToNow } from 'date-fns';
import { Bell, CheckCircle2, Clock } from 'lucide-react';

export default function CustomNotifications() {
  const [selectedNotifications, setSelectedNotifications] = useState<Set<number>>(new Set());
  
  const notificationsQuery = trpc.customNotifications.list.useQuery({ limit: 100 });
  const unreadCountQuery = trpc.customNotifications.unreadCount.useQuery();
  const markAsReadMutation = trpc.customNotifications.markAsRead.useMutation();
  const markAllAsReadMutation = trpc.customNotifications.markAllAsRead.useMutation();

  const handleMarkAsRead = async (notificationId: number) => {
    try {
      await markAsReadMutation.mutateAsync({ notificationId });
      notificationsQuery.refetch();
      unreadCountQuery.refetch();
      toast.success('Marked as read');
    } catch (error) {
      toast.error('Failed to mark as read');
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      await markAllAsReadMutation.mutateAsync();
      notificationsQuery.refetch();
      unreadCountQuery.refetch();
      toast.success('All notifications marked as read');
    } catch (error) {
      toast.error('Failed to mark all as read');
    }
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'personalized_match':
        return '🎯';
      case 'price_update':
        return '💰';
      case 'new_property':
        return '🏠';
      default:
        return '📢';
    }
  };

  const getNotificationColor = (type: string) => {
    switch (type) {
      case 'personalized_match':
        return 'bg-blue-100 text-blue-800';
      case 'price_update':
        return 'bg-green-100 text-green-800';
      case 'new_property':
        return 'bg-purple-100 text-purple-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  if (notificationsQuery.isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <Clock className="w-12 h-12 mx-auto mb-2 text-gray-400 animate-spin" />
          <p className="text-gray-500">Loading notifications...</p>
        </div>
      </div>
    );
  }

  const notifications = notificationsQuery.data || [];
  const unreadCount = unreadCountQuery.data || 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Notifications</h1>
          <p className="text-gray-500 mt-2">
            {unreadCount > 0 ? `You have ${unreadCount} unread notification${unreadCount !== 1 ? 's' : ''}` : 'All caught up!'}
          </p>
        </div>
        {unreadCount > 0 && (
          <Button 
            onClick={handleMarkAllAsRead}
            variant="outline"
            className="gap-2"
          >
            <CheckCircle2 className="w-4 h-4" />
            Mark all as read
          </Button>
        )}
      </div>

      {notifications.length === 0 ? (
        <Card>
          <CardContent className="pt-12 pb-12">
            <div className="text-center">
              <Bell className="w-12 h-12 mx-auto mb-3 text-gray-400" />
              <h3 className="text-lg font-semibold mb-1">No notifications yet</h3>
              <p className="text-gray-500">
                You'll receive personalized notifications when new properties match your preferences.
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {notifications.map((notification) => (
            <Card 
              key={notification.id}
              className={`cursor-pointer transition-all ${
                notification.isRead === 0 ? 'border-blue-300 bg-blue-50' : ''
              }`}
            >
              <CardContent className="pt-6">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-2xl">{getNotificationIcon(notification.notificationType)}</span>
                      <h3 className="font-semibold text-lg">{notification.title}</h3>
                      <Badge className={getNotificationColor(notification.notificationType)}>
                        {notification.notificationType.replace('_', ' ')}
                      </Badge>
                      {notification.isRead === 0 && (
                        <Badge className="bg-blue-600">New</Badge>
                      )}
                    </div>
                    
                    {notification.message && (
                      <p className="text-gray-700 mb-3">{notification.message}</p>
                    )}
                    
                    <div className="flex items-center gap-4 text-sm text-gray-500">
                      <span>
                        {formatDistanceToNow(new Date(notification.createdAt), { addSuffix: true })}
                      </span>
                      
                      <div className="flex gap-2">
                        {notification.sentViaWhatsapp === 1 && (
                          <Badge variant="outline" className="text-green-700">
                            ✓ WhatsApp sent
                          </Badge>
                        )}
                        {notification.sentViaEmail === 1 && (
                          <Badge variant="outline" className="text-blue-700">
                            ✓ Email sent
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                  
                  {notification.isRead === 0 && (
                    <Button
                      onClick={() => handleMarkAsRead(notification.id)}
                      variant="outline"
                      size="sm"
                      className="gap-2"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      Mark as read
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
