import { useState } from "react";
import { useLocation } from "wouter";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { post } from "@/lib/api";
import { Video, ArrowRight, Building2, FolderOpen } from "lucide-react";

interface OrgResponse { id: string; name: string }
interface WorkspaceResponse { id: string; name: string }

export default function OnboardingPage() {
  const [, navigate] = useLocation();
  const qc = useQueryClient();
  const [step, setStep] = useState<"org" | "workspace">("org");
  const [orgId, setOrgId] = useState("");
  const [orgName, setOrgName] = useState("");
  const [workspaceName, setWorkspaceName] = useState("");
  const [error, setError] = useState("");

  const createOrg = useMutation({
    mutationFn: () => post<OrgResponse>("/api/orgs", { name: orgName }),
    onSuccess: (data) => {
      setOrgId(data.id);
      setWorkspaceName(`${orgName}'s Workspace`);
      qc.invalidateQueries({ queryKey: ["/api/orgs"] });
      setStep("workspace");
    },
    onError: (e: Error) => setError(e.message),
  });

  const createWorkspace = useMutation({
    mutationFn: () => post<WorkspaceResponse>(`/api/orgs/${orgId}/workspaces`, { name: workspaceName }),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: [`/api/orgs/${orgId}/workspaces`] });
      navigate(`/w/${data.id}`);
    },
    onError: (e: Error) => setError(e.message),
  });

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5 flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-6">
        <div className="flex items-center gap-3 justify-center">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary">
            <Video className="h-5 w-5 text-primary-foreground" />
          </div>
          <span className="text-xl font-bold">OmniCreator</span>
        </div>

        <div className="flex items-center justify-center gap-2">
          <div className={`flex items-center gap-1.5 text-sm font-medium ${step === "org" ? "text-primary" : "text-muted-foreground"}`}>
            <div className={`h-6 w-6 rounded-full flex items-center justify-center text-xs font-bold ${step === "org" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>1</div>
            Organization
          </div>
          <div className="h-px w-8 bg-border" />
          <div className={`flex items-center gap-1.5 text-sm font-medium ${step === "workspace" ? "text-primary" : "text-muted-foreground"}`}>
            <div className={`h-6 w-6 rounded-full flex items-center justify-center text-xs font-bold ${step === "workspace" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>2</div>
            Workspace
          </div>
        </div>

        {step === "org" ? (
          <Card>
            <CardHeader>
              <div className="flex items-center gap-3 mb-2">
                <Building2 className="h-8 w-8 text-primary" />
              </div>
              <CardTitle>Create your organization</CardTitle>
              <CardDescription>
                An organization is the top-level container for your team, billing, and brand settings.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="orgName">Organization name</Label>
                <Input
                  id="orgName"
                  placeholder="Acme Studios"
                  value={orgName}
                  onChange={(e) => setOrgName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && orgName.trim() && createOrg.mutate()}
                />
              </div>
              {error && <p className="text-sm text-destructive">{error}</p>}
              <Button
                className="w-full"
                onClick={() => createOrg.mutate()}
                disabled={!orgName.trim() || createOrg.isPending}
              >
                Continue <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader>
              <div className="flex items-center gap-3 mb-2">
                <FolderOpen className="h-8 w-8 text-primary" />
              </div>
              <CardTitle>Create your first workspace</CardTitle>
              <CardDescription>
                Workspaces let you organize projects by brand, client, or campaign.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="wsName">Workspace name</Label>
                <Input
                  id="wsName"
                  placeholder="Main Workspace"
                  value={workspaceName}
                  onChange={(e) => setWorkspaceName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && workspaceName.trim() && createWorkspace.mutate()}
                />
              </div>
              {error && <p className="text-sm text-destructive">{error}</p>}
              <Button
                className="w-full"
                onClick={() => createWorkspace.mutate()}
                disabled={!workspaceName.trim() || createWorkspace.isPending}
              >
                Get started <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
