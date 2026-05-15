import { useParams, Link } from "wouter";
import { useGetDashboard, useGetRecentActivity } from "@workspace/api-client-react";
import type { DashboardSummary, ActivityItem, Project } from "@workspace/api-client-react";
import { AppShell } from "@/components/layout/app-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { FolderOpen, Sparkles, CalendarClock, Coins, Plus, Clock, ArrowRight, Activity } from "lucide-react";
import { useOrgContext } from "@/hooks/use-org-context";
import { formatDistanceToNow } from "date-fns";

const statusColors: Record<string, string> = {
  draft: "bg-muted text-muted-foreground",
  in_progress: "bg-blue-100 text-blue-800",
  review: "bg-yellow-100 text-yellow-800",
  approved: "bg-green-100 text-green-800",
  published: "bg-emerald-100 text-emerald-800",
  archived: "bg-gray-100 text-gray-600",
};

export default function DashboardPage() {
  const { workspaceId } = useParams<{ workspaceId: string }>();
  const { orgId, orgName, workspaceName } = useOrgContext(workspaceId);

  const { data: dashboard, isLoading } = useGetDashboard(workspaceId ?? "");
  const { data: activityData } = useGetRecentActivity(workspaceId ?? "");

  const ds = dashboard as DashboardSummary | undefined;
  const activity = activityData as ActivityItem[] | undefined;

  const totalProjects = Object.values(ds?.projectCounts ?? {}).reduce<number>(
    (sum, v) => sum + (typeof v === "number" ? v : 0), 0
  );

  if (isLoading) {
    return (
      <AppShell orgId={orgId} workspaceId={workspaceId ?? ""} orgName={orgName} workspaceName={workspaceName}>
        <div className="p-6 space-y-6">
          <Skeleton className="h-8 w-48" />
          <div className="grid grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-28" />)}
          </div>
          <Skeleton className="h-64" />
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell orgId={orgId} workspaceId={workspaceId ?? ""} orgName={orgName} workspaceName={workspaceName}>
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Dashboard</h1>
            <p className="text-sm text-muted-foreground">{workspaceName}</p>
          </div>
          <Link href={`/w/${workspaceId}/projects`}>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              New Project
            </Button>
          </Link>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: "Total Projects", value: totalProjects, icon: FolderOpen, color: "text-blue-600" },
            { label: "Active AI Jobs", value: ds?.activeJobs ?? 0, icon: Sparkles, color: "text-purple-600" },
            { label: "Scheduled Posts", value: ds?.scheduledPosts ?? 0, icon: CalendarClock, color: "text-green-600" },
            { label: "Credits Used", value: (ds?.creditsUsed ?? 0).toLocaleString(), icon: Coins, color: "text-orange-600" },
          ].map(({ label, value, icon: Icon, color }) => (
            <Card key={label}>
              <CardContent className="pt-5">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-muted-foreground">{label}</p>
                  <Icon className={`h-4 w-4 ${color}`} />
                </div>
                <p className="mt-2 text-2xl font-bold">{String(value)}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-base">Recent Projects</CardTitle>
              <Link href={`/w/${workspaceId}/projects`}>
                <Button variant="ghost" size="sm" className="text-xs">
                  View all <ArrowRight className="ml-1 h-3 w-3" />
                </Button>
              </Link>
            </CardHeader>
            <CardContent>
              {!ds?.recentProjects?.length ? (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <FolderOpen className="h-8 w-8 text-muted-foreground mb-2" />
                  <p className="text-sm text-muted-foreground">No projects yet</p>
                  <Link href={`/w/${workspaceId}/projects`}>
                    <Button size="sm" variant="outline" className="mt-3">Create your first project</Button>
                  </Link>
                </div>
              ) : (
                <div className="space-y-2">
                  {ds.recentProjects.map((p: Project) => (
                    <Link key={p.id} href={`/w/${workspaceId}/projects/${p.id}`}>
                      <div className="flex items-center justify-between rounded-md border border-border p-3 hover:bg-accent cursor-pointer transition-colors">
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">{p.name}</p>
                          <p className="text-xs text-muted-foreground capitalize">{p.type}</p>
                        </div>
                        <Badge className={`text-xs ml-2 shrink-0 ${statusColors[p.status] ?? ""}`}>
                          {p.status?.replace("_", " ")}
                        </Badge>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-base">Recent Activity</CardTitle>
              <Activity className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {!activity?.length ? (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <Clock className="h-8 w-8 text-muted-foreground mb-2" />
                  <p className="text-sm text-muted-foreground">No recent activity</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {activity.slice(0, 8).map((item: ActivityItem) => (
                    <div key={item.id} className="flex items-start gap-3 text-sm">
                      <div className="h-2 w-2 rounded-full bg-primary mt-1.5 shrink-0" />
                      <div className="min-w-0">
                        <p className="text-sm font-medium">{item.message}</p>
                        <p className="text-xs text-muted-foreground">
                          {formatDistanceToNow(new Date(item.createdAt), { addSuffix: true })}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </AppShell>
  );
}
