import type { ReactNode } from "react";
import { TrendingUp } from "lucide-react";
import { ThemeToggle } from "@/components/ThemeToggle";

export function AuthBrand() {
  return (
    <div className="flex items-center gap-3">
      <div className="w-10 h-10 rounded-xl bg-primary text-primary-foreground grid place-items-center shadow-sm">
        <TrendingUp className="w-5 h-5" />
      </div>
      <div>
        <div className="text-base font-semibold tracking-tight">Folio</div>
        <div className="text-xs text-muted-foreground">投资收益追踪</div>
      </div>
    </div>
  );
}

export function AuthShell({ children }: { children: ReactNode }) {
  return (
    <div className="auth-backdrop relative flex min-h-screen w-full flex-col">
      <div className="auth-grid pointer-events-none absolute inset-0" aria-hidden />
      <div className="relative z-10 flex justify-end px-4 py-3">
        <ThemeToggle />
      </div>
      <div className="relative z-10 flex flex-1 items-center justify-center px-4 pb-16">
        <div className="w-full max-w-md rounded-2xl border border-border bg-card/95 p-6 text-card-foreground shadow-lg shadow-black/5 backdrop-blur-sm sm:p-8">
          <div className="mb-6">
            <AuthBrand />
          </div>
          {children}
        </div>
      </div>
    </div>
  );
}
