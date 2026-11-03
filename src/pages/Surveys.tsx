import { useEffect, useMemo, useState } from "react";
import { Copy, Download, Link2, Plus, RefreshCw, Share2, Trash2 } from "lucide-react";
import { api, type Client, type Project } from "../lib/api";
import { useQuery } from "../lib/useQuery";
import { normalizeSurvey, type NSurvey } from "../lib/data";
import { exportCSV, formatDate, money, num } from "../lib/utils";
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
  Skeleton,
  StatusBadge,
  type Column,
} from "../components/ui";
import { useFeedback } from "../components/feedback";
import { AssignModal } from "../components/AssignModal";
import { PERMS, usePermissions } from "../lib/permissions";

export function Surveys() {
  const { can } = usePermissions();
  const [tab, setTab] = useState<"market" | "mine">("market");
  const { toast } = useFeedback();
  const [syncing, setSyncing] = useState(false);

  const market = useQuery(async () => {
    const r = await api.get<{ data: any[] }>("/zamplia");
    return (r.data || []).map(normalizeSurvey);
  }, []);
  const mine = useQuery(async () => (await api.get<{ data: Project[] }>("/manage/projects")).data || [], []);

  const sync = async () => {
    setSyncing(true);
    try {
      const r = await api.get<{ message: string }>("/zamplia/sync");
      toast(r.message || "Marketplace synced");
      market.reload();
    } catch (e: any) {
      toast(e.message, "error");
    } finally {
      setSyncing(false);
    }
  };

  const [creating, setCreating] = useState(false);

  return (
    <div>
      <PageHeader
        title="Surveys"
        subtitle="Live marketplace inventory and the studies you operate."
        actions={
          <>
            <Button variant="secondary" loading={syncing} icon={<RefreshCw size={15} />} onClick={sync}>
              Sync
            </Button>
            {can(PERMS.SURVEYS_CREATE) && (
              <Button icon={<Plus size={16} />} onClick={() => setCreating(true)}>
                New study
              </Button>
            )}
          </>
        }
      />
      <Segmented
        className="mb-5"
        value={tab}
        onChange={setTab}
        options={[
          { value: "market", label: "Marketplace", count: market.data?.length },
          { value: "mine", label: "My studies", count: mine.data?.length },
        ]}
      />
      {tab === "market" ? (
        <Marketplace q={market} />
      ) : (
        <MyStudies q={mine} onNew={() => setCreating(true)} />
      )}
      <StudyForm
        open={creating}
        onClose={() => setCreating(false)}
        onSaved={() => {
          mine.reload();
          market.reload();
          setTab("mine");
        }}
      />
    </div>
  );
}

/* ───────────── Marketplace ───────────── */
function Marketplace({ q }: { q: ReturnType<typeof useQuery<NSurvey[]>> }) {
  const [search, setSearch] = useState("");
  const [client, setClient] = useState("all");
  const [status, setStatus] = useState("all");
  const [sortBy, setSortBy] = useState("newest");
  const [selected, setSelected] = useState<Set<string | number>>(new Set());
  const [detail, setDetail] = useState<NSurvey | null>(null);
  const [assign, setAssign] = useState<NSurvey[]>([]);

  const list = q.data || [];
  const clients = useMemo(() => [...new Set(list.map((s) => s.client))], [list]);

  const rows = useMemo(() => {
    const t = search.trim().toLowerCase();
    let r = list.filter(
      (s) =>
        (client === "all" || s.client === client) &&
        (status === "all" || s.status === status) &&
        (!t || s.id.includes(t) || s.name.toLowerCase().includes(t)),
    );
    const sorters: Record<string, (a: NSurvey, b: NSurvey) => number> = {
      newest: (a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""),
      cpi: (a, b) => b.cpi - a.cpi,
      ir: (a, b) => b.ir - a.ir,
      loi: (a, b) => a.loi - b.loi,
      target: (a, b) => b.target - a.target,
    };
    r = [...r].sort(sorters[sortBy]);
    return r;
  }, [list, search, client, status, sortBy]);

  if (q.error && !q.data) return <ErrorState message={q.error} onRetry={q.reset} />;

  const cols: Column<NSurvey>[] = [
    { key: "id", header: "Survey", primary: true, render: (s) => (
        <div className="min-w-0">
          <p className="font-mono text-[13px] font-semibold text-ink">#{s.id}</p>
          <p className="max-w-[220px] truncate text-[12px] text-ink-3">{s.name}</p>
        </div>
      ) },
    { key: "client", header: "Client", render: (s) => <span className="text-ink-2">{s.client}</span> },
    { key: "cpi", header: "CPI", align: "right", sortValue: (s) => s.cpi, render: (s) => <span className="font-semibold">{money(s.cpi)}</span> },
    { key: "loi", header: "LOI", align: "right", sortValue: (s) => s.loi, render: (s) => `${s.loi} min` },
    {
      key: "ir",
      header: "IR",
      align: "right",
      sortValue: (s) => s.ir,
      render: (s) => <Badge tone={s.ir >= 60 ? "green" : s.ir >= 30 ? "orange" : "red"}>{s.ir}%</Badge>,
    },
    { key: "target", header: "Target", align: "right", sortValue: (s) => s.target, render: (s) => s.target.toLocaleString() },
    { key: "end", header: "Ends", hideMobile: true, render: (s) => <span className="text-ink-3">{formatDate(s.endDate, false)}</span> },
    { key: "status", header: "Status", render: (s) => <StatusBadge status={s.status} /> },
    {
      key: "act",
      header: "",
      align: "right",
      hideMobile: true,
      render: (s) => (
        <Button
          size="sm"
          variant="tinted"
          icon={<Share2 size={14} />}
          onClick={(e) => {
            e.stopPropagation();
            setAssign([s]);
          }}
        >
          Assign
        </Button>
      ),
    },
  ];

  const selectedSurveys = list.filter((s) => selected.has(s.id));

  return (
    <>
      <DataTable
        columns={cols}
        rows={rows}
        rowKey={(s) => s.id}
        loading={q.loading}
        pageSize={12}
        selectable
        selected={selected}
        onSelectedChange={setSelected}
        onRowClick={setDetail}
        empty={<EmptyState title="No surveys match" message="Try clearing a filter or syncing the marketplace." />}
        toolbar={
          <div className="flex flex-col gap-2.5 lg:flex-row lg:items-center">
            <SearchInput value={search} onChange={setSearch} placeholder="Search by ID or name" className="lg:w-72" />
            <div className="grid flex-1 grid-cols-3 gap-2 lg:flex lg:flex-none">
              <Select value={client} onChange={(e) => setClient(e.target.value)} className="!h-10 !text-[14px] lg:w-44" aria-label="Client">
                <option value="all">All clients</option>
                {clients.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </Select>
              <Select value={status} onChange={(e) => setStatus(e.target.value)} className="!h-10 !text-[14px] lg:w-32" aria-label="Status">
                <option value="all">Any status</option>
                <option>Live</option>
                <option>Pause</option>
              </Select>
              <Select value={sortBy} onChange={(e) => setSortBy(e.target.value)} className="!h-10 !text-[14px] lg:w-40" aria-label="Sort">
                <option value="newest">Newest</option>
                <option value="cpi">Highest CPI</option>
                <option value="ir">Highest IR</option>
                <option value="loi">Shortest LOI</option>
                <option value="target">Largest target</option>
              </Select>
            </div>
            <div className="flex items-center gap-3 lg:ml-auto">
              <p className="text-[13px] text-ink-3">{rows.length.toLocaleString()} surveys</p>
              <Button
                size="sm"
                variant="secondary"
                icon={<Download size={14} />}
                onClick={() =>
                  exportCSV(
                    "marketplace-surveys",
                    ["Survey ID", "Name", "Client", "CPI", "LOI", "IR", "Target", "Status"],
                    rows.map((s) => [s.id, s.name, s.client, s.cpi, s.loi, s.ir, s.target, s.status]),
                  )
                }
              >
                Export
              </Button>
            </div>
          </div>
        }
      />

      {/* Floating bulk bar */}
      {can(PERMS.SURVEYS_ASSIGN) && selected.size > 0 && (
        <div className="anim-sheet-up fixed inset-x-0 bottom-20 z-40 flex justify-center px-4 lg:bottom-6 lg:pl-[264px]">
          <div className="glass flex items-center gap-3 rounded-full border border-line py-2 pl-5 pr-2 shadow-[var(--shadow-lg)]">
            <span className="text-[14px] font-semibold tabular">{selected.size} selected</span>
            <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())}>
              Clear
            </Button>
            <Button
              size="sm"
              className="!rounded-full"
              icon={<Share2 size={14} />}
              onClick={() => setAssign(selectedSurveys)}
            >
              Bulk assign
            </Button>
          </div>
        </div>
      )}

      <SurveyDrawer survey={detail} onClose={() => setDetail(null)} onAssign={(s) => setAssign([s])} />
      <AssignModal
        surveys={assign}
        onClose={() => setAssign([])}
        onDone={() => setSelected(new Set())}
      />
    </>
  );
}

function SurveyDrawer({ survey, onClose, onAssign }: { survey: NSurvey | null; onClose: () => void; onAssign: (s: NSurvey) => void }) {
  const { can } = usePermissions();
  const id = survey?.id;
  const d = useQuery(
    async () => {
      if (!id) return null;
      const [det, quotas] = await Promise.all([
        api.get<any>(`/zamplia/details/${id}`).catch(() => null),
        api.get<any>(`/zamplia/quotas/${id}`).catch(() => null),
      ]);
      return { survey: det?.data?.survey, quals: det?.data?.qualifications || [], quotas: quotas?.data || [] };
    },
    [id],
  );
  const s = survey;
  const rows: [string, string | number][] = s
    ? [
        ["Client", s.client],
        ["Client CPI", money(s.cpi)],
        ["Length of interview", `${s.loi} min`],
        ["Incidence rate", `${s.ir}%`],
        ["Completes needed", s.target.toLocaleString()],
        ["Language", s.language],
        ["Device", s.device],
        ["Study type", s.type],
        ["Closes", formatDate(s.endDate, false)],
      ]
    : [];
  return (
    <Modal open={!!s} onClose={onClose} drawer title={s ? `Survey #${s.id}` : ""} subtitle={s?.name}
      footer={s && can(PERMS.SURVEYS_ASSIGN) ? <Button icon={<Share2 size={16} />} onClick={() => { onAssign(s); onClose(); }}>Assign to vendor</Button> : undefined}>
      {s && (
        <div className="space-y-6">
          <div className="flex items-center gap-2">
            <StatusBadge status={s.status} />
            {s.cloned && <Badge tone="purple">Clone</Badge>}
          </div>
          <dl className="divide-y divide-line overflow-hidden rounded-2xl border border-line">
            {rows.map(([k, v]) => (
              <div key={k} className="flex items-center justify-between gap-4 px-4 py-3">
                <dt className="text-[14px] text-ink-3">{k}</dt>
                <dd className="text-right text-[14px] font-medium text-ink">{v}</dd>
              </div>
            ))}
          </dl>

          {can(PERMS.SURVEYS_TARGETING) && (
            <section>
              <h3 className="mb-2 text-[15px] font-semibold">Qualifications</h3>
              {d.loading ? (
                <Skeleton className="h-20" />
              ) : (d.data?.quals.length || 0) === 0 ? (
                <p className="rounded-2xl bg-fill px-4 py-3 text-[14px] text-ink-3">No pre-screen qualifications.</p>
              ) : (
                <ul className="space-y-2">
                  {d.data!.quals.map((qq: any) => (
                    <li key={qq.QuestionID} className="flex items-center justify-between rounded-2xl bg-fill px-4 py-3">
                      <span className="text-[14px] font-medium">Question {qq.QuestionID}</span>
                      <span className="flex items-center gap-2 text-[12px] text-ink-3">
                        <Badge tone="gray">{qq.QuestionType}</Badge>
                        {qq.AnswerCodes?.length} answer{qq.AnswerCodes?.length === 1 ? "" : "s"}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          )}

          {can(PERMS.SURVEYS_QUOTAS) && (
            <section>
              <h3 className="mb-2 text-[15px] font-semibold">Quotas</h3>
              {d.loading ? (
                <Skeleton className="h-12" />
              ) : (d.data?.quotas.length || 0) === 0 ? (
                <p className="rounded-2xl bg-fill px-4 py-3 text-[14px] text-ink-3">Open sample — no quota groups defined.</p>
              ) : (
                <pre className="max-h-48 overflow-auto rounded-2xl bg-fill p-4 text-[12px]">{JSON.stringify(d.data!.quotas, null, 2)}</pre>
              )}
            </section>
          )}

          {s.liveUrl && (
            <section>
              <h3 className="mb-2 text-[15px] font-semibold">Client live URL</h3>
              <p className="mb-2 break-all rounded-xl bg-fill px-3 py-2 font-mono text-[12px] text-ink-2">{s.liveUrl}</p>
              <CopyButton text={s.liveUrl} />
            </section>
          )}
        </div>
      )}
    </Modal>
  );
}

/* ───────────── My studies ───────────── */
function MyStudies({ q, onNew }: { q: ReturnType<typeof useQuery<Project[]>>; onNew: () => void }) {
  const { can } = usePermissions();
  const { toast, confirm } = useFeedback();
  const [search, setSearch] = useState("");
  const [assign, setAssign] = useState<NSurvey[]>([]);
  const [cloneOf, setCloneOf] = useState<Project | null>(null);

  const rows = useMemo(() => {
    const t = search.toLowerCase();
    return (q.data || []).filter((p) => !t || p.project_name.toLowerCase().includes(t) || p.project_id.toLowerCase().includes(t));
  }, [q.data, search]);

  if (q.error && !q.data) return <ErrorState message={q.error} onRetry={q.reset} />;

  const asSurvey = (p: Project): NSurvey => ({
    id: p.project_id,
    name: p.project_name,
    client: p.client_name,
    cpi: num(p.cpi),
    loi: num(p.loi),
    ir: num(p.ir),
    target: num(p.target_completes),
    status: p.status,
    country: "—",
    language: "—",
    device: "—",
    type: "—",
    cloned: false,
  });

  const remove = async (p: Project) => {
    if (!(await confirm({ title: `Delete "${p.project_name}"?`, message: "This permanently removes the study and its allotments.", confirmLabel: "Delete", danger: true }))) return;
    try {
      await api.del(`/manage/projects/${p.id}`);
      toast("Study deleted");
      q.reload();
    } catch (e: any) {
      toast(e.message, "error");
    }
  };

  const cols: Column<Project>[] = [
    { key: "project_name", header: "Study", primary: true, render: (p) => (
        <div className="min-w-0">
          <p className="max-w-[260px] truncate font-semibold">{p.project_name}</p>
          <p className="font-mono text-[12px] text-ink-3">{p.project_id}</p>
        </div>
      ) },
    { key: "client_name", header: "Client" },
    { key: "cpi", header: "CPI", align: "right", sortValue: (p) => num(p.cpi), render: (p) => <span className="font-semibold">{money(p.cpi)}</span> },
    { key: "loi", header: "LOI", align: "right", render: (p) => `${p.loi} min` },
    { key: "ir", header: "IR", align: "right", render: (p) => `${p.ir}%` },
    { key: "target_completes", header: "Target", align: "right", render: (p) => num(p.target_completes).toLocaleString() },
    { key: "status", header: "Status", render: (p) => <StatusBadge status={p.status} /> },
    {
      key: "act",
      header: "",
      align: "right",
      render: (p) => (
        <div className="flex justify-end gap-1.5">
          {can(PERMS.SURVEYS_ASSIGN) && (
            <Button size="sm" variant="tinted" icon={<Link2 size={14} />} onClick={(e) => { e.stopPropagation(); setAssign([asSurvey(p)]); }}>
              Link
            </Button>
          )}
          {can(PERMS.SURVEYS_CLONE) && (
            <Button size="sm" variant="secondary" icon={<Copy size={14} />} onClick={(e) => { e.stopPropagation(); setCloneOf(p); }} aria-label="Duplicate" />
          )}
          {can(PERMS.SURVEYS_CREATE) && (
            <Button size="sm" variant="dangerSoft" icon={<Trash2 size={14} />} onClick={(e) => { e.stopPropagation(); remove(p); }} aria-label="Delete" />
          )}
        </div>
      ),
    },
  ];

  return (
    <>
      <DataTable
        columns={cols}
        rows={rows}
        rowKey={(p) => p.id}
        loading={q.loading}
        toolbar={<SearchInput value={search} onChange={setSearch} placeholder="Search your studies" className="sm:max-w-sm" />}
        empty={<EmptyState title="No studies yet" message="Create a study or duplicate one from the marketplace." action={can(PERMS.SURVEYS_CREATE) ? <Button onClick={onNew}>New study</Button> : undefined} />}
      />
      <AssignModal surveys={assign} onClose={() => setAssign([])} />
      <StudyForm open={!!cloneOf} base={cloneOf || undefined} duplicate onClose={() => setCloneOf(null)} onSaved={q.reload} />
    </>
  );
}

/* ───────────── Create / duplicate form ───────────── */
function StudyForm({
  open,
  onClose,
  onSaved,
  base,
  duplicate,
}: {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  base?: Project;
  duplicate?: boolean;
}) {
  const { toast } = useFeedback();
  const clients = useQuery(async () => (await api.get<{ data: Client[] }>("/clients")).data || [], []);
  const blank = { name: "", client_id: "", cpi: "1.50", loi: "10", ir: "70", target: "500", live_url: "", auto_pause: "50", country: "United States" };
  const [f, setF] = useState(blank);
  const [busy, setBusy] = useState(false);

  // reset whenever the dialog opens
  useEffect(() => {
    if (open)
      setF(
        base
          ? {
              name: `${base.project_name} (Clone)`,
              client_id: String(base.client_id || ""),
              cpi: String(base.cpi),
              loi: String(base.loi),
              ir: String(base.ir),
              target: String(base.target_completes),
              live_url: base.live_url || "",
              auto_pause: String(base.auto_pause_clicks || 50),
              country: "United States",
            }
          : blank,
      );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const set = (k: keyof typeof blank) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setF((p) => ({ ...p, [k]: e.target.value }));

  const save = async () => {
    if (!f.name.trim()) return toast("Give the study a name.", "error");
    if (num(f.cpi) <= 0 || num(f.target) <= 0) return toast("CPI and target must be above zero.", "error");
    const client = (clients.data || []).find((c) => String(c.id) === f.client_id);
    const body = {
      project_name: f.name.trim(),
      target_name: f.name.trim(),
      client_id: client?.id ?? (f.client_id ? Number(f.client_id) : undefined),
      client_name: client?.client_name,
      cpi: num(f.cpi),
      cost_per_complete: num(f.cpi),
      loi: num(f.loi),
      ir: num(f.ir),
      target_completes: num(f.target),
      max_limit: num(f.target),
      live_url: f.live_url.trim(),
      auto_pause_clicks: num(f.auto_pause),
      country: f.country,
      status: "Live",
      ...(base ? { source_project_id: base.project_id, id: base.id } : {}),
    };
    setBusy(true);
    try {
      await api.post(duplicate ? "/manage/projects/duplicate" : "/manage/projects", body);
      toast(duplicate ? "Study duplicated" : "Study created");
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
      open={open}
      onClose={onClose}
      title={duplicate ? "Duplicate study" : "New study"}
      subtitle="Set commercial terms and the client's live survey URL."
      size="lg"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button loading={busy} onClick={save}>
            {duplicate ? "Duplicate" : "Create study"}
          </Button>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Study name" className="sm:col-span-2">
          <Input value={f.name} onChange={set("name")} placeholder="e.g. US Consumers – Beverages" />
        </Field>
        <Field label="Client">
          <Select value={f.client_id} onChange={set("client_id")}>
            <option value="">Select a client</option>
            {(clients.data || []).map((c) => (
              <option key={c.id} value={c.id}>
                {c.client_name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Country">
          <Input value={f.country} onChange={set("country")} />
        </Field>
        <Field label="CPI ($)">
          <Input type="number" step="0.01" min="0" value={f.cpi} onChange={set("cpi")} />
        </Field>
        <Field label="Target completes">
          <Input type="number" min="1" value={f.target} onChange={set("target")} />
        </Field>
        <Field label="LOI (min)">
          <Input type="number" min="1" value={f.loi} onChange={set("loi")} />
        </Field>
        <Field label="IR (%)">
          <Input type="number" min="1" max="100" value={f.ir} onChange={set("ir")} />
        </Field>
        <Field label="Auto-pause after clicks" hint="Pause routing once this many clicks arrive without a complete">
          <Input type="number" min="0" value={f.auto_pause} onChange={set("auto_pause")} />
        </Field>
        <Field label="Client live URL" className="sm:col-span-2" hint="Use [RESPONDENT_ID] where the vendor UID should be injected">
          <Input value={f.live_url} onChange={set("live_url")} placeholder="https://client.com/start?uid=[RESPONDENT_ID]" />
        </Field>
      </div>
    </Modal>
  );
}
