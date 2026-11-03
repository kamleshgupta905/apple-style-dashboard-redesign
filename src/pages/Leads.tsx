import { useMemo, useState } from "react";
import { Download, Pause, Play } from "lucide-react";
import { api, type Lead } from "../lib/api";
import { useQuery } from "../lib/useQuery";
import { exportCSV, formatDate, num, timeAgo } from "../lib/utils";
import {
  Button,
  Card,
  CopyButton,
  CountUp,
  DataTable,
  EmptyState,
  ErrorState,
  Modal,
  PageHeader,
  SearchInput,
  Select,
  StatusBadge,
  type Column,
} from "../components/ui";
import { Stacked } from "../components/charts";
import { PERMS, usePermissions } from "../lib/permissions";
import { cn } from "../utils/cn";

interface Summary {
  total_clicks: number;
  total_completes: number;
  total_terminates: number;
  total_overquota: number;
  conversion_rate: number;
}

export function Leads() {
  const { can } = usePermissions();
  const [live, setLive] = useState(true);
  const q = useQuery(
    async () => {
      const r = await api.get<{ data: Lead[]; summary: Summary }>("/leads", { limit: 500 });
      return { leads: r.data || [], summary: r.summary };
    },
    [],
    { poll: live ? 10000 : undefined },
  );
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [vendor, setVendor] = useState("all");
  const [open, setOpen] = useState<Lead | null>(null);

  const leads = q.data?.leads || [];
  const vendors = useMemo(() => [...new Set(leads.map((l) => l.vendor_code))], [leads]);
  const statuses = useMemo(() => [...new Set(leads.map((l) => l.status))], [leads]);

  const rows = useMemo(() => {
    const t = search.trim().toLowerCase();
    return leads.filter(
      (l) =>
        (status === "all" || l.status === status) &&
        (vendor === "all" || l.vendor_code === vendor) &&
        (!t || [l.uid, l.ip_address, l.project_id, l.project_name, l.country].some((x) => (x || "").toLowerCase().includes(t))),
    );
  }, [leads, search, status, vendor]);

  if (q.error && !q.data) return <ErrorState message={q.error} onRetry={q.reset} />;

  const s = q.data?.summary;
  const cols: Column<Lead>[] = [
    { key: "created_at", header: "Time", sortValue: (l) => l.created_at, render: (l) => (
        <div>
          <p className="font-medium">{timeAgo(l.created_at)}</p>
          <p className="text-[12px] text-ink-3">{formatDate(l.created_at)}</p>
        </div>
      ) },
    { key: "uid", header: "Respondent", primary: true, render: (l) => <span className="font-mono text-[13px] font-semibold">{l.uid}</span> },
    { key: "project_name", header: "Study", render: (l) => <span className="block max-w-[200px] truncate">{l.project_name}</span> },
    { key: "vendor_code", header: "Vendor", render: (l) => <span className="font-mono text-[12.5px]">{l.vendor_code}</span> },
    { key: "country", header: "Country", sortValue: (l) => l.country || "" },
    { key: "ip", header: "IP", hideMobile: true, render: (l) => <span className="block max-w-[140px] truncate font-mono text-[12px] text-ink-3">{l.ip_address}</span> },
    { key: "status", header: "Status", sortValue: (l) => l.status, render: (l) => <StatusBadge status={l.status} /> },
  ];

  const tiles = [
    { label: "Clicks", value: num(s?.total_clicks) },
    { label: "Completes", value: num(s?.total_completes), tone: "text-green" },
    { label: "Terminates", value: num(s?.total_terminates), tone: "text-red" },
    { label: "Conversion", value: num(s?.conversion_rate), suffix: "%", tone: "text-accent" },
  ];

  const counts = (st: string) => leads.filter((l) => l.status === st).length;

  return (
    <div>
      <PageHeader
        title="Traffic stream"
        subtitle="Every respondent routed through the gateway, in real time."
        actions={
          <>
            <Button variant="secondary" icon={live ? <Pause size={15} /> : <Play size={15} />} onClick={() => setLive((v) => !v)}>
              {live ? "Pause live" : "Go live"}
            </Button>
            {can(PERMS.LEADS_EXPORT) && (
              <Button
                variant="secondary"
                icon={<Download size={15} />}
                onClick={() =>
                  exportCSV(
                    "traffic-leads",
                    ["Time", "UID", "Study ID", "Study", "Vendor", "Country", "IP", "Status", "Reason"],
                    rows.map((l) => [l.created_at, l.uid, l.project_id, l.project_name, l.vendor_code, l.country, l.ip_address, l.status, l.reason]),
                  )
                }
              >
                Export
              </Button>
            )}
          </>
        }
      />

      <div className="stagger mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
        {tiles.map((t) => (
          <Card key={t.label} className="p-4 sm:p-5">
            <p className="text-[13px] font-medium text-ink-3">{t.label}</p>
            <p className={cn("mt-0.5 text-[28px] font-bold tracking-tight", t.tone)}>
              <CountUp value={t.value} suffix={t.suffix} />
            </p>
          </Card>
        ))}
      </div>

      {leads.length > 0 && (
        <Card className="anim-fade-up mb-5 p-5">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <p className="text-[14px] font-semibold">Outcome mix</p>
            <div className="flex items-center gap-1.5 text-[12px] text-ink-3">
              {live && (
                <span className="relative mr-1 flex h-2 w-2">
                  <span className="anim-ping absolute inline-flex h-full w-full rounded-full bg-green" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-green" />
                </span>
              )}
              {live ? "Live · every 10s" : "Paused"}
            </div>
          </div>
          <Stacked
            parts={[
              { label: "Complete", value: counts("Complete"), color: "var(--green)" },
              { label: "Pending", value: counts("Pending"), color: "var(--orange)" },
              { label: "Terminates", value: counts("Terminates"), color: "var(--red)" },
              { label: "Security", value: counts("Security Terminate"), color: "var(--purple)" },
            ]}
          />
          <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-[12px] text-ink-2">
            {[
              ["Complete", "var(--green)"],
              ["Pending", "var(--orange)"],
              ["Terminates", "var(--red)"],
              ["Security Terminate", "var(--purple)"],
            ].map(([k, c]) => (
              <span key={k} className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full" style={{ background: c }} />
                {k} <b className="text-ink tabular">{counts(k)}</b>
              </span>
            ))}
          </div>
        </Card>
      )}

      <DataTable
        columns={cols}
        rows={rows}
        rowKey={(l) => l.id}
        loading={q.loading}
        onRowClick={setOpen}
        pageSize={12}
        empty={<EmptyState title="No sessions found" message="Adjust filters, or wait for new traffic." />}
        toolbar={
          <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center">
            <SearchInput value={search} onChange={setSearch} placeholder="UID, IP, study, country" className="sm:w-72" />
            <div className="grid grid-cols-2 gap-2 sm:flex">
              <Select value={status} onChange={(e) => setStatus(e.target.value)} className="!h-10 !text-[14px] sm:w-44" aria-label="Status">
                <option value="all">All outcomes</option>
                {statuses.map((x) => (
                  <option key={x}>{x}</option>
                ))}
              </Select>
              <Select value={vendor} onChange={(e) => setVendor(e.target.value)} className="!h-10 !text-[14px] sm:w-44" aria-label="Vendor">
                <option value="all">All vendors</option>
                {vendors.map((x) => (
                  <option key={x}>{x}</option>
                ))}
              </Select>
            </div>
            <p className="text-[13px] text-ink-3 sm:ml-auto">{rows.length} sessions</p>
          </div>
        }
      />

      <Modal open={!!open} onClose={() => setOpen(null)} drawer title="Session details" subtitle={open?.uid}>
        {open && (
          <div className="space-y-5">
            <StatusBadge status={open.status} />
            <dl className="divide-y divide-line overflow-hidden rounded-2xl border border-line">
              {[
                ["Study", `${open.project_name}`],
                ["Study ID", open.project_id],
                ["Vendor", `${open.vendor_name || ""} (${open.vendor_code})`],
                ["Country", open.country],
                ["IP address", open.ip_address],
                ["Reason", open.reason],
                ["Logged", formatDate(open.created_at)],
              ].map(([k, v]) => (
                <div key={k} className="flex items-start justify-between gap-4 px-4 py-3">
                  <dt className="shrink-0 text-[14px] text-ink-3">{k}</dt>
                  <dd className="break-all text-right text-[14px] font-medium">{v || "—"}</dd>
                </div>
              ))}
            </dl>
            <CopyButton text={open.ip_address || ""} label="Copy IP" size="md" />
          </div>
        )}
      </Modal>
    </div>
  );
}
