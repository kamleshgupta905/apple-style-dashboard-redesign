import { useMemo, useState } from "react";
import { Download } from "lucide-react";
import {
  api,
  isCompleteSt,
  isOverquotaSt,
  isSecuritySt,
  isTerminateSt,
  type Lead,
} from "../lib/api";
import { useQuery } from "../lib/useQuery";
import { useRealtime } from "../lib/useRealtime";
import { usePermissions } from "../lib/permissions";
import { exportCSV, formatDate, money, num } from "../lib/utils";
import {
  Badge,
  Button,
  Card,
  CountUp,
  DataTable,
  EmptyState,
  ErrorState,
  Input,
  Modal,
  PageHeader,
  SearchInput,
  Segmented,
  StatusBadge,
  type Column,
} from "../components/ui";
import { BarList, Columns } from "../components/charts";
import { cn } from "../utils/cn";

type Tab = "projects" | "clients" | "vendors";
type DrillMetric = "clicks" | "completes" | "terminates" | "overquota" | "security";

interface DrillState {
  title: string;
  subtitle: string;
  metric: DrillMetric;
  reportedCount: number;
  rows: Lead[];
}

const METRIC_LABELS: Record<DrillMetric, string> = {
  clicks: "Clicks",
  completes: "Completes",
  terminates: "Terminates",
  overquota: "Overquota",
  security: "Security Terminates",
};

const normKey = (v?: string | number | null) => String(v ?? "").toLowerCase().trim();

export function Reports() {
  const { user } = usePermissions();
  const isVendor = user?.role_id === 3 || user?.role_name === "Vendor" || user?.role_name?.toLowerCase().includes("vendor");

  const [tab, setTab] = useState<Tab>(isVendor ? "vendors" : "projects");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [search, setSearch] = useState("");
  const [drill, setDrill] = useState<DrillState | null>(null);
  const [drillSearch, setDrillSearch] = useState("");

  const q = useQuery(
    async () =>
      (
        await api.get<{
          data: { clients: any[]; vendors: any[]; projects: any[]; leads?: Lead[] };
        }>("/reports/unified", { fromDate: from, toDate: to })
      ).data,
    [from, to],
  );

  useRealtime(["smr_leads", "smr_projects", "smr_vendors"], () => {
    q.reload();
  });

  const d = q.data;

  // Build vendor identifiers if logged in as a vendor
  const vendorIdentifiers = useMemo(() => {
    const set = new Set<string>();
    if (!isVendor || !user) return set;
    [user.vendor_code, user.vendor_id, user.supplier_id, user.username, user.name]
      .map(normKey)
      .filter(Boolean)
      .forEach((k) => set.add(k));
    (d?.vendors || []).forEach((v) => {
      const vc = normKey(v.vendor_code || v.vendor_id);
      const vn = normKey(v.vendor_name || v.name);
      const ve = normKey(v.email);
      const vid = normKey(v.id);
      const uEmail = normKey(user.email);
      if (
        (vc && set.has(vc)) ||
        (vn && set.has(vn)) ||
        (vid && set.has(vid)) ||
        (ve && uEmail && ve === uEmail)
      ) {
        [vc, vn, vid].filter(Boolean).forEach((k) => set.add(k));
      }
    });
    return set;
  }, [isVendor, user, d?.vendors]);

  const scopedLeads = useMemo(() => {
    const all = d?.leads || [];
    if (!isVendor) return all;
    return all.filter((l) => {
      const lvc = normKey(l.vendor_code);
      const lvn = normKey(l.vendor_name);
      return (lvc && vendorIdentifiers.has(lvc)) || (lvn && vendorIdentifiers.has(lvn));
    });
  }, [d?.leads, isVendor, vendorIdentifiers]);

  const scopedVendors = useMemo(() => {
    const all = d?.vendors || [];
    if (!isVendor) return all;
    return all.filter((v) => {
      const vc = normKey(v.vendor_code || v.vendor_id);
      const vn = normKey(v.vendor_name || v.name);
      const vid = normKey(v.id);
      return (vc && vendorIdentifiers.has(vc)) || (vn && vendorIdentifiers.has(vn)) || (vid && vendorIdentifiers.has(vid));
    });
  }, [d?.vendors, isVendor, vendorIdentifiers]);

  const allotsQuery = useQuery(
    async () => (isVendor ? (await api.get<{ data: any[] }>("/vendor/allotments")).data || [] : []),
    [isVendor],
  );

  const scopedProjects = useMemo(() => {
    const all = d?.projects || [];
    if (!isVendor) return all;
    const myAllots = (allotsQuery.data || []).filter((a: any) => {
      const vid = normKey(a.vendor_id);
      const vname = normKey(a.vendor_name);
      return (vid && vendorIdentifiers.has(vid)) || (vname && vendorIdentifiers.has(vname));
    });
    const allotMap = new Map<string, any>();
    myAllots.forEach((a: any) => allotMap.set(String(a.project_id), a));

    const myPids = new Set([...scopedLeads.map((l) => String(l.project_id)), ...myAllots.map((a: any) => String(a.project_id))]);
    return all
      .filter((p) => myPids.has(String(p.project_id)))
      .map((p) => {
        const pLeads = scopedLeads.filter((l) => String(l.project_id) === String(p.project_id));
        const allot = allotMap.get(String(p.project_id));
        const clicks = pLeads.length;
        const completes = pLeads.filter((l) => isCompleteSt(l.status)).length;
        const terminates = pLeads.filter((l) => isTerminateSt(l.status)).length;
        const overquota = pLeads.filter((l) => isOverquotaSt(l.status)).length;
        const conv = clicks > 0 ? Number(((completes / clicks) * 100).toFixed(1)) : 0;
        const vendorCpi = num(allot?.vendor_cpi);
        const vendorPayout = Number((completes * vendorCpi).toFixed(2));
        return {
          ...p,
          client_name: "VMH GROUP",
          cpi: vendorCpi,
          total_clicks: clicks,
          total_completes: completes,
          total_terminates: terminates,
          total_overquota: overquota,
          conversion_rate: conv,
          total_revenue: vendorPayout,
          status: allot?.status || p.status,
        };
      });
  }, [d?.projects, isVendor, allotsQuery.data, vendorIdentifiers, scopedLeads]);

  const scopedClients = useMemo(() => (isVendor ? [] : d?.clients || []), [d?.clients, isVendor]);

  const totals = useMemo(() => {
    if (!d) return null;
    const revenue = scopedProjects.reduce((s, p) => s + num(p.total_revenue), 0);
    const payout = scopedVendors.reduce((s, v) => s + num(v.total_payout), 0);
    return {
      revenue,
      payout,
      margin: revenue - payout,
      marginPct: revenue ? ((revenue - payout) / revenue) * 100 : 0,
      completes: scopedProjects.reduce((s, p) => s + num(p.total_completes), 0),
    };
  }, [d, scopedProjects, scopedVendors]);

  const t = search.toLowerCase();
  const projects = scopedProjects.filter((p) => !t || JSON.stringify([p.project_name, p.project_id, p.client_name]).toLowerCase().includes(t));
  const clients = scopedClients.filter((c) => !t || JSON.stringify([c.client_name, c.client_code]).toLowerCase().includes(t));
  const vendors = scopedVendors.filter((v) => !t || JSON.stringify([v.vendor_name, v.vendor_id]).toLowerCase().includes(t));

  const drillRows = useMemo(() => {
    if (!drill) return [];
    const qStr = drillSearch.toLowerCase().trim();
    if (!qStr) return drill.rows;
    return drill.rows.filter((l) =>
      JSON.stringify([l.uid, l.project_id, l.project_name, l.vendor_code, l.vendor_name, l.ip_address, l.country, l.status, l.reason])
        .toLowerCase()
        .includes(qStr),
    );
  }, [drill, drillSearch]);

  if (q.error && !d) return <ErrorState message={q.error} onRetry={q.reset} />;

  const matchMetric = (status: string | undefined, metric: DrillMetric) => {
    if (metric === "clicks") return true;
    if (metric === "completes") return isCompleteSt(status);
    if (metric === "terminates") return isTerminateSt(status);
    if (metric === "overquota") return isOverquotaSt(status);
    return isSecuritySt(status);
  };

  const openDrill = (scope: "project" | "client" | "vendor", item: any, metric: DrillMetric, reportedCount: number) => {
    let entityLeads: Lead[] = [];
    let entityTitle = "";

    if (scope === "project") {
      entityTitle = item.project_name || item.project_id;
      entityLeads = scopedLeads.filter((l) => String(l.project_id) === String(item.project_id));
    } else if (scope === "client") {
      entityTitle = item.client_name || item.client_code;
      const cProjects = scopedProjects.filter(
        (p) =>
          (p.client_id && Number(p.client_id) === Number(item.id)) ||
          (p.client_name && item.client_name && p.client_name.toLowerCase() === item.client_name.toLowerCase()),
      );
      const pidSet = new Set(cProjects.map((p) => String(p.project_id)));
      entityLeads = scopedLeads.filter((l) => pidSet.has(String(l.project_id)));
    } else {
      entityTitle = item.vendor_name || item.vendor_id;
      const vCodeLower = normKey(item.vendor_id || item.vendor_code || item.id);
      const vNameLower = normKey(item.vendor_name || item.name);
      entityLeads = scopedLeads.filter((l) => {
        const lvc = normKey(l.vendor_code);
        const lvn = normKey(l.vendor_name);
        return (vCodeLower && lvc === vCodeLower) || (vNameLower && lvn === vNameLower);
      });
    }

    const filtered = entityLeads.filter((l) => matchMetric(l.status, metric));
    const rangeLabel = from || to ? `${from || "Start"} to ${to || "Today"}` : "All dates";

    setDrillSearch("");
    setDrill({
      title: `${entityTitle} — ${METRIC_LABELS[metric]}`,
      subtitle: `${filtered.length} session${filtered.length === 1 ? "" : "s"} · ${rangeLabel}`,
      metric,
      reportedCount,
      rows: filtered,
    });
  };

  const MetricBtn = ({
    value,
    bold,
    tone,
    onClick,
  }: {
    value: number;
    bold?: boolean;
    tone?: string;
    onClick: () => void;
  }) => (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      title="Click to view underlying respondent data"
      className={cn(
        "inline-flex cursor-pointer items-center justify-end rounded-md px-1.5 py-0.5 tabular-nums transition-colors hover:bg-fill-2 hover:text-accent hover:underline",
        bold ? "font-semibold" : "font-normal",
        tone || "text-ink",
      )}
    >
      {value}
    </button>
  );

  const pCols: Column<any>[] = [
    {
      key: "project_name",
      header: "Study",
      primary: true,
      render: (p) => (
        <div>
          <p className="max-w-[240px] truncate font-semibold">{p.project_name}</p>
          <p className="font-mono text-[12px] text-ink-3">
            {p.project_id} · {p.client_name}
          </p>
        </div>
      ),
    },
    { key: "cpi", header: isVendor ? "Your CPI" : "CPI", align: "right", render: (p) => money(p.cpi) },
    {
      key: "clicks",
      header: "Clicks",
      align: "right",
      sortValue: (p) => num(p.total_clicks),
      render: (p) => <MetricBtn value={num(p.total_clicks)} onClick={() => openDrill("project", p, "clicks", num(p.total_clicks))} />,
    },
    {
      key: "completes",
      header: "Completes",
      align: "right",
      sortValue: (p) => num(p.total_completes),
      render: (p) => <MetricBtn value={num(p.total_completes)} bold tone="text-green" onClick={() => openDrill("project", p, "completes", num(p.total_completes))} />,
    },
    {
      key: "t",
      header: "Term.",
      align: "right",
      sortValue: (p) => num(p.total_terminates),
      render: (p) => <MetricBtn value={num(p.total_terminates)} tone="text-red" onClick={() => openDrill("project", p, "terminates", num(p.total_terminates))} />,
    },
    {
      key: "oq",
      header: "Overquota",
      align: "right",
      sortValue: (p) => num(p.total_overquota),
      render: (p) => <MetricBtn value={num(p.total_overquota)} tone="text-purple" onClick={() => openDrill("project", p, "overquota", num(p.total_overquota))} />,
    },
    {
      key: "conv",
      header: "Conv.",
      align: "right",
      sortValue: (p) => num(p.conversion_rate),
      render: (p) => <Badge tone={num(p.conversion_rate) >= 30 ? "green" : "orange"}>{num(p.conversion_rate)}%</Badge>,
    },
    {
      key: "rev",
      header: isVendor ? "Payout" : "Revenue",
      align: "right",
      sortValue: (p) => num(p.total_revenue),
      render: (p) => <span className="font-semibold tabular-nums">{money(p.total_revenue)}</span>,
    },
    { key: "status", header: "Status", render: (p) => <StatusBadge status={p.status} /> },
  ];

  const cCols: Column<any>[] = [
    {
      key: "client_name",
      header: "Client",
      primary: true,
      render: (c) => (
        <div>
          <p className="font-semibold">{c.client_name}</p>
          <p className="font-mono text-[12px] text-ink-3">{c.client_code}</p>
        </div>
      ),
    },
    { key: "p", header: "Studies", align: "right", render: (c) => num(c.total_projects) },
    {
      key: "clicks",
      header: "Clicks",
      align: "right",
      sortValue: (c) => num(c.total_clicks),
      render: (c) => <MetricBtn value={num(c.total_clicks)} onClick={() => openDrill("client", c, "clicks", num(c.total_clicks))} />,
    },
    {
      key: "comp",
      header: "Completes",
      align: "right",
      sortValue: (c) => num(c.total_completes),
      render: (c) => <MetricBtn value={num(c.total_completes)} bold tone="text-green" onClick={() => openDrill("client", c, "completes", num(c.total_completes))} />,
    },
    {
      key: "term",
      header: "Term.",
      align: "right",
      sortValue: (c) => num(c.total_terminates),
      render: (c) => <MetricBtn value={num(c.total_terminates)} tone="text-red" onClick={() => openDrill("client", c, "terminates", num(c.total_terminates))} />,
    },
    {
      key: "oq",
      header: "Overquota",
      align: "right",
      sortValue: (c) => num(c.total_overquota),
      render: (c) => <MetricBtn value={num(c.total_overquota)} tone="text-purple" onClick={() => openDrill("client", c, "overquota", num(c.total_overquota))} />,
    },
    {
      key: "rev",
      header: "Revenue",
      align: "right",
      sortValue: (c) => num(c.total_revenue),
      render: (c) => <span className="font-semibold tabular-nums">{money(c.total_revenue)}</span>,
    },
  ];

  const vCols: Column<any>[] = [
    {
      key: "vendor_name",
      header: "Vendor",
      primary: true,
      render: (v) => (
        <div>
          <p className="font-semibold">{v.vendor_name}</p>
          <p className="font-mono text-[12px] text-ink-3">{v.vendor_id}</p>
        </div>
      ),
    },
    { key: "p", header: "Studies", align: "right", render: (v) => num(v.assigned_projects) },
    {
      key: "clicks",
      header: "Clicks",
      align: "right",
      sortValue: (v) => num(v.total_clicks),
      render: (v) => <MetricBtn value={num(v.total_clicks)} onClick={() => openDrill("vendor", v, "clicks", num(v.total_clicks))} />,
    },
    {
      key: "comp",
      header: "Completes",
      align: "right",
      sortValue: (v) => num(v.total_completes),
      render: (v) => <MetricBtn value={num(v.total_completes)} bold tone="text-green" onClick={() => openDrill("vendor", v, "completes", num(v.total_completes))} />,
    },
    {
      key: "term",
      header: "Term.",
      align: "right",
      sortValue: (v) => num(v.total_terminates),
      render: (v) => <MetricBtn value={num(v.total_terminates)} tone="text-red" onClick={() => openDrill("vendor", v, "terminates", num(v.total_terminates))} />,
    },
    {
      key: "sec",
      header: "Security",
      align: "right",
      sortValue: (v) => num(v.security_terminates),
      render: (v) => <MetricBtn value={num(v.security_terminates)} tone="text-orange" onClick={() => openDrill("vendor", v, "security", num(v.security_terminates))} />,
    },
    { key: "conv", header: "Conv.", align: "right", render: (v) => `${num(v.conversion_rate)}%` },
    {
      key: "pay",
      header: "Payout",
      align: "right",
      sortValue: (v) => num(v.total_payout),
      render: (v) => <span className="font-semibold tabular-nums">{money(v.total_payout)}</span>,
    },
  ];

  const drillCols: Column<Lead>[] = [
    { key: "t", header: "Time", render: (l) => <span className="text-[12px] text-ink-3 tabular-nums">{formatDate(l.created_at)}</span> },
    { key: "uid", header: "UID", primary: true, render: (l) => <span className="font-mono text-[12px] font-medium">{l.uid}</span> },
    {
      key: "proj",
      header: "Study",
      render: (l) => (
        <div className="max-w-[190px]">
          <p className="truncate font-medium">{l.project_name || l.project_id}</p>
          <p className="font-mono text-[11px] text-ink-3">{l.project_id}</p>
        </div>
      ),
    },
    { key: "v", header: "Vendor", render: (l) => <span className="font-mono text-[12px]">{l.vendor_name || l.vendor_code || "—"}</span> },
    { key: "c", header: "Country", hideMobile: true, render: (l) => l.country || "—" },
    { key: "ip", header: "IP", hideMobile: true, render: (l) => <span className="font-mono text-[12px] text-ink-3">{l.ip_address || "—"}</span> },
    { key: "s", header: "Status", render: (l) => <StatusBadge status={l.status} /> },
    { key: "r", header: "Reason", hideMobile: true, render: (l) => <span className="block max-w-[160px] truncate text-[12px] text-ink-3">{l.reason || "—"}</span> },
  ];

  const exportCurrent = () => {
    if (tab === "projects")
      exportCSV(
        "report-projects",
        ["Study ID", "Study", ...(isVendor ? [] : ["Client"]), isVendor ? "Your CPI" : "CPI", "Clicks", "Completes", "Terminates", "Overquota", "Conv %", isVendor ? "Payout" : "Revenue", "Status"],
        projects.map((p) => [p.project_id, p.project_name, ...(isVendor ? [] : [p.client_name]), p.cpi, p.total_clicks, p.total_completes, p.total_terminates, p.total_overquota, p.conversion_rate, p.total_revenue, p.status]),
      );
    else if (tab === "clients")
      exportCSV(
        "report-clients",
        ["Client", "Code", "Studies", "Clicks", "Completes", "Terminates", "Overquota", "Revenue"],
        clients.map((c) => [c.client_name, c.client_code, c.total_projects, c.total_clicks, c.total_completes, c.total_terminates, c.total_overquota, c.total_revenue]),
      );
    else
      exportCSV(
        "report-vendors",
        ["Vendor", "Code", "Studies", "Clicks", "Completes", "Terminates", "Security", "Conv %", "Payout"],
        vendors.map((v) => [v.vendor_name, v.vendor_id, v.assigned_projects, v.total_clicks, v.total_completes, v.total_terminates, v.security_terminates, v.conversion_rate, v.total_payout]),
      );
  };

  const tiles =
    totals &&
    (isVendor
      ? [
          { l: "Your payout", v: totals.payout, p: "$", d: 2, tone: "text-green" },
          { l: "Total clicks", v: scopedVendors.reduce((s, v) => s + num(v.total_clicks), 0), d: 0 },
          { l: "Total completes", v: scopedVendors.reduce((s, v) => s + num(v.total_completes), 0), d: 0, tone: "text-ink" },
          { l: "Security blocks", v: scopedVendors.reduce((s, v) => s + num(v.security_terminates), 0), d: 0, tone: "text-orange" },
        ]
      : [
          { l: "Gross revenue", v: totals.revenue, p: "$", d: 2 },
          { l: "Vendor payable", v: totals.payout, p: "$", d: 2 },
          { l: "Net margin", v: totals.margin, p: "$", d: 2, tone: "text-green" },
          { l: "Margin rate", v: totals.marginPct, s: "%", d: 1 },
        ]);

  const topClients = [...scopedClients]
    .sort((a, b) => num(b.total_clicks) - num(a.total_clicks))
    .filter((c) => num(c.total_clicks) > 0)
    .slice(0, 5);
  const topProjects = [...scopedProjects].sort((a, b) => num(b.total_clicks) - num(a.total_clicks)).slice(0, 6);

  const tabOptions: { value: Tab; label: string; count?: number }[] = isVendor
    ? [
        { value: "vendors", label: "Vendor Summary", count: scopedVendors.length },
        { value: "projects", label: "Studies", count: scopedProjects.length },
      ]
    : [
        { value: "projects", label: "Studies", count: scopedProjects.length },
        { value: "clients", label: "Clients", count: scopedClients.length },
        { value: "vendors", label: "Vendors", count: scopedVendors.length },
      ];

  return (
    <div>
      <PageHeader
        title="Reports"
        subtitle={
          isVendor
            ? "Your traffic performance and conversion breakdown. Click any metric count to inspect sessions."
            : "Consolidated performance across clients, vendors and studies. Click any count to inspect session details."
        }
        actions={
          <Button variant="secondary" icon={<Download size={15} />} onClick={exportCurrent}>
            Export CSV
          </Button>
        }
      />

      <div className="stagger mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
        {(tiles || Array.from({ length: 4 }).map(() => null)).map((k, i) => (
          <Card key={i} hover className="p-4 sm:p-5">
            {k ? (
              <>
                <p className="text-[13px] font-medium text-ink-3">{k.l}</p>
                <p className={`mt-0.5 text-[24px] font-bold tracking-tight tabular-nums sm:text-[28px] ${(k as any).tone || ""}`}>
                  <CountUp value={k.v} prefix={(k as any).p} suffix={(k as any).s} decimals={k.d} />
                </p>
              </>
            ) : (
              <div className="h-[56px]" />
            )}
          </Card>
        ))}
      </div>

      {d && (
        <div className={cn("mb-5 grid gap-4", !isVendor && "lg:grid-cols-2")}>
          <Card className="anim-fade-up p-5 sm:p-6">
            <p className="mb-4 text-[15px] font-semibold">Clicks by study</p>
            {topProjects.length ? (
              <Columns data={topProjects.map((p) => ({ label: String(p.project_id).slice(-6), value: num(p.total_clicks) }))} />
            ) : (
              <p className="py-8 text-center text-[14px] text-ink-3">No data</p>
            )}
          </Card>
          {!isVendor && (
            <Card className="anim-fade-up p-5 sm:p-6" style={{ animationDelay: "80ms" }}>
              <p className="mb-4 text-[15px] font-semibold">Top clients by traffic</p>
              {topClients.length ? (
                <BarList
                  color="var(--purple)"
                  items={topClients.map((c) => ({
                    label: c.client_name,
                    value: num(c.total_clicks),
                    sub: `${num(c.total_completes)} completes · ${money(c.total_revenue)}`,
                  }))}
                />
              ) : (
                <p className="py-8 text-center text-[14px] text-ink-3">No traffic in this range</p>
              )}
            </Card>
          )}
        </div>
      )}

      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <Segmented value={tab} onChange={setTab} options={tabOptions} />
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="flex items-center gap-2">
            <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="!h-10 !text-[14px]" aria-label="From date" />
            <span className="text-ink-3">–</span>
            <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="!h-10 !text-[14px]" aria-label="To date" />
          </div>
          <SearchInput value={search} onChange={setSearch} placeholder="Filter" className="sm:w-48" />
        </div>
      </div>

      {tab === "projects" && <DataTable columns={pCols} rows={projects} rowKey={(p) => p.project_id} loading={q.loading} empty={<EmptyState title="No studies" />} />}
      {tab === "clients" && !isVendor && <DataTable columns={cCols} rows={clients} rowKey={(c) => c.client_code} loading={q.loading} empty={<EmptyState title="No clients" />} />}
      {tab === "vendors" && <DataTable columns={vCols} rows={vendors} rowKey={(v) => v.vendor_id} loading={q.loading} empty={<EmptyState title="No vendor activity" />} />}

      <Modal
        open={!!drill}
        onClose={() => setDrill(null)}
        size="xl"
        title={drill?.title}
        subtitle={drill?.subtitle}
        footer={
          <div className="flex w-full items-center justify-between gap-3">
            <span className="text-[12px] text-ink-3">
              Showing {drillRows.length} of {drill?.rows.length || 0} matching respondent records
            </span>
            <div className="flex items-center gap-2">
              {drill && drillRows.length > 0 && (
                <Button
                  size="sm"
                  variant="secondary"
                  icon={<Download size={14} />}
                  onClick={() =>
                    exportCSV(
                      `report-drilldown-${drill.metric}`,
                      ["Time", "UID", "Study ID", "Study Name", "Vendor", "Country", "IP", "Status", "Reason"],
                      drillRows.map((l) => [l.created_at, l.uid, l.project_id, l.project_name, l.vendor_name || l.vendor_code, l.country, l.ip_address, l.status, l.reason]),
                    )
                  }
                >
                  Export CSV
                </Button>
              )}
              <Button size="sm" onClick={() => setDrill(null)}>
                Close
              </Button>
            </div>
          </div>
        }
      >
        <div className="space-y-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2">
              <Badge tone="blue">{drill ? METRIC_LABELS[drill.metric] : ""}</Badge>
              <span className="text-[13px] text-ink-3 tabular-nums">
                {drill?.rows.length ?? 0} logged session{(drill?.rows.length ?? 0) === 1 ? "" : "s"}
              </span>
            </div>
            <SearchInput value={drillSearch} onChange={setDrillSearch} placeholder="Search UID, study, vendor, IP..." className="sm:w-64" />
          </div>

          <DataTable
            columns={drillCols}
            rows={drillRows}
            rowKey={(l) => l.id}
            pageSize={10}
            empty={
              <EmptyState
                title="No respondent sessions found"
                message={
                  drill && drill.reportedCount > 0 && drill.rows.length === 0
                    ? `This summary count (${drill.reportedCount}) came from a legacy counter without individual respondent click logs in the leads stream.`
                    : "No respondent click logs match this metric and date range."
                }
              />
            }
          />
        </div>
      </Modal>
    </div>
  );
}
