import { useAuth } from "@/_core/hooks/useAuth";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { trpc } from "@/lib/trpc";
import { 
  Bell, 
  Mail, 
  MessageSquare, 
  Save,
  RefreshCw,
  Send,
  CheckCircle2,
  XCircle
} from "lucide-react";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { getLoginUrl } from "@/const";

export default function NotificationPreferences() {
  const { user, loading: authLoading, isAuthenticated } = useAuth();
  
  const { data: prefs, isLoading: prefsLoading, refetch } = trpc.notificationPrefs.get.useQuery(undefined, {
    enabled: isAuthenticated
  });
  const { data: isAdmin } = trpc.auth.isAdmin.useQuery(undefined, {
    enabled: isAuthenticated
  });
  
  const updateMutation = trpc.notificationPrefs.update.useMutation({
    onSuccess: () => {
      toast.success("Notification preferences saved");
      refetch();
    },
    onError: () => {
      toast.error("Failed to save preferences");
    }
  });

  const testNotificationMutation = trpc.notifications.sendTest.useMutation({
    onSuccess: (result) => {
      if (result.whatsapp || result.email) {
        toast.success("Test notification sent successfully");
      } else {
        toast.error("Failed to send test notification");
      }
    },
    onError: () => {
      toast.error("Failed to send test notification");
    }
  });

  // Form state
  const [emailEnabled, setEmailEnabled] = useState(true);
  const [emailAddress, setEmailAddress] = useState("");
  const [whatsappEnabled, setWhatsappEnabled] = useState(true);
  const [whatsappNumber, setWhatsappNumber] = useState("+201066505665");
  const [highMatchThreshold, setHighMatchThreshold] = useState(85);
  const [notifyNewSupply, setNotifyNewSupply] = useState(false);
  const [notifyNewDemand, setNotifyNewDemand] = useState(false);
  const [notifyHighMatch, setNotifyHighMatch] = useState(true);

  // Load preferences when data is available
  useEffect(() => {
    if (prefs) {
      setEmailEnabled(!!prefs.emailEnabled);
      setEmailAddress(prefs.emailAddress || user?.email || "");
      setWhatsappEnabled(!!prefs.whatsappEnabled);
      setWhatsappNumber(prefs.whatsappNumber || "+201066505665");
      setHighMatchThreshold(prefs.highMatchThreshold || 85);
      setNotifyNewSupply(!!prefs.notifyNewSupply);
      setNotifyNewDemand(!!prefs.notifyNewDemand);
      setNotifyHighMatch(!!prefs.notifyHighMatch);
    } else if (user?.email) {
      setEmailAddress(user.email);
    }
  }, [prefs, user]);

  const handleSave = () => {
    updateMutation.mutate({
      emailEnabled,
      emailAddress: emailAddress || undefined,
      whatsappEnabled,
      whatsappNumber: whatsappNumber || undefined,
      highMatchThreshold,
      notifyNewSupply,
      notifyNewDemand,
      notifyHighMatch
    });
  };

  const handleTestWhatsApp = () => {
    if (!whatsappNumber) {
      toast.error("Please enter a WhatsApp number first");
      return;
    }
    testNotificationMutation.mutate({
      channel: 'whatsapp',
      phoneNumber: whatsappNumber
    });
  };

  const handleTestEmail = () => {
    if (!emailAddress) {
      toast.error("Please enter an email address first");
      return;
    }
    testNotificationMutation.mutate({
      channel: 'email',
      email: emailAddress
    });
  };

  if (authLoading || prefsLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <RefreshCw className="h-8 w-8 animate-spin text-emerald-500" />
        </div>
      </DashboardLayout>
    );
  }

  if (!isAuthenticated) {
    return (
      <DashboardLayout>
        <div className="flex flex-col items-center justify-center h-[60vh] space-y-6">
          <Bell className="h-16 w-16 text-slate-400" />
          <div className="text-center space-y-2">
            <h1 className="text-2xl font-bold text-white">Notification Preferences</h1>
            <p className="text-slate-400">Please sign in to manage your notification settings</p>
          </div>
          <Button 
            onClick={() => window.location.href = getLoginUrl()}
            className="bg-emerald-600 hover:bg-emerald-700"
          >
            Sign In
          </Button>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6 max-w-3xl">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Bell className="h-6 w-6 text-emerald-500" />
            Notification Preferences
          </h1>
          <p className="text-slate-400 mt-1">
            Configure how and when you receive match notifications
          </p>
        </div>

        {/* WhatsApp Notifications */}
        <Card className="bg-slate-800/50 border-slate-700">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-green-500/20 rounded-lg">
                  <MessageSquare className="h-5 w-5 text-green-500" />
                </div>
                <div>
                  <CardTitle className="text-white">WhatsApp Notifications</CardTitle>
                  <CardDescription className="text-slate-400">
                    Receive instant alerts via WhatsApp
                  </CardDescription>
                </div>
              </div>
              <Switch
                checked={whatsappEnabled}
                onCheckedChange={setWhatsappEnabled}
              />
            </div>
          </CardHeader>
          {whatsappEnabled && (
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label className="text-slate-300">WhatsApp Number</Label>
                <div className="flex gap-2">
                  <Input
                    value={whatsappNumber}
                    onChange={(e) => setWhatsappNumber(e.target.value)}
                    placeholder="+201066505665"
                    className="bg-slate-900/50 border-slate-600 text-white"
                  />
                  <Button
                    variant="outline"
                    onClick={handleTestWhatsApp}
                    disabled={testNotificationMutation.isPending}
                    className="border-green-500/50 text-green-400 hover:bg-green-500/10"
                  >
                    <Send className="h-4 w-4 mr-2" />
                    Test
                  </Button>
                </div>
                <p className="text-xs text-slate-500">
                  Include country code (e.g., +20 for Egypt)
                </p>
              </div>
            </CardContent>
          )}
        </Card>

        {/* Email Notifications */}
        <Card className="bg-slate-800/50 border-slate-700">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-500/20 rounded-lg">
                  <Mail className="h-5 w-5 text-blue-500" />
                </div>
                <div>
                  <CardTitle className="text-white">Email Notifications</CardTitle>
                  <CardDescription className="text-slate-400">
                    Receive detailed reports via email
                  </CardDescription>
                </div>
              </div>
              <Switch
                checked={emailEnabled}
                onCheckedChange={setEmailEnabled}
              />
            </div>
          </CardHeader>
          {emailEnabled && (
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label className="text-slate-300">Email Address</Label>
                <div className="flex gap-2">
                  <Input
                    type="email"
                    value={emailAddress}
                    onChange={(e) => setEmailAddress(e.target.value)}
                    placeholder="your@email.com"
                    className="bg-slate-900/50 border-slate-600 text-white"
                  />
                  <Button
                    variant="outline"
                    onClick={handleTestEmail}
                    disabled={testNotificationMutation.isPending || !isAdmin}
                    className="border-blue-500/50 text-blue-400 hover:bg-blue-500/10"
                  >
                    <Send className="h-4 w-4 mr-2" />
                    Test
                  </Button>
                </div>
                {!isAdmin && (
                  <p className="text-xs text-amber-500">
                    Email testing is only available for admin users
                  </p>
                )}
              </div>
            </CardContent>
          )}
        </Card>

        {/* Notification Triggers */}
        <Card className="bg-slate-800/50 border-slate-700">
          <CardHeader>
            <CardTitle className="text-white">Notification Triggers</CardTitle>
            <CardDescription className="text-slate-400">
              Choose which events trigger notifications
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* High Match Threshold */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                  <div>
                    <p className="text-white font-medium">High-Confidence Matches</p>
                    <p className="text-sm text-slate-400">
                      Notify when match score exceeds threshold
                    </p>
                  </div>
                </div>
                <Switch
                  checked={notifyHighMatch}
                  onCheckedChange={setNotifyHighMatch}
                />
              </div>
              {notifyHighMatch && (
                <div className="pl-8 space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-slate-300">Threshold: {highMatchThreshold}%</Label>
                    <span className="text-xs text-slate-500">
                      {highMatchThreshold >= 85 ? "Premium" : highMatchThreshold >= 70 ? "Good" : "Standard"}
                    </span>
                  </div>
                  <Slider
                    value={[highMatchThreshold]}
                    onValueChange={(value) => setHighMatchThreshold(value[0])}
                    min={60}
                    max={100}
                    step={5}
                    className="w-full"
                  />
                  <p className="text-xs text-slate-500">
                    Minimum 60% (system threshold). Recommended: 85% for premium matches only.
                  </p>
                </div>
              )}
            </div>

            {/* New Supply */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-5 w-5 rounded-full bg-emerald-500/20 flex items-center justify-center">
                  <span className="text-emerald-500 text-xs font-bold">S</span>
                </div>
                <div>
                  <p className="text-white font-medium">New Supply Listings</p>
                  <p className="text-sm text-slate-400">
                    Notify when new properties are listed
                  </p>
                </div>
              </div>
              <Switch
                checked={notifyNewSupply}
                onCheckedChange={setNotifyNewSupply}
              />
            </div>

            {/* New Demand */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-5 w-5 rounded-full bg-blue-500/20 flex items-center justify-center">
                  <span className="text-blue-500 text-xs font-bold">D</span>
                </div>
                <div>
                  <p className="text-white font-medium">New Demand Requests</p>
                  <p className="text-sm text-slate-400">
                    Notify when new buyer requests arrive
                  </p>
                </div>
              </div>
              <Switch
                checked={notifyNewDemand}
                onCheckedChange={setNotifyNewDemand}
              />
            </div>
          </CardContent>
        </Card>

        {/* Save Button */}
        <div className="flex justify-end">
          <Button
            onClick={handleSave}
            disabled={updateMutation.isPending}
            className="bg-emerald-600 hover:bg-emerald-700"
          >
            {updateMutation.isPending ? (
              <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Save className="h-4 w-4 mr-2" />
            )}
            Save Preferences
          </Button>
        </div>
      </div>
    </DashboardLayout>
  );
}
