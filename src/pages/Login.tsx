import { useState } from "react";
import { Eye, EyeOff, Lock, User } from "lucide-react";
import { login, type AuthUser } from "../lib/api";
import { Button } from "../components/ui";

export function Login({ onSuccess }: { onSuccess: (u: AuthUser) => void }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [shake, setShake] = useState(0);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password) {
      setError("Enter your username and password.");
      setShake((s) => s + 1);
      return;
    }
    setLoading(true);
    setError("");
    try {
      const u = await login(username.trim(), password);
      onSuccess(u);
    } catch (err: any) {
      setError(err?.message?.includes("Network") ? err.message : "Incorrect username or password.");
      setShake((s) => s + 1);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-dvh items-center justify-center bg-bg px-4 py-10">
      <div className="w-full max-w-[400px]">
        <div className="anim-fade-up mb-8 flex flex-col items-center text-center">
          <div className="mb-4 flex h-20 w-20 items-center justify-center overflow-hidden rounded-2xl bg-white p-2.5 shadow-[var(--shadow-md)] ring-1 ring-line">
            <img src="/vmh-logo.png" alt="VMH Group" className="h-full w-full object-contain" />
          </div>
          <h1 className="text-[28px] font-bold tracking-tight text-ink">Sign in to API Tool</h1>
          <p className="mt-1 text-[14px] text-ink-3">VMH GROUP'S · API TOOL</p>
        </div>

        <form
          key={shake}
          onSubmit={submit}
          className="anim-fade-up rounded-2xl border border-line bg-surface p-6 shadow-[var(--shadow-md)]"
          style={{ animationDelay: "90ms", animation: shake ? "fade-up .6s var(--ease) both" : undefined }}
        >
          <div className="space-y-3">
            <div className="relative">
              <User size={17} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-ink-3" />
              <input
                autoFocus
                autoComplete="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Username"
                className="h-[52px] w-full rounded-2xl border border-line-strong bg-surface pl-11 pr-4 text-[16px] text-ink outline-none transition-all duration-300 placeholder:text-ink-3 focus:border-accent focus:ring-4 focus:ring-accent-soft"
              />
            </div>
            <div className="relative">
              <Lock size={17} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-ink-3" />
              <input
                type={show ? "text" : "password"}
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Password"
                className="h-[52px] w-full rounded-2xl border border-line-strong bg-surface pl-11 pr-12 text-[16px] text-ink outline-none transition-all duration-300 placeholder:text-ink-3 focus:border-accent focus:ring-4 focus:ring-accent-soft"
              />
              <button
                type="button"
                aria-label={show ? "Hide password" : "Show password"}
                onClick={() => setShow((s) => !s)}
                className="absolute right-3 top-1/2 flex h-8 w-8 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full text-ink-3 hover:bg-fill"
              >
                {show ? <EyeOff size={17} /> : <Eye size={17} />}
              </button>
            </div>
          </div>

          {error && (
            <p role="alert" className="anim-fade-in mt-3 rounded-xl bg-red-soft px-3.5 py-2.5 text-[13px] font-medium text-red">
              {error}
            </p>
          )}

          <Button type="submit" size="lg" loading={loading} className="mt-5 w-full">
            Sign In
          </Button>
        </form>

        <p className="anim-fade-in mt-6 text-center text-[12px] text-ink-3" style={{ animationDelay: "300ms" }}>
          Authorised personnel only. Activity is logged.
        </p>
      </div>
    </div>
  );
}
