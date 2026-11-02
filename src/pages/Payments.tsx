import { useMemo, useState } from "react";
import { Check, Download, Pause, Plus, Trash2, X } from "lucide-react";
import { api, type Payment, type Project } from "../lib/api";
import { useQuery } from "../lib/useQuery";
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
import { Donut, Legend } from "../components/charts";

interface PaymentsRes {
  data: Payment[];
  summary: { total_payout: string; total_paid: string; total_pending: string; total_rejected: string; count_paid: number; count_pending: number; count_rejected: number };
}

export function Payments() {
  const { toast, confirm } = useFeedback();
  const q = useQuery(() => api.get<PaymentsRes>("/payments"), [], { poll: 30000 });
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [creating, setCreating] = useState(false);

  const list = q.data?.data || [];
  const rows = useMemo(() => {
    const t = search.toLowerCase();
    return list.filter(
      (p) =>
        (filter === "all" || p.status === filter) &&
        (!t || JSON.stringify([p.vendor_name, p.vendor_id, p.project_name, p.invoice_code, p.remarks]).toLowerCase().includes(t)),
    );
  }, [list, filter, search]);

  if (q.error && !q.data) return <ErrorState message={q.error} onRetry={q.reset} />;

  const sm = q.data?.summary;
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

  const amount = (p: Payment) => num(p.amount ?? p.payout_amount);
  const cols: Column<Payment>[] = [
    { key: "id", header: "Voucher", primary: true, render: (p) => <span className="font-mono text-[13px] font-semibold">{p.invoice_code || `PAY-${String(p.id).padStart(4, "0")}`}</span> },
    { key: "vendor", header: "Vendor", render: (p) => p.vendor_name || p.vendor_id || "—" },
    { key: "project", header: "Study", render: (p) => <span className="block max-w-[200px] truncate">{p.project_name || p.project_id || "—"}</span> },
    { key: "amount", header: "Amount", align: "right", sortValue: amount, render: (p) => <span className="font-semibold">{money(amount(p))}</span> },
    { key: "status", header: "Status", render: (p) => <StatusBadge status={p.status} /> },
    { key: "created_at", header: "Created", hideMobile: true, render: (p) => <span className="text-ink-3">{formatDate(p.created_at, false)}</span> },
    {
      key: "act",
      header: "",
      align: "right",
      render: (p) => (
        <div className="flex justify-end gap-1.5">
          {p.status !== "Paid" && <Button size="sm" variant="tinted" icon={<Check size={14} />} onClick={() => setStatus(p, "Paid")}>Settle</Button>}
          {p.status !== "Pending" && <Button size="sm" variant="secondary" aria-label="Put on hold" icon={<Pause size={14} />} onClick={() => setStatus(p, "Pending")} />}
          {p.status !== "Rejected" && <Button size="sm" variant="secondary" aria-label="Reject" icon={<X size={14} />} onClick={() => setStatus(p, "Rejected")} />}
          <Button size="sm" variant="dangerSoft" aria-label="Delete" icon={<Trash2 size={14} />} onClick={() => remove(p)} />
        </div>
      ),
    },
  ];

  const paid = num(sm?.total_paid);
  const pending = num(sm?.total_pending);
  const rejected = num(sm?.total_rejected);

  return (
    <div>
      <PageHeader
        title="Payments"
        subtitle="Vendor payouts, vouchers and settlement status."
        actions={
          <>
            <Button
              variant="secondary"
              icon={<Download size={15} />}
              onClick={() =>
                exportCSV(
                  "vendor-payments",
                  ["Voucher", "Vendor", "Study", "Amount", "Status", "Method", "Remarks", "Created"],
                  rows.map((p) => [p.invoice_code || `PAY-${p.id}`, p.vendor_name || p.vendor_id, p.project_name || p.project_id, amount(p), p.status, p.payment_method, p.remarks, p.created_at]),
                )
              }
            >
              Export
            </Button>
            <Button icon={<Plus size={16} />} onClick={() => setCreating(true)}>
              New voucher
            </Button>
          </>
        }
      />

      <div className="mb-5 grid gap-4 lg:grid-cols-3">
        <div className="stagger grid grid-cols-2 gap-3 lg:col-span-2 lg:gap-4">
          {[
            ["Total payout", num(sm?.total_payout), "text-ink"],
            ["Paid", paid, "text-green"],
            ["Pending", pending, "text-orange"],
            ["Rejected", rejected, "text-red"],
          ].map(([l, v, tone]) => (
            <Card key={l as string} hover className="p-4 sm:p-5">
              <p className="text-[13px] font-medium text-ink-3">{l}</p>
              <p className={`mt-0.5 text-[26px] font-bold tracking-tight sm:text-[30px] ${tone}`}>
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
              { label: "Paid", value: paid, color: "var(--green)" },
              { label: "Pending", value: pending, color: "var(--orange)" },
              { label: "Rejected", value: rejected, color: "var(--red)" },
            ]}
            centerValue={String(sm?.count_paid ?? 0)}
            centerLabel="settled"
          />
          <Legend
            items={[
              { label: "Paid", value: sm?.count_paid ?? 0, color: "var(--green)" },
              { label: "Pending", value: sm?.count_pending ?? 0, color: "var(--orange)" },
              { label: "Rejected", value: sm?.count_rejected ?? 0, color: "var(--red)" },
            ]}
          />
        </Card>
      </div>

      <DataTable
        columns={cols}
        rows={rows}
        rowKey={(p) => p.id}
        loading={q.loading}
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
            <SearchInput value={search} onChange={setSearch} placeholder="Search vouchers" className="sm:w-64" />
          </div>
        }
        empty={<EmptyState title="No payment vouchers" message="Create a voucher to record a vendor payout." action={<Button onClick={() => setCreating(true)}>New voucher</Button>} />}
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
    const proj = opts.data?.p.find((p) => String(p.id) === f.project);
    setBusy(true);
    try {
      await api.post("/payments/create", {
        project_id: proj?.id ?? (f.project ? Number(f.project) : 1),
        vendor_id: f.vendor,
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
