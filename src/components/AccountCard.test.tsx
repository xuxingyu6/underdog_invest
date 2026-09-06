import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AccountCard } from "@/components/AccountCard";

const mockSync = vi.hoisted(() => ({
  configured: true,
  user: { id: "u1", email: "you@example.com" } as { id: string; email: string } | null,
  loading: false,
  syncing: false,
  lastSyncedAt: "2026-09-06T12:00:00.000Z",
  error: null as string | null,
  pending: null,
  outboundEnabled: true,
  signOut: vi.fn(),
  pushNow: vi.fn(),
  resolveUpload: vi.fn(),
  resolveConflict: vi.fn(),
  signIn: vi.fn(),
  signUp: vi.fn(),
}));

vi.mock("@/hooks/use-cloud-sync", () => ({
  useCloudSync: () => mockSync,
}));

describe("AccountCard", () => {
  beforeEach(() => {
    mockSync.configured = true;
    mockSync.user = { id: "u1", email: "you@example.com" };
    mockSync.outboundEnabled = true;
    mockSync.pending = null;
    mockSync.error = null;
  });

  it("shows account and sync status when logged in", () => {
    render(
      <MemoryRouter>
        <AccountCard />
      </MemoryRouter>,
    );

    expect(screen.getByText("账号与云同步")).toBeInTheDocument();
    expect(screen.getByText("you@example.com")).toBeInTheDocument();
    expect(screen.getByText(/已登录，写入会同步到云端/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "立即同步" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "退出登录" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "登录" })).not.toBeInTheDocument();
  });
});
