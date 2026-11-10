import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowUpRight, ChevronDown, Copy, Download, ExternalLink, Link2, Pencil, Plus, RefreshCw, Share2, Trash2, Users } from "lucide-react";
import { api, type Client, type Project } from "../lib/api";
import { useQuery } from "../lib/useQuery";
import { entryLink, normalizeSurvey, type NSurvey } from "../lib/data";
import { exportCSV, formatDate, money, num } from "../lib/utils";
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
  Skeleton,
  StatusBadge,
  type Column,
} from "../components/ui";
import { useFeedback } from "../components/feedback";
import { AssignModal } from "../components/AssignModal";
import { EditAllotmentModal } from "../components/EditAllotmentModal";
import { PERMS, usePermissions } from "../lib/permissions";

export function Surveys() {
  const { can } = usePermissions();
  const [tab, setTab] = useState<"market" | "mine">("market");
  const { toast } = useFeedback();
  const [syncing, setSyncing] = useState(false);

  const market = useQuery(async () => {
    const [surveysRes, clientsRes] = await Promise.all([
      api.get<{ data: any[] }>("/zamplia"),
      api.get<{ data: Client[] }>("/clients").catch(() => ({ data: [] })),
    ]);
    const rawSurveys = surveysRes.data || [];
    const clientList: Client[] = clientsRes.data || [];

    // Map all inactive client names and codes
    const inactiveClients = new Set(
      clientList
        .filter((c) => c.status !== "Y" && c.status !== "Active")
        .flatMap((c) => [
          (c.client_name || "").toLowerCase().trim(),
          (c.client_code || "").toLowerCase().trim(),
        ])
        .filter(Boolean),
    );

    const normalized = rawSurveys.map(normalizeSurvey);

    return normalized.filter((s) => {
      const cName = (s.client || "").toLowerCase().trim();
      if (inactiveClients.has(cName)) return false;
      if (
        cName.includes("zamplia") &&
        (inactiveClients.has("zamplia") ||
          inactiveClients.has("zamplia global") ||
          inactiveClients.has("zamp_global"))
      ) {
        return false;
      }
      return true;
    });
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
        <Marketplace
          q={market}
          onCloned={() => {
            mine.reload();
            market.reload();
            setTab("mine");
          }}
        />
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

/* ───────────── Custom Action Dropdown (Theme Safe, No Browser Select Quirks) ───────────── */
function ActionDropdown({
  value,
  onChange,
  actions,
}: {
  value: "assign" | "link" | "clone";
  onChange: (v: "assign" | "link" | "clone") => void;
  actions: { id: "assign" | "link" | "clone"; label: string; icon: React.ReactNode }[];
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [open]);

  const current = actions.find((a) => a.id === value) || actions[0];

  return (
    <div className="relative inline-block text-left" ref={ref} onClick={(e) => e.stopPropagation()}>
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="flex items-center gap-1.5 rounded-lg border border-line bg-surface px-2.5 py-1 text-[12px] font-semibold text-ink shadow-sm transition hover:bg-fill hover:border-line-strong focus:outline-none focus:ring-1 focus:ring-accent cursor-pointer"
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span className="flex items-center gap-1.5">
          {current?.icon}
          {current?.label}
        </span>
        <ChevronDown size={13} className={cn("text-ink-3 transition-transform duration-200", open && "rotate-180")} />
      </button>

      {open && (
        <div
          role="listbox"
          className="anim-scale-in absolute right-0 z-50 mt-1 min-w-[130px] overflow-hidden rounded-xl border border-line bg-surface p-1 shadow-[var(--shadow-lg)]"
        >
          {actions.map((act) => {
            const isSelected = act.id === value;
            return (
              <button
                key={act.id}
                type="button"
                role="option"
                aria-selected={isSelected}
                onClick={() => {
                  onChange(act.id);
                  setOpen(false);
                }}
                className={cn(
                  "flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-[12px] font-medium transition cursor-pointer",
                  isSelected
                    ? "bg-accent text-white font-semibold"
                    : "text-ink hover:bg-fill"
                )}
              >
                <span className={isSelected ? "text-white" : "text-ink-2"}>{act.icon}</span>
                <span>{act.label}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ───────────── Marketplace ───────────── */
function Marketplace({
  q,
  onCloned,
}: {
  q: ReturnType<typeof useQuery<NSurvey[]>>;
  onCloned?: () => void;
}) {
  const { can, user } = usePermissions();
  const isVendor = user?.role_id === 3 || user?.role_name === "Vendor" || user?.role_name?.toLowerCase().includes("vendor");
  const { toast } = useFeedback();
  const [search, setSearch] = useState("");
  const [client, setClient] = useState("all");
  const [status, setStatus] = useState("all");
  const [sortBy, setSortBy] = useState("newest");
  const [selected, setSelected] = useState<Set<string | number>>(new Set());
  const [detail, setDetail] = useState<NSurvey | null>(null);
  const [assign, setAssign] = useState<NSurvey[]>([]);
  const [actionType, setActionType] = useState<"assign" | "link" | "clone">("assign");
  const [activeLink, setActiveLink] = useState<{ id: string; name: string; url: string } | null>(null);
  const [cloneStudy, setCloneStudy] = useState<NSurvey | null>(null);

  const availableActions = useMemo(() => {
    const acts: { id: "assign" | "link" | "clone"; label: string; icon: React.ReactNode }[] = [];
    if (can(PERMS.SURVEYS_ASSIGN)) acts.push({ id: "assign", label: "Assign", icon: <Share2 size={13} /> });
    acts.push({ id: "link", label: "Link", icon: <Link2 size={13} /> });
    if (can(PERMS.SURVEYS_CLONE)) acts.push({ id: "clone", label: "Clone", icon: <Copy size={13} /> });
    return acts;
  }, [can]);

  useEffect(() => {
    if (availableActions.length > 0 && !availableActions.some((a) => a.id === actionType)) {
      setActionType(availableActions[0].id);
    }
  }, [availableActions, actionType]);

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
    {
      key: "id",
      header: "Survey",
      primary: true,
      render: (s) => (
        <div className="min-w-0">
          <p className="font-mono text-[13px] font-semibold text-ink">#{s.id}</p>
          <p className="max-w-[220px] truncate text-[12px] text-ink-3">{s.name}</p>
        </div>
      ),
    },
    {
      key: "client",
      header: "Client",
      render: (s) => (
        <span className={cn("text-ink-2", isVendor && "font-semibold text-accent")}>
          {isVendor ? "VMH GROUP" : s.client}
        </span>
      ),
    },
    {
      key: "cpi",
      header: isVendor ? "Payout" : "CPI",
      align: "right",
      sortValue: (s) => s.cpi,
      render: (s) => <span className="font-semibold">{money(s.cpi)}</span>,
    },
    { key: "loi", header: "LOI", align: "right", sortValue: (s) => s.loi, render: (s) => `${s.loi} min` },
    {
      key: "ir",
      header: "IR",
      align: "right",
      sortValue: (s) => s.ir,
      render: (s) => <Badge tone={s.ir >= 60 ? "green" : s.ir >= 30 ? "orange" : "red"}>{s.ir}%</Badge>,
    },
    { key: "target", header: "Target", align: "right", sortValue: (s) => s.target, render: (s) => num(s.target).toLocaleString() },
    { key: "end", header: "Ends", hideMobile: true, render: (s) => <span className="text-ink-3">{formatDate(s.endDate, false)}</span> },
    { key: "status", header: "Status", render: (s) => <StatusBadge status={s.status} /> },
    ...(availableActions.length > 0
      ? [
          {
            key: "action",
            header: (
              <div className="flex items-center justify-end">
                <ActionDropdown
                  value={actionType}
                  onChange={setActionType}
                  actions={availableActions}
                />
              </div>
            ),
            align: "right" as const,
            hideMobile: true,
            render: (s: NSurvey) => {
              if (actionType === "assign") {
                return (
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
                );
              }
              if (actionType === "link") {
                return (
                  <Button
                    size="sm"
                    variant="tinted"
                    icon={<Link2 size={14} />}
                    onClick={(e) => {
                      e.stopPropagation();
                      const url = entryLink(s.id);
                      navigator.clipboard?.writeText?.(url);
                      toast("Survey entry link copied!", "success");
                      setActiveLink({ id: s.id, name: s.name, url });
                    }}
                  >
                    Link
                  </Button>
                );
              }
              return (
                <Button
                  size="sm"
                  variant="tinted"
                  icon={<Copy size={14} />}
                  onClick={(e) => {
                    e.stopPropagation();
                    setCloneStudy(s);
                  }}
                >
                  Clone
                </Button>
              );
            },
          },
        ]
      : []),
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
        selectable={can(PERMS.SURVEYS_ASSIGN)}
        selected={selected}
        onSelectedChange={setSelected}
        onRowClick={setDetail}
        empty={<EmptyState title="No surveys match" message="Try clearing a filter or syncing the marketplace." />}
        toolbar={
          <div className="flex flex-col gap-2.5 lg:flex-row lg:items-center">
            <SearchInput value={search} onChange={setSearch} placeholder="Search by ID or name" className="lg:w-72" />
            <div className="grid flex-1 grid-cols-3 gap-2 lg:flex lg:flex-none">
              {!isVendor && (
                <Select value={client} onChange={(e) => setClient(e.target.value)} className="!h-10 !text-[14px] lg:w-44" aria-label="Client">
                  <option value="all">All clients</option>
                  {clients.map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </Select>
              )}
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
      <StudyForm
        open={!!cloneStudy}
        base={cloneStudy || undefined}
        duplicate
        onClose={() => setCloneStudy(null)}
        onSaved={() => {
          setCloneStudy(null);
          onCloned?.();
        }}
      />
      <Modal
        open={!!activeLink}
        onClose={() => setActiveLink(null)}
        title="Survey Entry Link"
        subtitle={`Live respondent routing link for survey #${activeLink?.id}`}
      >
        <div className="space-y-4">
          <div>
            <p className="mb-1 text-[12px] font-semibold uppercase tracking-wider text-ink-3">Study Name</p>
            <p className="text-[14px] font-medium text-ink">{activeLink?.name}</p>
          </div>
          <div>
            <p className="mb-1.5 text-[12px] font-semibold uppercase tracking-wider text-ink-3">Direct Entry URL</p>
            <div className="flex items-center gap-2">
              <input
                readOnly
                value={activeLink?.url || ""}
                onFocus={(e) => e.target.select()}
                className="flex-1 rounded-xl border border-line bg-fill px-3 py-2 font-mono text-[13px] text-ink outline-none select-all"
              />
              <Button
                variant="primary"
                icon={<Copy size={14} />}
                onClick={() => {
                  if (activeLink?.url) {
                    navigator.clipboard?.writeText?.(activeLink.url);
                    toast("Link copied to clipboard!", "success");
                  }
                }}
              >
                Copy
              </Button>
            </div>
            <p className="mt-2 text-[12px] text-ink-3">
              Append your supply tracking parameters such as{" "}
              <code className="rounded bg-fill px-1 py-0.5 text-accent">&uid=[USER_ID]</code> or{" "}
              <code className="rounded bg-fill px-1 py-0.5 text-accent">&rid=[TRANSACTION_ID]</code>.
            </p>
          </div>
          <div className="flex justify-end pt-2">
            <Button
              variant="secondary"
              icon={<ExternalLink size={14} />}
              onClick={() => {
                if (activeLink?.url) window.open(activeLink.url, "_blank", "noopener,noreferrer");
              }}
            >
              Test link in new tab
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}

function SurveyDrawer({ survey, onClose, onAssign }: { survey: NSurvey | null; onClose: () => void; onAssign: (s: NSurvey) => void }) {
  const { can, user } = usePermissions();
  const isVendor = user?.role_id === 3 || user?.role_name === "Vendor" || user?.role_name?.toLowerCase().includes("vendor");
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
        ["Client", isVendor ? "VMH GROUP" : s.client],
        [isVendor ? "Payout Rate" : "Client CPI", money(s.cpi)],
        ["Length of interview", `${s.loi} min`],
        ["Incidence rate", `${s.ir}%`],
        ["Completes needed", num(s.target).toLocaleString()],
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

          {!isVendor && s.liveUrl && (
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
  const { can, user } = usePermissions();
  const isVendor = user?.role_id === 3 || user?.role_name === "Vendor" || user?.role_name?.toLowerCase().includes("vendor");
  const { toast, confirm } = useFeedback();
  const [search, setSearch] = useState("");
  const [assign, setAssign] = useState<NSurvey[]>([]);
  const [cloneOf, setCloneOf] = useState<Project | null>(null);
  const [editStudy, setEditStudy] = useState<Project | null>(null);
  const [detailStudy, setDetailStudy] = useState<Project | null>(null);

  // Load allotments count for each study
  const allots = useQuery(async () => (await api.get<{ data: any[] }>("/vendor/allotments")).data || [], []);

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
      allots.reload();
    } catch (e: any) {
      toast(e.message, "error");
    }
  };

  const cols: Column<Project>[] = [
    {
      key: "project_name",
      header: "Study",
      primary: true,
      render: (p) => (
        <div className="min-w-0">
          <p className="max-w-[260px] truncate font-semibold">{p.project_name}</p>
          <p className="font-mono text-[12px] text-ink-3">{p.project_id}</p>
        </div>
      ),
    },
    {
      key: "client_name",
      header: "Client",
      render: (p) => (
        <span className={cn("text-ink-2", isVendor && "font-semibold text-accent")}>
          {isVendor ? "VMH GROUP" : (p.client_name || "Direct")}
        </span>
      ),
    },
    {
      key: "cpi",
      header: isVendor ? "Payout" : "CPI",
      align: "right",
      sortValue: (p) => num(p.cpi),
      render: (p) => <span className="font-semibold">{money(p.cpi)}</span>,
    },
    { key: "loi", header: "LOI", align: "right", render: (p) => `${p.loi} min` },
    { key: "ir", header: "IR", align: "right", render: (p) => `${p.ir}%` },
    { key: "target_completes", header: "Target", align: "right", render: (p) => num(p.target_completes).toLocaleString() },
    {
      key: "clicks_completes",
      header: "Clicks / Comp",
      align: "right",
      sortValue: (p) => num(p.total_clicks),
      render: (p) => (
        <div className="text-right">
          <span className="tabular font-medium text-[13px] text-ink">{num(p.total_clicks)}</span>
          <span className="text-ink-3 text-[12px]"> / </span>
          <span className={num(p.total_completes) > 0 ? "font-semibold text-green tabular text-[13px]" : "text-ink-3 tabular text-[13px]"}>
            {num(p.total_completes)}
          </span>
        </div>
      ),
    },
    {
      key: "auto_pause_clicks",
      header: "Auto-Pause",
      align: "right",
      render: (p) => {
        const limit = num(p.auto_pause_clicks, 50);
        const clicks = num(p.total_clicks);
        const comp = num(p.total_completes);
        const isPausedByCap = p.status === "Pause" && limit > 0 && clicks >= limit && comp === 0;

        return (
          <span
            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-mono ${
              isPausedByCap
                ? "bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 font-semibold border border-amber-200 dark:border-amber-800/60"
                : "bg-fill text-ink-2"
            }`}
            title={isPausedByCap ? `Auto-paused: reached ${clicks} clicks without a complete (limit: ${limit})` : `Auto-pauses at ${limit} clicks if 0 completes`}
          >
            {isPausedByCap ? "Auto-Paused" : `${limit} clk limit`}
          </span>
        );
      },
    },
    { key: "status", header: "Status", render: (p) => <StatusBadge status={p.status} /> },
    {
      key: "allotments",
      header: "Partners",
      render: (p) => {
        const count = (allots.data || []).filter((a: any) => a.project_id === p.project_id).length;
        return (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setDetailStudy(p);
            }}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium bg-fill hover:bg-fill-hover text-ink-2 transition cursor-pointer"
            title="View & manage assigned supply partners"
          >
            <Users size={12} className="text-ink-3" />
            <span>{count > 0 ? `${count} partner${count > 1 ? "s" : ""}` : "Assign"}</span>
          </button>
        );
      },
    },
    {
      key: "act",
      header: "",
      align: "right",
      render: (p) => (
        <div className="flex justify-end gap-1.5" onClick={(e) => e.stopPropagation()}>
          {can(PERMS.SURVEYS_ASSIGN) && (
            <Button
              size="sm"
              variant="tinted"
              icon={<Share2 size={13} />}
              onClick={() => setAssign([asSurvey(p)])}
              title="Assign to supply partners"
            >
              Assign
            </Button>
          )}
          <Button
            size="sm"
            variant="secondary"
            icon={<Pencil size={13} />}
            onClick={() => setEditStudy(p)}
            aria-label="Edit study"
            title="Edit study"
          />
          {can(PERMS.SURVEYS_CLONE) && (
            <Button
              size="sm"
              variant="secondary"
              icon={<Copy size={13} />}
              onClick={() => setCloneOf(p)}
              aria-label="Duplicate"
              title="Duplicate study"
            />
          )}
          {can(PERMS.SURVEYS_CREATE) && (
            <Button
              size="sm"
              variant="dangerSoft"
              icon={<Trash2 size={13} />}
              onClick={() => remove(p)}
              aria-label="Delete"
              title="Delete study"
            />
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
        onRowClick={(p) => setDetailStudy(p)}
        toolbar={<SearchInput value={search} onChange={setSearch} placeholder="Search your studies" className="sm:max-w-sm" />}
        empty={
          <EmptyState
            title="No studies yet"
            message="Create a study or duplicate one from the marketplace."
            action={can(PERMS.SURVEYS_CREATE) ? <Button onClick={onNew}>New study</Button> : undefined}
          />
        }
      />

      {/* Assign Modal */}
      <AssignModal
        surveys={assign}
        onClose={() => setAssign([])}
        onDone={() => {
          allots.reload();
          q.reload();
        }}
      />

      {/* Duplicate Study Modal */}
      <StudyForm
        open={!!cloneOf}
        base={cloneOf || undefined}
        duplicate
        onClose={() => setCloneOf(null)}
        onSaved={() => {
          q.reload();
          allots.reload();
        }}
      />

      {/* Edit Study Modal */}
      <StudyForm
        open={!!editStudy}
        base={editStudy || undefined}
        edit
        onClose={() => setEditStudy(null)}
        onSaved={() => {
          q.reload();
          allots.reload();
        }}
      />

      {/* Study Details & Allotted Supply Partners Drawer */}
      <StudyDetailDrawer
        study={detailStudy}
        onClose={() => setDetailStudy(null)}
        onAssign={(p) => setAssign([asSurvey(p)])}
        onEdit={(p) => setEditStudy(p)}
        onReload={() => {
          q.reload();
          allots.reload();
        }}
      />
    </>
  );
}

/* ───────────── Study Detail & Allotments Drawer ───────────── */
function StudyDetailDrawer({
  study,
  onClose,
  onAssign,
  onEdit,
  onReload,
}: {
  study: Project | null;
  onClose: () => void;
  onAssign: (p: Project) => void;
  onEdit: (p: Project) => void;
  onReload: () => void;
}) {
  const { can, user } = usePermissions();
  const isVendor = user?.role_id === 3 || user?.role_name === "Vendor" || user?.role_name?.toLowerCase().includes("vendor");
  const { toast, confirm } = useFeedback();
  const [editAllot, setEditAllot] = useState<any | null>(null);

  const allotmentsQuery = useQuery(async () => {
    if (!study) return [];
    const res = await api.get<{ data: any[] }>("/vendor/allotments");
    const all = res.data || [];
    return all.filter((a) => a.project_id === study.project_id);
  }, [study?.project_id]);

  if (!study) return null;

  const removeAllot = async (a: any) => {
    if (
      !(await confirm({
        title: "Remove vendor allotment?",
        message: `${a.vendor_id} will lose access to study #${study.project_id}.`,
        confirmLabel: "Remove",
        danger: true,
      }))
    )
      return;
    try {
      await api.del("/vendor/allot", { project_id: study.project_id, vendor_id: a.vendor_id });
      toast("Vendor allotment removed");
      allotmentsQuery.reload();
      onReload();
    } catch (e: any) {
      toast(e.message, "error");
    }
  };

  const allotted = allotmentsQuery.data || [];

  return (
    <>
      <Modal
        open={!!study}
        onClose={onClose}
        drawer
        title={study.project_name}
        subtitle={`#${study.project_id} · ${isVendor ? "VMH GROUP" : (study.client_name || "Direct")}`}
        footer={
          !isVendor ? (
            <div className="flex w-full items-center justify-between gap-2">
              <Button
                variant="secondary"
                icon={<Pencil size={15} />}
                onClick={() => {
                  onEdit(study);
                  onClose();
                }}
              >
                Edit study
              </Button>
              {can(PERMS.SURVEYS_ASSIGN) && (
                <Button
                  variant="primary"
                  icon={<Share2 size={15} />}
                  onClick={() => {
                    onAssign(study);
                    onClose();
                  }}
                >
                  Assign to vendor
                </Button>
              )}
            </div>
          ) : undefined
        }
      >
        <div className="space-y-6">
          {/* Key study metrics */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-2xl bg-fill p-3.5">
              <p className="text-[11px] font-medium text-ink-3">CPI</p>
              <p className="mt-0.5 text-[18px] font-bold text-accent tabular">{money(study.cpi)}</p>
            </div>
            <div className="rounded-2xl bg-fill p-3.5">
              <p className="text-[11px] font-medium text-ink-3">LOI</p>
              <p className="mt-0.5 text-[18px] font-bold tabular">{study.loi} min</p>
            </div>
            <div className="rounded-2xl bg-fill p-3.5">
              <p className="text-[11px] font-medium text-ink-3">IR</p>
              <p className="mt-0.5 text-[18px] font-bold tabular">{study.ir}%</p>
            </div>
            <div className="rounded-2xl bg-fill p-3.5">
              <p className="text-[11px] font-medium text-ink-3">Target</p>
              <p className="mt-0.5 text-[18px] font-bold tabular">{num(study.target_completes).toLocaleString()}</p>
            </div>
          </div>

          {/* Status and Client info */}
          <div className="rounded-2xl border border-line p-4 space-y-2 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-ink-3">Client</span>
              <span className={cn("font-semibold text-ink", isVendor && "text-accent")}>
                {isVendor ? "VMH GROUP" : (study.client_name || "Direct")}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-ink-3">Status</span>
              <StatusBadge status={study.status} />
            </div>
            {!isVendor && study.live_url && (
              <div className="pt-2 border-t border-line/60">
                <span className="text-ink-3 block mb-1">Live Survey URL</span>
                <p className="font-mono text-[11px] text-ink-2 break-all bg-fill p-2 rounded-lg">
                  {study.live_url}
                </p>
              </div>
            )}
          </div>

          {/* Assigned Supply Partners / Vendors or Vendor Tracking Link */}
          {isVendor ? (
            <div>
              <h3 className="text-[15px] font-semibold text-ink mb-1">Your Tracking Link</h3>
              <p className="text-[12px] text-ink-3 mb-3">Share this link with your respondents</p>
              <div className="rounded-2xl border border-line bg-surface p-4 space-y-3">
                <p className="font-mono text-[11.5px] text-ink-2 break-all bg-fill p-2.5 rounded-xl select-all">
                  {`https://api.vmhgroupsmr.com/#/prescreener?pid=${study.project_id}&vid=${user?.username || "VND"}&uid=[YOUR_UID]`}
                </p>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="secondary"
                    icon={<Copy size={13} />}
                    onClick={() => {
                      navigator.clipboard?.writeText?.(
                        `https://api.vmhgroupsmr.com/#/prescreener?pid=${study.project_id}&vid=${user?.username || "VND"}&uid=[YOUR_UID]`
                      );
                      toast("Tracking link copied!", "success");
                    }}
                  >
                    Copy Link
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    icon={<ExternalLink size={13} />}
                    onClick={() =>
                      window.open(
                        `https://api.vmhgroupsmr.com/#/prescreener?pid=${study.project_id}&vid=${user?.username || "VND"}&uid=TEST_${Date.now()}`,
                        "_blank"
                      )
                    }
                  >
                    Test Link
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            <div>
              <div className="mb-3 flex items-center justify-between">
                <div>
                  <h3 className="text-[15px] font-semibold text-ink">Assigned Supply Partners</h3>
                  <p className="text-[12px] text-ink-3">Vendors with live tracking access to this study</p>
                </div>
                <Button
                  size="sm"
                  variant="tinted"
                  icon={<Plus size={13} />}
                  onClick={() => {
                    onAssign(study);
                    onClose();
                  }}
                >
                  Assign vendor
                </Button>
              </div>

            {allotmentsQuery.loading ? (
              <div className="space-y-2">
                <Skeleton className="h-16 w-full rounded-2xl" />
                <Skeleton className="h-16 w-full rounded-2xl" />
              </div>
            ) : allotted.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-line p-6 text-center">
                <Users className="mx-auto h-8 w-8 text-ink-4 mb-2" />
                <p className="text-sm font-semibold text-ink">No vendors assigned yet</p>
                <p className="mt-1 text-xs text-ink-3 max-w-xs mx-auto">
                  Assign this study to supply partners to generate unique tracking entry links.
                </p>
                <Button
                  size="sm"
                  className="mt-4"
                  icon={<Share2 size={14} />}
                  onClick={() => {
                    onAssign(study);
                    onClose();
                  }}
                >
                  Assign first vendor
                </Button>
              </div>
            ) : (
              <ul className="space-y-2.5">
                {allotted.map((a: any) => (
                  <li key={a.id || a.vendor_id} className="rounded-2xl border border-line bg-surface p-3.5 shadow-xs">
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <div className="min-w-0">
                        <span className="font-mono text-[13px] font-semibold text-ink">{a.vendor_id}</span>
                        {a.vendor_name && a.vendor_name !== a.vendor_id && (
                          <span className="ml-2 text-xs text-ink-3 truncate">({a.vendor_name})</span>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Badge tone={a.status === "Active" ? "green" : "gray"}>{a.status || "Active"}</Badge>
                        <Button
                          size="sm"
                          variant="secondary"
                          icon={<Pencil size={12} />}
                          onClick={() => setEditAllot(a)}
                          title="Edit vendor CPI / quota"
                        />
                        <Button
                          size="sm"
                          variant="dangerSoft"
                          icon={<Trash2 size={12} />}
                          onClick={() => removeAllot(a)}
                          title="Remove vendor"
                        />
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-xs text-ink-3 mb-2 tabular">
                      <span>Vendor CPI: <strong className="text-ink font-semibold">{money(a.vendor_cpi)}</strong></span>
                      <span>Quota: <strong className="text-ink font-semibold">{a.complete_count || 0}/{a.quota_limit}</strong></span>
                    </div>

                    <div className="flex items-center gap-2 pt-2 border-t border-line/60">
                      <p className="flex-1 truncate font-mono text-[11px] text-ink-3 bg-fill px-2 py-1 rounded">
                        {a.entry_link}
                      </p>
                      <CopyButton text={a.entry_link} label="Copy link" />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
        </div>
      </Modal>

      <EditAllotmentModal
        allotment={editAllot}
        onClose={() => setEditAllot(null)}
        onSaved={() => {
          allotmentsQuery.reload();
          onReload();
        }}
      />
    </>
  );
}

/* ───────────── Create / duplicate / edit form ───────────── */
function StudyForm({
  open,
  onClose,
  onSaved,
  base,
  duplicate,
  edit,
}: {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  base?: Project | NSurvey;
  duplicate?: boolean;
  edit?: boolean;
}) {
  const { toast } = useFeedback();
  const clients = useQuery(async () => (await api.get<{ data: Client[] }>("/clients")).data || [], []);
  const blank = {
    name: "",
    client_id: "",
    cpi: "1.50",
    loi: "10",
    ir: "70",
    target: "500",
    live_url: "",
    auto_pause: "50",
    country: "United States",
    status: "Live",
  };
  const [f, setF] = useState(blank);
  const [busy, setBusy] = useState(false);

  // reset whenever the dialog opens
  useEffect(() => {
    if (open) {
      if (base) {
        const isProject = "project_name" in base;
        const name = isProject ? (base as Project).project_name : (base as NSurvey).name;
        const cpi = isProject ? String((base as Project).cpi) : String((base as NSurvey).cpi);
        const loi = isProject ? String((base as Project).loi) : String((base as NSurvey).loi);
        const ir = isProject ? String((base as Project).ir) : String((base as NSurvey).ir);
        const target = isProject
          ? String((base as Project).target_completes)
          : String((base as NSurvey).target || 500);
        const liveUrl = isProject
          ? (base as Project).live_url || ""
          : (base as NSurvey).liveUrl || entryLink((base as NSurvey).id);
        const clientId = isProject
          ? String((base as Project).client_id || "")
          : String((base as NSurvey).clientId || "");
        const status = isProject ? (base as Project).status || "Live" : (base as NSurvey).status || "Live";

        setF({
          name: edit ? name : duplicate ? `${name} (Clone)` : name,
          client_id: clientId,
          cpi,
          loi,
          ir,
          target,
          live_url: liveUrl,
          auto_pause: isProject ? String((base as Project).auto_pause_clicks || 50) : "50",
          country: "United States",
          status,
        });
      } else {
        setF(blank);
      }
    }
  }, [open, edit, duplicate]);

  const set = (k: keyof typeof blank) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setF((p) => ({ ...p, [k]: e.target.value }));

  const save = async () => {
    if (!f.name.trim()) return toast("Give the study a name.", "error");
    if (num(f.cpi) <= 0 || num(f.target) <= 0) return toast("CPI and target must be above zero.", "error");
    const client = (clients.data || []).find((c) => String(c.id) === f.client_id);
    const isProject = base && "project_name" in base;
    const baseId = isProject ? (base as Project).id : undefined;
    const baseProjectId = isProject ? (base as Project).project_id : (base as NSurvey)?.id;

    const body: any = {
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
      status: f.status || "Live",
    };

    if (edit && baseId) {
      body.id = baseId;
      body.project_id = baseProjectId;
    } else if (duplicate) {
      body.source_project_id = baseProjectId;
    }

    setBusy(true);
    try {
      await api.post(duplicate ? "/manage/projects/duplicate" : "/manage/projects", body);
      toast(edit ? "Study updated successfully" : duplicate ? "Study duplicated" : "Study created");
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
      title={edit ? "Edit study" : duplicate ? "Duplicate study" : "New study"}
      subtitle={
        edit
          ? `Update parameters and client live survey URL for #${(base as any)?.project_id || ""}`
          : "Set commercial terms and the client's live survey URL."
      }
      size="lg"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button loading={busy} onClick={save}>
            {edit ? "Save changes" : duplicate ? "Duplicate" : "Create study"}
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
        <Field label="Status">
          <Select value={f.status} onChange={set("status")}>
            <option value="Live">Live</option>
            <option value="Pause">Pause</option>
            <option value="Draft">Draft</option>
            <option value="Closed">Closed</option>
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
        <Field
          label="Auto-pause click threshold"
          hint="Automatically pauses study if this many clicks arrive with 0 completes (e.g. 50, 30, 10). Set 0 to disable."
        >
          <Input type="number" min="0" value={f.auto_pause} onChange={set("auto_pause")} placeholder="50" />
        </Field>
        <Field label="Client live URL" className="sm:col-span-2" hint="Use [RESPONDENT_ID] where the vendor UID should be injected">
          <Input value={f.live_url} onChange={set("live_url")} placeholder="https://client.com/start?uid=[RESPONDENT_ID]" />
        </Field>
      </div>
    </Modal>
  );
}
