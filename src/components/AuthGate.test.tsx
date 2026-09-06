import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthGate, isAuthRoute, resolveAuthGate } from "@/components/AuthGate";
import LoginPage from "@/pages/Login";
import RegisterPage from "@/pages/Register";

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

function renderGate(path: string, app = <div>持仓内容</div>) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <AuthGate>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/" element={app} />
          <Route path="/settings" element={<div>设置内容</div>} />
        </Routes>
      </AuthGate>
    </MemoryRouter>,
  );
}

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

describe("isAuthRoute", () => {
  it("treats only login and register as public auth pages", () => {
    expect(isAuthRoute("/login")).toBe(true);
    expect(isAuthRoute("/register")).toBe(true);
    expect(isAuthRoute("/")).toBe(false);
    expect(isAuthRoute("/settings")).toBe(false);
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
    renderGate("/");

    expect(screen.queryByText("持仓内容")).not.toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("正在连接…");
    expect(screen.queryByRole("button", { name: "登录" })).not.toBeInTheDocument();
  });

  it("redirects signed-out users from the app to /login", () => {
    renderGate("/");

    expect(screen.getByRole("heading", { name: "登录" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "登录" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "注册" })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "去注册" })).toHaveAttribute("href", "/register");
    expect(screen.queryByText("持仓内容")).not.toBeInTheDocument();
  });

  it("redirects other private routes to /login when signed out", () => {
    renderGate("/settings");

    expect(screen.getByRole("heading", { name: "登录" })).toBeInTheDocument();
    expect(screen.queryByText("设置内容")).not.toBeInTheDocument();
  });

  it("shows a separate register page when signed out", () => {
    renderGate("/register");

    expect(screen.getByRole("heading", { name: "注册" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "注册" })).toBeInTheDocument();
    expect(screen.getByLabelText("确认密码")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "去登录" })).toHaveAttribute("href", "/login");
    expect(screen.queryByRole("button", { name: "登录" })).not.toBeInTheDocument();
  });

  it("renders the app after a session exists", () => {
    mockSync.user = { id: "u1", email: "you@example.com" };
    renderGate("/");

    expect(screen.getByText("持仓内容")).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "登录" })).not.toBeInTheDocument();
  });

  it("sends signed-in users away from /login and /register", () => {
    mockSync.user = { id: "u1", email: "you@example.com" };
    renderGate("/login");
    expect(screen.getByText("持仓内容")).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "登录" })).not.toBeInTheDocument();
  });

  it("returns to the login gate after sign-out", () => {
    mockSync.user = { id: "u1", email: "you@example.com" };
    const { rerender } = render(
      <MemoryRouter initialEntries={["/"]}>
        <AuthGate>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/" element={<div>持仓内容</div>} />
          </Routes>
        </AuthGate>
      </MemoryRouter>,
    );
    expect(screen.getByText("持仓内容")).toBeInTheDocument();

    mockSync.user = null;
    rerender(
      <MemoryRouter initialEntries={["/"]}>
        <AuthGate>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/" element={<div>持仓内容</div>} />
          </Routes>
        </AuthGate>
      </MemoryRouter>,
    );

    expect(screen.queryByText("持仓内容")).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "登录" })).toBeInTheDocument();
  });

  it("shows 未配置登录 instead of the empty app when Supabase is missing", () => {
    mockSync.configured = false;
    renderGate("/");

    expect(screen.getByRole("heading", { name: "未配置登录" })).toBeInTheDocument();
    expect(screen.getByText(/VITE_SUPABASE_URL/)).toBeInTheDocument();
    expect(screen.queryByText("持仓内容")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "登录" })).not.toBeInTheDocument();
  });
});
