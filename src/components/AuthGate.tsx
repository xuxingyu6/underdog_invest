import type { ReactNode } from "react";
import { Loader2 } from "lucide-react";
import { Navigate, useLocation } from "react-router-dom";
import { AuthShell } from "@/components/AuthShell";
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

export function isAuthRoute(pathname: string): boolean {
  return pathname === "/login" || pathname === "/register";
}

export function AuthGate({ children }: { children: ReactNode }) {
  const { configured, loading, user } = useCloudSync();
  const view = resolveAuthGate({ configured, loading, user });
  const location = useLocation();
  const onAuthPage = isAuthRoute(location.pathname);

  if (view === "authenticated") {
    if (onAuthPage) return <Navigate to="/" replace />;
    return <>{children}</>;
  }

  if (view === "loading") {
    return (
      <AuthShell>
        <div role="status" aria-live="polite" className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          正在连接…
        </div>
      </AuthShell>
    );
  }

  if (view === "unconfigured") {
    return (
      <AuthShell>
        <h1 className="text-xl font-semibold tracking-tight">未配置登录</h1>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          尚未设置 <code className="text-xs">VITE_SUPABASE_URL</code> 与{" "}
          <code className="text-xs">VITE_SUPABASE_ANON_KEY</code>。配置后即可使用邮箱登录，无法以仅本机模式进入。
        </p>
      </AuthShell>
    );
  }

  if (!onAuthPage) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}
