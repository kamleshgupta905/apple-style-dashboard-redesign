import { useMemo, useState, useEffect } from "react";
import { Download, Pencil, Plus, Share2, Trash2, Users } from "lucide-react";
import { api, type Allotment, type Vendor, type Project } from "../lib/api";
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
  Select,
  StatusBadge,
  type Column,
} from "../components/ui";
import { useFeedback } from "../components/feedback";
import { EditAllotmentModal } from "../components/EditAllotmentModal";
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

const DUMMY_CODES = new Set<string>();

export function Vendors() {
  const { can } = usePermissions();
  const { toast, confirm } = useFeedback();
  const [tab, setTab] = useState<"partners" | "allot">("partners");
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState<VRow | null>(null);
  const [form, setForm] = useState<null | { vendor?: VRow }>(null);
  const [editAllot, setEditAllot] = useState<Allotment | null>(null);
  const [assignVendor, setAssignVendor] = useState<VRow | null>(null);

  const q = useQuery(async () => {
    const [mv, uni, al] = await Promise.all([
      api.get<{ data: Vendor[] }>("/manage/vendors", { limit: 500 }).catch(() => ({ data: [] as Vendor[] })),
      api.get<{ data: { vendors: any[] } }>("/reports/unified").catch(() => ({ data: { vendors: [] as any[] } })),
      api.get<{ data: Allotment[] }>("/vendor/allotments"),
    ]);
    const map = new Map<string, VRow>();
    const blank = (code: string, name: string): VRow => ({ code, name, share: 70, studies: 0, clicks: 0, completes: 0, terminates: 0, conv: 0, payout: 0, avgCpi: 0, registered: false });
    
    // Clean allotments: remove dummy vendor allotments
    const realAllotments = (al.data || []).filter(
      (a) => !DUMMY_CODES.has(a.vendor_id)
    );

    (mv.data || []).forEach((v) => {
      const code = v.vendor_code || v.vendor_id || String(v.id);
      if (code && !DUMMY_CODES.has(code)) {
        map.set(code, {
          ...blank(code, v.name || v.vendor_name || code),
          email: v.email,
          phone: v.phone,
          share: num(v.cpi_percentage ?? v.rev_share, 70),
          dbId: v.id ?? v._id ?? code,
          registered: true,
        });
      }
    });

    (uni.data?.vendors || []).forEach((v) => {
      if (v.vendor_id && !DUMMY_CODES.has(v.vendor_id)) {
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
      }
    });

    realAllotments.forEach((a) => {
      if (!map.has(a.vendor_id)) {
        map.set(a.vendor_id, blank(a.vendor_id, a.vendor_name || a.vendor_id));
      }
      const item = map.get(a.vendor_id);
      if (item && item.studies === 0) {
        item.studies = realAllotments.filter((x) => x.vendor_id === a.vendor_id).length;
      }
    });

    return { vendors: [...map.values()], allotments: realAllotments };
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
    if (!(await confirm({ title: `Delete ${v.name}?`, message: `Supply partner ${v.name} (${v.code}) will be deleted.`, confirmLabel: "Delete", danger: true }))) return;
    try {
      await api.del(`/manage/vendors/${v.dbId || v.code}`);
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
    {
      key: "actions",
      header: "",
      align: "right",
      render: (v) => (
        <div className="flex items-center justify-end gap-1.5" onClick={(e) => e.stopPropagation()}>
          <Button
            size="sm"
            variant="tinted"
            icon={<Share2 size={13} />}
            onClick={() => setAssignVendor(v)}
            title="Assign study to partner"
          >
            Assign
          </Button>
          <button
            type="button"
            title="Edit partner"
            onClick={() => setForm({ vendor: v })}
            className="flex h-7 w-7 items-center justify-center rounded-lg text-ink-3 hover:bg-fill hover:text-ink transition cursor-pointer"
          >
            <Pencil size={13} />
          </button>
          <button
            type="button"
            title="Delete partner"
            onClick={() => removeVendor(v)}
            className="flex h-7 w-7 items-center justify-center rounded-lg text-ink-3 hover:bg-red-soft hover:text-red transition cursor-pointer"
          >
            <Trash2 size={13} />
          </button>
        </div>
      ),
    },
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
          <Button
            size="sm"
            variant="secondary"
            aria-label="Edit allotment"
            title="Edit allotment"
            icon={<Pencil size={13} />}
            onClick={() => setEditAllot(a)}
          />
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
              {can(PERMS.VENDORS_DELETE) && (
                <Button variant="dangerSoft" icon={<Trash2 size={15} />} onClick={() => removeVendor(open)}>
                  Delete
                </Button>
              )}
              {can(PERMS.VENDORS_CREATE) && (
                <Button variant="secondary" icon={<Pencil size={15} />} onClick={() => { setForm({ vendor: open }); setOpen(null); }}>
                  Edit
                </Button>
              )}
              <Button
                variant="primary"
                icon={<Share2 size={15} />}
                onClick={() => {
                  setAssignVendor(open);
                  setOpen(null);
                }}
              >
                Assign study
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

      <VendorForm
        state={form}
        existingVendors={q.data?.vendors || []}
        onClose={() => setForm(null)}
        onSaved={() => {
          setForm(null);
          q.reload();
        }}
      />

      <EditAllotmentModal
        allotment={editAllot}
        onClose={() => setEditAllot(null)}
        onSaved={q.reload}
      />

      <AssignStudyToVendorModal
        vendor={assignVendor}
        onClose={() => setAssignVendor(null)}
        onSaved={q.reload}
      />
    </div>
  );
}

function AssignStudyToVendorModal({
  vendor,
  onClose,
  onSaved,
}: {
  vendor: VRow | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { toast } = useFeedback();
  const studiesQuery = useQuery(async () => {
    const res = await api.get<{ data: Project[] }>("/manage/projects");
    return res.data || [];
  }, []);

  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [sharePct, setSharePct] = useState("70");
  const [quota, setQuota] = useState("100");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (vendor) {
      setSharePct(String(vendor.share || 70));
      setQuota("100");
      setSelectedProjectId("");
    }
  }, [vendor]);

  if (!vendor) return null;

  const studies = studiesQuery.data || [];
  const selectedStudy = studies.find(
    (p) => String(p.project_id) === selectedProjectId || String(p.id) === selectedProjectId
  );
  const clientCpi = selectedStudy ? num(selectedStudy.cpi) : 0;
  const vendorCpi = Number(((clientCpi * num(sharePct, 70)) / 100).toFixed(2));
  const margin = Number((clientCpi - vendorCpi).toFixed(2));

  const save = async () => {
    if (!selectedProjectId) return toast("Select a study to assign.", "error");
    if (num(quota) <= 0) return toast("Quota must be greater than zero.", "error");
    const pId = selectedStudy?.project_id || selectedProjectId;

    setBusy(true);
    try {
      const res = await api.post<any>("/vendor/allot", {
        project_id: pId,
        vendor_id: vendor.code,
        vendor_name: vendor.name,
        vendor_cpi: vendorCpi,
        quota_limit: num(quota),
        status: "Active",
      });
      const link =
        res?.entry_link ||
        `https://api.vmhgroupsmr.com/vendor/auth/${encodeURIComponent(vendor.code)}/project/${encodeURIComponent(pId)}?uid=[RESPONDENT_ID]`;
      navigator.clipboard?.writeText?.(link);
      toast(`Assigned ${vendor.name} to study #${pId}! Link copied to clipboard.`);
      onSaved();
      onClose();
    } catch (e: any) {
      toast(e.message, "error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open={!!vendor}
      onClose={onClose}
      title="Assign study to supply partner"
      subtitle={`Partner: ${vendor.name} (${vendor.code})`}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button loading={busy} onClick={save} disabled={!selectedProjectId}>
            Assign & Generate link
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Choose study to allocate">
          <Select value={selectedProjectId} onChange={(e) => setSelectedProjectId(e.target.value)}>
            <option value="">Select an active study</option>
            {studies.map((p) => (
              <option key={p.id || p.project_id} value={p.project_id}>
                #{p.project_id} · {p.project_name} ({money(p.cpi)} CPI)
              </option>
            ))}
          </Select>
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Partner share (%)">
            <Input
              type="number"
              min="1"
              max="100"
              value={sharePct}
              onChange={(e) => setSharePct(e.target.value)}
            />
          </Field>
          <Field label="Quota limit (completes)">
            <Input
              type="number"
              min="1"
              value={quota}
              onChange={(e) => setQuota(e.target.value)}
            />
          </Field>
        </div>

        {selectedStudy && (
          <div className="rounded-2xl bg-fill p-4 space-y-1.5 text-xs">
            <div className="flex justify-between text-ink-3">
              <span>Client CPI</span>
              <span className="font-semibold text-ink">{money(clientCpi)}</span>
            </div>
            <div className="flex justify-between text-ink-3">
              <span>Vendor CPI ({sharePct}%)</span>
              <span className="font-semibold text-accent">{money(vendorCpi)}</span>
            </div>
            <div className="flex justify-between text-ink-3 pt-1 border-t border-line">
              <span>Platform Margin</span>
              <span className="font-semibold text-green">{money(margin)}</span>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}

function getNextVendorCode(vendors: VRow[]): string {
  let maxSeq = 0;
  vendors.forEach((x) => {
    const code = x.code || "";
    const m = code.match(/(?:VND|VI)[-_]?(\d+)/i) || code.match(/(\d+)/);
    if (m && m[1]) {
      const num = parseInt(m[1], 10);
      if (!isNaN(num) && num > maxSeq) {
        maxSeq = num;
      }
    }
  });
  return `VND${String(maxSeq + 1).padStart(3, "0")}`;
}

function VendorForm({
  state,
  existingVendors = [],
  onClose,
  onSaved,
}: {
  state: null | { vendor?: VRow };
  existingVendors?: VRow[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const { toast } = useFeedback();
  const [v, setV] = useState({ code: "", name: "", email: "", phone: "", share: "70" });
  const [busy, setBusy] = useState(false);
  const [key, setKey] = useState<unknown>(null);

  if (state && key !== state) {
    setKey(state);
    const x = state.vendor;
    const defaultCode = x?.code || getNextVendorCode(existingVendors);
    setV({
      code: defaultCode,
      name: x?.name || "",
      email: x?.email || "",
      phone: x?.phone || "",
      share: String(x?.share ?? 70),
    });
  }

  const set = (k: keyof typeof v) => (e: React.ChangeEvent<HTMLInputElement>) => setV((p) => ({ ...p, [k]: e.target.value }));

  const save = async () => {
    if (!v.name.trim()) return toast("Vendor name is required.", "error");
    const code = (v.code || getNextVendorCode(existingVendors)).trim();
    const share = num(v.share, 70);
    if (share <= 0 || share > 100) return toast("Share must be between 1 and 100.", "error");
    setBusy(true);
    try {
      await api.post("/manage/vendors", {
        id: state?.vendor?.dbId,
        vendor_code: code,
        vendor_id: code,
        name: v.name.trim(),
        vendor_name: v.name.trim(),
        email: v.email,
        phone: v.phone,
        cpi_percentage: share,
        rev_share: share,
        status: "Active",
      });
      toast(state?.vendor ? "Vendor updated" : `Vendor added (${code})`);
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
      subtitle={
        state?.vendor
          ? `Editing supply partner ${state.vendor.name}`
          : "Supply partner profile with auto-generated sequential vendor code"
      }
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
          <Input value={v.name} onChange={set("name")} placeholder="e.g. Acme Research Panel" />
        </Field>
        <Field
          label="Vendor code"
          hint={!state?.vendor ? "Auto-generated sequential code (editable)" : "Unique partner tracking code"}
        >
          <div className="relative">
            <Input
              value={v.code}
              onChange={set("code")}
              placeholder="e.g. VND001"
              disabled={!!state?.vendor}
              className="font-mono pr-28"
            />
            {!state?.vendor && (
              <span className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-md bg-accent-soft px-2 py-0.5 text-[11px] font-medium text-accent">
                Auto Sequence
              </span>
            )}
          </div>
        </Field>
        <Field label="Revenue share (%)" hint="Default payout percentage of client CPI">
          <Input type="number" min={1} max={100} value={v.share} onChange={set("share")} />
        </Field>
        <Field label="Email">
          <Input type="email" value={v.email} onChange={set("email")} placeholder="partner@domain.com" />
        </Field>
        <Field label="Phone">
          <Input value={v.phone} onChange={set("phone")} placeholder="+1 555-0100" />
        </Field>
      </div>
    </Modal>
  );
}
