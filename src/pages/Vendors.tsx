import { useMemo, useState, useEffect } from "react";
import {
  Ban,
  Cable,
  Check,
  ChevronDown,
  Download,
  Globe,
  Link2,
  Pencil,
  Plus,
  Search,
  Share2,
  Trash2,
  UserPlus,
  Users,
  X,
} from "lucide-react";
import { api, type Allotment, type Vendor, type Project } from "../lib/api";
import { useQuery } from "../lib/useQuery";
import { exportCSV, formatDate, initials, money, num } from "../lib/utils";
import { cn } from "../utils/cn";
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
import { VendorIntegrationModal } from "../components/VendorIntegrationModal";
import { PERMS, usePermissions } from "../lib/permissions";
import { useRealtime } from "../lib/useRealtime";
import { DEFAULT_COUNTRIES } from "../lib/data";

export { DEFAULT_COUNTRIES };

interface VRow {
  code: string;
  name: string;
  email?: string;
  phone?: string;
  share: number;
  commission_type?: string;
  cpi?: number | string;
  status?: string;
  countries?: string[];
  blocked_clients?: (string | number)[];
  contacts?: Array<{ name: string; email: string; phone?: string; role?: string }>;
  redirect_complete?: string;
  redirect_terminate?: string;
  redirect_overquota?: string;
  redirect_security?: string;
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
  const [integrationVendor, setIntegrationVendor] = useState<VRow | null>(null);

  // Live Supabase Realtime for Vendors & Allotments
  useRealtime(["smr_vendors", "smr_vendor_allotments"], () => q.reload());

  const q = useQuery(async () => {
    const [mv, uni, al, cl] = await Promise.all([
      api.get<{ data: Vendor[] }>("/manage/vendors", { limit: 500 }).catch(() => ({ data: [] as Vendor[] })),
      api.get<{ data: { vendors: any[] } }>("/reports/unified").catch(() => ({ data: { vendors: [] as any[] } })),
      api.get<{ data: Allotment[] }>("/vendor/allotments"),
      api.get<{ data: any[] }>("/clients").catch(() => ({ data: [] as any[] })),
    ]);
    const map = new Map<string, VRow>();
    const blank = (code: string, name: string): VRow => ({
      code,
      name,
      share: 70,
      commission_type: "fixed_cpi",
      cpi: "1.50",
      status: "Active",
      countries: [],
      blocked_clients: [],
      contacts: [],
      studies: 0,
      clicks: 0,
      completes: 0,
      terminates: 0,
      conv: 0,
      payout: 0,
      avgCpi: 0,
      registered: false,
    });
    
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
          commission_type: v.commission_type || "revenue_share",
          cpi: v.cpi !== undefined && v.cpi !== null ? v.cpi : "1.50",
          status: v.status || "Active",
          countries: Array.isArray(v.countries) ? v.countries : [],
          blocked_clients: Array.isArray(v.blocked_clients) ? v.blocked_clients : [],
          contacts: Array.isArray(v.contacts) ? v.contacts : [],
          redirect_complete: v.callback_complete || v.redirect_complete || "",
          redirect_terminate: v.callback_terminate || v.redirect_terminate || "",
          redirect_overquota: v.callback_overquota || v.redirect_overquota || "",
          redirect_security: v.callback_security || v.redirect_security || "",
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

    return {
      vendors: [...map.values()],
      allotments: realAllotments,
      clients: (cl as any)?.data || [],
    };
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
            variant="secondary"
            icon={<Cable size={13} />}
            onClick={() => setIntegrationVendor(v)}
            title="Partner Integration & Universal Router Link"
          >
            Integrate
          </Button>
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
                variant="secondary"
                icon={<Cable size={15} />}
                onClick={() => {
                  setIntegrationVendor(open);
                  setOpen(null);
                }}
              >
                Integration
              </Button>
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
        clients={q.data?.clients || []}
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

      <VendorIntegrationModal
        vendor={integrationVendor}
        onClose={() => setIntegrationVendor(null)}
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
  clients = [],
  onClose,
  onSaved,
}: {
  state: null | { vendor?: VRow };
  existingVendors?: VRow[];
  clients?: any[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const { toast } = useFeedback();
  const [tab, setTab] = useState<"general" | "countries" | "restrictions">("general");
  const [showRedirects, setShowRedirects] = useState(false);
  const [countryFilter, setCountryFilter] = useState("");
  const [contactDraft, setContactDraft] = useState({ name: "", email: "", phone: "", role: "Account Manager" });
  const [manualCode, setManualCode] = useState(false);

  const [v, setV] = useState({
    code: "",
    name: "",
    email: "",
    phone: "",
    commission_type: "fixed_cpi" as "fixed_cpi" | "revenue_share",
    cpi: "1.50",
    share: "70",
    status: "Active" as "Active" | "Inactive",
    redirect_complete: "",
    redirect_terminate: "",
    redirect_overquota: "",
    redirect_security: "",
    countries: [] as string[],
    blocked_clients: [] as (string | number)[],
    contacts: [] as Array<{ name: string; email: string; phone?: string; role?: string }>,
  });
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!state) return;
    setTab("general");
    setShowRedirects(false);
    setCountryFilter("");
    const x = state.vendor;
    if (x) {
      setManualCode(true);
      setV({
        code: x.code || "",
        name: x.name || "",
        email: x.email || "",
        phone: x.phone || "",
        commission_type:
          x.commission_type === "fixed_cpi" || x.commission_type === "flat_rate"
            ? "fixed_cpi"
            : "revenue_share",
        cpi: String(x.cpi ?? "1.50"),
        share: String(x.share ?? "70"),
        status:
          x.status === "Inactive" || x.status === "inactive" || x.status === "N"
            ? "Inactive"
            : "Active",
        redirect_complete: x.redirect_complete || "",
        redirect_terminate: x.redirect_terminate || "",
        redirect_overquota: x.redirect_overquota || "",
        redirect_security: x.redirect_security || "",
        countries: Array.isArray(x.countries) ? [...x.countries] : [],
        blocked_clients: Array.isArray(x.blocked_clients) ? [...x.blocked_clients] : [],
        contacts: Array.isArray(x.contacts) ? [...x.contacts] : [],
      });
    } else {
      setManualCode(false);
      setV({
        code: getNextVendorCode(existingVendors),
        name: "",
        email: "",
        phone: "",
        commission_type: "fixed_cpi",
        cpi: "1.50",
        share: "70",
        status: "Active",
        redirect_complete: "",
        redirect_terminate: "",
        redirect_overquota: "",
        redirect_security: "",
        countries: [],
        blocked_clients: [],
        contacts: [],
      });
    }
  }, [state, existingVendors]);

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const name = e.target.value;
    setV((prev) => ({ ...prev, name }));
  };

  const handleCodeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setManualCode(true);
    setV((prev) => ({
      ...prev,
      code: e.target.value.toUpperCase().replace(/\s+/g, "-"),
    }));
  };

  const filteredCountries = useMemo(() => {
    if (!countryFilter.trim()) return DEFAULT_COUNTRIES;
    const q = countryFilter.toLowerCase().trim();
    return DEFAULT_COUNTRIES.filter(
      (c) => c.name.toLowerCase().includes(q) || c.code.toLowerCase().includes(q)
    );
  }, [countryFilter]);

  const save = async () => {
    if (!v.name.trim()) return toast("Vendor name is required.", "error");
    const code = (v.code.trim() || getNextVendorCode(existingVendors)).trim();
    if (!code) return toast("Vendor ID is required.", "error");

    const share = num(v.share, 70);
    const cpiVal = parseFloat(v.cpi) || 0;
    if (v.commission_type === "revenue_share" && (share <= 0 || share > 100)) {
      return toast("Revenue share must be between 1 and 100%.", "error");
    }

    setBusy(true);
    try {
      await api.post("/manage/vendors", {
        id: state?.vendor?.dbId,
        vendor_code: code,
        vendor_id: code,
        name: v.name.trim(),
        vendor_name: v.name.trim(),
        email: v.email.trim(),
        phone: v.phone.trim(),
        commission_type: v.commission_type,
        cpi: v.commission_type === "fixed_cpi" ? cpiVal : 0,
        cpi_percentage: v.commission_type === "revenue_share" ? share : 0,
        rev_share: v.commission_type === "revenue_share" ? share : 0,
        status: v.status,
        redirect_complete: v.redirect_complete,
        redirect_terminate: v.redirect_terminate,
        redirect_overquota: v.redirect_overquota,
        redirect_security: v.redirect_security,
        callback_complete: v.redirect_complete,
        callback_terminate: v.redirect_terminate,
        callback_overquota: v.redirect_overquota,
        callback_security: v.redirect_security,
        countries: v.countries,
        blocked_clients: v.blocked_clients,
        contacts: v.contacts,
      });
      toast(state?.vendor ? "Vendor panel updated" : `Vendor panel added (${code})`);
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
      title={state?.vendor ? "Edit Supply Vendor Panel" : "Add Supply Vendor Panel"}
      subtitle="Configure supplier profile, entry routes, and 4 callback redirects."
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button loading={busy} onClick={save} icon={state?.vendor ? undefined : <Plus size={16} />}>
            {state?.vendor ? "Save Vendor Panel" : "Create Vendor"}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {/* 3-Tab Navigation Bar */}
        <div className="flex border-b border-line -mt-2 -mx-6 px-6 gap-2 bg-fill/40">
          <button
            type="button"
            onClick={() => setTab("general")}
            className={cn(
              "flex items-center gap-2 py-3 px-2 text-[12.5px] font-bold transition border-b-2 cursor-pointer",
              tab === "general"
                ? "border-ink text-ink dark:border-accent dark:text-accent"
                : "border-transparent text-ink-3 hover:text-ink"
            )}
          >
            <Link2 size={14} />
            <span>1. General Profile &amp; Redirects</span>
          </button>
          <button
            type="button"
            onClick={() => setTab("countries")}
            className={cn(
              "flex items-center gap-2 py-3 px-2 text-[12.5px] font-bold transition border-b-2 cursor-pointer",
              tab === "countries"
                ? "border-ink text-ink dark:border-accent dark:text-accent"
                : "border-transparent text-ink-3 hover:text-ink"
            )}
          >
            <Globe size={14} />
            <span>2. Operating Countries</span>
            <span
              className={cn(
                "rounded-full px-2 py-0.5 text-[10px] font-extrabold",
                v.countries.length > 0
                  ? "bg-emerald-500 text-white"
                  : "bg-fill text-ink-3 border border-line"
              )}
            >
              {v.countries.length} / 48
            </span>
          </button>
          <button
            type="button"
            onClick={() => setTab("restrictions")}
            className={cn(
              "flex items-center gap-2 py-3 px-2 text-[12.5px] font-bold transition border-b-2 cursor-pointer",
              tab === "restrictions"
                ? "border-ink text-ink dark:border-accent dark:text-accent"
                : "border-transparent text-ink-3 hover:text-ink"
            )}
          >
            <Ban size={14} />
            <span>3. Blocked Clients &amp; Contacts</span>
            {v.blocked_clients.length + v.contacts.length > 0 && (
              <span className="rounded-full bg-ink px-2 py-0.5 text-[10px] font-extrabold text-surface">
                {v.blocked_clients.length + v.contacts.length}
              </span>
            )}
          </button>
        </div>

        {/* Tab 1: General Profile & Redirects */}
        {tab === "general" && (
          <div className="space-y-4 pt-1">
            <Field label="Vendor / Panel Name *">
              <Input
                required
                value={v.name}
                onChange={handleNameChange}
                placeholder="e.g. Dynata Panel, PureSpectrum, Lucid"
              />
            </Field>

            <Field
              label="Vendor ID / Code (Auto-generated)"
              hint={!state?.vendor ? "Automatically assigned sequential ID for traffic routing and entry links" : undefined}
            >
              <div className="flex items-center gap-2">
                <Input
                  required
                  value={v.code}
                  readOnly={!state?.vendor && !manualCode}
                  onChange={handleCodeChange}
                  placeholder="VND001"
                  className="font-mono font-semibold"
                />
                {!state?.vendor && (
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    onClick={() => {
                      if (!manualCode) {
                        setManualCode(true);
                      } else {
                        setManualCode(false);
                        setV((p) => ({ ...p, code: getNextVendorCode(existingVendors) }));
                      }
                    }}
                  >
                    {manualCode ? "Auto ID" : "Edit"}
                  </Button>
                )}
              </div>
            </Field>

            <Field label="Contact Email">
              <Input
                type="email"
                value={v.email}
                onChange={(e) => setV((p) => ({ ...p, email: e.target.value }))}
                placeholder="partners@supplier.com"
              />
            </Field>

            <div>
              <label className="block text-[13px] font-semibold text-ink mb-1.5">
                Payout Model / Commission Type
              </label>
              <div className="grid grid-cols-2 gap-2 p-1 rounded-xl bg-fill border border-line">
                <button
                  type="button"
                  onClick={() => setV((p) => ({ ...p, commission_type: "fixed_cpi" }))}
                  className={cn(
                    "py-2 text-[13px] font-semibold rounded-lg transition text-center cursor-pointer",
                    v.commission_type === "fixed_cpi"
                      ? "bg-surface shadow-sm text-ink border border-line font-bold"
                      : "text-ink-3 hover:text-ink"
                  )}
                >
                  $ Fixed CPI ($)
                </button>
                <button
                  type="button"
                  onClick={() => setV((p) => ({ ...p, commission_type: "revenue_share" }))}
                  className={cn(
                    "py-2 text-[13px] font-semibold rounded-lg transition text-center cursor-pointer",
                    v.commission_type === "revenue_share"
                      ? "bg-surface shadow-sm text-ink border border-line font-bold"
                      : "text-ink-3 hover:text-ink"
                  )}
                >
                  % Revenue Share (%)
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {v.commission_type === "fixed_cpi" ? (
                <Field label="Default CPI Payout ($)" hint="Fixed agreed payout per complete">
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 font-bold text-ink-3">$</span>
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      className="pl-7 font-semibold"
                      value={v.cpi}
                      onChange={(e) => setV((p) => ({ ...p, cpi: e.target.value }))}
                      placeholder="1.50"
                    />
                  </div>
                </Field>
              ) : (
                <Field label="Revenue Share (%)" hint="% of client revenue paid to vendor">
                  <div className="relative">
                    <Input
                      type="number"
                      min="1"
                      max="100"
                      className="pr-8 font-semibold"
                      value={v.share}
                      onChange={(e) => setV((p) => ({ ...p, share: e.target.value }))}
                      placeholder="70"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 font-bold text-emerald-600">%</span>
                  </div>
                </Field>
              )}

              <Field label="Status">
                <Select
                  value={v.status}
                  onChange={(e) => setV((p) => ({ ...p, status: e.target.value as any }))}
                >
                  <option value="Active">Active</option>
                  <option value="Inactive">Inactive</option>
                </Select>
              </Field>
            </div>

            {/* Collapsible 4 Callback Redirects */}
            <div className="border-t border-line/60 pt-3">
              <button
                type="button"
                onClick={() => setShowRedirects(!showRedirects)}
                className="flex items-center gap-1.5 text-[12.5px] font-semibold text-accent hover:underline cursor-pointer"
              >
                <Link2 size={14} />
                <span>
                  {showRedirects
                    ? "Hide 4 Callback Redirects"
                    : "Configure 4 Callback Redirects Now (Optional - Defaults Provided)"}
                </span>
              </button>

              {showRedirects && (
                <div className="mt-3 space-y-3 rounded-2xl border border-line bg-fill/40 p-4">
                  <p className="text-[12px] text-ink-3">
                    Use <code className="rounded bg-surface px-1.5 py-0.5 font-mono text-[11px] font-bold text-ink">[UID]</code> as respondent identifier placeholder.
                  </p>

                  <Field label="Complete Callback URL">
                    <Input
                      value={v.redirect_complete}
                      onChange={(e) => setV((p) => ({ ...p, redirect_complete: e.target.value }))}
                      placeholder={`https://${v.code || "partner"}.com/survey/complete?uid=[UID]`}
                      className="font-mono text-[12px]"
                    />
                  </Field>

                  <Field label="Terminate Callback URL">
                    <Input
                      value={v.redirect_terminate}
                      onChange={(e) => setV((p) => ({ ...p, redirect_terminate: e.target.value }))}
                      placeholder={`https://${v.code || "partner"}.com/survey/terminate?uid=[UID]`}
                      className="font-mono text-[12px]"
                    />
                  </Field>

                  <Field label="OverQuota Callback URL">
                    <Input
                      value={v.redirect_overquota}
                      onChange={(e) => setV((p) => ({ ...p, redirect_overquota: e.target.value }))}
                      placeholder={`https://${v.code || "partner"}.com/survey/overquota?uid=[UID]`}
                      className="font-mono text-[12px]"
                    />
                  </Field>

                  <Field label="Security Screenout Callback URL">
                    <Input
                      value={v.redirect_security}
                      onChange={(e) => setV((p) => ({ ...p, redirect_security: e.target.value }))}
                      placeholder={`https://${v.code || "partner"}.com/survey/security?uid=[UID]`}
                      className="font-mono text-[12px]"
                    />
                  </Field>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Tab 2: Operating Countries */}
        {tab === "countries" && (
          <div className="space-y-3 pt-1">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <span className="flex items-center gap-1.5 text-[13px] font-bold text-ink">
                  <Globe size={15} /> Operating Countries &amp; Geographies
                </span>
                <span className="text-[11.5px] text-ink-3">
                  Select respondent markets where this supplier can route survey traffic.
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => setV((p) => ({ ...p, countries: DEFAULT_COUNTRIES.map((c) => c.code) }))}
                  className="text-[11px] h-7 px-2.5"
                >
                  Select All (48)
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => setV((p) => ({ ...p, countries: ["US", "GB", "CA", "AU", "DE", "FR"] }))}
                  className="text-[11px] h-7 px-2.5"
                >
                  Tier 1
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setV((p) => ({ ...p, countries: [] }))}
                  className="text-[11px] h-7 px-2.5 text-red hover:text-red hover:bg-red-soft"
                >
                  Clear All
                </Button>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="relative flex-1">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-3" />
                <input
                  type="text"
                  value={countryFilter}
                  onChange={(e) => setCountryFilter(e.target.value)}
                  placeholder="Search country by name or code (e.g. India, US, Germany)..."
                  className="w-full h-9 rounded-xl border border-line bg-surface pl-9 pr-3 text-[12px] text-ink focus:outline-none focus:border-accent"
                />
              </div>
              <span className="rounded-full bg-emerald-500/10 px-2.5 py-1 text-[11px] font-bold text-emerald-600 dark:text-emerald-400 whitespace-nowrap">
                {v.countries.length} / 48 Markets Selected
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 max-h-[300px] overflow-y-auto p-1.5 rounded-2xl border border-line bg-fill/30">
              {filteredCountries.map((c) => {
                const isSel = v.countries.includes(c.code);
                return (
                  <div
                    key={c.code}
                    onClick={() => {
                      setV((p) => ({
                        ...p,
                        countries: isSel
                          ? p.countries.filter((x) => x !== c.code)
                          : [...p.countries, c.code],
                      }));
                    }}
                    className={cn(
                      "flex items-center gap-2 p-2 rounded-xl border cursor-pointer select-none transition text-[12px]",
                      isSel
                        ? "border-accent bg-accent-soft/30 text-ink font-semibold"
                        : "border-line/70 bg-surface text-ink-2 hover:border-line hover:bg-fill"
                    )}
                  >
                    <input
                      type="checkbox"
                      checked={isSel}
                      readOnly
                      className="cursor-pointer rounded accent-accent h-3.5 w-3.5"
                    />
                    <span
                      className={cn(
                        "rounded px-1.5 py-0.5 font-mono text-[10px] font-bold",
                        isSel ? "bg-accent text-white" : "bg-fill text-ink-3"
                      )}
                    >
                      {c.code}
                    </span>
                    <span className="truncate" title={c.name}>
                      {c.name}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Tab 3: Blocked Clients & Contacts */}
        {tab === "restrictions" && (
          <div className="space-y-5 pt-1">
            {/* 1. Blocked Clients Section */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div>
                  <span className="flex items-center gap-1.5 text-[13px] font-bold text-ink">
                    <Ban size={15} className="text-red" /> Restricted / Blocked Client Accounts
                  </span>
                  <span className="text-[11.5px] text-ink-3">
                    Select buyers that this vendor is forbidden from supplying responses to.
                  </span>
                </div>
                <span className="rounded-full bg-red-soft px-2.5 py-0.5 text-[11px] font-bold text-red">
                  {v.blocked_clients.length} Clients Blocked
                </span>
              </div>

              {clients.length === 0 ? (
                <p className="rounded-xl bg-fill p-3 text-[12px] text-ink-3">
                  No demand clients configured yet.
                </p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 max-h-[160px] overflow-y-auto p-1.5 rounded-2xl border border-line bg-fill/30">
                  {clients.map((cl) => {
                    const cId = cl.id || cl.client_code || cl.client_name;
                    const cName = cl.client_name || cl.name || cId;
                    const isBlocked =
                      v.blocked_clients.includes(cId) ||
                      v.blocked_clients.includes(cName) ||
                      (cl.id && v.blocked_clients.includes(cl.id));
                    return (
                      <div
                        key={"bl_" + cId}
                        onClick={() => {
                          setV((p) => ({
                            ...p,
                            blocked_clients: isBlocked
                              ? p.blocked_clients.filter((x) => x !== cId && x !== cName && x !== cl.id)
                              : [...p.blocked_clients, cId],
                          }));
                        }}
                        className={cn(
                          "flex items-center justify-between gap-2 p-2 rounded-xl border cursor-pointer select-none transition text-[12px]",
                          isBlocked
                            ? "border-red/40 bg-red-soft/40 text-red font-semibold"
                            : "border-line/70 bg-surface text-ink-2 hover:border-line hover:bg-fill"
                        )}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <input
                            type="checkbox"
                            checked={isBlocked}
                            readOnly
                            className="cursor-pointer rounded accent-red h-3.5 w-3.5"
                          />
                          <span className="truncate" title={cName}>
                            {cName}
                          </span>
                        </div>
                        {isBlocked && (
                          <span className="shrink-0 rounded bg-red text-white text-[9px] font-extrabold px-1.5 py-0.5">
                            BLOCKED
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* 2. Supplier Contact Persons Section */}
            <div className="border-t border-line/60 pt-4 space-y-3">
              <div>
                <span className="flex items-center gap-1.5 text-[13px] font-bold text-ink">
                  <UserPlus size={15} /> Supplier Contact Persons ({v.contacts.length})
                </span>
                <span className="text-[11.5px] text-ink-3">
                  Maintain key account managers, billing, and technical leads for this supplier.
                </span>
              </div>

              {/* Add Contact Draft Form */}
              <div className="rounded-2xl border border-line bg-fill/30 p-3 space-y-2.5">
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2">
                  <input
                    type="text"
                    placeholder="Full Name *"
                    value={contactDraft.name}
                    onChange={(e) => setContactDraft({ ...contactDraft, name: e.target.value })}
                    className="h-8 rounded-lg border border-line bg-surface px-2.5 text-[12px] text-ink focus:outline-none focus:border-accent"
                  />
                  <input
                    type="email"
                    placeholder="Email Address"
                    value={contactDraft.email}
                    onChange={(e) => setContactDraft({ ...contactDraft, email: e.target.value })}
                    className="h-8 rounded-lg border border-line bg-surface px-2.5 text-[12px] text-ink focus:outline-none focus:border-accent"
                  />
                  <input
                    type="tel"
                    placeholder="Phone Number"
                    value={contactDraft.phone}
                    onChange={(e) => setContactDraft({ ...contactDraft, phone: e.target.value })}
                    className="h-8 rounded-lg border border-line bg-surface px-2.5 text-[12px] text-ink focus:outline-none focus:border-accent"
                  />
                  <select
                    value={contactDraft.role}
                    onChange={(e) => setContactDraft({ ...contactDraft, role: e.target.value })}
                    className="h-8 rounded-lg border border-line bg-surface px-2 text-[12px] text-ink focus:outline-none focus:border-accent"
                  >
                    <option value="Account Manager">Account Manager</option>
                    <option value="Technical Lead">Technical Lead</option>
                    <option value="Billing & Finance">Billing &amp; Finance</option>
                    <option value="Operations">Operations</option>
                  </select>
                </div>
                <div className="flex justify-end">
                  <Button
                    size="sm"
                    variant="secondary"
                    icon={<Plus size={13} />}
                    onClick={() => {
                      if (!contactDraft.name.trim() && !contactDraft.email.trim()) return;
                      setV((p) => ({
                        ...p,
                        contacts: [...p.contacts, { ...contactDraft }],
                      }));
                      setContactDraft({ name: "", email: "", phone: "", role: "Account Manager" });
                    }}
                    className="h-7 text-[11px] px-3"
                  >
                    Add Contact
                  </Button>
                </div>
              </div>

              {/* Contacts List */}
              {v.contacts.length > 0 && (
                <div className="space-y-1.5 max-h-[140px] overflow-y-auto">
                  {v.contacts.map((c, i) => (
                    <div
                      key={i}
                      className="flex items-center justify-between gap-3 p-2 rounded-xl border border-line bg-surface text-[12px]"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="font-semibold text-ink truncate">{c.name}</span>
                        {c.role && (
                          <span className="rounded bg-accent-soft px-1.5 py-0.5 text-[10px] font-medium text-accent">
                            {c.role}
                          </span>
                        )}
                        {c.email && <span className="text-ink-3 truncate text-[11px]">({c.email})</span>}
                        {c.phone && <span className="text-ink-3 truncate text-[11px]">{c.phone}</span>}
                      </div>
                      <button
                        type="button"
                        onClick={() =>
                          setV((p) => ({
                            ...p,
                            contacts: p.contacts.filter((_, idx) => idx !== i),
                          }))
                        }
                        className="text-ink-3 hover:text-red transition cursor-pointer p-1"
                        title="Remove contact"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
