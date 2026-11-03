import { useMemo, useState } from "react";
import { Download, Pencil, Plus, Trash2 } from "lucide-react";
import { api, type Allotment, type Vendor } from "../lib/api";
import { useQuery } from "../lib/useQuery";
import { exportCSV, formatDate, initials, money, num } from "../lib/utils";
import {
  Badge,
  Button,
  CopyButton,
  DataTable,
  EmptyState,
  ErrorState,
  Field,
  Input,
  Modal,
  PageHeader,
  SearchInput,
  Segmented,
  StatusBadge,
  type Column,
} from "../components/ui";
import { useFeedback } from "../components/feedback";
import { PERMS, usePermissions } from "../lib/permissions";

interface VRow {
  code: string;
  name: string;
  email?: string;
  phone?: string;
  share: number;
  dbId?: number | string;
  studies: number;
  clicks: number;
  completes: number;
  terminates: number;
  conv: number;
  payout: number;
  avgCpi: number;
  registered: boolean;
}

export function Vendors() {
  const { can } = usePermissions();
  const { toast, confirm } = useFeedback();
  const [tab, setTab] = useState<"partners" | "allot">("partners");
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState<VRow | null>(null);
  const [form, setForm] = useState<null | { vendor?: VRow }>(null);

  const q = useQuery(async () => {
    const [mv, uni, al] = await Promise.all([
      api.get<{ data: Vendor[] }>("/manage/vendors", { limit: 500 }).catch(() => ({ data: [] as Vendor[] })),
      api.get<{ data: { vendors: any[] } }>("/reports/unified").catch(() => ({ data: { vendors: [] as any[] } })),
      api.get<{ data: Allotment[] }>("/vendor/allotments"),
    ]);
    const map = new Map<string, VRow>();
    const blank = (code: string, name: string): VRow => ({ code, name, share: 70, studies: 0, clicks: 0, completes: 0, terminates: 0, conv: 0, payout: 0, avgCpi: 0, registered: false });
    (mv.data || []).forEach((v) => {
      const code = v.vendor_code || v.vendor_id || String(v.id);
      map.set(code, {
        ...blank(code, v.name || v.vendor_name || code),
        email: v.email,
        phone: v.phone,
        share: num(v.cpi_percentage ?? v.rev_share, 70),
        dbId: v.id ?? v._id ?? code,
        registered: true,
      });
    });
    (uni.data?.vendors || []).forEach((v) => {
      const cur = map.get(v.vendor_id) || blank(v.vendor_id, v.vendor_name || v.vendor_id);
      map.set(v.vendor_id, {
        ...cur,
        studies: num(v.assigned_projects),
        clicks: num(v.total_clicks),
        completes: num(v.total_completes),
        terminates: num(v.total_terminates),
        conv: num(v.conversion_rate),
        payout: num(v.total_payout),
        avgCpi: num(v.avg_cpi),
      });
    });
    (al.data || []).forEach((a) => {
      if (!map.has(a.vendor_id)) map.set(a.vendor_id, blank(a.vendor_id, a.vendor_name || a.vendor_id));
    });
    return { vendors: [...map.values()], allotments: al.data || [] };
  }, []);

  const rows = useMemo(() => {
    const t = search.toLowerCase();
    return (q.data?.vendors || []).filter((v) => !t || v.name.toLowerCase().includes(t) || v.code.toLowerCase().includes(t));
  }, [q.data, search]);

  const allots = useMemo(() => {
    const t = search.toLowerCase();
    return (q.data?.allotments || []).filter((a) => !t || a.project_id.toLowerCase().includes(t) || a.vendor_id.toLowerCase().includes(t));
  }, [q.data, search]);

  if (q.error && !q.data) return <ErrorState message={q.error} onRetry={q.reset} />;

  const removeAllot = async (a: Allotment) => {
    if (!(await confirm({ title: "Remove allotment?", message: `${a.vendor_id} will lose access to study ${a.project_id}.`, confirmLabel: "Remove", danger: true }))) return;
    try {
      await api.del("/vendor/allot", { project_id: a.project_id, vendor_id: a.vendor_id });
      toast("Allotment removed");
      q.reload();
    } catch (e: any) {
      toast(e.message, "error");
    }
  };

  const removeVendor = async (v: VRow) => {
    if (!v.dbId) return toast("This vendor only exists through allotments and cannot be deleted.", "info");
    if (!(await confirm({ title: `Delete ${v.name}?`, message: "Their profile is removed. Existing allotments remain.", confirmLabel: "Delete", danger: true }))) return;
    try {
      await api.del(`/manage/vendors/${v.dbId}`);
      toast("Vendor deleted");
      setOpen(null);
      q.reload();
    } catch (e: any) {
      toast(e.message, "error");
    }
  };

  const vCols: Column<VRow>[] = [
    {
      key: "name",
      header: "Partner",
      primary: true,
      sortValue: (v) => v.name,
      render: (v) => (
        <div className="flex items-center gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-purple-soft text-[12px] font-bold text-purple">{initials(v.name)}</span>
          <div className="min-w-0">
            <p className="truncate font-semibold">{v.name}</p>
            <p className="font-mono text-[12px] text-ink-3">{v.code}</p>
          </div>
        </div>
      ),
    },
    { key: "studies", header: "Studies", align: "right", sortValue: (v) => v.studies },
    { key: "clicks", header: "Clicks", align: "right", sortValue: (v) => v.clicks, render: (v) => v.clicks.toLocaleString() },
    { key: "completes", header: "Completes", align: "right", sortValue: (v) => v.completes, render: (v) => <span className="font-semibold">{v.completes.toLocaleString()}</span> },
    { key: "conv", header: "Conv.", align: "right", sortValue: (v) => v.conv, render: (v) => <Badge tone={v.conv >= 50 ? "green" : v.conv >= 20 ? "orange" : "gray"}>{v.conv}%</Badge> },
    { key: "payout", header: "Payout", align: "right", sortValue: (v) => v.payout, render: (v) => money(v.payout) },
    { key: "share", header: "Share", align: "right", render: (v) => `${v.share}%` },
  ];

  const aCols: Column<Allotment>[] = [
    { key: "project_id", header: "Study", primary: true, render: (a) => <span className="font-mono text-[13px] font-semibold">#{a.project_id}</span> },
    { key: "vendor_id", header: "Vendor", render: (a) => <span className="font-mono text-[13px]">{a.vendor_id}</span> },
    { key: "vendor_cpi", header: "Vendor CPI", align: "right", render: (a) => money(a.vendor_cpi) },
    {
      key: "quota",
      header: "Progress",
      render: (a) => {
        const pct = a.quota_limit ? Math.min(100, (num(a.complete_count) / a.quota_limit) * 100) : 0;
        return (
          <div className="min-w-[110px]">
            <div className="mb-1 flex justify-between text-[12px] text-ink-3 tabular">
              <span>{a.complete_count}</span>
              <span>{a.quota_limit}</span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-fill">
              <div className="anim-grow-x h-full rounded-full bg-accent" style={{ width: `${pct}%` }} />
            </div>
          </div>
        );
      },
    },
    { key: "status", header: "Status", render: (a) => <StatusBadge status={a.status} /> },
    { key: "created_at", header: "Created", hideMobile: true, render: (a) => <span className="text-ink-3">{formatDate(a.created_at, false)}</span> },
    {
      key: "act",
      header: "",
      align: "right",
      render: (a) => (
        <div className="flex justify-end gap-1.5">
          <CopyButton text={a.entry_link} label="Link" />
          {can(PERMS.VENDORS_DELETE) && (
            <Button size="sm" variant="dangerSoft" aria-label="Remove allotment" icon={<Trash2 size={14} />} onClick={() => removeAllot(a)} />
          )}
        </div>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Vendors"
        subtitle="Supply partners, their performance and allocated studies."
        actions={
          <>
            <Button
              variant="secondary"
              icon={<Download size={15} />}
              onClick={() =>
                exportCSV(
                  "vendors",
                  ["Code", "Name", "Studies", "Clicks", "Completes", "Conversion %", "Payout", "Share %"],
                  rows.map((v) => [v.code, v.name, v.studies, v.clicks, v.completes, v.conv, v.payout, v.share]),
                )
              }
            >
              Export
            </Button>
            {can(PERMS.VENDORS_CREATE) && (
              <Button icon={<Plus size={16} />} onClick={() => setForm({})}>
                Add vendor
              </Button>
            )}
          </>
        }
      />

      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Segmented
          value={tab}
          onChange={setTab}
          options={[
            { value: "partners", label: "Partners", count: q.data?.vendors.length },
            { value: "allot", label: "Allotments", count: q.data?.allotments.length },
          ]}
        />
        <SearchInput value={search} onChange={setSearch} placeholder={tab === "partners" ? "Search vendors" : "Search study or vendor"} className="sm:w-72" />
      </div>

      {tab === "partners" ? (
        <DataTable
          columns={vCols}
          rows={rows}
          rowKey={(v) => v.code}
          loading={q.loading}
          onRowClick={setOpen}
          empty={<EmptyState title="No vendors yet" message="Add a supply partner, then assign surveys to generate entry links." action={<Button onClick={() => setForm({})}>Add vendor</Button>} />}
        />
      ) : (
        <DataTable columns={aCols} rows={allots} rowKey={(a) => a.id} loading={q.loading} empty={<EmptyState title="No allotments" message="Assign a survey to a vendor from the Surveys page." />} />
      )}

      {/* Vendor drawer */}
      <Modal
        open={!!open}
        onClose={() => setOpen(null)}
        drawer
        title={open?.name}
        subtitle={open?.code}
        footer={
          open && (
            <>
              <Button variant="dangerSoft" icon={<Trash2 size={15} />} onClick={() => removeVendor(open)}>
                Delete
              </Button>
              <Button variant="secondary" icon={<Pencil size={15} />} onClick={() => { setForm({ vendor: open }); setOpen(null); }}>
                Edit
              </Button>
            </>
          )
        }
      >
        {open && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-3">
              {[
                ["Completes", open.completes.toLocaleString()],
                ["Conversion", `${open.conv}%`],
                ["Total payout", money(open.payout)],
                ["Avg. CPI", money(open.avgCpi)],
              ].map(([k, v]) => (
                <div key={k} className="rounded-2xl bg-fill p-4">
                  <p className="text-[12px] font-medium text-ink-3">{k}</p>
                  <p className="mt-0.5 text-[22px] font-bold tracking-tight tabular">{v}</p>
                </div>
              ))}
            </div>
            <section>
              <h3 className="mb-2 text-[15px] font-semibold">Allotted studies</h3>
              {(q.data?.allotments || []).filter((a) => a.vendor_id === open.code).length === 0 ? (
                <p className="rounded-2xl bg-fill px-4 py-3 text-[14px] text-ink-3">No studies allotted yet.</p>
              ) : (
                <ul className="space-y-2">
                  {(q.data?.allotments || [])
                    .filter((a) => a.vendor_id === open.code)
                    .map((a) => (
                      <li key={a.id} className="rounded-2xl border border-line p-3.5">
                        <div className="mb-2 flex items-center justify-between gap-2">
                          <span className="font-mono text-[13px] font-semibold">#{a.project_id}</span>
                          <div className="flex items-center gap-2">
                            <span className="text-[12px] text-ink-3 tabular">
                              {a.complete_count}/{a.quota_limit} · {money(a.vendor_cpi)}
                            </span>
                            <CopyButton text={a.entry_link} />
                          </div>
                        </div>
                        <p className="break-all font-mono text-[11px] text-ink-3">{a.entry_link}</p>
                      </li>
                    ))}
                </ul>
              )}
            </section>
          </div>
        )}
      </Modal>

      <VendorForm state={form} onClose={() => setForm(null)} onSaved={() => { setForm(null); q.reload(); }} />
    </div>
  );
}

function VendorForm({ state, onClose, onSaved }: { state: null | { vendor?: VRow }; onClose: () => void; onSaved: () => void }) {
  const { toast } = useFeedback();
  const [v, setV] = useState({ code: "", name: "", email: "", phone: "", share: "70" });
  const [busy, setBusy] = useState(false);
  const [key, setKey] = useState<unknown>(null);
  if (state && key !== state) {
    setKey(state);
    const x = state.vendor;
    setV({ code: x?.code || "", name: x?.name || "", email: x?.email || "", phone: x?.phone || "", share: String(x?.share ?? 70) });
  }
  const set = (k: keyof typeof v) => (e: React.ChangeEvent<HTMLInputElement>) => setV((p) => ({ ...p, [k]: e.target.value }));

  const save = async () => {
    if (!v.name.trim()) return toast("Vendor name is required.", "error");
    const code = (v.code || "VND-" + v.name.replace(/[^a-z0-9]/gi, "").slice(0, 6).toUpperCase()).trim();
    const share = num(v.share, 70);
    if (share <= 0 || share > 100) return toast("Share must be between 1 and 100.", "error");
    setBusy(true);
    try {
      await api.post("/manage/vendors", {
        vendor_code: code,
        vendor_id: code,
        name: v.name.trim(),
        vendor_name: v.name.trim(),
        email: v.email,
        phone: v.phone,
        cpi_percentage: share,
        status: "Active",
      });
      toast(state?.vendor ? "Vendor updated" : "Vendor added");
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
      title={state?.vendor ? "Edit vendor" : "Add vendor"}
      subtitle="Supply partner profile and default revenue share"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button loading={busy} onClick={save}>
            {state?.vendor ? "Save changes" : "Add vendor"}
          </Button>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Vendor name" className="sm:col-span-2">
          <Input value={v.name} onChange={set("name")} placeholder="Panel company" />
        </Field>
        <Field label="Vendor code" hint="Used in entry links">
          <Input value={v.code} onChange={set("code")} placeholder="VND-ABC-01" disabled={!!state?.vendor} />
        </Field>
        <Field label="Revenue share (%)" hint="Default payout of client CPI">
          <Input type="number" min={1} max={100} value={v.share} onChange={set("share")} />
        </Field>
        <Field label="Email">
          <Input type="email" value={v.email} onChange={set("email")} />
        </Field>
        <Field label="Phone">
          <Input value={v.phone} onChange={set("phone")} />
        </Field>
      </div>
    </Modal>
  );
}
