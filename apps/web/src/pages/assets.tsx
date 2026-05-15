import { useState } from "react";
import { useParams } from "wouter";
import { useListAssets } from "@workspace/api-client-react";
import type { Asset } from "@workspace/api-client-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { AppShell } from "@/components/layout/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { FileUpload } from "@/components/file-upload";
import { apiResourceUrl, del } from "@/lib/api";
import { useOrgContext } from "@/hooks/use-org-context";
import { HardDrive, Upload, Search, Image, Video, Music, FileText, Trash2, MoreHorizontal, AlertCircle } from "lucide-react";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import { Alert, AlertDescription } from "@/components/ui/alert";

const typeIcons: Record<string, typeof Image> = {
  image: Image,
  video: Video,
  audio: Music,
  document: FileText,
};

function formatBytes(bytes: number | undefined): string {
  if (!bytes) return "—";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

export default function AssetsPage() {
  const { workspaceId } = useParams<{ workspaceId: string }>();
  const { orgId, orgName, workspaceName } = useOrgContext(workspaceId);
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [showUpload, setShowUpload] = useState(false);

  const { data: assets, isLoading } = useListAssets(workspaceId ?? "");

  const deleteMutation = useMutation({
    mutationFn: (assetId: string) => del(`/api/assets/${assetId}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["assets", workspaceId] }),
  });

  const filtered = (assets as Asset[] | undefined)?.filter((a) =>
    a.name.toLowerCase().includes(search.toLowerCase())
  ) ?? [];

  return (
    <AppShell orgId={orgId} workspaceId={workspaceId ?? ""} orgName={orgName} workspaceName={workspaceName}>
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Assets</h1>
            <p className="text-sm text-muted-foreground">{filtered.length} file{filtered.length !== 1 ? "s" : ""}</p>
          </div>
          <Button onClick={() => setShowUpload(!showUpload)}>
            <Upload className="h-4 w-4 mr-2" />
            {showUpload ? "Hide Upload" : "Upload Files"}
          </Button>
        </div>

        {showUpload && (
          <Card>
            <CardContent className="pt-6">
              <FileUpload
                workspaceId={workspaceId ?? ""}
                onUploadSuccess={() => {
                  qc.invalidateQueries({ queryKey: ["assets", workspaceId] });
                  setShowUpload(false);
                }}
              />
            </CardContent>
          </Card>
        )}

        <div className="relative">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search assets..."
            className="pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {isLoading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            {[...Array(10)].map((_, i) => <Skeleton key={i} className="h-36" />)}
          </div>
        ) : !filtered.length ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <HardDrive className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-1">No assets yet</h3>
            <p className="text-sm text-muted-foreground mb-4">
              {search ? "Try adjusting your search" : "Upload images, videos and audio files"}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            {filtered.map((asset: Asset) => {
              const TypeIcon = typeIcons[asset.type] ?? FileText;
              return (
                <Card key={asset.id} className="group overflow-hidden">
                  <div className="aspect-video bg-muted flex items-center justify-center relative">
                    {asset.type === "image" && asset.url ? (
                      <img
                        src={apiResourceUrl(asset.url)}
                        alt={asset.name}
                        className="object-cover w-full h-full"
                        onError={(e) => { e.currentTarget.style.display = "none"; }}
                      />
                    ) : (
                      <TypeIcon className="h-8 w-8 text-muted-foreground" />
                    )}
                    <div className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="secondary" size="sm" className="h-7 w-7 p-0">
                            <MoreHorizontal className="h-3 w-3" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            className="text-destructive"
                            onClick={() => deleteMutation.mutate(asset.id)}
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                  <CardContent className="p-2">
                    <p className="text-xs font-medium truncate" title={asset.name}>{asset.name}</p>
                    <div className="flex items-center justify-between mt-0.5">
                      <Badge variant="secondary" className="text-[10px] px-1.5">{asset.type}</Badge>
                      <span className="text-[10px] text-muted-foreground">{formatBytes(asset.fileSize ?? undefined)}</span>
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
