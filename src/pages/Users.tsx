import { useMemo, useState } from "react";
import { Check, CheckSquare, MinusSquare, Pencil, Plus, Search, Square, Trash2 } from "lucide-react";
import { api, auth } from "../lib/api";
import { useQuery } from "../lib/useQuery";
import { formatDate, initials } from "../lib/utils";
import {
  Badge,
  Button,
  DataTable,
  EmptyState,
  ErrorState,
  Field,
  Input,
  Modal,
  PageHeader,
  SearchInput,
  Segmented,
  Select,
  Toggle,
  type Column,
} from "../components/ui";
import { useFeedback } from "../components/feedback";
import { ALL_MENU_IDS, MENU_TREE, MenuItemNode, PERMS, usePermissions } from "../lib/permissions";
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

export function Users() {
  const { toast, confirm } = useFeedback();
  const { can, user: currentAuthUser } = usePermissions();
  const q = useQuery(async () => {
    const [u, r] = await Promise.all([
      api.get<{ data: User[] }>("/manage/users"),
      api.get<{ data: { id: number; name: string }[] }>("/auth/roles").catch(() => ({ data: [] })),
    ]);
    return { users: u.data || [], roles: r.data || [] };
  }, []);
  const [search, setSearch] = useState("");
  const [edit, setEdit] = useState<null | { user?: User }>(null);

  const rows = useMemo(() => {
    const t = search.toLowerCase();
    return (q.data?.users || []).filter(
      (u) => !t || JSON.stringify([u.name, u.username, u.email, u.role_name]).toLowerCase().includes(t),
    );
  }, [q.data, search]);

  if (q.error && !q.data) return <ErrorState message={q.error} onRetry={q.reset} />;

  const remove = async (u: User) => {
    if (u.id === currentAuthUser?.id) {
      toast("You cannot delete your own account.", "error");
      return;
    }
    if (
      !(await confirm({
        title: `Delete ${u.name}?`,
        message: "This account will be permanently removed and cannot sign in.",
        confirmLabel: "Delete",
        danger: true,
      }))
    )
      return;
    try {
      await api.del("/manage/users", { id: u.id });
      toast("User deleted");
      q.reload();
    } catch (e: any) {
      toast(e.message, "error");
    }
  };

  const cols: Column<User>[] = [
    {
      key: "name",
      header: "User",
      primary: true,
      sortValue: (u) => u.name,
      render: (u) => (
        <div className="flex items-center gap-3">
          <span className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent-soft text-[12px] font-bold text-accent">
            {initials(u.name)}
            {u.is_online === "Y" && (
              <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-surface bg-green" />
            )}
          </span>
          <div className="min-w-0">
            <p className="truncate font-semibold">{u.name}</p>
            <p className="max-w-[220px] truncate text-[12px] text-ink-3">{u.username}</p>
          </div>
        </div>
      ),
    },
    {
      key: "role",
      header: "Role",
      render: (u) => (
        <Badge tone={u.role_id === 1 ? "purple" : u.role_id === 2 ? "blue" : "gray"}>{u.role_name}</Badge>
      ),
    },
    {
      key: "menus",
      header: "Permissions",
      render: (u) => {
        const count = (u.menu_permissions || []).length;
        return (
          <span className="text-[13px] font-medium text-ink-2">
            {count} / {ALL_MENU_IDS.length} active
          </span>
        );
      },
    },
    {
      key: "status",
      header: "Status",
      render: (u) => (
        <Badge tone={u.is_active === "Y" ? "green" : "gray"} dot>
          {u.is_active === "Y" ? "Active" : "Disabled"}
        </Badge>
      ),
    },
    {
      key: "created",
      header: "Created",
      hideMobile: true,
      render: (u) => <span className="text-ink-3">{formatDate(u.created_at, false)}</span>,
    },
    {
      key: "act",
      header: "",
      align: "right",
      render: (u) =>
        can(PERMS.USERS) && (
          <div className="flex items-center justify-end gap-1.5" onClick={(e) => e.stopPropagation()}>
            <Button
              size="sm"
              variant="secondary"
              aria-label="Edit user"
              icon={<Pencil size={14} />}
              onClick={() => setEdit({ user: u })}
            >
              Edit
            </Button>
            <Button
              size="sm"
              variant="dangerSoft"
              aria-label="Delete user"
              icon={<Trash2 size={14} />}
              onClick={() => remove(u)}
            />
          </div>
        ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Users & access"
        subtitle="Accounts, roles and granular sub-permissions."
        actions={
          can(PERMS.USERS) && (
            <Button icon={<Plus size={16} />} onClick={() => setEdit({})}>
              Add user
            </Button>
          )
        }
      />
      <SearchInput value={search} onChange={setSearch} placeholder="Search users" className="mb-5 sm:max-w-sm" />
      <DataTable
        columns={cols}
        rows={rows}
        rowKey={(u) => u.id}
        loading={q.loading}
        onRowClick={(u) => setEdit({ user: u })}
        empty={<EmptyState title="No users found" />}
      />
      <UserForm
        state={edit}
        roles={q.data?.roles || []}
        onClose={() => setEdit(null)}
        onSaved={() => {
          setEdit(null);
          q.reload();
        }}
      />
    </div>
  );
}

function UserForm({
  state,
  roles,
  onClose,
  onSaved,
}: {
  state: null | { user?: User };
  roles: { id: number; name: string }[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const { toast } = useFeedback();
  const { can } = usePermissions();
  const [f, setF] = useState({
    name: "",
    username: "",
    email: "",
    mobile_no: "",
    role_id: "3",
    password: "",
    active: true,
  });
  const [checkedIds, setCheckedIds] = useState<Set<number>>(new Set());
  const [permFilter, setPermFilter] = useState("");
  const [tab, setTab] = useState<"profile" | "access">("profile");
  const [busy, setBusy] = useState(false);
  const [key, setKey] = useState<unknown>(null);
  const u = state?.user;

  if (state && key !== state) {
    setKey(state);
    setTab("profile");
    setPermFilter("");
    setF({
      name: u?.name || "",
      username: u?.username || "",
      email: u?.email || "",
      mobile_no: u?.mobile_no || "",
      role_id: String(u?.role_id ?? 3),
      password: "",
      active: u ? u.is_active === "Y" : true,
    });

    const initSet = new Set<number>();
    if (u?.menu_permissions && Array.isArray(u.menu_permissions)) {
      u.menu_permissions.forEach((id) => initSet.add(Number(id)));
    } else if (!u) {
      // Default permissions for new users
      [7, 701, 702].forEach((id) => initSet.add(id));
    }
    setCheckedIds(initSet);
  }

  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const val = e.target.value;
    setF((p) => ({ ...p, [k]: val }));
    if (k === "role_id" && !u) {
      const rid = Number(val);
      if (rid === 1 || rid === 2) {
        setCheckedIds(new Set(ALL_MENU_IDS));
      } else if (rid === 8) {
        setCheckedIds(new Set([1, 101, 7, 701, 9, 901, 10, 1001]));
      } else {
        setCheckedIds(new Set([7, 701, 702]));
      }
    }
  };

  const toggleChild = (parentId: number, childId: number) => {
    setCheckedIds((prev) => {
      const next = new Set(prev);
      if (next.has(childId)) {
        next.delete(childId);
      } else {
        next.add(childId);
        // Automatically check parent node when child is checked
        next.add(parentId);
      }
      return next;
    });
  };

  const toggleParent = (node: MenuItemNode) => {
    setCheckedIds((prev) => {
      const next = new Set(prev);
      const isParentChecked = next.has(node.id);
      const childIds = (node.children || []).map((c) => c.id);

      if (isParentChecked) {
        // Uncheck parent and all children
        next.delete(node.id);
        childIds.forEach((cid) => next.delete(cid));
      } else {
        // Check parent and all children
        next.add(node.id);
        childIds.forEach((cid) => next.add(cid));
      }
      return next;
    });
  };

  const selectAll = () => setCheckedIds(new Set(ALL_MENU_IDS));
  const deselectAll = () => setCheckedIds(new Set());

  const save = async () => {
    if (!f.name.trim() || !f.username.trim()) {
      setTab("profile");
      return toast("Name and username are required.", "error");
    }
    if (!u && can(PERMS.USERS_PASSWORDS) && f.password.length < 6) {
      setTab("profile");
      return toast("Set a password of at least 6 characters.", "error");
    }
    if (f.email && !/^\S+@\S+\.\S+$/.test(f.email)) {
      setTab("profile");
      return toast("Enter a valid email address.", "error");
    }

    const finalIds = Array.from(checkedIds);
    const granularMap: Record<string, { view: number; add: number; edit: number; delete: number; print: number }> = {};
    finalIds.forEach((id) => {
      granularMap[String(id)] = { view: 1, add: 1, edit: 1, delete: 1, print: 1 };
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
        menu_permissions: finalIds,
        granular_permissions: granularMap,
      });

      // If current logged in user's permissions were updated, refresh localStorage
      const cur = auth.user();
      if (cur && (cur.id === u?.id || cur.username === f.username.trim())) {
        auth.save(auth.token(), {
          ...cur,
          name: f.name.trim(),
          permissions: finalIds,
          menu_permissions: finalIds,
          granular_permissions: granularMap,
        });
      }

      toast(u ? "User and permissions updated" : "User created with permissions");
      onSaved();
    } catch (e: any) {
      toast(e.message, "error");
    } finally {
      setBusy(false);
    }
  };

  // Group MENU_TREE by sections
  const sections = useMemo(() => {
    const map = new Map<string, MenuItemNode[]>();
    MENU_TREE.forEach((node) => {
      const sec = node.section || "General";
      map.set(sec, [...(map.get(sec) || []), node]);
    });
    return Array.from(map.entries());
  }, []);

  const filterText = permFilter.toLowerCase().trim();

  return (
    <Modal
      open={!!state}
      onClose={onClose}
      size="lg"
      title={u ? "Edit user & access" : "Add user & access"}
      subtitle={u ? `@${u.username} • Role ID ${u.role_id}` : "Configure profile and permissions"}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button loading={busy} onClick={save}>
            {u ? "Save changes" : "Create user"}
          </Button>
        </>
      }
    >
      <Segmented
        className="mb-5"
        value={tab}
        onChange={setTab}
        options={[
          { value: "profile", label: "Profile" },
          { value: "access", label: `Module access (${checkedIds.size}/${ALL_MENU_IDS.length})` },
        ]}
      />

      {tab === "profile" ? (
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Full name">
            <Input value={f.name} onChange={set("name")} placeholder="Kamlesh Gupta" />
          </Field>
          <Field label="Username">
            <Input value={f.username} onChange={set("username")} autoComplete="off" placeholder="username" />
          </Field>
          <Field label="Email">
            <Input type="email" value={f.email} onChange={set("email")} placeholder="user@company.com" />
          </Field>
          <Field label="Mobile">
            <Input value={f.mobile_no} onChange={set("mobile_no")} placeholder="10-digit number" />
          </Field>
          <Field label="Role">
            <Select value={f.role_id} onChange={set("role_id")}>
              {(roles.length
                ? roles
                : [
                    { id: 1, name: "Admin" },
                    { id: 2, name: "Manager" },
                    { id: 3, name: "Employee" },
                  ]
              ).map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </Select>
          </Field>
          {can(PERMS.USERS_PASSWORDS) ? (
            <Field
              label={u ? "New password" : "Password"}
              hint={u ? "Leave blank to keep existing password" : "Minimum 6 characters"}
            >
              <Input
                type="password"
                autoComplete="new-password"
                value={f.password}
                onChange={set("password")}
                placeholder={u ? "••••••••" : "Create password"}
              />
            </Field>
          ) : !u ? (
            <Field label="Password" hint="Default password will be assigned">
              <Input
                type="password"
                disabled
                value="••••••••••••"
                className="opacity-70 cursor-not-allowed"
              />
            </Field>
          ) : null}
          <div className="flex items-center justify-between rounded-2xl bg-fill px-4 py-3 sm:col-span-2">
            <div>
              <p className="text-[14px] font-medium">Account active</p>
              <p className="text-[12px] text-ink-3">Disabled accounts cannot log in to the dashboard</p>
            </div>
            <Toggle checked={f.active} onChange={(v) => setF((p) => ({ ...p, active: v }))} label="Account active" />
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2">
              <Button size="sm" variant="secondary" onClick={selectAll}>
                Select all
              </Button>
              <Button size="sm" variant="ghost" onClick={deselectAll}>
                Deselect all
              </Button>
              <span className="text-[12px] font-semibold text-ink-2">
                {checkedIds.size} of {ALL_MENU_IDS.length} enabled
              </span>
            </div>
            <div className="sm:w-64">
              <Input
                placeholder="Filter permissions..."
                value={permFilter}
                onChange={(e) => setPermFilter(e.target.value)}
              />
            </div>
          </div>

          <div className="max-h-[500px] overflow-y-auto rounded-2xl border border-line bg-surface p-4">
            <div className="space-y-6">
              {sections.map(([sectionName, nodes]) => {
                const visibleNodes = nodes.filter((n) => {
                  if (!filterText) return true;
                  const matchParent = n.name.toLowerCase().includes(filterText);
                  const matchChild = (n.children || []).some((c) => c.name.toLowerCase().includes(filterText));
                  return matchParent || matchChild;
                });

                if (visibleNodes.length === 0) return null;

                return (
                  <div key={sectionName} className="space-y-3">
                    <p className="text-[11px] font-bold uppercase tracking-wider text-ink-3">• {sectionName}</p>

                    <div className="space-y-4 pl-1">
                      {visibleNodes.map((node) => {
                        const isParentChecked = checkedIds.has(node.id);
                        const hasChildren = node.children && node.children.length > 0;
                        const visibleChildren = (node.children || []).filter(
                          (c) => !filterText || c.name.toLowerCase().includes(filterText) || node.name.toLowerCase().includes(filterText),
                        );

                        return (
                          <div key={node.id} className="rounded-xl border border-line/60 bg-fill/30 p-3">
                            {/* Parent Module Checkbox */}
                            <label className="flex cursor-pointer items-center gap-2.5 font-semibold text-ink select-none">
                              <input
                                type="checkbox"
                                className="h-4 w-4 rounded border-line text-accent accent-accent cursor-pointer"
                                checked={isParentChecked}
                                onChange={() => toggleParent(node)}
                              />
                              <span className="text-[14px]">{node.name}</span>
                              <span className="ml-auto font-mono text-[10px] text-ink-3">#{node.id}</span>
                            </label>

                            {/* Children sub-permissions with hierarchy connector line */}
                            {hasChildren && visibleChildren.length > 0 && (
                              <div className="mt-2.5 space-y-2 border-l-2 border-line/80 pl-4 ml-2">
                                {visibleChildren.map((child) => {
                                  const isChildChecked = checkedIds.has(child.id);
                                  return (
                                    <label
                                      key={child.id}
                                      className="flex cursor-pointer items-center gap-2.5 text-[13px] font-medium text-ink-2 select-none hover:text-ink transition-colors"
                                    >
                                      <input
                                        type="checkbox"
                                        className="h-3.5 w-3.5 rounded border-line text-accent accent-accent cursor-pointer"
                                        checked={isChildChecked}
                                        onChange={() => toggleChild(node.id, child.id)}
                                      />
                                      <span>{child.name}</span>
                                      <span className="ml-auto font-mono text-[10px] text-ink-3">#{child.id}</span>
                                    </label>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </Modal>
  );
}
