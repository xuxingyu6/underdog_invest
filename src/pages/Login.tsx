import { Link } from "react-router-dom";
import { AuthForm } from "@/components/AuthForm";
import { AuthShell } from "@/components/AuthShell";

export default function LoginPage() {
  return (
    <AuthShell>
      <h1 className="text-xl font-semibold tracking-tight">登录</h1>
      <p className="mb-6 mt-1.5 text-sm leading-relaxed text-muted-foreground">
        使用邮箱和密码登录。登录后即可使用，持仓会备份到云端。
      </p>
      <AuthForm mode="login" idPrefix="login" />
      <p className="mt-6 text-center text-sm text-muted-foreground">
        没有账号？
        <Link
          to="/register"
          className="ml-1 font-medium text-foreground underline-offset-4 hover:underline"
        >
          去注册
        </Link>
      </p>
    </AuthShell>
  );
}
