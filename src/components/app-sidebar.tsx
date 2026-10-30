import type { ComponentType } from "react";
import { Link } from "react-router-dom";
import { MapPin, Settings2 } from "lucide-react";
import { Logo } from "@/components/logo";
import type { Meeting } from "@/api";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  SidebarSeparator,
  useSidebar,
} from "@/components/ui/sidebar";

export type NavItem = { name: string; path: string; icon: ComponentType };

export function AppSidebar({
  nav,
  activePath,
  year,
  years,
  onYearChange,
  completed,
  total,
  meeting,
}: {
  nav: readonly NavItem[];
  activePath: string;
  year: number;
  years: number[];
  onYearChange: (year: number) => void;
  completed: number;
  total: number;
  meeting?: Meeting;
}) {
  const { isMobile, setOpenMobile } = useSidebar();
  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild>
              <Link to="/">
                <div className="flex h-8 shrink-0 items-center text-sidebar-foreground">
                  <Logo className="h-5! w-auto! group-data-[collapsible=icon]:h-3!" />
                </div>
                <div className="grid flex-1 text-left leading-tight">
                  <span className="truncate font-medium tracking-wide">APEX</span>
                  <span className="truncate text-xs text-muted-foreground">Race intelligence</span>
                </div>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup className="group-data-[collapsible=icon]:hidden">
          <SidebarGroupLabel>Season</SidebarGroupLabel>
          <SidebarGroupContent className="space-y-2.5 px-2">
            <Select value={String(year)} onValueChange={(v) => onYearChange(Number(v))}>
              <SelectTrigger aria-label="Select season" className="w-full bg-sidebar">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {years.map((y) => (
                  <SelectItem key={y} value={String(y)}>
                    {y} season
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Progress value={total ? (completed / total) * 100 : 0} aria-label="Season progress" />
            <p className="text-xs text-muted-foreground tabular-nums">
              {completed} of {total || "—"} rounds completed
            </p>
          </SidebarGroupContent>
        </SidebarGroup>
        <SidebarGroup>
          <SidebarGroupLabel>Workspace</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {nav.map(({ name, path, icon: Icon }) => (
                <SidebarMenuItem key={path}>
                  <SidebarMenuButton asChild isActive={activePath === path} tooltip={name}>
                    <Link to={path} onClick={() => isMobile && setOpenMobile(false)}>
                      <Icon />
                      <span>{name}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton tooltip={meeting?.meeting_name ?? "Race control"} className="h-auto py-2">
              <MapPin />
              <div className="grid flex-1 text-left leading-tight">
                <span className="truncate text-sm font-medium">{meeting?.country_name ?? "Race control"}</span>
                <span className="truncate text-xs text-muted-foreground">{meeting?.meeting_name ?? "Select a Grand Prix"}</span>
              </div>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarSeparator className="mx-0" />
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" tooltip="Race analyst">
              <Avatar className="size-8 rounded-lg">
                <AvatarFallback className="rounded-lg text-xs">AP</AvatarFallback>
              </Avatar>
              <div className="grid flex-1 text-left leading-tight">
                <span className="truncate text-sm font-medium">Race analyst</span>
                <span className="truncate text-xs text-muted-foreground">Historical data mode</span>
              </div>
              <Settings2 className="ml-auto size-4" />
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
