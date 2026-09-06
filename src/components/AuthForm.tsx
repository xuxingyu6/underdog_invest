import { useState, type ChangeEvent } from "react";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useCloudSync } from "@/hooks/use-cloud-sync";
import { toast } from "sonner";

export const MIN_PASSWORD_LENGTH = 6;

export type AuthFormMode = "login" | "register";

interface AuthFormProps {
  mode: AuthFormMode;
  idPrefix?: string;
}

function PasswordField({
  id,
  label,
  value,
  onChange,
  autoComplete,
  placeholder,
  hint,
  disabled,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (event: ChangeEvent<HTMLInputElement>) => void;
  autoComplete: string;
  placeholder: string;
  hint?: string;
  disabled?: boolean;
}) {
  const [visible, setVisible] = useState(false);

  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <div className="relative">
        <Input
          id={id}
          type={visible ? "text" : "password"}
          autoComplete={autoComplete}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          disabled={disabled}
          className="pr-11"
        />
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="absolute right-0.5 top-1/2 h-9 w-9 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          onClick={() => setVisible((open) => !open)}
          aria-label={visible ? "隐藏密码" : "显示密码"}
          tabIndex={-1}
        >
          {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </Button>
      </div>
      {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

export function AuthForm({ mode, idPrefix }: AuthFormProps) {
  const prefix = idPrefix ?? mode;
  const { loading, signIn, signUp } = useCloudSync();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [busy, setBusy] = useState(false);

  const submitting = busy || loading;
  const submitLabel = mode === "login" ? "登录" : "注册";

  const submit = async () => {
    const trimmed = email.trim();
    if (!trimmed || !password) {
      toast.error("请输入邮箱和密码");
      return;
    }
    if (mode === "register") {
      if (password.length < MIN_PASSWORD_LENGTH) {
        toast.error(`密码至少 ${MIN_PASSWORD_LENGTH} 位`);
        return;
      }
      if (password !== confirmPassword) {
        toast.error("两次输入的密码不一致");
        return;
      }
    }

    setBusy(true);
    try {
      if (mode === "login") await signIn(trimmed, password);
      else await signUp(trimmed, password);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : mode === "login" ? "登录失败" : "注册失败");
    } finally {
      setBusy(false);
    }
  };

  return (
    <form
      className="space-y-4"
      aria-busy={submitting}
      onSubmit={(event) => {
        event.preventDefault();
        void submit();
      }}
    >
      <div className="space-y-1.5">
        <Label htmlFor={`${prefix}-email`}>邮箱</Label>
        <Input
          id={`${prefix}-email`}
          type="email"
          autoComplete="email"
          inputMode="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          disabled={submitting}
        />
      </div>
      <PasswordField
        id={`${prefix}-password`}
        label="密码"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        autoComplete={mode === "login" ? "current-password" : "new-password"}
        placeholder={mode === "register" ? `至少 ${MIN_PASSWORD_LENGTH} 位` : "请输入密码"}
        hint={mode === "register" ? `密码至少 ${MIN_PASSWORD_LENGTH} 位` : undefined}
        disabled={submitting}
      />
      {mode === "register" ? (
        <PasswordField
          id={`${prefix}-confirm`}
          label="确认密码"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          autoComplete="new-password"
          placeholder="再输入一次密码"
          disabled={submitting}
        />
      ) : null}
      <Button type="submit" className="w-full" size="lg" disabled={submitting}>
        {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
        {submitLabel}
      </Button>
    </form>
  );
}
