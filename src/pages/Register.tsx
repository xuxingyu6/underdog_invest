import { Link } from "react-router-dom";
import { AuthForm } from "@/components/AuthForm";
import { AuthShell } from "@/components/AuthShell";

export default function RegisterPage() {
  return (
    <AuthShell>
      <h1 className="text-xl font-semibold tracking-tight">注册</h1>
      <p className="mb-6 mt-1.5 text-sm leading-relaxed text-muted-foreground">
        创建账号后即可同步持仓到云端。只需邮箱和密码，无需第三方登录。
      </p>
      <AuthForm mode="register" idPrefix="register" />
      <p className="mt-6 text-center text-sm text-muted-foreground">
        已有账号？
        <Link
          to="/login"
          className="ml-1 font-medium text-foreground underline-offset-4 hover:underline"
        >
          去登录
        </Link>
      </p>
    </AuthShell>
  );
}
