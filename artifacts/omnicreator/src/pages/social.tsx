import { useParams } from "wouter";
import { useListSocialAccounts } from "@workspace/api-client-react";
import type { SocialAccount } from "@workspace/api-client-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { AppShell } from "@/components/layout/app-shell";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { del } from "@/lib/api";
import { useOrgContext } from "@/hooks/use-org-context";
import { Share2, Trash2, AlertCircle, CheckCircle2, Plus } from "lucide-react";

interface PlatformInfo {
  id: string;
  name: string;
  color: string;
}

const PLATFORMS: PlatformInfo[] = [
  { id: "youtube", name: "YouTube", color: "bg-red-100 text-red-800" },
  { id: "instagram", name: "Instagram", color: "bg-pink-100 text-pink-800" },
  { id: "tiktok", name: "TikTok", color: "bg-gray-100 text-gray-800" },
  { id: "facebook", name: "Facebook", color: "bg-blue-100 text-blue-800" },
  { id: "linkedin", name: "LinkedIn", color: "bg-sky-100 text-sky-800" },
  { id: "twitter", name: "X (Twitter)", color: "bg-slate-100 text-slate-800" },
  { id: "pinterest", name: "Pinterest", color: "bg-rose-100 text-rose-800" },
];

export default function SocialPage() {
  const { workspaceId } = useParams<{ workspaceId: string }>();
  const { orgId, orgName, workspaceName } = useOrgContext(workspaceId);
  const qc = useQueryClient();

  const { data: accounts, isLoading } = useListSocialAccounts(workspaceId ?? "");

  const disconnectMutation = useMutation({
    mutationFn: (accountId: string) => del(`/api/social-accounts/${accountId}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: [workspaceId ?? ""] }),
  });

  const accountList: SocialAccount[] = (accounts as SocialAccount[] | undefined) ?? [];
  const connectedPlatforms = new Set(accountList.map((a) => String(a.platform)));

  return (
    <AppShell orgId={orgId} workspaceId={workspaceId ?? ""} orgName={orgName} workspaceName={workspaceName}>
      <div className="p-6 space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Social Accounts</h1>
          <p className="text-sm text-muted-foreground">
            Connect social media accounts to publish content directly
          </p>
        </div>

        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            OAuth connections require platform developer credentials. Configure them in{" "}
            <span className="font-medium">Settings → AI Providers</span> to enable direct OAuth flows.
          </AlertDescription>
        </Alert>

        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-24" />)}
          </div>
        ) : (
          <>
            {accountList.length > 0 && (
              <div className="space-y-3">
                <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                  Connected Accounts
                </h2>
                {accountList.map((account: SocialAccount) => {
                  const platformId = String(account.platform);
                  const platform = PLATFORMS.find((p) => p.id === platformId);
                  const isExpired = account.tokenExpiresAt && new Date(account.tokenExpiresAt) < new Date();
                  return (
                    <Card key={account.id}>
                      <CardContent className="p-4 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted">
                            <Share2 className="h-5 w-5 text-muted-foreground" />
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-sm">{account.accountName}</span>
                              <Badge className={`text-xs ${platform?.color ?? ""}`}>
                                {platform?.name ?? platformId}
                              </Badge>
                              {isExpired ? (
                                <Badge variant="destructive" className="text-xs">Token expired</Badge>
                              ) : (
                                <Badge variant="secondary" className="text-xs">
                                  <CheckCircle2 className="h-3 w-3 mr-1" />
                                  Active
                                </Badge>
                              )}
                            </div>
                            {account.accountId && (
                              <p className="text-xs text-muted-foreground">@{account.accountId}</p>
                            )}
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-destructive hover:text-destructive"
                          onClick={() => disconnectMutation.mutate(account.id)}
                          disabled={disconnectMutation.isPending}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}

            <div className="space-y-3">
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                Available Platforms
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {PLATFORMS.map((platform) => {
                  const isConnected = connectedPlatforms.has(platform.id);
                  return (
                    <Card key={platform.id} className={isConnected ? "border-green-200 bg-green-50/30" : ""}>
                      <CardContent className="p-4 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className={`flex h-9 w-9 items-center justify-center rounded-full ${platform.color}`}>
                            <Share2 className="h-4 w-4" />
                          </div>
                          <div>
                            <p className="text-sm font-medium">{platform.name}</p>
                            {isConnected && <p className="text-xs text-green-600">Connected</p>}
                          </div>
                        </div>
                        {!isConnected ? (
                          <Button variant="outline" size="sm" disabled>
                            <Plus className="h-3 w-3 mr-1" />
                            Connect
                          </Button>
                        ) : (
                          <CheckCircle2 className="h-5 w-5 text-green-600" />
                        )}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </div>
          </>
        )}
      </div>
    </AppShell>
  );
}
