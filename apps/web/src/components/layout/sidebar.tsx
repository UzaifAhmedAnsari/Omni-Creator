import { Link, useLocation } from "wouter";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/use-auth";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  LayoutDashboard,
  FolderOpen,
  Sparkles,
  HardDrive,
  Share2,
  CalendarClock,
  BarChart3,
  Settings,
  Shield,
  LogOut,
  ChevronDown,
  Video,
  Zap,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface SidebarProps {
  orgId: string;
  workspaceId: string;
  orgName?: string;
  workspaceName?: string;
  isAdmin?: boolean;
}

const navItems = (orgId: string, workspaceId: string) => [
  { href: `/w/${workspaceId}`, label: "Dashboard", icon: LayoutDashboard },
  { href: `/w/${workspaceId}/projects`, label: "Projects", icon: FolderOpen },
  { href: `/w/${workspaceId}/ai-jobs`, label: "AI Generation", icon: Sparkles },
  { href: `/w/${workspaceId}/assets`, label: "Assets", icon: HardDrive },
  { href: `/w/${workspaceId}/social`, label: "Social Accounts", icon: Share2 },
  { href: `/w/${workspaceId}/publishing`, label: "Publishing", icon: CalendarClock },
  { href: `/w/${workspaceId}/analytics`, label: "Analytics", icon: BarChart3 },
];

const settingsItems = (orgId: string, workspaceId: string) => [
  { href: `/settings/${orgId}`, label: "Settings", icon: Settings },
];

export function Sidebar({ orgId, workspaceId, orgName, workspaceName, isAdmin }: SidebarProps) {
  const [location] = useLocation();
  const { user, logout } = useAuth();

  const initials = [user?.firstName?.[0], user?.lastName?.[0]].filter(Boolean).join("") || "U";

  return (
    <aside className="flex h-screen w-60 flex-col border-r border-border bg-card">
      <div className="flex h-14 items-center gap-2 px-4 border-b border-border">
        <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary">
          <Video className="h-4 w-4 text-primary-foreground" />
        </div>
        <span className="font-semibold text-sm truncate">OmniCreator</span>
      </div>

      <div className="px-3 py-2 border-b border-border">
        <DropdownMenu>
          <DropdownMenuTrigger className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-accent cursor-pointer">
            <div className="flex h-5 w-5 items-center justify-center rounded bg-primary/10 text-primary text-xs font-bold shrink-0">
              {(orgName ?? "O")[0].toUpperCase()}
            </div>
            <div className="flex flex-col items-start min-w-0">
              <span className="text-xs font-medium truncate w-full">{orgName ?? "Organization"}</span>
              <span className="text-[10px] text-muted-foreground truncate w-full">{workspaceName ?? "Workspace"}</span>
            </div>
            <ChevronDown className="h-3 w-3 ml-auto shrink-0 text-muted-foreground" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-48">
            <DropdownMenuItem asChild>
              <Link href="/onboarding">New Organization</Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href={`/settings/${orgId}`}>Organization Settings</Link>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <nav className="flex-1 overflow-y-auto px-2 py-2 space-y-0.5">
        {navItems(orgId, workspaceId).map(({ href, label, icon: Icon }) => (
          <Link key={href} href={href}>
            <a className={cn(
              "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
              location === href || (href !== `/w/${workspaceId}` && location.startsWith(href))
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-accent hover:text-foreground"
            )}>
              <Icon className="h-4 w-4 shrink-0" />
              {label}
            </a>
          </Link>
        ))}

        <div className="pt-2 border-t border-border mt-2">
          {settingsItems(orgId, workspaceId).map(({ href, label, icon: Icon }) => (
            <Link key={href} href={href}>
              <a className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
                location.startsWith(href)
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-accent hover:text-foreground"
              )}>
                <Icon className="h-4 w-4 shrink-0" />
                {label}
              </a>
            </Link>
          ))}
          {isAdmin && (
            <Link href="/admin">
              <a className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
                location.startsWith("/admin")
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-accent hover:text-foreground"
              )}>
                <Shield className="h-4 w-4 shrink-0" />
                Admin
              </a>
            </Link>
          )}
        </div>
      </nav>

      <div className="border-t border-border p-3">
        <DropdownMenu>
          <DropdownMenuTrigger className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 hover:bg-accent cursor-pointer">
            <Avatar className="h-7 w-7">
              <AvatarImage src={user?.profileImageUrl ?? undefined} />
              <AvatarFallback className="text-xs">{initials}</AvatarFallback>
            </Avatar>
            <div className="flex flex-col items-start min-w-0 flex-1">
              <span className="text-xs font-medium truncate w-full">
                {[user?.firstName, user?.lastName].filter(Boolean).join(" ") || user?.email || "User"}
              </span>
              {user?.email && (
                <span className="text-[10px] text-muted-foreground truncate w-full">{user.email}</span>
              )}
            </div>
            <ChevronDown className="h-3 w-3 shrink-0 text-muted-foreground" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" side="top" className="w-48">
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={logout} className="text-destructive">
              <LogOut className="h-4 w-4 mr-2" />
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </aside>
  );
}
