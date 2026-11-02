import { useMemo, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { api } from "../lib/api";
import { useQuery } from "../lib/useQuery";
import { formatDate, initials } from "../lib/utils";
import { Badge, Button, DataTable, EmptyState, ErrorState, Field, Input, Modal, PageHeader, SearchInput, Segmented, Select, Toggle, type Column } from "../components/ui";
import { useFeedback } from "../components/feedback";
import { cn } from "../utils/cn";

interface User {
  id: number;
  name: string;
  username: string;
  email: string | null;
  mobile_no: string | null;
  role_id: number;
  role_name: string;
  is_active: "Y" | "N";
  is_online?: "Y" | "N";
  created_at: string;
  menu_permissions: number[];
  granular_permissions: Record<string, { view: number; add: number; edit: number; delete: number; print: number }>;
}
interface Menu {
  id: number;
  name: string;
}
type Level = "none" | "view" | "full";

export function Users() {
  const { toast, confirm } = useFeedback();
  const q = useQuery(async () => {
    const [u, r, m] = await Promise.all([
      api.get<{ data: User[] }>("/manage/users"),
      api.get<{ data: { id: number; name: string }[] }>("/auth/roles").catch(() => ({ data: [] })),
      api.get<{ menus: Menu[] }>("/menu-permissions", { user_id: 1 }).catch(() => ({ menus: [] as Menu[] })),
    ]);
    return { users: u.data || [], roles: r.data || [], menus: [...m.menus].sort((a, b) => a.id - b.id) };
  }, []);
  const [search, setSearch] = useState("");
  const [edit, setEdit] = useState<null | { user?: User }>(null);

  const rows = useMemo(() => {
    const t = search.toLowerCase();
    return (q.data?.users || []).filter((u) => !t || JSON.stringify([u.name, u.username, u.email]).toLowerCase().includes(t));
  }, [q.data, search]);

  if (q.error && !q.data) return <ErrorState message={q.error} onRetry={q.reset} />;

  const remove = async (u: User) => {
    if (!(await confirm({ title: `Delete ${u.name}?`, message: "This account can no longer sign in.", confirmLabel: "Delete", danger: true }))) return;
    try {
      await api.del("/manage/users", { id: u.id });
      toast("User deleted");
      q.reload();
    } catch (e: any) {
      toast(e.message, "error");
    }
  };

  const cols: Column<User>[] = [
    { key: "name", header: "User", primary: true, sortValue: (u) => u.name, render: (u) => (
        <div className="flex items-center gap-3">
          <span className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent-soft text-[12px] font-bold text-accent">
            {initials(u.name)}
            {u.is_online === "Y" && <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-surface bg-green" />}
          </span>
          <div className="min-w-0">
            <p className="truncate font-semibold">{u.name}</p>
            <p className="max-w-[220px] truncate text-[12px] text-ink-3">{u.username}</p>
          </div>
        </div>
      ) },
    { key: "role", header: "Role", render: (u) => <Badge tone="blue">{u.role_name}</Badge> },
    { key: "menus", header: "Access", render: (u) => <span className="text-ink-2">{(u.menu_permissions || []).filter((id) => id < 100).length} modules</span> },
    { key: "status", header: "Status", render: (u) => <Badge tone={u.is_active === "Y" ? "green" : "gray"} dot>{u.is_active === "Y" ? "Active" : "Disabled"}</Badge> },
    { key: "created", header: "Created", hideMobile: true, render: (u) => <span className="text-ink-3">{formatDate(u.created_at, false)}</span> },
    { key: "act", header: "", align: "right", render: (u) => <Button size="sm" variant="dangerSoft" aria-label="Delete user" icon={<Trash2 size={14} />} onClick={(e) => { e.stopPropagation(); remove(u); }} /> },
  ];

  return (
    <div>
      <PageHeader title="Users & access" subtitle="Accounts, roles and per-module permissions." actions={<Button icon={<Plus size={16} />} onClick={() => setEdit({})}>Add user</Button>} />
      <SearchInput value={search} onChange={setSearch} placeholder="Search users" className="mb-5 sm:max-w-sm" />
      <DataTable columns={cols} rows={rows} rowKey={(u) => u.id} loading={q.loading} onRowClick={(u) => setEdit({ user: u })} empty={<EmptyState title="No users found" />} />
      <UserForm
        state={edit}
        roles={q.data?.roles || []}
        menus={q.data?.menus || []}
        onClose={() => setEdit(null)}
        onSaved={() => {
          setEdit(null);
          q.reload();
        }}
      />
    </div>
  );
}

function levelOf(u: User | undefined, id: number): Level {
  const g = u?.granular_permissions?.[String(id)];
  if (!g || !g.view) return u?.menu_permissions?.includes(id) ? "view" : "none";
  return g.add && g.edit && g.delete ? "full" : "view";
}

function UserForm({
  state,
  roles,
  menus,
  onClose,
  onSaved,
}: {
  state: null | { user?: User };
  roles: { id: number; name: string }[];
  menus: Menu[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const { toast } = useFeedback();
  const [f, setF] = useState({ name: "", username: "", email: "", mobile_no: "", role_id: "3", password: "", active: true });
  const [levels, setLevels] = useState<Record<number, Level>>({});
  const [tab, setTab] = useState<"profile" | "access">("profile");
  const [busy, setBusy] = useState(false);
  const [key, setKey] = useState<unknown>(null);
  const u = state?.user;

  if (state && key !== state) {
    setKey(state);
    setTab("profile");
    setF({
      name: u?.name || "",
      username: u?.username || "",
      email: u?.email || "",
      mobile_no: u?.mobile_no || "",
      role_id: String(u?.role_id ?? 3),
      password: "",
      active: u ? u.is_active === "Y" : true,
    });
    const l: Record<number, Level> = {};
    menus.forEach((m) => (l[m.id] = u ? levelOf(u, m.id) : m.id === 7 ? "view" : "none"));
    setLevels(l);
  }

  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setF((p) => ({ ...p, [k]: e.target.value }));

  const save = async () => {
    if (!f.name.trim() || !f.username.trim()) return setTab("profile"), toast("Name and username are required.", "error");
    if (!u && f.password.length < 6) return setTab("profile"), toast("Set a password of at least 6 characters.", "error");
    if (f.email && !/^\S+@\S+\.\S+$/.test(f.email)) return setTab("profile"), toast("Enter a valid email address.", "error");

    const topIds = new Set(menus.map((m) => m.id));
    const keep = (u?.menu_permissions || []).filter((id) => !topIds.has(id));
    const granular: Record<string, any> = {};
    Object.entries(u?.granular_permissions || {}).forEach(([k, v]) => {
      if (!topIds.has(Number(k))) granular[k] = v;
    });
    const ids = [...keep];
    menus.forEach((m) => {
      const lv = levels[m.id];
      if (lv && lv !== "none") {
        ids.push(m.id);
        granular[String(m.id)] = lv === "full" ? { view: 1, add: 1, edit: 1, delete: 1, print: 1 } : { view: 1, add: 0, edit: 0, delete: 0, print: 1 };
      }
    });

    setBusy(true);
    try {
      await api.post("/manage/users/save", {
        id: u?.id,
        name: f.name.trim(),
        username: f.username.trim(),
        email: f.email.trim() || null,
        mobile_no: f.mobile_no.trim() || null,
        role_id: Number(f.role_id),
        employee_type: Number(f.role_id),
        password: f.password || undefined,
        status: f.active ? "active" : "inactive",
        is_active: f.active ? "Y" : "N",
        menu_permissions: [...new Set(ids)],
        granular_permissions: granular,
      });
      toast(u ? "User updated" : "User created");
      onSaved();
    } catch (e: any) {
      toast(e.message, "error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open={!!state}
      onClose={onClose}
      size="lg"
      title={u ? "Edit user" : "Add user"}
      subtitle={u?.username}
      footer={<><Button variant="ghost" onClick={onClose}>Cancel</Button><Button loading={busy} onClick={save}>{u ? "Save changes" : "Create user"}</Button></>}
    >
      <Segmented className="mb-5" value={tab} onChange={setTab} options={[{ value: "profile", label: "Profile" }, { value: "access", label: "Module access" }]} />
      {tab === "profile" ? (
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Full name"><Input value={f.name} onChange={set("name")} /></Field>
          <Field label="Username"><Input value={f.username} onChange={set("username")} autoComplete="off" /></Field>
          <Field label="Email"><Input type="email" value={f.email} onChange={set("email")} /></Field>
          <Field label="Mobile"><Input value={f.mobile_no} onChange={set("mobile_no")} /></Field>
          <Field label="Role">
            <Select value={f.role_id} onChange={set("role_id")}>
              {(roles.length ? roles : [{ id: 1, name: "Admin" }, { id: 2, name: "Manager" }, { id: 3, name: "Employee" }]).map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
            </Select>
          </Field>
          <Field label={u ? "New password" : "Password"} hint={u ? "Leave blank to keep the current password" : "Minimum 6 characters"}>
            <Input type="password" autoComplete="new-password" value={f.password} onChange={set("password")} />
          </Field>
          <div className="flex items-center justify-between rounded-2xl bg-fill px-4 py-3 sm:col-span-2">
            <div>
              <p className="text-[14px] font-medium">Account active</p>
              <p className="text-[12px] text-ink-3">Disabled accounts cannot sign in</p>
            </div>
            <Toggle checked={f.active} onChange={(v) => setF((p) => ({ ...p, active: v }))} label="Account active" />
          </div>
        </div>
      ) : (
        <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line">
          {menus.map((m) => (
            <li key={m.id} className="flex items-center justify-between gap-3 px-4 py-2.5">
              <span className="text-[14px] font-medium">{m.name}</span>
              <div className="flex rounded-lg bg-fill p-0.5">
                {(["none", "view", "full"] as Level[]).map((lv) => (
                  <button
                    key={lv}
                    type="button"
                    onClick={() => setLevels((p) => ({ ...p, [m.id]: lv }))}
                    className={cn(
                      "cursor-pointer rounded-md px-3 py-1 text-[12px] font-medium capitalize transition-all duration-300",
                      levels[m.id] === lv ? "bg-surface text-ink shadow-[0_1px_3px_rgba(0,0,0,0.15)]" : "text-ink-3",
                    )}
                  >
                    {lv === "none" ? "No access" : lv === "view" ? "View" : "Full"}
                  </button>
                ))}
              </div>
            </li>
          ))}
        </ul>
      )}
    </Modal>
  );
}
