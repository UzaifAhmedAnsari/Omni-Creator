import { useState } from "react";
import { useParams, Link } from "wouter";
import { useListProjects } from "@workspace/api-client-react";
import type { Project } from "@workspace/api-client-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { AppShell } from "@/components/layout/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { post } from "@/lib/api";
import { useOrgContext } from "@/hooks/use-org-context";
import {
  Plus, Search, FolderOpen, Video, Image, Layers, Megaphone, LayoutTemplate, Package, MoreHorizontal
} from "lucide-react";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import { formatDistanceToNow } from "date-fns";

const projectTypes = [
  { value: "video", label: "Video", icon: Video },
  { value: "image", label: "Image", icon: Image },
  { value: "carousel", label: "Carousel", icon: Layers },
  { value: "ad", label: "Ad", icon: Megaphone },
  { value: "thumbnail", label: "Thumbnail", icon: LayoutTemplate },
  { value: "campaign", label: "Campaign", icon: Package },
];

const statusVariants: Record<string, "default" | "secondary" | "outline"> = {
  draft: "secondary",
  in_progress: "default",
  review: "outline",
  approved: "default",
  published: "default",
  archived: "secondary",
};

const typeIcons: Record<string, typeof Video> = {
  video: Video,
  image: Image,
  carousel: Layers,
  ad: Megaphone,
  thumbnail: LayoutTemplate,
  campaign: Package,
};

export default function ProjectsPage() {
  const { workspaceId } = useParams<{ workspaceId: string }>();
  const { orgId, orgName, workspaceName } = useOrgContext(workspaceId);
  const qc = useQueryClient();

  const [search, setSearch] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newType, setNewType] = useState("video");
  const [createError, setCreateError] = useState("");

  const { data: projects, isLoading } = useListProjects(workspaceId ?? "");

  const createMutation = useMutation({
    mutationFn: () => post<Project>(`/api/workspaces/${workspaceId}/projects`, {
      name: newName,
      type: newType,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [workspaceId ?? ""] });
      setCreateOpen(false);
      setNewName("");
      setNewType("video");
      setCreateError("");
    },
    onError: (e: Error) => setCreateError(e.message),
  });

  const archiveMutation = useMutation({
    mutationFn: (projectId: string) => post(`/api/projects/${projectId}/archive`, {}),
    onSuccess: () => qc.invalidateQueries({ queryKey: [workspaceId ?? ""] }),
  });

  const filtered = (projects as Project[] | undefined)?.filter((p) =>
    p.name.toLowerCase().includes(search.toLowerCase())
  ) ?? [];

  return (
    <AppShell orgId={orgId} workspaceId={workspaceId ?? ""} orgName={orgName} workspaceName={workspaceName}>
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Projects</h1>
            <p className="text-sm text-muted-foreground">{filtered.length} project{filtered.length !== 1 ? "s" : ""}</p>
          </div>
          <Dialog open={createOpen} onOpenChange={setCreateOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                New Project
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create new project</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 pt-2">
                <div className="space-y-2">
                  <Label>Project name</Label>
                  <Input
                    placeholder="My Awesome Video"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && newName.trim() && createMutation.mutate()}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Content type</Label>
                  <Select value={newType} onValueChange={setNewType}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {projectTypes.map(({ value, label }) => (
                        <SelectItem key={value} value={value}>{label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {createError && <p className="text-sm text-destructive">{createError}</p>}
                <div className="flex gap-2 justify-end">
                  <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
                  <Button
                    onClick={() => createMutation.mutate()}
                    disabled={!newName.trim() || createMutation.isPending}
                  >
                    Create
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search projects..."
            className="pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-40" />)}
          </div>
        ) : !filtered.length ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <FolderOpen className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-1">No projects found</h3>
            <p className="text-sm text-muted-foreground mb-4">
              {search ? "Try adjusting your search" : "Create your first project to get started"}
            </p>
            {!search && (
              <Button onClick={() => setCreateOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                New Project
              </Button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map((project: Project) => {
              const TypeIcon = typeIcons[project.type] ?? FolderOpen;
              return (
                <Card key={project.id} className="group hover:shadow-md transition-shadow">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                        <TypeIcon className="h-5 w-5 text-primary" />
                      </div>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm" className="h-8 w-8 p-0 opacity-0 group-hover:opacity-100">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem asChild>
                            <Link href={`/w/${workspaceId}/projects/${project.id}`}>Open</Link>
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="text-destructive"
                            onClick={() => archiveMutation.mutate(project.id)}
                          >
                            Archive
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                    <Link href={`/w/${workspaceId}/projects/${project.id}`}>
                      <div className="cursor-pointer">
                        <h3 className="font-medium text-sm mb-1 truncate hover:text-primary transition-colors">
                          {project.name}
                        </h3>
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-muted-foreground capitalize">{project.type.replace("_", " ")}</span>
                          <Badge variant={statusVariants[project.status] ?? "secondary"} className="text-xs">
                            {project.status.replace("_", " ")}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground mt-2">
                          Updated {formatDistanceToNow(new Date(project.updatedAt), { addSuffix: true })}
                        </p>
                      </div>
                    </Link>
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
