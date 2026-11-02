import { useState } from "react";
import { ArrowRightLeft, Plus, Trash2 } from "lucide-react";
import { api, type Client } from "../lib/api";
import { useQuery } from "../lib/useQuery";
import { formatDate, money, num } from "../lib/utils";
import { Badge, Button, Card, CountUp, EmptyState, ErrorState, Field, Input, Modal, PageHeader, Select, Skeleton, Textarea, statusTone } from "../components/ui";
import { useFeedback } from "../components/feedback";

interface Bid {
  id: number;
  bid_id: string;
  bid_name: string;
  client_id: number;
  client_name: string;
  cpi: string;
  sample_size: number;
  specifications: string;
  status: string;
  created_by: string;
  createdAt: string;
}
interface BidsRes {
  data: Bid[];
  summary: { totalBids: number; wonBids: number; pendingBids: number; pipelineValue: number };
}

const COLUMNS = ["Pending", "Won", "Lost"];

export function Bids() {
  const { toast, confirm } = useFeedback();
  const q = useQuery(() => api.get<BidsRes>("/bids"), []);
  const [creating, setCreating] = useState(false);

  if (q.error && !q.data) return <ErrorState message={q.error} onRetry={q.reset} />;
  const list = q.data?.data || [];
  const sm = q.data?.summary;

  const move = async (b: Bid, status: string) => {
    try {
      await api.post("/bids/status", { id: b.id, status });
      toast(`${b.bid_id} marked ${status}`);
      q.reload();
    } catch (e: any) {
      toast(e.message, "error");
    }
  };
  const convert = async (b: Bid) => {
    if (!(await confirm({ title: "Convert to study?", message: `"${b.bid_name}" becomes a live project you can route traffic to.`, confirmLabel: "Convert" }))) return;
    try {
      await api.post("/bids/convert", { id: b.id });
      toast("Bid converted to a study");
      q.reload();
    } catch (e: any) {
      toast(e.message, "error");
    }
  };
  const remove = async (b: Bid) => {
    if (!(await confirm({ title: "Delete bid?", message: b.bid_name, confirmLabel: "Delete", danger: true }))) return;
    try {
      await api.del("/bids/delete", { id: b.id });
      toast("Bid deleted");
      q.reload();
    } catch (e: any) {
      toast(e.message, "error");
    }
  };

  return (
    <div>
      <PageHeader
        title="Bids"
        subtitle="Proposals in your sales pipeline."
        actions={
          <Button icon={<Plus size={16} />} onClick={() => setCreating(true)}>
            New bid
          </Button>
        }
      />

      <div className="stagger mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
        {[
          ["Total bids", num(sm?.totalBids), "", ""],
          ["Won", num(sm?.wonBids), "text-green", ""],
          ["Pending", num(sm?.pendingBids), "text-orange", ""],
          ["Pipeline value", num(sm?.pipelineValue), "text-accent", "$"],
        ].map(([l, v, tone, p]) => (
          <Card key={l as string} hover className="p-4 sm:p-5">
            <p className="text-[13px] font-medium text-ink-3">{l}</p>
            <div className={`mt-0.5 text-[26px] font-bold tracking-tight sm:text-[30px] ${tone}`}>
              {q.loading ? <Skeleton className="mt-1 h-8 w-20" /> : <CountUp value={v as number} prefix={p as string} />}
            </div>
          </Card>
        ))}
      </div>

      {q.loading ? (
        <Skeleton className="h-64 rounded-3xl" />
      ) : list.length === 0 ? (
        <Card>
          <EmptyState title="No bids yet" message="Track every proposal from pending to won." action={<Button onClick={() => setCreating(true)}>Create a bid</Button>} />
        </Card>
      ) : (
        <div className="grid gap-4 lg:grid-cols-3">
          {COLUMNS.map((col) => {
            const items = list.filter((b) => (COLUMNS.includes(b.status) ? b.status : "Pending") === col);
            return (
              <div key={col} className="rounded-3xl bg-fill/60 p-3">
                <div className="mb-3 flex items-center justify-between px-2 pt-1">
                  <Badge tone={statusTone(col)} dot>{col}</Badge>
                  <span className="text-[13px] font-semibold text-ink-3 tabular">{items.length}</span>
                </div>
                <div className="stagger space-y-3">
                  {items.length === 0 && <p className="px-2 py-6 text-center text-[13px] text-ink-3">Nothing here</p>}
                  {items.map((b) => (
                    <Card key={b.id} hover className="p-4">
                      <div className="mb-1 flex items-start justify-between gap-2">
                        <p className="text-[15px] font-semibold leading-snug">{b.bid_name}</p>
                        <button aria-label="Delete bid" onClick={() => remove(b)} className="cursor-pointer rounded-full p-1.5 text-ink-3 transition-colors hover:bg-red-soft hover:text-red">
                          <Trash2 size={14} />
                        </button>
                      </div>
                      <p className="mb-3 text-[12px] text-ink-3">
                        {b.bid_id} · {b.client_name}
                      </p>
                      {b.specifications && <p className="mb-3 line-clamp-2 text-[13px] text-ink-2">{b.specifications}</p>}
                      <div className="mb-3 grid grid-cols-2 gap-2 text-[13px]">
                        <div className="rounded-xl bg-fill px-3 py-2">
                          <p className="text-[11px] font-semibold uppercase text-ink-3">CPI</p>
                          <p className="font-semibold tabular">{money(b.cpi)}</p>
                        </div>
                        <div className="rounded-xl bg-fill px-3 py-2">
                          <p className="text-[11px] font-semibold uppercase text-ink-3">Sample</p>
                          <p className="font-semibold tabular">{num(b.sample_size).toLocaleString()}</p>
                        </div>
                      </div>
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[12px] text-ink-3">{formatDate(b.createdAt, false)}</span>
                        <div className="flex gap-1.5">
                          {col !== "Won" && <Button size="sm" variant="tinted" onClick={() => move(b, "Won")}>Won</Button>}
                          {col !== "Lost" && <Button size="sm" variant="secondary" onClick={() => move(b, "Lost")}>Lost</Button>}
                          {col === "Won" && <Button size="sm" variant="tinted" icon={<ArrowRightLeft size={13} />} onClick={() => convert(b)}>Convert</Button>}
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <BidForm open={creating} onClose={() => setCreating(false)} onSaved={() => { setCreating(false); q.reload(); }} />
    </div>
  );
}

function BidForm({ open, onClose, onSaved }: { open: boolean; onClose: () => void; onSaved: () => void }) {
  const { toast } = useFeedback();
  const clients = useQuery(async () => (await api.get<{ data: Client[] }>("/clients")).data || [], []);
  const [f, setF] = useState({ name: "", client_id: "", cpi: "1.50", sample_size: "500", specifications: "" });
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setF((p) => ({ ...p, [k]: e.target.value }));

  const save = async () => {
    if (!f.name.trim()) return toast("Give the bid a name.", "error");
    setBusy(true);
    try {
      await api.post("/bids", {
        name: f.name.trim(),
        bid_name: f.name.trim(),
        client_id: f.client_id ? Number(f.client_id) : clients.data?.[0]?.id ?? 1,
        cpi: num(f.cpi),
        sample_size: num(f.sample_size),
        specifications: f.specifications,
        status: "Pending",
        created_by: "Admin",
      });
      toast("Bid created");
      setF({ name: "", client_id: "", cpi: "1.50", sample_size: "500", specifications: "" });
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
      title="New bid"
      subtitle="Quote a prospective project"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button loading={busy} onClick={save}>Create bid</Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Bid name"><Input value={f.name} onChange={set("name")} placeholder="Healthcare Professionals – US" /></Field>
        <Field label="Client">
          <Select value={f.client_id} onChange={set("client_id")}>
            <option value="">Select a client</option>
            {(clients.data || []).map((c) => <option key={c.id} value={c.id}>{c.client_name}</option>)}
          </Select>
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="CPI ($)"><Input type="number" step="0.01" min="0" value={f.cpi} onChange={set("cpi")} /></Field>
          <Field label="Sample size"><Input type="number" min="1" value={f.sample_size} onChange={set("sample_size")} /></Field>
        </div>
        <Field label="Specifications"><Textarea value={f.specifications} onChange={set("specifications")} placeholder="Target audience, quotas, incidence…" /></Field>
      </div>
    </Modal>
  );
}
