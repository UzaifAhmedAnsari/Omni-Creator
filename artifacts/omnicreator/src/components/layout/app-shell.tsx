import { ReactNode } from "react";
import { Sidebar } from "./sidebar";

interface AppShellProps {
  orgId: string;
  workspaceId: string;
  orgName?: string;
  workspaceName?: string;
  isAdmin?: boolean;
  children: ReactNode;
}

export function AppShell({ orgId, workspaceId, orgName, workspaceName, isAdmin, children }: AppShellProps) {
  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <Sidebar
        orgId={orgId}
        workspaceId={workspaceId}
        orgName={orgName}
        workspaceName={workspaceName}
        isAdmin={isAdmin}
      />
      <main className="flex-1 overflow-y-auto">
        {children}
      </main>
    </div>
  );
}
