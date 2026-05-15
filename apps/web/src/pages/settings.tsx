import { useState } from "react";
import { useParams } from "wouter";
import {
  useGetOrganization,
  useListOrgMembers,
  useGetBillingInfo,
  useListProviders,
  useListBrandKits,
} from "@workspace/api-client-react";
import type {
  Organization,
  Member,
  BillingInfo,
  ProviderConfig,
  BrandKit,
} from "@workspace/api-client-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { AppShell } from "@/components/layout/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { patch, put, del, post } from "@/lib/api";
import { useOrgContext } from "@/hooks/use-org-context";
import { Users, CreditCard, Cpu, Palette, Building2, Check, AlertCircle, Trash2, Plus } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

const PLAN_LABELS: Record<string, string> = {
  free: "Free",
  creator: "Creator",
  pro: "Pro",
  studio: "Studio",
  agency: "Agency",
  enterprise: "Enterprise",
};

export default function SettingsPage() {
  const { orgId } = useParams<{ orgId: string }>();
  const { orgName, workspaceName, workspace } = useOrgContext();
  const workspaceId = workspace?.id ?? "";
  const qc = useQueryClient();

  const [newOrgName, setNewOrgName] = useState("");
  const [providerKeys, setProviderKeys] = useState<Record<string, string>>({});
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("viewer");
  const [inviteError, setInviteError] = useState("");
  const [brandKitName, setBrandKitName] = useState("");
  const [brandKitOpen, setBrandKitOpen] = useState(false);

  const { data: org, isLoading: orgLoading } = useGetOrganization(orgId ?? "");
  const { data: members, isLoading: membersLoading } = useListOrgMembers(orgId ?? "");
  const { data: billing, isLoading: billingLoading } = useGetBillingInfo(orgId ?? "");
  const { data: providers, isLoading: providersLoading } = useListProviders(orgId ?? "");
  const { data: brandKits, isLoading: brandKitsLoading } = useListBrandKits(workspaceId);

  const updateOrgMutation = useMutation({
    mutationFn: () => patch(`/api/organizations/${orgId}`, { name: newOrgName }),
    onSuccess: () => qc.invalidateQueries({ queryKey: [orgId ?? ""] }),
  });

  const saveProviderMutation = useMutation({
    mutationFn: ({ provider, apiKey }: { provider: string; apiKey: string }) =>
      post(`/api/organizations/${orgId}/providers`, { providerKey: provider, apiKey, isDefault: true }),
    onSuccess: () => qc.invalidateQueries({ queryKey: [orgId ?? ""] }),
  });

  const toggleProviderMutation = useMutation({
    mutationFn: ({ provider, isActive }: { provider: string; isActive: boolean }) =>
      post(`/api/organizations/${orgId}/providers`, { providerKey: provider, isDefault: isActive }),
    onSuccess: () => qc.invalidateQueries({ queryKey: [orgId ?? ""] }),
  });

  const removeMemberMutation = useMutation({
    mutationFn: (memberId: string) => del(`/api/organizations/${orgId}/members/${memberId}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: [orgId ?? ""] }),
  });

  const inviteMutation = useMutation({
    mutationFn: () => post(`/api/organizations/${orgId}/members`, { email: inviteEmail, role: inviteRole }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [orgId ?? ""] });
      setInviteEmail("");
      setInviteError("");
    },
    onError: (e: Error) => setInviteError(e.message),
  });

  const createBrandKitMutation = useMutation({
    mutationFn: () => post(`/api/workspaces/${workspaceId}/brand-kits`, {
      name: brandKitName,
      colors: [],
      fonts: [],
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [workspaceId] });
      setBrandKitOpen(false);
      setBrandKitName("");
    },
  });

  const orgData = org as Organization | undefined;
  const memberList: Member[] = (members as Member[] | undefined) ?? [];
  const billingData = billing as BillingInfo | undefined;
  const providerList: ProviderConfig[] = (providers as ProviderConfig[] | undefined) ?? [];
  const brandKitList: BrandKit[] = (brandKits as BrandKit[] | undefined) ?? [];

  return (
    <AppShell orgId={orgId ?? ""} workspaceId={workspaceId} orgName={orgName} workspaceName={workspaceName}>
      <div className="p-6 space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Settings</h1>
          <p className="text-sm text-muted-foreground">{orgName}</p>
        </div>

        <Tabs defaultValue="organization">
          <TabsList>
            <TabsTrigger value="organization"><Building2 className="h-4 w-4 mr-2" />Organization</TabsTrigger>
            <TabsTrigger value="members"><Users className="h-4 w-4 mr-2" />Members</TabsTrigger>
            <TabsTrigger value="brand-kits"><Palette className="h-4 w-4 mr-2" />Brand Kits</TabsTrigger>
            <TabsTrigger value="providers"><Cpu className="h-4 w-4 mr-2" />AI Providers</TabsTrigger>
            <TabsTrigger value="billing"><CreditCard className="h-4 w-4 mr-2" />Billing</TabsTrigger>
          </TabsList>

          <TabsContent value="organization" className="space-y-4 mt-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Organization Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {orgLoading ? <Skeleton className="h-20" /> : (
                  <>
                    <div className="space-y-2">
                      <Label>Organization name</Label>
                      <div className="flex gap-2">
                        <Input
                          defaultValue={orgData?.name ?? ""}
                          onChange={(e) => setNewOrgName(e.target.value)}
                          placeholder={orgData?.name ?? ""}
                        />
                        <Button
                          onClick={() => updateOrgMutation.mutate()}
                          disabled={!newOrgName.trim() || updateOrgMutation.isPending}
                        >
                          Save
                        </Button>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>Plan</Label>
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary">{PLAN_LABELS[orgData?.plan ?? "free"] ?? "Free"}</Badge>
                      </div>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="members" className="space-y-4 mt-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Invite Member</CardTitle>
                <CardDescription>Invite team members by their Replit email address</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex gap-2">
                  <Input
                    placeholder="user@example.com"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                  />
                  <select
                    value={inviteRole}
                    onChange={(e) => setInviteRole(e.target.value)}
                    className="rounded-md border border-input bg-background px-3 text-sm"
                  >
                    <option value="viewer">Viewer</option>
                    <option value="editor">Editor</option>
                    <option value="admin">Admin</option>
                  </select>
                  <Button
                    onClick={() => inviteMutation.mutate()}
                    disabled={!inviteEmail.trim() || inviteMutation.isPending}
                  >
                    Invite
                  </Button>
                </div>
                {inviteError && <p className="text-sm text-destructive">{inviteError}</p>}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Team Members</CardTitle>
              </CardHeader>
              <CardContent>
                {membersLoading ? <Skeleton className="h-32" /> : (
                  <div className="space-y-2">
                    {memberList.map((m: Member) => (
                      <div key={m.id} className="flex items-center justify-between rounded-md border border-border p-3">
                        <div>
                          <p className="text-sm font-medium">
                            {[m.firstName, m.lastName].filter(Boolean).join(" ") || m.email || m.userId}
                          </p>
                          {m.email && <p className="text-xs text-muted-foreground">{m.email}</p>}
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant="secondary" className="capitalize">{m.role}</Badge>
                          {m.role !== "owner" && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                              onClick={() => removeMemberMutation.mutate(m.id)}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="brand-kits" className="space-y-4 mt-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-semibold">Brand Kits</h2>
                <p className="text-sm text-muted-foreground">Manage color palettes and fonts for your brand</p>
              </div>
              <Dialog open={brandKitOpen} onOpenChange={setBrandKitOpen}>
                <DialogTrigger asChild>
                  <Button size="sm">
                    <Plus className="h-4 w-4 mr-2" />
                    New Brand Kit
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Create Brand Kit</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4 pt-2">
                    <div className="space-y-2">
                      <Label>Name</Label>
                      <Input
                        placeholder="My Brand"
                        value={brandKitName}
                        onChange={(e) => setBrandKitName(e.target.value)}
                      />
                    </div>
                    <div className="flex gap-2 justify-end">
                      <Button variant="outline" onClick={() => setBrandKitOpen(false)}>Cancel</Button>
                      <Button
                        onClick={() => createBrandKitMutation.mutate()}
                        disabled={!brandKitName.trim() || createBrandKitMutation.isPending}
                      >
                        Create
                      </Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            </div>

            {brandKitsLoading ? (
              <Skeleton className="h-24" />
            ) : !brandKitList.length ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-10 text-center">
                  <Palette className="h-8 w-8 text-muted-foreground mb-3" />
                  <p className="text-sm text-muted-foreground">No brand kits yet.</p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {brandKitList.map((kit: BrandKit) => (
                  <Card key={kit.id}>
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between mb-3">
                        <h3 className="font-medium text-sm">{kit.name}</h3>
                        <Badge variant="outline" className="text-xs">{kit.colors?.length ?? 0} colors</Badge>
                      </div>
                      {kit.colors && kit.colors.length > 0 && (
                        <div className="flex gap-1 flex-wrap mb-2">
                          {kit.colors.map((c: string, i: number) => (
                            <div
                              key={i}
                              className="h-6 w-6 rounded-full border border-border"
                              style={{ backgroundColor: c }}
                              title={c}
                            />
                          ))}
                        </div>
                      )}
                      {kit.fonts && kit.fonts.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {kit.fonts.map((f: string, i: number) => (
                            <Badge key={i} variant="secondary" className="text-xs">{f}</Badge>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="providers" className="space-y-4 mt-4">
            <div>
              <h2 className="text-base font-semibold">AI Providers</h2>
              <p className="text-sm text-muted-foreground mb-4">
                Configure API keys for AI providers. Keys are stored encrypted and only used server-side.
              </p>
            </div>

            {providersLoading ? (
              <div className="space-y-3">
                {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-20" />)}
              </div>
            ) : !providerList.length ? (
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>No providers configured. Set up API keys to enable AI generation.</AlertDescription>
              </Alert>
            ) : (
              <div className="space-y-3">
                {providerList.map((provider: ProviderConfig) => (
                  <Card key={provider.providerKey}>
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-2">
                            <p className="font-medium text-sm capitalize">{provider.name ?? provider.providerKey}</p>
                            {provider.isDefault && (
                              <Badge variant="secondary" className="text-xs">Default</Badge>
                            )}
                            {provider.configured ? (
                              <Badge className="text-xs bg-green-100 text-green-800">
                                <Check className="h-3 w-3 mr-1" />
                                Configured
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="text-xs">Not configured</Badge>
                            )}
                          </div>
                          <div className="flex gap-2">
                            <Input
                              type="password"
                              placeholder={provider.configured ? "••••••••••••••••" : "Enter API key"}
                              value={providerKeys[provider.providerKey] ?? ""}
                              onChange={(e) => setProviderKeys((prev) => ({
                                ...prev,
                                [provider.providerKey]: e.target.value,
                              }))}
                              className="text-sm"
                            />
                            <Button
                              size="sm"
                              onClick={() => saveProviderMutation.mutate({
                                provider: provider.providerKey,
                                apiKey: providerKeys[provider.providerKey] ?? "",
                              })}
                              disabled={!providerKeys[provider.providerKey]?.trim() || saveProviderMutation.isPending}
                            >
                              Save
                            </Button>
                          </div>
                          {provider.taskTypes?.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-2">
                              {provider.taskTypes.map((t) => (
                                <Badge key={t} variant="outline" className="text-xs">{t.replace(/_/g, " ")}</Badge>
                              ))}
                            </div>
                          )}
                        </div>
                        <Switch
                          checked={provider.isDefault ?? false}
                          onCheckedChange={(checked) => toggleProviderMutation.mutate({
                            provider: provider.providerKey,
                            isActive: checked,
                          })}
                        />
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="billing" className="space-y-4 mt-4">
            {billingLoading ? (
              <Skeleton className="h-48" />
            ) : (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Current Plan</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-lg font-bold">{PLAN_LABELS[billingData?.plan ?? "free"] ?? "Free"}</p>
                      <p className="text-sm text-muted-foreground">
                        {billingData?.stripeSubscriptionId
                          ? `Subscription: ${billingData.stripeSubscriptionId}`
                          : "No active subscription"}
                      </p>
                    </div>
                    <Button variant="outline" disabled>
                      Upgrade (configure Stripe)
                    </Button>
                  </div>

                  <Separator />

                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    <div className="rounded-lg border border-border p-3">
                      <p className="text-xs text-muted-foreground">Credits Balance</p>
                      <p className="font-semibold text-sm">{(billingData?.creditsBalance ?? 0).toLocaleString()}</p>
                    </div>
                    <div className="rounded-lg border border-border p-3">
                      <p className="text-xs text-muted-foreground">Credits Used</p>
                      <p className="font-semibold text-sm">{(billingData?.creditsUsedThisPeriod ?? 0).toLocaleString()}</p>
                    </div>
                    {billingData?.seats != null && (
                      <div className="rounded-lg border border-border p-3">
                        <p className="text-xs text-muted-foreground">Seats</p>
                        <p className="font-semibold text-sm">{billingData.seatsUsed ?? 0} / {billingData.seats}</p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </AppShell>
  );
}
