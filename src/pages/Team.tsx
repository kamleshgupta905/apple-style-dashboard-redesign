import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { api } from "../lib/api";
import { useQuery } from "../lib/useQuery";
import { formatDate, initials, timeAgo } from "../lib/utils";
import { Badge, Button, Card, DataTable, EmptyState, ErrorState, Field, Input, Modal, PageHeader, Segmented, Select, Toggle, type Column } from "../components/ui";
import { useFeedback } from "../components/feedback";

interface Member {
  id: number;
  name: string;
  username: string;
  email?: string;
  mobile_no?: string;
  role_id?: number;
  role_name?: string;
  status?: string;
  is_active?: string;
}
interface Activity {
  id: number;
  user_name: string;
  username: string;
  ip_address: string;
  user_browser: string;
  user_platform: string;
  login_time: string;
}

export function Team() {
  const { toast, confirm } = useFeedback();
  const [tab, setTab] = useState<"dir" | "act">("dir");
  const team = useQuery(async () => (await api.get<{ data: Member[] }>("/team")).data || [], []);
  const act = useQuery(async () => (await api.get<{ data: Activity[] }>("/team/activity")).data || [], []);
  const [open, setOpen] = useState(false);

  if (team.error && !team.data) return <ErrorState message={team.error} onRetry={team.reset} />;

  const active = (m: Member) => (m.status ?? m.is_active) === "Y" || (m.status ?? m.is_active) === "Active";

  const toggle = async (m: Member, on: boolean) => {
    try {
      await api.post("/team/status", { id: m.id, status: on ? "Y" : "N" });
      toast(`${m.name} ${on ? "activated" : "deactivated"}`);
      team.reload();
    } catch (e: any) {
      toast(e.message, "error");
    }
  };
  const remove = async (m: Member) => {
    if (!(await confirm({ title: `Remove ${m.name}?`, confirmLabel: "Remove", danger: true }))) return;
    try {
      await api.del("/team/delete", { id: m.id });
      toast("Member removed");
      team.reload();
    } catch (e: any) {
      toast(e.message, "error");
    }
  };

  const mCols: Column<Member>[] = [
    { key: "name", header: "Member", primary: true, render: (m) => (
        <div className="flex items-center gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent-soft text-[12px] font-bold text-accent">{initials(m.name)}</span>
          <div className="min-w-0">
            <p className="truncate font-semibold">{m.name}</p>
            <p className="truncate text-[12px] text-ink-3">{m.email || m.username}</p>
          </div>
        </div>
      ) },
    { key: "role", header: "Role", render: (m) => <Badge tone={m.role_id === 1 ? "purple" : m.role_id === 2 ? "blue" : "orange"}>{m.role_name === "Employee" ? "Vendor" : (m.role_name || ({ 1: "Admin", 2: "Manager", 3: "Vendor" } as Record<number, string>)[m.role_id || 0] || "Vendor")}</Badge> },
    { key: "mobile_no", header: "Phone", render: (m) => m.mobile_no || "—" },
    { key: "active", header: "Active", render: (m) => <Toggle checked={active(m)} onChange={(v) => toggle(m, v)} label="Active" /> },
    { key: "act", header: "", align: "right", render: (m) => <Button size="sm" variant="dangerSoft" aria-label="Remove member" icon={<Trash2 size={14} />} onClick={() => remove(m)} /> },
  ];
  const aCols: Column<Activity>[] = [
    { key: "user", header: "User", primary: true, render: (a) => <span className="font-semibold">{a.user_name}</span> },
    { key: "time", header: "Signed in", sortValue: (a) => a.login_time, render: (a) => (<div><p>{timeAgo(a.login_time)}</p><p className="text-[12px] text-ink-3">{formatDate(a.login_time)}</p></div>) },
    { key: "ip", header: "IP", render: (a) => <span className="font-mono text-[12.5px]">{a.ip_address}</span> },
    { key: "browser", header: "Browser", render: (a) => (a.user_browser && a.user_browser !== "0" ? a.user_browser : "—") },
    { key: "platform", header: "Platform", render: (a) => (a.user_platform && a.user_platform !== "0" ? a.user_platform : "—") },
  ];

  return (
    <div>
      <PageHeader title="Team" subtitle="Directory of people and their sign-in history." actions={<Button icon={<Plus size={16} />} onClick={() => setOpen(true)}>Add member</Button>} />
      <Segmented className="mb-5" value={tab} onChange={setTab} options={[{ value: "dir", label: "Directory", count: team.data?.length }, { value: "act", label: "Login activity", count: act.data?.length }]} />
      {tab === "dir" ? (
        <DataTable columns={mCols} rows={team.data || []} rowKey={(m) => m.id} loading={team.loading} empty={<EmptyState title="No team members yet" message="Add the people who work in this console." action={<Button onClick={() => setOpen(true)}>Add member</Button>} />} />
      ) : (
        <Card className="overflow-hidden">
          <DataTable columns={aCols} rows={act.data || []} rowKey={(a) => a.id} loading={act.loading} empty={<EmptyState title="No activity" />} />
        </Card>
      )}
      <MemberForm open={open} onClose={() => setOpen(false)} onSaved={() => { setOpen(false); team.reload(); }} />
    </div>
  );
}

function MemberForm({ open, onClose, onSaved }: { open: boolean; onClose: () => void; onSaved: () => void }) {
  const { toast } = useFeedback();
  const [f, setF] = useState({ name: "", username: "", email: "", mobile_no: "", role_id: "2" });
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setF((p) => ({ ...p, [k]: e.target.value }));
  const save = async () => {
    if (!f.name.trim() || !f.email.trim()) return toast("Name and email are required.", "error");
    if (!/^\S+@\S+\.\S+$/.test(f.email)) return toast("Enter a valid email address.", "error");
    setBusy(true);
    try {
      await api.post("/team", { ...f, username: f.username || f.name.toLowerCase().replace(/[^a-z0-9]/g, ""), role_id: Number(f.role_id), status: "Y" });
      toast("Member added");
      setF({ name: "", username: "", email: "", mobile_no: "", role_id: "2" });
      onSaved();
    } catch (e: any) {
      toast(e.message, "error");
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal open={open} onClose={onClose} title="Add team member" footer={<><Button variant="ghost" onClick={onClose}>Cancel</Button><Button loading={busy} onClick={save}>Add member</Button></>}>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Full name" className="sm:col-span-2"><Input value={f.name} onChange={set("name")} /></Field>
        <Field label="Email"><Input type="email" value={f.email} onChange={set("email")} /></Field>
        <Field label="Phone"><Input value={f.mobile_no} onChange={set("mobile_no")} /></Field>
        <Field label="Username" hint="Defaults to the name"><Input value={f.username} onChange={set("username")} /></Field>
        <Field label="Role">
          <Select value={f.role_id} onChange={set("role_id")}>
            <option value="1">Admin</option>
            <option value="2">Manager</option>
            <option value="3">Vendor</option>
          </Select>
        </Field>
      </div>
    </Modal>
  );
}
