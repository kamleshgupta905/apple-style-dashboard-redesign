import { useState } from "react";
import { KeyRound, LogOut, Moon, Sun } from "lucide-react";
import { api, type AuthUser } from "../lib/api";
import { Button, Card, Field, Input, PageHeader, SectionTitle, Segmented } from "../components/ui";
import { useFeedback } from "../components/feedback";
import { PERMS, usePermissions } from "../lib/permissions";
import { initials } from "../lib/utils";

export function Settings({ user, dark, onSetDark, onLogout }: { user: AuthUser; dark: boolean; onSetDark: (d: boolean) => void; onLogout: () => void }) {
  const { toast } = useFeedback();
  const { can } = usePermissions();
  const [f, setF] = useState({ next: "", confirm: "" });
  const [busy, setBusy] = useState(false);

  const strength = (() => {
    const p = f.next;
    let s = 0;
    if (p.length >= 8) s++;
    if (/[A-Z]/.test(p) && /[a-z]/.test(p)) s++;
    if (/\d/.test(p)) s++;
    if (/[^A-Za-z0-9]/.test(p)) s++;
    return s;
  })();
  const labels = ["Too short", "Weak", "Fair", "Good", "Strong"];
  const colors = ["var(--fill-2)", "var(--red)", "var(--orange)", "var(--accent)", "var(--green)"];

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (f.next.length < 6) return toast("Use at least 6 characters.", "error");
    if (f.next !== f.confirm) return toast("Passwords don't match.", "error");
    setBusy(true);
    try {
      const r = await api.post<{ message?: string }>("/auth/change-password", { user_id: user.id, new_password: f.next });
      toast(r.message || "Password updated");
      setF({ next: "", confirm: "" });
    } catch (err: any) {
      toast(err.message, "error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title="Settings" subtitle="Your account and appearance." />

      <div className="stagger space-y-5">
        <Card className="flex items-center gap-4 p-5 sm:p-6">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-accent text-[22px] font-semibold text-white">{initials(user.name)}</div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[20px] font-semibold tracking-tight">{user.name}</p>
            <p className="truncate text-[14px] text-ink-3">{user.email || user.username}</p>
            <p className="mt-1 text-[12px] font-medium text-accent">{user.role_name || "Administrator"}</p>
          </div>
          <Button variant="secondary" icon={<LogOut size={15} />} onClick={onLogout}>
            Sign out
          </Button>
        </Card>

        <Card className="p-5 sm:p-6">
          <SectionTitle title="Appearance" hint="Applies instantly on this device" />
          <Segmented
            value={dark ? "dark" : "light"}
            onChange={(v) => onSetDark(v === "dark")}
            className="w-full sm:w-auto"
            options={[
              { value: "light", label: "☀︎  Light" },
              { value: "dark", label: "☾  Dark" },
            ]}
          />
          <p className="mt-3 flex items-center gap-2 text-[13px] text-ink-3">
            {dark ? <Moon size={14} /> : <Sun size={14} />} Currently using the {dark ? "dark" : "light"} theme.
          </p>
        </Card>

        {can(PERMS.USERS_PASSWORDS) && (
          <Card className="p-5 sm:p-6">
            <SectionTitle title="Change password" hint="Choose something unique you don't use elsewhere" />
            <form onSubmit={save} className="space-y-4">
              <Field label="New password">
                <Input type="password" autoComplete="new-password" value={f.next} onChange={(e) => setF({ ...f, next: e.target.value })} />
              </Field>
              {f.next && (
                <div className="anim-fade-in">
                  <div className="flex gap-1.5">
                    {[1, 2, 3, 4].map((i) => (
                      <span key={i} className="h-1.5 flex-1 rounded-full transition-colors duration-500" style={{ background: strength >= i ? colors[strength] : "var(--fill)" }} />
                    ))}
                  </div>
                  <p className="mt-1.5 text-[12px] text-ink-3">{labels[strength]}</p>
                </div>
              )}
              <Field label="Confirm password">
                <Input type="password" autoComplete="new-password" value={f.confirm} onChange={(e) => setF({ ...f, confirm: e.target.value })} />
              </Field>
              <Button type="submit" loading={busy} icon={<KeyRound size={16} />}>
                Update password
              </Button>
            </form>
          </Card>
        )}
      </div>
    </div>
  );
}
