import { useGetAdminStats, useAdminListUsers, useAdminListAiJobs } from "@workspace/api-client-react";
import type { AdminStats } from "@workspace/api-client-react";
import { AppShell } from "@/components/layout/app-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { useOrgContext } from "@/hooks/use-org-context";
import { Shield, Users, Sparkles, Activity } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface AdminUser {
  id: string;
  email?: string;
  firstName?: string;
  lastName?: string;
  createdAt: string;
}

interface AdminAiJob {
  id: string;
  taskType: string;
  providerKey?: string | null;
  status: string;
  createdAt: string;
}

export default function AdminPage() {
  const { orgId, orgName, workspace } = useOrgContext();
  const workspaceId = workspace?.id ?? "";

  const { data: stats, isLoading: statsLoading } = useGetAdminStats();
  const { data: usersData, isLoading: usersLoading } = useAdminListUsers();
  const { data: jobsData, isLoading: jobsLoading } = useAdminListAiJobs();

  const statsData = stats as AdminStats | undefined;
  const users = usersData as { users: AdminUser[]; total: number } | undefined;
  const jobs = (jobsData as AdminAiJob[] | undefined) ?? [];

  return (
    <AppShell orgId={orgId} workspaceId={workspaceId} orgName={orgName} workspaceName="Admin Panel" isAdmin>
      <div className="p-6 space-y-6">
        <div className="flex items-center gap-3">
          <Shield className="h-6 w-6 text-primary" />
          <div>
            <h1 className="text-2xl font-bold">Admin Panel</h1>
            <p className="text-sm text-muted-foreground">Platform administration</p>
          </div>
        </div>

        {statsLoading ? (
          <div className="grid grid-cols-3 gap-4">
            {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-24" />)}
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-4">
            {[
              { label: "Total Users", value: statsData?.totalUsers ?? 0, icon: Users, color: "text-blue-600" },
              { label: "Total AI Jobs", value: statsData?.totalAiJobs ?? 0, icon: Sparkles, color: "text-purple-600" },
              { label: "Active AI Jobs", value: statsData?.activeJobs ?? 0, icon: Activity, color: "text-green-600" },
            ].map(({ label, value, icon: Icon, color }) => (
              <Card key={label}>
                <CardContent className="pt-5">
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-muted-foreground">{label}</p>
                    <Icon className={`h-4 w-4 ${color}`} />
                  </div>
                  <p className="mt-2 text-2xl font-bold">{value.toLocaleString()}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        <Tabs defaultValue="users">
          <TabsList>
            <TabsTrigger value="users"><Users className="h-4 w-4 mr-2" />Users</TabsTrigger>
            <TabsTrigger value="jobs"><Sparkles className="h-4 w-4 mr-2" />AI Jobs</TabsTrigger>
          </TabsList>

          <TabsContent value="users" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">
                  Users
                  {users && (
                    <span className="text-muted-foreground font-normal ml-2">({users.total} total)</span>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {usersLoading ? (
                  <Skeleton className="h-48" />
                ) : (
                  <div className="space-y-2">
                    {users?.users?.map((u) => (
                      <div key={u.id} className="flex items-center justify-between rounded-md border border-border p-3">
                        <div>
                          <p className="text-sm font-medium">
                            {[u.firstName, u.lastName].filter(Boolean).join(" ") || u.email || u.id}
                          </p>
                          {u.email && <p className="text-xs text-muted-foreground">{u.email}</p>}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {formatDistanceToNow(new Date(u.createdAt), { addSuffix: true })}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="jobs" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Recent AI Jobs</CardTitle>
              </CardHeader>
              <CardContent>
                {jobsLoading ? (
                  <Skeleton className="h-48" />
                ) : (
                  <div className="space-y-2">
                    {jobs.map((job) => (
                      <div key={job.id} className="flex items-center justify-between rounded-md border border-border p-3">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium capitalize">{job.taskType?.replace(/_/g, " ")}</span>
                            {job.providerKey && (
                              <span className="text-xs text-muted-foreground">via {job.providerKey}</span>
                            )}
                            <Badge variant="outline" className="text-xs">{job.status?.replace("_", " ")}</Badge>
                          </div>
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {formatDistanceToNow(new Date(job.createdAt), { addSuffix: true })}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </AppShell>
  );
}
