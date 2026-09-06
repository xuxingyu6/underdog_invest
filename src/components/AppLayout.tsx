import { ReactNode, useState } from "react";
import { Menu } from "lucide-react";
import { Sidebar } from "./Sidebar";
import { ThemeToggle } from "./ThemeToggle";
import { Button } from "@/components/ui/button";

interface Props {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  children: ReactNode;
}

export function AppLayout({ title, subtitle, actions, children }: Props) {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  return (
    <div className="min-h-screen flex w-full max-w-[100vw] overflow-x-hidden bg-background">
      <Sidebar mobileOpen={mobileNavOpen} onMobileOpenChange={setMobileNavOpen} />
      <div className="flex-1 flex flex-col min-w-0">
        <header className="sticky top-0 z-10 bg-background/80 backdrop-blur border-b border-border">
          <div className="flex items-center gap-2 px-4 py-3 md:px-8 md:py-5">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="md:hidden min-h-11 min-w-11 shrink-0"
              aria-label="打开导航"
              onClick={() => setMobileNavOpen(true)}
            >
              <Menu className="w-5 h-5" />
            </Button>
            <div className="min-w-0 flex-1">
              <h1 className="text-xl md:text-2xl font-semibold tracking-tight truncate">{title}</h1>
              {subtitle && (
                <p className="text-xs md:text-sm text-muted-foreground mt-0.5 truncate">{subtitle}</p>
              )}
            </div>
            <div className="hidden md:flex items-center gap-2 shrink-0">
              {actions}
              <ThemeToggle />
            </div>
            <div className="md:hidden shrink-0">
              <ThemeToggle />
            </div>
          </div>
          {actions && (
            <div className="flex flex-wrap items-center gap-2 px-4 pb-3 md:hidden">
              {actions}
            </div>
          )}
        </header>
        <main className="flex-1 px-4 py-4 md:px-8 md:py-6 animate-fade-in min-w-0">{children}</main>
      </div>
    </div>
  );
}
