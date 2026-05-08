import { useState } from "react";
import { useParams } from "wouter";
import { useListPublishingJobs, useListProjects, useListSocialAccounts } from "@workspace/api-client-react";
import type { PublishingJob, Project, SocialAccount } from "@workspace/api-client-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { AppShell } from "@/components/layout/app-shell";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { post } from "@/lib/api";
import { useOrgContext } from "@/hooks/use-org-context";
import { CalendarClock, Plus, CheckCircle, XCircle, Clock, Share2 } from "lucide-react";
import { formatDistanceToNow, format } from "date-fns";

const statusConfig: Record<string, { icon: typeof Clock; color: string; label: string }> = {
  preflight_pending: { icon: Clock, color: "text-yellow-600", label: "Pending" },
  scheduled: { icon: CalendarClock, color: "text-blue-600", label: "Scheduled" },
  publishing: { icon: Share2, color: "text-purple-600", label: "Publishing" },
  published: { icon: CheckCircle, color: "text-green-600", label: "Published" },
  failed: { icon: XCircle, color: "text-red-600", label: "Failed" },
};

export default function PublishingPage() {
  const { workspaceId } = useParams<{ workspaceId: string }>();
  const { orgId, orgName, workspaceName } = useOrgContext(workspaceId);
  const qc = useQueryClient();

  const [createOpen, setCreateOpen] = useState(false);
  const [projectId, setProjectId] = useState("");
  const [accountId, setAccountId] = useState("");
  const [caption, setCaption] = useState("");
  const [hashtags, setHashtags] = useState("");
  const [scheduledAt, setScheduledAt] = useState("");
  const [createError, setCreateError] = useState("");

  const { data: jobs, isLoading } = useListPublishingJobs(workspaceId ?? "");
  const { data: projects } = useListProjects(workspaceId ?? "");
  const { data: accounts } = useListSocialAccounts(workspaceId ?? "");

  const createMutation = useMutation({
    mutationFn: () => post(`/api/workspaces/${workspaceId}/publishing`, {
      projectId,
      socialAccountId: accountId || undefined,
      caption,
      hashtags: hashtags.split(/[\s,]+/).filter(Boolean),
      scheduledAt: scheduledAt || undefined,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [workspaceId ?? ""] });
      setCreateOpen(false);
      setProjectId("");
      setCaption("");
      setHashtags("");
      setScheduledAt("");
      setCreateError("");
    },
    onError: (e: Error) => setCreateError(e.message),
  });

  const projectList: Project[] = (projects as Project[] | undefined) ?? [];
  const accountList: SocialAccount[] = (accounts as SocialAccount[] | undefined) ?? [];
  const jobList: PublishingJob[] = (jobs as PublishingJob[] | undefined) ?? [];

  return (
    <AppShell orgId={orgId} workspaceId={workspaceId ?? ""} orgName={orgName} workspaceName={workspaceName}>
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Publishing</h1>
            <p className="text-sm text-muted-foreground">Schedule and publish content to social platforms</p>
          </div>
          <Dialog open={createOpen} onOpenChange={setCreateOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Schedule Post
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Schedule a post</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 pt-2">
                <div className="space-y-2">
                  <Label>Project</Label>
                  <Select value={projectId} onValueChange={setProjectId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a project" />
                    </SelectTrigger>
                    <SelectContent>
                      {projectList.map((p) => (
                        <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Social account</Label>
                  <Select value={accountId} onValueChange={setAccountId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select an account (optional)" />
                    </SelectTrigger>
                    <SelectContent>
                      {accountList.map((a) => (
                        <SelectItem key={a.id} value={a.id}>
                          {a.accountName} ({a.platform})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {accountList.length === 0 && (
                    <p className="text-xs text-muted-foreground">Connect social accounts to publish</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label>Caption</Label>
                  <Textarea
                    placeholder="Write your caption..."
                    value={caption}
                    onChange={(e) => setCaption(e.target.value)}
                    rows={3}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Hashtags</Label>
                  <Input
                    placeholder="#creative #content #marketing"
                    value={hashtags}
                    onChange={(e) => setHashtags(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Schedule (optional)</Label>
                  <Input
                    type="datetime-local"
                    value={scheduledAt}
                    onChange={(e) => setScheduledAt(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">Leave blank to post immediately</p>
                </div>
                {createError && <p className="text-sm text-destructive">{createError}</p>}
                <div className="flex gap-2 justify-end">
                  <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
                  <Button
                    onClick={() => createMutation.mutate()}
                    disabled={!projectId || createMutation.isPending}
                  >
                    {scheduledAt ? "Schedule" : "Publish Now"}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {isLoading ? (
          <div className="space-y-3">
            {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-20" />)}
          </div>
        ) : !jobList.length ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <CalendarClock className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-1">No posts scheduled</h3>
            <p className="text-sm text-muted-foreground mb-4">Schedule your first post to get started</p>
          </div>
        ) : (
          <div className="space-y-2">
            {jobList.map((job: PublishingJob) => {
              const cfg = statusConfig[job.status] ?? statusConfig.preflight_pending;
              const StatusIcon = cfg.icon;
              const projectName = projectList.find((p) => p.id === job.projectId)?.name ?? "Unknown Project";
              const meta = job.metadata as { caption?: string; hashtags?: string[] } | null | undefined;
              return (
                <Card key={job.id}>
                  <CardContent className="p-4">
                    <div className="flex items-start gap-3">
                      <StatusIcon className={`h-4 w-4 mt-0.5 shrink-0 ${cfg.color}`} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium text-sm">{projectName}</span>
                          <Badge variant="outline" className="text-xs capitalize">{job.platform}</Badge>
                          <Badge variant="outline" className="text-xs">{cfg.label}</Badge>
                        </div>
                        {meta?.caption && (
                          <p className="text-xs text-muted-foreground mt-1 truncate">{meta.caption}</p>
                        )}
                        {job.errorMessage && (
                          <p className="text-xs text-orange-600 mt-1">{job.errorMessage}</p>
                        )}
                        <p className="text-xs text-muted-foreground mt-1">
                          {job.scheduledAt
                            ? `Scheduled for ${format(new Date(job.scheduledAt), "MMM d, yyyy h:mm a")}`
                            : `Created ${formatDistanceToNow(new Date(job.createdAt), { addSuffix: true })}`}
                        </p>
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
