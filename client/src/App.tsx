import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import ArchivePage from "@/pages/ArchivePage";
import AuditPage from "@/pages/AuditPage";
import CorrespondencePage from "@/pages/CorrespondencePage";
import FollowUpPage from "@/pages/FollowUpPage";
import Home from "@/pages/Home";
import NotFound from "@/pages/NotFound";
import OfficialDocumentsPage from "@/pages/OfficialDocumentsPage";
import PdfDownloadMonitorPage from "@/pages/PdfDownloadMonitorPage";
import ReportsPage from "@/pages/ReportsPage";
import UsersPage from "@/pages/UsersPage";
import { LocalLoginScreen } from "@/components/LocalLoginScreen";
import { useAuth } from "@/_core/hooks/useAuth";
import { DashboardLayoutSkeleton } from "@/components/DashboardLayoutSkeleton";
import { Route, Switch, useLocation } from "wouter";
import { useEffect } from "react";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";

function EntryScreen() {
  const { loading, user } = useAuth();
  if (loading) return <DashboardLayoutSkeleton />;
  return user ? <Home /> : <LocalLoginScreen />;
}

function LoginRoute() {
  const { loading, user } = useAuth();
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (!loading && user) setLocation("/", { replace: true });
  }, [loading, setLocation, user]);

  if (loading || user) return <DashboardLayoutSkeleton />;
  return <LocalLoginScreen />;
}

function Router() {
  return <Switch>
    <Route path="/" component={EntryScreen} />
    <Route path="/incoming"><CorrespondencePage type="incoming" /></Route>
    <Route path="/outgoing"><CorrespondencePage type="outgoing" /></Route>
    <Route path="/decisions"><OfficialDocumentsPage type="decision" /></Route>
    <Route path="/circulars"><OfficialDocumentsPage type="circular" /></Route>
    <Route path="/follow-up" component={FollowUpPage} />
    <Route path="/archive" component={ArchivePage} />
    <Route path="/reports" component={ReportsPage} />
    <Route path="/users" component={UsersPage} />
    <Route path="/audit" component={AuditPage} />
    <Route path="/pdf-downloads" component={PdfDownloadMonitorPage} />
    <Route path="/login" component={LoginRoute} />
    <Route path="/404" component={NotFound} />
    <Route component={NotFound} />
  </Switch>;
}

export default function App() {
  return <ErrorBoundary><ThemeProvider defaultTheme="light"><TooltipProvider><Toaster position="top-center" richColors /><Router /></TooltipProvider></ThemeProvider></ErrorBoundary>;
}
