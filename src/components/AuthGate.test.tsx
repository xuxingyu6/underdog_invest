import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthGate, resolveAuthGate } from "@/components/AuthGate";

const mockSync = vi.hoisted(() => ({
  configured: true,
  user: null as { id: string; email: string } | null,
  loading: false,
  signIn: vi.fn(),
  signUp: vi.fn(),
}));

vi.mock("@/hooks/use-cloud-sync", () => ({
  useCloudSync: () => mockSync,
}));

describe("resolveAuthGate", () => {
  it("blocks the app when Supabase is not configured", () => {
    expect(resolveAuthGate({ configured: false, loading: false, user: null })).toBe("unconfigured");
    expect(resolveAuthGate({ configured: false, loading: true, user: null })).toBe("unconfigured");
  });

  it("shows loading while the session is unknown", () => {
    expect(resolveAuthGate({ configured: true, loading: true, user: null })).toBe("loading");
  });

  it("shows the login gate when signed out", () => {
    expect(resolveAuthGate({ configured: true, loading: false, user: null })).toBe("unauthenticated");
  });

  it("opens the app after sign-in even if cloud sync is still loading", () => {
    expect(resolveAuthGate({ configured: true, loading: true, user: { id: "1" } })).toBe("authenticated");
    expect(resolveAuthGate({ configured: true, loading: false, user: { id: "1" } })).toBe("authenticated");
  });
});

describe("AuthGate", () => {
  beforeEach(() => {
    mockSync.configured = true;
    mockSync.user = null;
    mockSync.loading = false;
  });

  it("does not flash private content while the session is loading", () => {
    mockSync.loading = true;
    render(
      <AuthGate>
        <div>持仓内容</div>
      </AuthGate>,
    );

    expect(screen.queryByText("持仓内容")).not.toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("正在连接…");
    expect(screen.queryByRole("button", { name: "登录" })).not.toBeInTheDocument();
  });

  it("shows only the login form when signed out", () => {
    render(
      <AuthGate>
        <nav>持仓</nav>
        <div>设置内容</div>
      </AuthGate>,
    );

    expect(screen.getByRole("heading", { name: "登录" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "登录" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "注册" })).toBeInTheDocument();
    expect(screen.queryByText("持仓")).not.toBeInTheDocument();
    expect(screen.queryByText("设置内容")).not.toBeInTheDocument();
  });

  it("renders the app after a session exists", () => {
    mockSync.user = { id: "u1", email: "you@example.com" };
    render(
      <AuthGate>
        <div>持仓内容</div>
      </AuthGate>,
    );

    expect(screen.getByText("持仓内容")).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "登录" })).not.toBeInTheDocument();
  });

  it("returns to the login gate after sign-out", () => {
    mockSync.user = { id: "u1", email: "you@example.com" };
    const { rerender } = render(
      <AuthGate>
        <div>持仓内容</div>
      </AuthGate>,
    );
    expect(screen.getByText("持仓内容")).toBeInTheDocument();

    mockSync.user = null;
    rerender(
      <AuthGate>
        <div>持仓内容</div>
      </AuthGate>,
    );

    expect(screen.queryByText("持仓内容")).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "登录" })).toBeInTheDocument();
  });

  it("shows 未配置登录 instead of the empty app when Supabase is missing", () => {
    mockSync.configured = false;
    render(
      <AuthGate>
        <div>持仓内容</div>
      </AuthGate>,
    );

    expect(screen.getByRole("heading", { name: "未配置登录" })).toBeInTheDocument();
    expect(screen.getByText(/VITE_SUPABASE_URL/)).toBeInTheDocument();
    expect(screen.queryByText("持仓内容")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "登录" })).not.toBeInTheDocument();
  });
});
