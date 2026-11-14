import { useMemo, useState } from "react";
import { Check, Download, Pause, Plus, Trash2, X } from "lucide-react";
import { api, type Payment, type Project, type Vendor } from "../lib/api";
import { useQuery } from "../lib/useQuery";
import { useRealtime } from "../lib/useRealtime";
import { fetchVendorOptions } from "../lib/data";
import { exportCSV, formatDate, money, num } from "../lib/utils";
import {
  Button,
  Card,
  CountUp,
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
  Textarea,
  type Column,
} from "../components/ui";
import { useFeedback } from "../components/feedback";
import { PERMS, usePermissions } from "../lib/permissions";
import { Donut, Legend } from "../components/charts";

interface PaymentsRes {
  data: Payment[];
  summary?: {
    total_payout: string;
    total_paid: string;
    total_pending: string;
    total_rejected: string;
    count_paid: number;
    count_pending: number;
    count_rejected: number;
  };
}

const normKey = (v?: string | number | null) => String(v ?? "").toLowerCase().trim();

export function Payments() {
  const { can, user } = usePermissions();
  const { toast, confirm } = useFeedback();
  const isVendor = user?.role_id === 3 || user?.role_name === "Vendor" || user?.role_name?.toLowerCase().includes("vendor");

  const q = useQuery(() => api.get<PaymentsRes>("/payments"), [], { poll: 30000 });
  const vendorsQuery = useQuery(async () => (await api.get<{ data: Vendor[] }>("/manage/vendors")).data || [], []);

  useRealtime(["smr_payments", "smr_vendors"], () => {
    q.reload();
    vendorsQuery.reload();
  });

  const [filter, setFilter] = useState("all");
  const [vendorFilter, setVendorFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [creating, setCreating] = useState(false);

  const registeredVendors = vendorsQuery.data || [];

  const uName = normKey(user?.username);
  const rName = normKey(user?.name);
  const uEmail = normKey(user?.email);
  const uVendorCode = normKey(user?.vendor_code || user?.vendor_id || user?.supplier_id);

  // Match logged-in vendor against registered Vendors directory
  const matchedVendor = useMemo(() => {
    if (!isVendor) return null;
    return registeredVendors.find((v) => {
      const vc = normKey(v.vendor_code || v.vendor_id);
      const vn = normKey(v.vendor_name || v.name);
      const ve = normKey(v.email);
      const vid = normKey(v.id);
      return (
        (uVendorCode && (vc === uVendorCode || vid === uVendorCode || vn === uVendorCode)) ||
        (vc && (vc === uName || vc === rName)) ||
        (vn && (vn === uName || vn === rName)) ||
        (ve && uEmail && ve === uEmail)
      );
    }) || null;
  }, [isVendor, registeredVendors, uVendorCode, uName, rName, uEmail]);

  // All valid identifier tokens for the logged-in vendor
  const vendorIdentifiers = useMemo(() => {
    const set = new Set<string>();
    if (uVendorCode) set.add(uVendorCode);
    if (user?.vendor_code) set.add(normKey(user.vendor_code));
    if (user?.vendor_id) set.add(normKey(user.vendor_id));
    if (user?.supplier_id) set.add(normKey(user.supplier_id));
    if (matchedVendor) {
      if (matchedVendor.vendor_code) set.add(normKey(matchedVendor.vendor_code));
      if (matchedVendor.vendor_id) set.add(normKey(matchedVendor.vendor_id));
      if (matchedVendor.vendor_name) set.add(normKey(matchedVendor.vendor_name));
      if (matchedVendor.name) set.add(normKey(matchedVendor.name));
      if (matchedVendor.id != null) set.add(normKey(matchedVendor.id));
    }
    if (uName) set.add(uName);
    if (rName) set.add(rName);
    return set;
  }, [uVendorCode, user, matchedVendor, uName, rName]);

  // Lookup map from any registered vendor identifier -> canonical vendor record
  const registeredVendorMap = useMemo(() => {
    const map = new Map<string, Vendor>();
    registeredVendors.forEach((v) => {
      [v.vendor_code, v.vendor_id, v.vendor_name, v.name, v.id != null ? String(v.id) : ""].forEach((k) => {
        const nk = normKey(k);
        if (nk) map.set(nk, v);
      });
    });
    return map;
  }, [registeredVendors]);

  const paymentMatchesVendor = (p: Payment, keys: Set<string>) => {
    if (keys.size === 0) return false;
    return [p.vendor_code, p.vendor_id, p.vendor_name].some((val) => {
      const k = normKey(val);
      return k !== "" && keys.has(k);
    });
  };

  // Scope payments strictly to valid/registered vendors (and to current vendor when logged in as Vendor)
  const vendorScopedList = useMemo(() => {
    const rawList = q.data?.data || [];
    // Wait until vendors directory finishes initial load so stale/unregistered rows never flash
    if (vendorsQuery.loading && !vendorsQuery.data) return [];

    let scoped = rawList;
    if (isVendor) {
      scoped = rawList.filter((p) => paymentMatchesVendor(p, vendorIdentifiers));
    } else if (registeredVendors.length > 0) {
      scoped = rawList.filter((p) =>
        [p.vendor_code, p.vendor_id, p.vendor_name].some((val) => {
          const k = normKey(val);
          return k !== "" && registeredVendorMap.has(k);
        }),
      );
    } else {
      // No registered vendors on platform -> no orphan/default vendor payments shown
      scoped = [];
    }

    if (!isVendor && vendorFilter !== "all") {
      const selectedVendor = registeredVendors.find((v) => (v.vendor_code || v.vendor_id || String(v.id)) === vendorFilter);
      const selectedKeys = new Set<string>();
      if (selectedVendor) {
        [selectedVendor.vendor_code, selectedVendor.vendor_id, selectedVendor.vendor_name, selectedVendor.name, selectedVendor.id]
          .map(normKey)
          .filter(Boolean)
          .forEach((k) => selectedKeys.add(k));
      } else {
        selectedKeys.add(normKey(vendorFilter));
      }
      scoped = scoped.filter((p) => paymentMatchesVendor(p, selectedKeys));
    }

    return scoped;
  }, [q.data, vendorsQuery.loading, vendorsQuery.data, isVendor, vendorIdentifiers, registeredVendors, registeredVendorMap, vendorFilter]);

  // Recompute KPI totals and chart counts strictly from the scoped payments
  const summary = useMemo(() => {
    const amt = (p: Payment) => num(p.amount ?? p.payout_amount);
    const paidRows = vendorScopedList.filter((p) => normKey(p.status) === "paid");
    const pendingRows = vendorScopedList.filter((p) => normKey(p.status) === "pending");
    const rejectedRows = vendorScopedList.filter((p) => normKey(p.status) === "rejected");
    const totalPaid = paidRows.reduce((s, p) => s + amt(p), 0);
    const totalPending = pendingRows.reduce((s, p) => s + amt(p), 0);
    const totalRejected = rejectedRows.reduce((s, p) => s + amt(p), 0);
    return {
      totalPayout: totalPaid + totalPending,
      totalPaid,
      totalPending,
      totalRejected,
      countPaid: paidRows.length,
      countPending: pendingRows.length,
      countRejected: rejectedRows.length,
    };
  }, [vendorScopedList]);

  const rows = useMemo(() => {
    const t = search.toLowerCase();
    return vendorScopedList.filter(
      (p) =>
        (filter === "all" || normKey(p.status) === normKey(filter)) &&
        (!t || JSON.stringify([p.vendor_name, p.vendor_id, p.vendor_code, p.project_name, p.invoice_code, p.remarks]).toLowerCase().includes(t)),
    );
  }, [vendorScopedList, filter, search]);

  if (q.error && !q.data) return <ErrorState message={q.error} onRetry={q.reset} />;

  const setStatus = async (p: Payment, status: string) => {
    try {
      await api.post("/payments/update-status", { id: p.id, status });
      toast(`Marked as ${status}`);
      q.reload();
    } catch (e: any) {
      toast(e.message, "error");
    }
  };
  const remove = async (p: Payment) => {
    if (!(await confirm({ title: "Delete this voucher?", message: "The payment record is permanently removed.", confirmLabel: "Delete", danger: true }))) return;
    try {
      await api.post("/payments/delete", { id: p.id });
      toast("Voucher deleted");
      q.reload();
    } catch (e: any) {
      toast(e.message, "error");
    }
  };

  const resolveVendorLabel = (p: Payment) => {
    const matched =
      registeredVendorMap.get(normKey(p.vendor_code)) ||
      registeredVendorMap.get(normKey(p.vendor_id)) ||
      registeredVendorMap.get(normKey(p.vendor_name));
    if (matched) {
      const name = matched.vendor_name || matched.name || "";
      const code = matched.vendor_code || matched.vendor_id || "";
      return name && code && name !== code ? `${name} (${code})` : name || code;
    }
    return p.vendor_name || p.vendor_code || p.vendor_id || "—";
  };

  const amount = (p: Payment) => num(p.amount ?? p.payout_amount);
  const cols: Column<Payment>[] = [
    { key: "id", header: "Voucher", primary: true, render: (p) => <span className="font-mono text-[13px] font-semibold">{p.invoice_code || `PAY-${String(p.id).padStart(4, "0")}`}</span> },
    { key: "vendor", header: "Vendor", render: (p) => resolveVendorLabel(p) },
    { key: "project", header: "Study", render: (p) => <span className="block max-w-[200px] truncate">{p.project_name || p.project_id || "—"}</span> },
    { key: "amount", header: "Amount", align: "right", sortValue: amount, render: (p) => <span className="font-semibold tabular-nums">{money(amount(p))}</span> },
    { key: "status", header: "Status", render: (p) => <StatusBadge status={p.status} /> },
    { key: "created_at", header: "Created", hideMobile: true, render: (p) => <span className="text-ink-3">{formatDate(p.created_at, false)}</span> },
    {
      key: "act",
      header: "",
      align: "right",
      render: (p) => (
        <div className="flex justify-end gap-1.5">
          {can(PERMS.PAYMENTS_APPROVE) && p.status !== "Paid" && <Button size="sm" variant="tinted" icon={<Check size={14} />} onClick={() => setStatus(p, "Paid")}>Settle</Button>}
          {can(PERMS.PAYMENTS_APPROVE) && p.status !== "Pending" && <Button size="sm" variant="secondary" aria-label="Put on hold" icon={<Pause size={14} />} onClick={() => setStatus(p, "Pending")} />}
          {can(PERMS.PAYMENTS_APPROVE) && p.status !== "Rejected" && <Button size="sm" variant="secondary" aria-label="Reject" icon={<X size={14} />} onClick={() => setStatus(p, "Rejected")} />}
          {can(PERMS.PAYMENTS_DELETE) && <Button size="sm" variant="dangerSoft" aria-label="Delete" icon={<Trash2 size={14} />} onClick={() => remove(p)} />}
        </div>
      ),
    },
  ];

  const isLoading = q.loading || (vendorsQuery.loading && !vendorsQuery.data);

  return (
    <div>
      <PageHeader
        title="Payments"
        subtitle={isVendor ? "Your payout vouchers and settlement status." : "Vendor payouts, vouchers and settlement status."}
        actions={
          <>
            {can(PERMS.PAYMENTS_EXPORT) && (
              <Button
                variant="secondary"
                icon={<Download size={15} />}
                onClick={() =>
                  exportCSV(
                    "vendor-payments",
                    ["Voucher", "Vendor", "Study", "Amount", "Status", "Method", "Remarks", "Created"],
                    rows.map((p) => [p.invoice_code || `PAY-${p.id}`, resolveVendorLabel(p), p.project_name || p.project_id, amount(p), p.status, p.payment_method, p.remarks, p.created_at]),
                  )
                }
              >
                Export
              </Button>
            )}
            {can(PERMS.PAYMENTS_RECORD) && (
              <Button icon={<Plus size={16} />} onClick={() => setCreating(true)}>
                New voucher
              </Button>
            )}
          </>
        }
      />

      <div className="mb-5 grid gap-4 lg:grid-cols-3">
        <div className="stagger grid grid-cols-2 gap-3 lg:col-span-2 lg:gap-4">
          {[
            ["Total payout", summary.totalPayout, "text-ink"],
            ["Paid", summary.totalPaid, "text-green"],
            ["Pending", summary.totalPending, "text-orange"],
            ["Rejected", summary.totalRejected, "text-red"],
          ].map(([l, v, tone]) => (
            <Card key={l as string} hover className="p-4 sm:p-5">
              <p className="text-[13px] font-medium text-ink-3">{l}</p>
              <p className={`mt-0.5 text-[26px] font-bold tracking-tight tabular-nums sm:text-[30px] ${tone}`}>
                <CountUp value={v as number} prefix="$" decimals={2} />
              </p>
            </Card>
          ))}
        </div>
        <Card className="anim-fade-up flex items-center justify-center gap-6 p-5" style={{ animationDelay: "150ms" }}>
          <Donut
            size={124}
            thickness={14}
            segments={[
              { label: "Paid", value: summary.totalPaid, color: "var(--green)" },
              { label: "Pending", value: summary.totalPending, color: "var(--orange)" },
              { label: "Rejected", value: summary.totalRejected, color: "var(--red)" },
            ]}
            centerValue={String(summary.countPaid)}
            centerLabel="settled"
          />
          <Legend
            items={[
              { label: "Paid", value: summary.countPaid, color: "var(--green)" },
              { label: "Pending", value: summary.countPending, color: "var(--orange)" },
              { label: "Rejected", value: summary.countRejected, color: "var(--red)" },
            ]}
          />
        </Card>
      </div>

      <DataTable
        columns={cols}
        rows={rows}
        rowKey={(p) => p.id}
        loading={isLoading}
        toolbar={
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <Segmented
              value={filter}
              onChange={setFilter}
              options={[
                { value: "all", label: "All" },
                { value: "Pending", label: "Pending" },
                { value: "Paid", label: "Paid" },
                { value: "Rejected", label: "Rejected" },
              ]}
            />
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              {!isVendor && registeredVendors.length > 0 && (
                <Select
                  value={vendorFilter}
                  onChange={(e) => setVendorFilter(e.target.value)}
                  className="!h-10 !text-[13px] sm:w-48"
                  aria-label="Filter by vendor"
                >
                  <option value="all">All vendors ({registeredVendors.length})</option>
                  {registeredVendors.map((v) => {
                    const code = v.vendor_code || v.vendor_id || String(v.id);
                    return (
                      <option key={code} value={code}>
                        {v.vendor_name || v.name || code}
                      </option>
                    );
                  })}
                </Select>
              )}
              <SearchInput value={search} onChange={setSearch} placeholder="Search vouchers" className="sm:w-64" />
            </div>
          </div>
        }
        empty={
          <EmptyState
            title="No payment vouchers"
            message={
              isVendor
                ? "No payout vouchers have been recorded for your vendor account yet."
                : "Create a voucher to record a payout for one of your registered vendors."
            }
            action={can(PERMS.PAYMENTS_RECORD) ? <Button onClick={() => setCreating(true)}>New voucher</Button> : undefined}
          />
        }
      />

      <VoucherForm open={creating} onClose={() => setCreating(false)} onSaved={() => { setCreating(false); q.reload(); }} />
    </div>
  );
}

function VoucherForm({ open, onClose, onSaved }: { open: boolean; onClose: () => void; onSaved: () => void }) {
  const { toast } = useFeedback();
  const opts = useQuery(
    async () => {
      const [v, p] = await Promise.all([fetchVendorOptions(), api.get<{ data: Project[] }>("/manage/projects").then((r) => r.data || []).catch(() => [])]);
      return { v, p };
    },
    [],
  );
  const [f, setF] = useState({ vendor: "", project: "", amount: "", status: "Pending", remarks: "" });
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setF((p) => ({ ...p, [k]: e.target.value }));

  const save = async () => {
    if (!f.vendor) return toast("Choose a vendor.", "error");
    if (num(f.amount) <= 0) return toast("Enter a valid payout amount.", "error");
    const vend = opts.data?.v.find((v) => v.code === f.vendor);
    const proj = opts.data?.p.find((p) => String(p.id) === f.project);
    setBusy(true);
    try {
      await api.post("/payments/create", {
        project_id: proj?.id ?? (f.project ? Number(f.project) : null),
        project_name: proj?.project_name || null,
        vendor_id: f.vendor,
        vendor_name: vend?.name || f.vendor,
        amount: num(f.amount),
        status: f.status,
        remarks: f.remarks || `Vendor payout${proj ? ` for ${proj.project_name}` : ""}`,
      });
      toast("Voucher recorded");
      setF({ vendor: "", project: "", amount: "", status: "Pending", remarks: "" });
      onSaved();
    } catch (e: any) {
      toast(e.message, "error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="New payment voucher"
      subtitle="Record a payout owed to a supply partner"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button loading={busy} onClick={save}>Record voucher</Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Vendor">
          <Select value={f.vendor} onChange={set("vendor")}>
            <option value="">Select vendor</option>
            {(opts.data?.v || []).map((v) => (
              <option key={v.code} value={v.code}>{v.name} — {v.code}</option>
            ))}
          </Select>
        </Field>
        <Field label="Study (optional)">
          <Select value={f.project} onChange={set("project")}>
            <option value="">General payout</option>
            {(opts.data?.p || []).map((p) => (
              <option key={p.id} value={p.id}>{p.project_name}</option>
            ))}
          </Select>
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Amount ($)">
            <Input type="number" step="0.01" min="0" value={f.amount} onChange={set("amount")} placeholder="0.00" />
          </Field>
          <Field label="Status">
            <Select value={f.status} onChange={set("status")}>
              <option>Pending</option>
              <option>Paid</option>
              <option>Rejected</option>
            </Select>
          </Field>
        </div>
        <Field label="Remarks">
          <Textarea value={f.remarks} onChange={set("remarks")} placeholder="Invoice reference, bank batch, notes…" />
        </Field>
      </div>
    </Modal>
  );
}
