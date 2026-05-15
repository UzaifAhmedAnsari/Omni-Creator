import { Switch, Route, Router as WouterRouter, Redirect, useLocation } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/hooks/use-auth";
import { useFirstWorkspace } from "@/hooks/use-org-context";
import LoginPage from "@/pages/login";
import OnboardingPage from "@/pages/onboarding";
import DashboardPage from "@/pages/dashboard";
import ProjectsPage from "@/pages/projects";
import ProjectDetailPage from "@/pages/project-detail";
import AssetsPage from "@/pages/assets";
import AiJobsPage from "@/pages/ai-jobs";
import SocialPage from "@/pages/social";
import PublishingPage from "@/pages/publishing";
import AnalyticsPage from "@/pages/analytics";
import SettingsPage from "@/pages/settings";
import AdminPage from "@/pages/admin";
import NotFound from "@/pages/not-found";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: (count, error: unknown) => {
        const status = (error as { status?: number })?.status;
        if (status === 401 || status === 403 || status === 404) return false;
        return count < 2;
      },
    },
  },
});

function AppLoader() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="space-y-3 w-48">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-4 w-1/2" />
      </div>
    </div>
  );
}

function AuthGate({ children }: { children: React.ReactNode }) {
  const { isLoading, isAuthenticated } = useAuth();
  const [location] = useLocation();

  if (isLoading) return <AppLoader />;
  if (!isAuthenticated) return <LoginPage />;
  return <>{children}</>;
}

function WorkspaceRedirect() {
  const { isLoading, firstOrg, firstWorkspace } = useFirstWorkspace();

  if (isLoading) return <AppLoader />;

  if (!firstOrg) {
    return <Redirect to="/onboarding" />;
  }

  if (!firstWorkspace) {
    return <Redirect to="/onboarding" />;
  }

  return <Redirect to={`/w/${firstWorkspace.id}`} />;
}

function Router() {
  return (
    <Switch>
      <Route path="/" component={() => (
        <AuthGate>
          <WorkspaceRedirect />
        </AuthGate>
      )} />

      <Route path="/onboarding" component={() => (
        <AuthGate>
          <OnboardingPage />
        </AuthGate>
      )} />

      <Route path="/w/:workspaceId" component={() => (
        <AuthGate>
          <DashboardPage />
        </AuthGate>
      )} />

      <Route path="/w/:workspaceId/projects" component={() => (
        <AuthGate>
          <ProjectsPage />
        </AuthGate>
      )} />

      <Route path="/w/:workspaceId/projects/:projectId" component={() => (
        <AuthGate>
          <ProjectDetailPage />
        </AuthGate>
      )} />

      <Route path="/w/:workspaceId/assets" component={() => (
        <AuthGate>
          <AssetsPage />
        </AuthGate>
      )} />

      <Route path="/w/:workspaceId/ai-jobs" component={() => (
        <AuthGate>
          <AiJobsPage />
        </AuthGate>
      )} />

      <Route path="/w/:workspaceId/social" component={() => (
        <AuthGate>
          <SocialPage />
        </AuthGate>
      )} />

      <Route path="/w/:workspaceId/publishing" component={() => (
        <AuthGate>
          <PublishingPage />
        </AuthGate>
      )} />

      <Route path="/w/:workspaceId/analytics" component={() => (
        <AuthGate>
          <AnalyticsPage />
        </AuthGate>
      )} />

      <Route path="/settings/:orgId" component={() => (
        <AuthGate>
          <SettingsPage />
        </AuthGate>
      )} />

      <Route path="/admin" component={() => (
        <AuthGate>
          <AdminPage />
        </AuthGate>
      )} />

      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
