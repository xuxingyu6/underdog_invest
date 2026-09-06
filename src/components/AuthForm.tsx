import { useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useCloudSync } from "@/hooks/use-cloud-sync";
import { toast } from "sonner";

interface AuthFormProps {
  idPrefix?: string;
}

export function AuthForm({ idPrefix = "auth" }: AuthFormProps) {
  const { loading, signIn, signUp } = useCloudSync();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (mode: "in" | "up") => {
    const trimmed = email.trim();
    if (!trimmed || !password) {
      toast.error("请输入邮箱和密码");
      return;
    }
    setBusy(true);
    try {
      if (mode === "in") await signIn(trimmed, password);
      else await signUp(trimmed, password);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "登录失败");
    } finally {
      setBusy(false);
    }
  };

  return (
    <form
      className="space-y-3"
      onSubmit={(event) => {
        event.preventDefault();
        void submit("in");
      }}
    >
      <div className="space-y-1.5">
        <Label htmlFor={`${idPrefix}-email`}>邮箱</Label>
        <Input
          id={`${idPrefix}-email`}
          type="email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor={`${idPrefix}-password`}>密码</Label>
        <Input
          id={`${idPrefix}-password`}
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="至少 6 位"
        />
      </div>
      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={busy || loading}>
          {busy ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
          登录
        </Button>
        <Button type="button" variant="outline" onClick={() => void submit("up")} disabled={busy || loading}>
          注册
        </Button>
      </div>
    </form>
  );
}
