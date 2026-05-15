import { useParams } from "wouter";
import { useGetWorkspaceAnalytics, useGetAnalyticsRecommendations } from "@workspace/api-client-react";
import type { WorkspaceAnalytics, AnalyticsRecommendation } from "@workspace/api-client-react";
import { AppShell } from "@/components/layout/app-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { useOrgContext } from "@/hooks/use-org-context";
import { BarChart3, Sparkles, Share2, FileText, AlertCircle, TrendingUp } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

export default function AnalyticsPage() {
  const { workspaceId } = useParams<{ workspaceId: string }>();
  const { orgId, orgName, workspaceName } = useOrgContext(workspaceId);

  const { data: analytics, isLoading } = useGetWorkspaceAnalytics(workspaceId ?? "");
  const { data: recData } = useGetAnalyticsRecommendations(workspaceId ?? "");

  const data = analytics as WorkspaceAnalytics | undefined;
  const recommendations = (recData as AnalyticsRecommendation[] | undefined) ?? [];

  const chartData = [
    { name: "Projects", value: data?.projectsCreated ?? 0 },
    { name: "Assets", value: data?.assetsGenerated ?? 0 },
    { name: "Credits", value: data?.totalCreditsUsed ?? 0 },
  ];

  const topPlatforms = data?.topPlatforms ?? [];
  const postPerformance = data?.postPerformance ?? [];

  const hasData = (data?.projectsCreated ?? 0) > 0 || (data?.assetsGenerated ?? 0) > 0;

  return (
    <AppShell orgId={orgId} workspaceId={workspaceId ?? ""} orgName={orgName} workspaceName={workspaceName}>
      <div className="p-6 space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Analytics</h1>
          <p className="text-sm text-muted-foreground">Track your content performance across platforms</p>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-24" />)}
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {[
                { label: "Projects Created", value: data?.projectsCreated ?? 0, icon: FileText, color: "text-blue-600" },
                { label: "Assets Generated", value: data?.assetsGenerated ?? 0, icon: Sparkles, color: "text-purple-600" },
                { label: "Publishing Success", value: data?.publishingSuccessRate != null
                  ? `${Math.round((data.publishingSuccessRate) * 100)}%` : "—",
                  icon: Share2, color: "text-green-600" },
              ].map(({ label, value, icon: Icon, color }) => (
                <Card key={label}>
                  <CardContent className="pt-5">
                    <div className="flex items-center justify-between">
                      <p className="text-sm text-muted-foreground">{label}</p>
                      <Icon className={`h-4 w-4 ${color}`} />
                    </div>
                    <p className="mt-2 text-2xl font-bold">{value}</p>
                  </CardContent>
                </Card>
              ))}
            </div>

            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <BarChart3 className="h-4 w-4 text-primary" />
                  Activity Overview
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={240}>
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 12 }} />
                    <Tooltip />
                    <Bar dataKey="value" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {recommendations.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <TrendingUp className="h-4 w-4 text-primary" />
                    Recommendations
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-3">
                    {recommendations.map((rec) => (
                      <li key={rec.id} className="flex items-start gap-2 text-sm">
                        <span className="mt-1 h-2 w-2 rounded-full bg-primary shrink-0" />
                        <div>
                          <p className="font-medium">{rec.title}</p>
                          <p className="text-xs text-muted-foreground">{rec.reason}</p>
                          {rec.impact && (
                            <p className="text-xs text-primary mt-0.5">Impact: {rec.impact}</p>
                          )}
                        </div>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            )}

            {!hasData && (
              <div className="flex flex-col items-center justify-center py-12 text-center border border-dashed rounded-lg">
                <BarChart3 className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium mb-1">No metrics yet</h3>
                <p className="text-sm text-muted-foreground">
                  Connect your social accounts and publish content to start seeing analytics
                </p>
              </div>
            )}
          </>
        )}
      </div>
    </AppShell>
  );
}
