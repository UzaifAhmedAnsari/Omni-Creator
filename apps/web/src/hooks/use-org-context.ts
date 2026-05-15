import { useListOrganizations, useGetWorkspace, useListWorkspaces } from "@workspace/api-client-react";
import type { Organization } from "@workspace/api-client-react";

interface WorkspaceShape { id: string; orgId: string; name: string }

export function useOrgContext(workspaceId?: string) {
  const { data: orgs } = useListOrganizations();
  const { data: workspace } = useGetWorkspace(workspaceId ?? "");

  const ws = workspace as WorkspaceShape | undefined;
  const orgId = ws?.orgId ?? (orgs as Organization[] | undefined)?.[0]?.id ?? "";
  const org = (orgs as Organization[] | undefined)?.find((o) => o.id === orgId);

  return {
    orgId,
    orgName: org?.name ?? "Organization",
    workspaceName: ws?.name ?? "Workspace",
    workspace: ws,
    org,
  };
}

export function useFirstWorkspace() {
  const { data: orgs, isLoading: orgsLoading } = useListOrganizations();
  const firstOrg = (orgs as Organization[] | undefined)?.[0];

  const { data: workspaces, isLoading: wsLoading } = useListWorkspaces(
    firstOrg?.id ?? ""
  );

  const wsList = workspaces as WorkspaceShape[] | undefined;

  return {
    isLoading: orgsLoading || wsLoading,
    firstOrg,
    firstWorkspace: wsList?.[0],
  };
}
