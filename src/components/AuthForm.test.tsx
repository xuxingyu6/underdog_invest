import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthForm } from "@/components/AuthForm";

const toastError = vi.hoisted(() => vi.fn());
const mockSync = vi.hoisted(() => ({
  loading: false,
  signIn: vi.fn(),
  signUp: vi.fn(),
}));

vi.mock("sonner", () => ({
  toast: {
    error: (...args: unknown[]) => toastError(...args),
    success: vi.fn(),
    message: vi.fn(),
  },
}));

vi.mock("@/hooks/use-cloud-sync", () => ({
  useCloudSync: () => mockSync,
}));

describe("AuthForm", () => {
  beforeEach(() => {
    mockSync.loading = false;
    mockSync.signIn.mockReset();
    mockSync.signUp.mockReset();
    toastError.mockReset();
  });

  it("requires email and password before signing in", () => {
    render(<AuthForm />);
    fireEvent.click(screen.getByRole("button", { name: "登录" }));
    expect(toastError).toHaveBeenCalledWith("请输入邮箱和密码");
    expect(mockSync.signIn).not.toHaveBeenCalled();
  });

  it("signs in with trimmed email and password", async () => {
    mockSync.signIn.mockResolvedValue(undefined);
    render(<AuthForm idPrefix="gate" />);

    fireEvent.change(screen.getByLabelText("邮箱"), { target: { value: "  you@example.com  " } });
    fireEvent.change(screen.getByLabelText("密码"), { target: { value: "secret1" } });
    fireEvent.click(screen.getByRole("button", { name: "登录" }));

    await waitFor(() => {
      expect(mockSync.signIn).toHaveBeenCalledWith("you@example.com", "secret1");
    });
    expect(mockSync.signUp).not.toHaveBeenCalled();
  });

  it("registers with the same email and password fields", async () => {
    mockSync.signUp.mockResolvedValue(undefined);
    render(<AuthForm />);

    fireEvent.change(screen.getByLabelText("邮箱"), { target: { value: "new@example.com" } });
    fireEvent.change(screen.getByLabelText("密码"), { target: { value: "secret1" } });
    fireEvent.click(screen.getByRole("button", { name: "注册" }));

    await waitFor(() => {
      expect(mockSync.signUp).toHaveBeenCalledWith("new@example.com", "secret1");
    });
    expect(mockSync.signIn).not.toHaveBeenCalled();
  });

  it("surfaces auth errors from sign-in", async () => {
    mockSync.signIn.mockRejectedValue(new Error("邮箱或密码不正确"));
    render(<AuthForm />);

    fireEvent.change(screen.getByLabelText("邮箱"), { target: { value: "you@example.com" } });
    fireEvent.change(screen.getByLabelText("密码"), { target: { value: "wrong" } });
    fireEvent.click(screen.getByRole("button", { name: "登录" }));

    await waitFor(() => {
      expect(toastError).toHaveBeenCalledWith("邮箱或密码不正确");
    });
  });
});
