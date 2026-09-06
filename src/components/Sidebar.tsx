import { NavLink } from "react-router-dom";
import { LayoutDashboard, ArrowLeftRight, LineChart, CalendarDays, Settings, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { useCloudSync } from "@/hooks/use-cloud-sync";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";

const navItems = [
  { to: "/", label: "持仓", icon: LayoutDashboard, end: true },
  { to: "/trades", label: "交易记录", icon: ArrowLeftRight },
  { to: "/returns", label: "收益率", icon: LineChart },
  { to: "/calendar", label: "收益日历", icon: CalendarDays },
  { to: "/settings", label: "设置", icon: Settings },
];

function Brand() {
  return (
    <div className="flex items-center gap-2">
      <div className="w-9 h-9 rounded-lg bg-primary text-primary-foreground grid place-items-center">
        <TrendingUp className="w-5 h-5" />
      </div>
      <div>
        <div className="text-sm font-semibold tracking-tight">Folio</div>
        <div className="text-xs text-muted-foreground">投资收益追踪</div>
      </div>
    </div>
  );
}

function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <nav className="flex-1 px-3 py-4 space-y-1">
      {navItems.map(({ to, label, icon: Icon, end }) => (
        <NavLink
          key={to}
          to={to}
          end={end}
          onClick={onNavigate}
          className={({ isActive }) =>
            cn(
              "flex items-center gap-3 px-3 min-h-11 rounded-md text-sm font-medium transition-colors",
              isActive
                ? "bg-sidebar-accent text-sidebar-accent-foreground"
                : "text-sidebar-foreground/80 hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground",
            )
          }
        >
          <Icon className="w-4 h-4" />
          {label}
        </NavLink>
      ))}
    </nav>
  );
}

function SidebarFooter() {
  const { user, outboundEnabled } = useCloudSync();
  return (
    <div className="px-6 py-4 border-t border-sidebar-border text-xs text-muted-foreground">
      {user && outboundEnabled ? "已登录，数据同步到云端" : "数据存于本地浏览器"}
    </div>
  );
}

function SidebarBody({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <div className="flex flex-col h-full bg-sidebar">
      <div className="px-6 py-6 border-b border-sidebar-border">
        <Brand />
      </div>
      <NavLinks onNavigate={onNavigate} />
      <SidebarFooter />
    </div>
  );
}

interface SidebarProps {
  mobileOpen: boolean;
  onMobileOpenChange: (open: boolean) => void;
}

export function Sidebar({ mobileOpen, onMobileOpenChange }: SidebarProps) {
  return (
    <>
      <aside className="hidden md:flex w-60 shrink-0 border-r border-sidebar-border bg-sidebar flex-col h-screen sticky top-0">
        <SidebarBody />
      </aside>

      <Sheet open={mobileOpen} onOpenChange={onMobileOpenChange}>
        <SheetContent side="left" className="w-72 max-w-[85vw] p-0 bg-sidebar border-sidebar-border">
          <SheetHeader className="sr-only">
            <SheetTitle>导航</SheetTitle>
            <SheetDescription>切换持仓、交易、收益和设置页面</SheetDescription>
          </SheetHeader>
          <SidebarBody onNavigate={() => onMobileOpenChange(false)} />
        </SheetContent>
      </Sheet>
    </>
  );
}
