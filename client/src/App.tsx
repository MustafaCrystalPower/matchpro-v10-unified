import { Toaster } from "sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import DashboardLayout from "./components/DashboardLayout";
import Dashboard from "./pages/Dashboard";
import Messages from "./pages/Messages";
import Matches from "./pages/Matches";
import MatchesDashboard from "./pages/MatchesDashboard";
import Analytics from "./pages/Analytics";
import Settings from "./pages/Settings";
import MarketIntelligence from "./pages/MarketIntelligence";
import NotificationPreferences from "./pages/NotificationPreferences";
import UserProfile from "./pages/UserProfile";
import CustomNotifications from "./pages/CustomNotifications";
import Onboarding from "./pages/Onboarding";
import ExecutiveAnalytics from "./pages/ExecutiveAnalytics";
import AuditLogs from "./pages/AuditLogs";
import BrokerLeaderboard from "./pages/BrokerLeaderboard";
import HotZones from "./pages/HotZones";
import MatchFeedback from "./pages/MatchFeedback";
import InvestorDashboard from "./pages/InvestorDashboard";
import JoinPage from "./pages/JoinPage";
import WhatsAppLogin from "./pages/WhatsAppLogin";
import AdminManagement from "./pages/AdminManagement";
import { Properties } from "./pages/Properties";
import Compliance from "./pages/Compliance";
import PrivacyPolicy from "./pages/PrivacyPolicy";
import { BuyerRequests } from "./pages/BuyerRequests";
import ReviewQueue from "./pages/ReviewQueue";
import { DailyDigest } from "./pages/DailyDigest";
import ProfileIntake from "./pages/ProfileIntake";
import UserManagement from "./pages/UserManagement";
import Keywords from "./pages/Keywords";
import OwnerTasks from "./pages/OwnerTasks";
import MyAssets from "./pages/MyAssets";
import { AssetMatches } from "./pages/AssetMatches";
import { MyRequests } from "./pages/MyRequests";
import { RequestMatches } from "./pages/RequestMatches";
import { PWAInstallPrompt } from "./components/PWAInstallPrompt";
import Login from "./pages/Login";
import { ReportSettings } from "./pages/ReportSettings";
import ReportHistory from "./pages/ReportHistory";

function Router() {
  return (
    <Switch>
      {/* Public routes — no auth, no sidebar */}
      <Route path="/login" component={Login} />
      <Route path="/whatsapp-login" component={WhatsAppLogin} />
      <Route path="/join/:token" component={JoinPage} />
      <Route path="/join" component={JoinPage} />
      <Route path="/privacy" component={PrivacyPolicy} />
      {/* Protected routes inside DashboardLayout */}
      <Route>
        {() => (
          <DashboardLayout>
            <Switch>
              <Route path="/" component={Dashboard} />
              <Route path="/messages" component={Messages} />
              <Route path="/matches" component={Matches} />
              <Route path="/matches-dashboard" component={MatchesDashboard} />
              <Route path="/analytics" component={Analytics} />
              <Route path="/settings" component={Settings} />
              <Route path="/market-intelligence" component={MarketIntelligence} />
              <Route path="/notification-preferences" component={NotificationPreferences} />
              <Route path="/profile" component={UserProfile} />
              <Route path="/admin-management" component={AdminManagement} />
              <Route path="/notifications" component={CustomNotifications} />
              <Route path="/onboarding" component={Onboarding} />
              <Route path="/executive-analytics" component={ExecutiveAnalytics} />
              <Route path="/audit-logs" component={AuditLogs} />
              <Route path="/broker-leaderboard" component={BrokerLeaderboard} />
              <Route path="/hot-zones" component={HotZones} />
              <Route path="/match-feedback" component={MatchFeedback} />
              <Route path="/investor-dashboard" component={InvestorDashboard} />
              <Route path="/properties" component={Properties} />
              <Route path="/buyer-requests" component={BuyerRequests} />
              <Route path="/review-queue" component={ReviewQueue} />
              <Route path="/daily-digest" component={DailyDigest} />
              <Route path="/compliance" component={Compliance} />
              <Route path="/report-history" component={ReportHistory} />
              <Route path="/intake" component={ProfileIntake} />
              <Route path="/user-management" component={UserManagement} />
              <Route path="/keywords" component={Keywords} />
              <Route path="/owner-tasks" component={OwnerTasks} />
              <Route path="/my-assets" component={MyAssets} />
              <Route path="/asset-matches" component={AssetMatches} />
              <Route path="/my-requests" component={MyRequests} />
              <Route path="/request-matches" component={RequestMatches} />
              <Route path="/report-settings" component={ReportSettings} />
              <Route component={NotFound} />
            </Switch>
          </DashboardLayout>
        )}
      </Route>
    </Switch>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="dark" switchable={true}>
        <TooltipProvider>
          <Toaster />
          <Router />
          <PWAInstallPrompt />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
