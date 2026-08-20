import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import ArchivePage from "@/pages/ArchivePage";
import CorrespondencePage from "@/pages/CorrespondencePage";
import FollowUpPage from "@/pages/FollowUpPage";
import Home from "@/pages/Home";
import NotFound from "@/pages/NotFound";
import OfficialDocumentsPage from "@/pages/OfficialDocumentsPage";
import ReportsPage from "@/pages/ReportsPage";
import UsersPage from "@/pages/UsersPage";
import { LocalLoginScreen } from "@/components/LocalLoginScreen";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";

function Router() {
  return <Switch>
    <Route path="/" component={Home} />
    <Route path="/incoming"><CorrespondencePage type="incoming" /></Route>
    <Route path="/outgoing"><CorrespondencePage type="outgoing" /></Route>
    <Route path="/decisions"><OfficialDocumentsPage type="decision" /></Route>
    <Route path="/circulars"><OfficialDocumentsPage type="circular" /></Route>
    <Route path="/follow-up" component={FollowUpPage} />
    <Route path="/archive" component={ArchivePage} />
    <Route path="/reports" component={ReportsPage} />
    <Route path="/users" component={UsersPage} />
    <Route path="/login"><LocalLoginScreen /></Route>
    <Route path="/404" component={NotFound} />
    <Route component={NotFound} />
  </Switch>;
}

export default function App() {
  return <ErrorBoundary><ThemeProvider defaultTheme="light"><TooltipProvider><Toaster position="top-center" richColors /><Router /></TooltipProvider></ThemeProvider></ErrorBoundary>;
}
