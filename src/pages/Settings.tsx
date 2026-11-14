import { useMemo, useState } from "react";
import { Eye, EyeOff, KeyRound, Layers, LogOut, Moon, RotateCcw, Sun, Zap } from "lucide-react";
import { api, type AuthUser } from "../lib/api";
import { Button, Card, Field, Input, PageHeader, SectionTitle, Segmented, Toggle } from "../components/ui";
import { useFeedback } from "../components/feedback";
import { PERMS, usePermissions } from "../lib/permissions";
import { NAV } from "../components/Shell";
import { saveHiddenNavItems, useHiddenNavItems } from "../lib/navConfig";
import { initials } from "../lib/utils";

export function Settings({ user, dark, onSetDark, onLogout }: { user: AuthUser; dark: boolean; onSetDark: (d: boolean) => void; onLogout: () => void }) {
  const { toast } = useFeedback();
  const { can } = usePermissions();
  const isVendor = user.role_id === 3 || user.role_name === "Vendor" || user.role_name?.toLowerCase().includes("vendor");
  const isSuperOrAdmin =
    !isVendor &&
    (user.role_id === 4 ||
      user.role_id === 1 ||
      user.role_name === "Super Admin" ||
      user.role_name === "Admin" ||
      user.role_name?.toLowerCase().includes("admin"));

  const hiddenNavIds = useHiddenNavItems();
  const [navSaving, setNavSaving] = useState(false);

  const [f, setF] = useState({ next: "", confirm: "" });
  const [busy, setBusy] = useState(false);

  const configurableNavGroups = useMemo(() => {
    const groups = new Map<string, typeof NAV>();
    NAV.filter((n) => n.id !== "settings").forEach((n) => {
      groups.set(n.group, [...(groups.get(n.group) || []), n]);
    });
    return [...groups.entries()];
  }, []);

  const toggleNavVisibility = async (id: string, visible: boolean) => {
    const nextHidden = visible
      ? hiddenNavIds.filter((x) => x !== id)
      : Array.from(new Set([...hiddenNavIds, id]));
    setNavSaving(true);
    try {
      await saveHiddenNavItems(nextHidden);
      const item = NAV.find((n) => n.id === id);
      toast(`${item?.label || id} ${visible ? "shown in" : "hidden from"} navbar`);
    } catch {
      toast("Saved locally (Supabase sync failed)", "error");
    } finally {
      setNavSaving(false);
    }
  };

  const resetNavVisibility = async () => {
    setNavSaving(true);
    try {
      await saveHiddenNavItems([]);
      toast("All navbar items restored");
    } catch {
      toast("Restored locally", "error");
    } finally {
      setNavSaving(false);
    }
  };

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
      <PageHeader title="Settings" subtitle="Your account, navigation and appearance." />

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
              { value: "light", label: "Light" },
              { value: "dark", label: "Dark" },
            ]}
          />
          <p className="mt-3 flex items-center gap-2 text-[13px] text-ink-3">
            {dark ? <Moon size={14} /> : <Sun size={14} />} Currently using the {dark ? "dark" : "light"} theme.
          </p>
        </Card>

        {isSuperOrAdmin && (
          <Card className="p-5 sm:p-6">
            <SectionTitle
              title="Navbar Visibility (Super Admin)"
              hint="Hide or show sidebar & navigation pages across the workspace. Settings always stays visible."
              action={
                hiddenNavIds.length > 0 ? (
                  <Button
                    size="sm"
                    variant="secondary"
                    icon={<RotateCcw size={13} />}
                    disabled={navSaving}
                    onClick={resetNavVisibility}
                  >
                    Show all ({hiddenNavIds.length} hidden)
                  </Button>
                ) : undefined
              }
            />
            <div className="space-y-4">
              {configurableNavGroups.map(([group, items]) => (
                <div key={group} className="space-y-2">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-3">{group}</p>
                  <div className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface">
                    {items.map((item) => {
                      const visible = !hiddenNavIds.includes(item.id);
                      return (
                        <div key={item.id} className="flex items-center justify-between gap-3 px-3.5 py-2.5">
                          <div className="flex min-w-0 items-center gap-3">
                            <span className={visible ? "text-ink-2" : "text-ink-3/50"}>{item.icon}</span>
                            <div className="min-w-0">
                              <p className={`truncate text-[13.5px] font-medium ${visible ? "text-ink" : "text-ink-3 line-through"}`}>
                                {item.label}
                              </p>
                              <p className="truncate text-[11.5px] text-ink-3">{item.hint}</p>
                            </div>
                          </div>
                          <div className="flex shrink-0 items-center gap-2.5">
                            <span className="hidden items-center gap-1 text-[11.5px] text-ink-3 sm:inline-flex">
                              {visible ? <Eye size={13} className="text-green" /> : <EyeOff size={13} />}
                              {visible ? "Visible" : "Hidden"}
                            </span>
                            <Toggle
                              checked={visible}
                              disabled={navSaving}
                              label={`Toggle ${item.label} in navbar`}
                              onChange={(next) => toggleNavVisibility(item.id, next)}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </Card>
        )}

        {!isVendor && (
          <Card className="p-5 sm:p-6">
            <SectionTitle
              title="Survey Automation & Smart Routing"
              hint="Global rules applied to incoming respondents & study conversions"
            />
            <div className="space-y-4 pt-1">
              <div className="rounded-xl border border-line p-4 space-y-2.5">
                <div className="flex items-start gap-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-500/15 text-amber-500">
                    <Zap size={18} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-[14px] font-semibold text-ink">Auto-Pause Inactive Studies</p>
                    <p className="text-[12px] text-ink-3 leading-relaxed">
                      If a study receives 50 clicks (or your customized click limit) without delivering a single complete, the router automatically pauses traffic to prevent spend loss.
                    </p>
                  </div>
                </div>
                <p className="text-[11px] text-ink-3 font-mono bg-fill px-3 py-2 rounded-lg">
                  Configurable per study in Surveys → Edit Study (default: 50 clicks).
                </p>
              </div>

              <div className="rounded-xl border border-line p-4">
                <div className="flex items-start gap-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-accent-soft text-accent">
                    <Layers size={18} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-[14px] font-semibold text-ink">Waterfall Rerouting</p>
                    <ul className="mt-1 space-y-1 text-[12px] text-ink-3 leading-relaxed">
                      <li><strong className="text-ink-2">Screenout / Quota / Security:</strong> Routes respondents directly to the next eligible live survey.</li>
                      <li><strong className="text-ink-2">Complete:</strong> Displays confirmation for 5 seconds before forwarding to the next open study or partner callback.</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          </Card>
        )}

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
