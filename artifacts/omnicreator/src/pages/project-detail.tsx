import { useState } from "react";
import { useParams, Link } from "wouter";
import { useGetProject, useListAiJobs } from "@workspace/api-client-react";
import type { Project, AiJob } from "@workspace/api-client-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { AppShell } from "@/components/layout/app-shell";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { post } from "@/lib/api";
import { useOrgContext } from "@/hooks/use-org-context";
import {
  Sparkles, Play, Pause, CheckCircle, XCircle, AlertCircle, Clock, ArrowLeft, Wand2, RefreshCw
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { Skeleton } from "@/components/ui/skeleton";

const jobStatusConfig: Record<string, { icon: typeof Clock; color: string }> = {
  queued: { icon: Clock, color: "text-yellow-600" },
  running: { icon: Play, color: "text-blue-600" },
  succeeded: { icon: CheckCircle, color: "text-green-600" },
  failed: { icon: XCircle, color: "text-red-600" },
  cancelled: { icon: Pause, color: "text-gray-500" },
  setup_required: { icon: AlertCircle, color: "text-orange-600" },
  draft: { icon: Clock, color: "text-gray-400" },
};

const AI_TASK_TYPES = ["text_to_video", "text_to_image", "image_to_video", "voiceover", "upscale", "caption"];
const AI_PROVIDERS = ["openai", "anthropic", "runwayml", "pika", "stability", "elevenlabs"];

export default function ProjectDetailPage() {
  const { workspaceId, projectId } = useParams<{ workspaceId: string; projectId: string }>();
  const { orgId, orgName, workspaceName } = useOrgContext(workspaceId);
  const qc = useQueryClient();

  const [prompt, setPrompt] = useState("");
  const [provider, setProvider] = useState("openai");
  const [taskType, setTaskType] = useState("text_to_image");
  const [jobError, setJobError] = useState("");

  const { data: project, isLoading } = useGetProject(projectId ?? "");
  const { data: jobs, isLoading: jobsLoading } = useListAiJobs(projectId ?? "");

  const createJob = useMutation({
    mutationFn: () => post(`/api/projects/${projectId}/ai-jobs`, {
      type: taskType,
      provider,
      prompt,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [projectId ?? ""] });
      setPrompt("");
      setJobError("");
    },
    onError: (e: Error) => setJobError(e.message),
  });

  const cancelJob = useMutation({
    mutationFn: (jobId: string) => post(`/api/ai-jobs/${jobId}/cancel`, {}),
    onSuccess: () => qc.invalidateQueries({ queryKey: [projectId ?? ""] }),
  });

  const retryJob = useMutation({
    mutationFn: (jobId: string) => post(`/api/ai-jobs/${jobId}/retry`, {}),
    onSuccess: () => qc.invalidateQueries({ queryKey: [projectId ?? ""] }),
  });

  if (isLoading) {
    return (
      <AppShell orgId={orgId} workspaceId={workspaceId ?? ""} orgName={orgName} workspaceName={workspaceName}>
        <div className="p-6 space-y-4">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-48" />
        </div>
      </AppShell>
    );
  }

  if (!project) {
    return (
      <AppShell orgId={orgId} workspaceId={workspaceId ?? ""} orgName={orgName} workspaceName={workspaceName}>
        <div className="p-6">
          <p className="text-muted-foreground">Project not found.</p>
        </div>
      </AppShell>
    );
  }

  const p = project as Project;
  const jobList: AiJob[] = (jobs as AiJob[] | undefined) ?? [];

  return (
    <AppShell orgId={orgId} workspaceId={workspaceId ?? ""} orgName={orgName} workspaceName={workspaceName}>
      <div className="p-6 space-y-6">
        <div className="flex items-center gap-4">
          <Link href={`/w/${workspaceId}/projects`}>
            <Button variant="ghost" size="sm">
              <ArrowLeft className="h-4 w-4 mr-1" /> Back
            </Button>
          </Link>
          <div className="flex-1">
            <h1 className="text-2xl font-bold">{p.name}</h1>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-sm text-muted-foreground capitalize">{p.type}</span>
              <span className="text-muted-foreground">·</span>
              <Badge variant="secondary">{p.status?.replace("_", " ")}</Badge>
            </div>
          </div>
        </div>

        <Tabs defaultValue="ai-jobs">
          <TabsList>
            <TabsTrigger value="ai-jobs">AI Generation</TabsTrigger>
            <TabsTrigger value="assets">Assets</TabsTrigger>
            <TabsTrigger value="publish">Publish</TabsTrigger>
          </TabsList>

          <TabsContent value="ai-jobs" className="space-y-4 mt-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Wand2 className="h-4 w-4 text-primary" />
                  Generate with AI
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Task type</Label>
                    <Select value={taskType} onValueChange={setTaskType}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {AI_TASK_TYPES.map((t) => (
                          <SelectItem key={t} value={t}>{t.replace(/_/g, " ")}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Provider</Label>
                    <Select value={provider} onValueChange={setProvider}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {AI_PROVIDERS.map((pr) => (
                          <SelectItem key={pr} value={pr}>{pr}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Prompt</Label>
                  <Textarea
                    placeholder="Describe what you want to generate..."
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    rows={3}
                  />
                </div>
                {jobError && <p className="text-sm text-destructive">{jobError}</p>}
                <Button onClick={() => createJob.mutate()} disabled={!prompt.trim() || createJob.isPending}>
                  <Sparkles className="h-4 w-4 mr-2" />
                  Generate
                </Button>
              </CardContent>
            </Card>

            <div className="space-y-2">
              <h3 className="text-sm font-medium text-muted-foreground">Generation History</h3>
              {jobsLoading ? (
                <Skeleton className="h-24" />
              ) : !jobList.length ? (
                <div className="flex flex-col items-center justify-center py-8 border border-dashed rounded-lg text-center">
                  <Sparkles className="h-8 w-8 text-muted-foreground mb-2" />
                  <p className="text-sm text-muted-foreground">No AI jobs yet. Start generating above.</p>
                </div>
              ) : (
                jobList.map((job: AiJob) => {
                  const cfg = jobStatusConfig[job.status] ?? jobStatusConfig.draft;
                  const StatusIcon = cfg.icon;
                  return (
                    <Card key={job.id}>
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-start gap-3 min-w-0">
                            <StatusIcon className={`h-4 w-4 mt-0.5 shrink-0 ${cfg.color}`} />
                            <div className="min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-sm font-medium capitalize">
                                  {job.taskType?.replace(/_/g, " ")}
                                </span>
                                {job.providerKey && (
                                  <span className="text-xs text-muted-foreground">via {job.providerKey}</span>
                                )}
                                <Badge variant="outline" className="text-xs">{job.status?.replace("_", " ")}</Badge>
                              </div>
                              {job.prompt && (
                                <p className="text-xs text-muted-foreground mt-1 truncate">{job.prompt}</p>
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
                              <Button variant="outline" size="sm" onClick={() => retryJob.mutate(job.id)}>
                                <RefreshCw className="h-3 w-3 mr-1" /> Retry
                              </Button>
                            )}
                            {["queued", "running"].includes(job.status) && (
                              <Button variant="ghost" size="sm" onClick={() => cancelJob.mutate(job.id)}>Cancel</Button>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })
              )}
            </div>
          </TabsContent>

          <TabsContent value="assets" className="mt-4">
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                <p className="text-muted-foreground">
                  Manage project assets in the{" "}
                  <Link href={`/w/${workspaceId}/assets`}>
                    <span className="text-primary underline cursor-pointer">Assets library</span>
                  </Link>
                </p>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="publish" className="mt-4">
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                <p className="text-muted-foreground">
                  Schedule and publish this project from the{" "}
                  <Link href={`/w/${workspaceId}/publishing`}>
                    <span className="text-primary underline cursor-pointer">Publishing</span>
                  </Link>{" "}
                  page.
                </p>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </AppShell>
  );
}
