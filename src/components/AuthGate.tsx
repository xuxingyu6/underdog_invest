import type { ReactNode } from "react";
import { Loader2, TrendingUp } from "lucide-react";
import { AuthForm } from "@/components/AuthForm";
import { ThemeToggle } from "@/components/ThemeToggle";
import { useCloudSync } from "@/hooks/use-cloud-sync";

export type AuthGateView = "unconfigured" | "loading" | "unauthenticated" | "authenticated";

export function resolveAuthGate({
  configured,
  loading,
  user,
}: {
  configured: boolean;
  loading: boolean;
  user: unknown;
}): AuthGateView {
  if (!configured) return "unconfigured";
  if (user) return "authenticated";
  if (loading) return "loading";
  return "unauthenticated";
}

function GateShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen w-full bg-background flex flex-col">
      <div className="flex justify-end px-4 py-3">
        <ThemeToggle />
      </div>
      <div className="flex-1 flex items-center justify-center px-4 pb-16">
        <div className="w-full max-w-md bg-card border border-border rounded-xl p-6 sm:p-8">
          <div className="flex items-center gap-2 mb-6">
            <div className="w-9 h-9 rounded-lg bg-primary text-primary-foreground grid place-items-center">
              <TrendingUp className="w-5 h-5" />
            </div>
            <div>
              <div className="text-sm font-semibold tracking-tight">Folio</div>
              <div className="text-xs text-muted-foreground">投资收益追踪</div>
            </div>
          </div>
          {children}
        </div>
      </div>
    </div>
  );
}

export function AuthGate({ children }: { children: ReactNode }) {
  const { configured, loading, user } = useCloudSync();
  const view = resolveAuthGate({ configured, loading, user });

  if (view === "authenticated") {
    return <>{children}</>;
  }

  if (view === "loading") {
    return (
      <GateShell>
        <div role="status" aria-live="polite" className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="w-4 h-4 animate-spin" />
          正在连接…
        </div>
      </GateShell>
    );
  }

  if (view === "unconfigured") {
    return (
      <GateShell>
        <h1 className="text-xl font-semibold tracking-tight">未配置登录</h1>
        <p className="text-sm text-muted-foreground mt-2">
          尚未设置 <code className="text-xs">VITE_SUPABASE_URL</code> 与{" "}
          <code className="text-xs">VITE_SUPABASE_ANON_KEY</code>。配置后即可使用邮箱登录，无法以仅本机模式进入。
        </p>
      </GateShell>
    );
  }

  return (
    <GateShell>
      <h1 className="text-xl font-semibold tracking-tight">登录</h1>
      <p className="text-sm text-muted-foreground mt-1 mb-4">
        请使用邮箱和密码登录或注册。登录后即可使用，持仓会备份到云端。
      </p>
      <AuthForm idPrefix="gate" />
    </GateShell>
  );
}
