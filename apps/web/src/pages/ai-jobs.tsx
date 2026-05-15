import { useParams } from "wouter";
import type { AiJob, Project } from "@workspace/api-client-react";
import { useListProjects } from "@workspace/api-client-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AppShell } from "@/components/layout/app-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { post, apiRequest } from "@/lib/api";
import { useOrgContext } from "@/hooks/use-org-context";
import { Sparkles, Play, Pause, CheckCircle, XCircle, AlertCircle, Clock, RefreshCw } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

const statusConfig: Record<string, { icon: typeof Clock; color: string; label: string }> = {
  queued: { icon: Clock, color: "text-yellow-600", label: "Queued" },
  running: { icon: Play, color: "text-blue-600", label: "Running" },
  succeeded: { icon: CheckCircle, color: "text-green-600", label: "Succeeded" },
  failed: { icon: XCircle, color: "text-red-600", label: "Failed" },
  cancelled: { icon: Pause, color: "text-gray-500", label: "Cancelled" },
  setup_required: { icon: AlertCircle, color: "text-orange-600", label: "Setup Required" },
  draft: { icon: Clock, color: "text-gray-400", label: "Draft" },
};

export default function AiJobsPage() {
  const { workspaceId } = useParams<{ workspaceId: string }>();
  const { orgId, orgName, workspaceName } = useOrgContext(workspaceId);
  const qc = useQueryClient();

  const { data: projects } = useListProjects(workspaceId ?? "");
  const projectList = (projects as Project[] | undefined) ?? [];
  const projectMap = new Map(projectList.map((p) => [p.id, p.name]));

  const { data: jobs, isLoading } = useQuery({
    queryKey: ["workspace-ai-jobs", workspaceId],
    queryFn: () => apiRequest<AiJob[]>(`/api/workspaces/${workspaceId}/ai-jobs`),
    enabled: !!workspaceId,
  });

  const retryMutation = useMutation({
    mutationFn: (jobId: string) => post(`/api/ai-jobs/${jobId}/retry`, {}),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["workspace-ai-jobs", workspaceId] }),
  });

  const cancelMutation = useMutation({
    mutationFn: (jobId: string) => post(`/api/ai-jobs/${jobId}/cancel`, {}),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["workspace-ai-jobs", workspaceId] }),
  });

  const jobList: AiJob[] = (jobs as AiJob[] | undefined) ?? [];
  const activeCount = jobList.filter((j) => ["running", "queued"].includes(j.status)).length;

  return (
    <AppShell orgId={orgId} workspaceId={workspaceId ?? ""} orgName={orgName} workspaceName={workspaceName}>
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">AI Generation</h1>
            <p className="text-sm text-muted-foreground">
              {activeCount > 0 ? `${activeCount} job${activeCount !== 1 ? "s" : ""} running` : "All jobs completed"}
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => qc.invalidateQueries({ queryKey: ["workspace-ai-jobs", workspaceId] })}
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {["queued", "running", "succeeded", "failed"].map((status) => {
            const count = jobList.filter((j) => j.status === status).length;
            const cfg = statusConfig[status];
            const Icon = cfg.icon;
            return (
              <Card key={status}>
                <CardContent className="pt-4">
                  <div className="flex items-center justify-between">
                    <p className="text-xs text-muted-foreground">{cfg.label}</p>
                    <Icon className={`h-4 w-4 ${cfg.color}`} />
                  </div>
                  <p className="mt-1 text-2xl font-bold">{count}</p>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {isLoading ? (
          <div className="space-y-3">
            {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-20" />)}
          </div>
        ) : !jobList.length ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <Sparkles className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-1">No AI jobs yet</h3>
            <p className="text-sm text-muted-foreground">
              Open a project and use the AI Generation tab to start creating
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {jobList.map((job: AiJob) => {
              const cfg = statusConfig[job.status] ?? statusConfig.draft;
              const StatusIcon = cfg.icon;
              return (
                <Card key={job.id}>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-start gap-3 min-w-0 flex-1">
                        <StatusIcon className={`h-4 w-4 mt-0.5 shrink-0 ${cfg.color}`} />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm font-medium capitalize">
                              {job.taskType?.replace(/_/g, " ")}
                            </span>
                            {job.providerKey && (
                              <span className="text-xs text-muted-foreground">via {job.providerKey}</span>
                            )}
                            {job.projectId && projectMap.get(job.projectId) && (
                              <span className="text-xs text-muted-foreground">
                                · {projectMap.get(job.projectId)}
                              </span>
                            )}
                            <Badge variant="outline" className="text-xs">{cfg.label}</Badge>
                          </div>
                          {job.prompt && (
                            <p className="text-xs text-muted-foreground mt-1 truncate max-w-lg">{job.prompt}</p>
                          )}
                          {job.errorMessage && (
                            <p className="text-xs text-orange-600 mt-1">{job.errorMessage}</p>
                          )}
                          <p className="text-xs text-muted-foreground mt-1">
                            {formatDistanceToNow(new Date(job.createdAt), { addSuffix: true })}
                          </p>
                        </div>
                      </div>
                      <div className="flex gap-1 shrink-0">
                        {["failed", "cancelled", "setup_required"].includes(job.status) && (
                          <Button variant="outline" size="sm" onClick={() => retryMutation.mutate(job.id)} disabled={retryMutation.isPending}>
                            <RefreshCw className="h-3 w-3 mr-1" /> Retry
                          </Button>
                        )}
                        {["queued", "running"].includes(job.status) && (
                          <Button variant="ghost" size="sm" onClick={() => cancelMutation.mutate(job.id)} disabled={cancelMutation.isPending}>
                            Cancel
                          </Button>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </AppShell>
  );
}
