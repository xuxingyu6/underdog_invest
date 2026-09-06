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

  it("login mode only shows a login submit button", () => {
    render(<AuthForm mode="login" />);
    expect(screen.getByRole("button", { name: "登录" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "注册" })).not.toBeInTheDocument();
    expect(screen.queryByLabelText("确认密码")).not.toBeInTheDocument();
  });

  it("register mode asks for password confirmation", () => {
    render(<AuthForm mode="register" />);
    expect(screen.getByRole("button", { name: "注册" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "登录" })).not.toBeInTheDocument();
    expect(screen.getByLabelText("确认密码")).toBeInTheDocument();
    expect(screen.getByText("密码至少 6 位")).toBeInTheDocument();
  });

  it("requires email and password before signing in", () => {
    render(<AuthForm mode="login" />);
    fireEvent.click(screen.getByRole("button", { name: "登录" }));
    expect(toastError).toHaveBeenCalledWith("请输入邮箱和密码");
    expect(mockSync.signIn).not.toHaveBeenCalled();
  });

  it("signs in with trimmed email and password", async () => {
    mockSync.signIn.mockResolvedValue(undefined);
    render(<AuthForm mode="login" idPrefix="login" />);

    fireEvent.change(screen.getByLabelText("邮箱"), { target: { value: "  you@example.com  " } });
    fireEvent.change(screen.getByLabelText("密码"), { target: { value: "secret1" } });
    fireEvent.click(screen.getByRole("button", { name: "登录" }));

    await waitFor(() => {
      expect(mockSync.signIn).toHaveBeenCalledWith("you@example.com", "secret1");
    });
    expect(mockSync.signUp).not.toHaveBeenCalled();
  });

  it("registers after matching passwords", async () => {
    mockSync.signUp.mockResolvedValue(undefined);
    render(<AuthForm mode="register" />);

    fireEvent.change(screen.getByLabelText("邮箱"), { target: { value: "new@example.com" } });
    fireEvent.change(screen.getByLabelText("密码"), { target: { value: "secret1" } });
    fireEvent.change(screen.getByLabelText("确认密码"), { target: { value: "secret1" } });
    fireEvent.click(screen.getByRole("button", { name: "注册" }));

    await waitFor(() => {
      expect(mockSync.signUp).toHaveBeenCalledWith("new@example.com", "secret1");
    });
    expect(mockSync.signIn).not.toHaveBeenCalled();
  });

  it("rejects a short register password", () => {
    render(<AuthForm mode="register" />);
    fireEvent.change(screen.getByLabelText("邮箱"), { target: { value: "new@example.com" } });
    fireEvent.change(screen.getByLabelText("密码"), { target: { value: "123" } });
    fireEvent.change(screen.getByLabelText("确认密码"), { target: { value: "123" } });
    fireEvent.click(screen.getByRole("button", { name: "注册" }));
    expect(toastError).toHaveBeenCalledWith("密码至少 6 位");
    expect(mockSync.signUp).not.toHaveBeenCalled();
  });

  it("rejects mismatched register passwords", () => {
    render(<AuthForm mode="register" />);
    fireEvent.change(screen.getByLabelText("邮箱"), { target: { value: "new@example.com" } });
    fireEvent.change(screen.getByLabelText("密码"), { target: { value: "secret1" } });
    fireEvent.change(screen.getByLabelText("确认密码"), { target: { value: "secret2" } });
    fireEvent.click(screen.getByRole("button", { name: "注册" }));
    expect(toastError).toHaveBeenCalledWith("两次输入的密码不一致");
    expect(mockSync.signUp).not.toHaveBeenCalled();
  });

  it("surfaces auth errors from sign-in", async () => {
    mockSync.signIn.mockRejectedValue(new Error("邮箱或密码不正确"));
    render(<AuthForm mode="login" />);

    fireEvent.change(screen.getByLabelText("邮箱"), { target: { value: "you@example.com" } });
    fireEvent.change(screen.getByLabelText("密码"), { target: { value: "wrong" } });
    fireEvent.click(screen.getByRole("button", { name: "登录" }));

    await waitFor(() => {
      expect(toastError).toHaveBeenCalledWith("邮箱或密码不正确");
    });
  });

  it("toggles password visibility", () => {
    render(<AuthForm mode="login" />);
    const password = screen.getByLabelText("密码");
    expect(password).toHaveAttribute("type", "password");
    fireEvent.click(screen.getByRole("button", { name: "显示密码" }));
    expect(password).toHaveAttribute("type", "text");
    fireEvent.click(screen.getByRole("button", { name: "隐藏密码" }));
    expect(password).toHaveAttribute("type", "password");
  });
});
