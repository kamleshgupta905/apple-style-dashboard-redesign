import { useMemo, useState } from "react";
import { Download } from "lucide-react";
import { api } from "../lib/api";
import { useQuery } from "../lib/useQuery";
import { exportCSV, money, num } from "../lib/utils";
import {
  Badge,
  Button,
  Card,
  CountUp,
  DataTable,
  EmptyState,
  ErrorState,
  Input,
  PageHeader,
  SearchInput,
  Segmented,
  StatusBadge,
  type Column,
} from "../components/ui";
import { BarList, Columns } from "../components/charts";

type Tab = "projects" | "clients" | "vendors";

export function Reports() {
  const [tab, setTab] = useState<Tab>("projects");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [search, setSearch] = useState("");

  const q = useQuery(
    async () => (await api.get<{ data: { clients: any[]; vendors: any[]; projects: any[] } }>("/reports/unified", { fromDate: from, toDate: to })).data,
    [from, to],
  );

  const d = q.data;
  const totals = useMemo(() => {
    if (!d) return null;
    const projectsList = d.projects || [];
    const vendorsList = d.vendors || [];
    const revenue = projectsList.reduce((s, p) => s + num(p.total_revenue), 0);
    const payout = vendorsList.reduce((s, v) => s + num(v.total_payout), 0);
    return {
      revenue,
      payout,
      margin: revenue - payout,
      marginPct: revenue ? ((revenue - payout) / revenue) * 100 : 0,
      completes: projectsList.reduce((s, p) => s + num(p.total_completes), 0),
    };
  }, [d]);

  const t = search.toLowerCase();
  const projects = (d?.projects || []).filter((p) => !t || JSON.stringify([p.project_name, p.project_id, p.client_name]).toLowerCase().includes(t));
  const clients = (d?.clients || []).filter((c) => !t || JSON.stringify([c.client_name, c.client_code]).toLowerCase().includes(t));
  const vendors = (d?.vendors || []).filter((v) => !t || JSON.stringify([v.vendor_name, v.vendor_id]).toLowerCase().includes(t));

  if (q.error && !d) return <ErrorState message={q.error} onRetry={q.reset} />;

  const pCols: Column<any>[] = [
    { key: "project_name", header: "Study", primary: true, render: (p) => (
        <div>
          <p className="max-w-[240px] truncate font-semibold">{p.project_name}</p>
          <p className="font-mono text-[12px] text-ink-3">{p.project_id} · {p.client_name}</p>
        </div>
      ) },
    { key: "cpi", header: "CPI", align: "right", render: (p) => money(p.cpi) },
    { key: "clicks", header: "Clicks", align: "right", sortValue: (p) => num(p.total_clicks), render: (p) => num(p.total_clicks) },
    { key: "completes", header: "Completes", align: "right", sortValue: (p) => num(p.total_completes), render: (p) => <span className="font-semibold">{num(p.total_completes)}</span> },
    { key: "t", header: "Term.", align: "right", render: (p) => num(p.total_terminates) },
    { key: "conv", header: "Conv.", align: "right", sortValue: (p) => num(p.conversion_rate), render: (p) => <Badge tone={num(p.conversion_rate) >= 30 ? "green" : "orange"}>{num(p.conversion_rate)}%</Badge> },
    { key: "rev", header: "Revenue", align: "right", sortValue: (p) => num(p.total_revenue), render: (p) => <span className="font-semibold">{money(p.total_revenue)}</span> },
    { key: "status", header: "Status", render: (p) => <StatusBadge status={p.status} /> },
  ];
  const cCols: Column<any>[] = [
    { key: "client_name", header: "Client", primary: true, render: (c) => (
        <div>
          <p className="font-semibold">{c.client_name}</p>
          <p className="font-mono text-[12px] text-ink-3">{c.client_code}</p>
        </div>
      ) },
    { key: "p", header: "Studies", align: "right", render: (c) => num(c.total_projects) },
    { key: "clicks", header: "Clicks", align: "right", sortValue: (c) => num(c.total_clicks), render: (c) => num(c.total_clicks) },
    { key: "comp", header: "Completes", align: "right", sortValue: (c) => num(c.total_completes), render: (c) => <span className="font-semibold">{num(c.total_completes)}</span> },
    { key: "term", header: "Term.", align: "right", render: (c) => num(c.total_terminates) },
    { key: "oq", header: "Overquota", align: "right", render: (c) => num(c.total_overquota) },
    { key: "rev", header: "Revenue", align: "right", sortValue: (c) => num(c.total_revenue), render: (c) => <span className="font-semibold">{money(c.total_revenue)}</span> },
  ];
  const vCols: Column<any>[] = [
    { key: "vendor_name", header: "Vendor", primary: true, render: (v) => (
        <div>
          <p className="font-semibold">{v.vendor_name}</p>
          <p className="font-mono text-[12px] text-ink-3">{v.vendor_id}</p>
        </div>
      ) },
    { key: "p", header: "Studies", align: "right", render: (v) => num(v.assigned_projects) },
    { key: "clicks", header: "Clicks", align: "right", sortValue: (v) => num(v.total_clicks), render: (v) => num(v.total_clicks) },
    { key: "comp", header: "Completes", align: "right", sortValue: (v) => num(v.total_completes), render: (v) => <span className="font-semibold">{num(v.total_completes)}</span> },
    { key: "term", header: "Term.", align: "right", render: (v) => num(v.total_terminates) },
    { key: "sec", header: "Security", align: "right", render: (v) => num(v.security_terminates) },
    { key: "conv", header: "Conv.", align: "right", render: (v) => `${num(v.conversion_rate)}%` },
    { key: "pay", header: "Payout", align: "right", sortValue: (v) => num(v.total_payout), render: (v) => <span className="font-semibold">{money(v.total_payout)}</span> },
  ];

  const exportCurrent = () => {
    if (tab === "projects")
      exportCSV("report-projects", ["Study ID", "Study", "Client", "CPI", "Clicks", "Completes", "Terminates", "Overquota", "Conv %", "Revenue", "Status"],
        projects.map((p) => [p.project_id, p.project_name, p.client_name, p.cpi, p.total_clicks, p.total_completes, p.total_terminates, p.total_overquota, p.conversion_rate, p.total_revenue, p.status]));
    else if (tab === "clients")
      exportCSV("report-clients", ["Client", "Code", "Studies", "Clicks", "Completes", "Terminates", "Overquota", "Revenue"],
        clients.map((c) => [c.client_name, c.client_code, c.total_projects, c.total_clicks, c.total_completes, c.total_terminates, c.total_overquota, c.total_revenue]));
    else
      exportCSV("report-vendors", ["Vendor", "Code", "Studies", "Clicks", "Completes", "Terminates", "Security", "Conv %", "Payout"],
        vendors.map((v) => [v.vendor_name, v.vendor_id, v.assigned_projects, v.total_clicks, v.total_completes, v.total_terminates, v.security_terminates, v.conversion_rate, v.total_payout]));
  };

  const tiles = totals && [
    { l: "Gross revenue", v: totals.revenue, p: "$", d: 2 },
    { l: "Vendor payable", v: totals.payout, p: "$", d: 2 },
    { l: "Net margin", v: totals.margin, p: "$", d: 2, tone: "text-green" },
    { l: "Margin rate", v: totals.marginPct, s: "%", d: 1 },
  ];

  const topClients = [...(d?.clients || [])].sort((a, b) => num(b.total_clicks) - num(a.total_clicks)).filter((c) => num(c.total_clicks) > 0).slice(0, 5);
  const topProjects = [...(d?.projects || [])].sort((a, b) => num(b.total_clicks) - num(a.total_clicks)).slice(0, 6);

  return (
    <div>
      <PageHeader
        title="Reports"
        subtitle="Consolidated performance across clients, vendors and studies."
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
                <p className={`mt-0.5 text-[24px] font-bold tracking-tight sm:text-[28px] ${(k as any).tone || ""}`}>
                  <CountUp value={k.v} prefix={k.p} suffix={k.s} decimals={k.d} />
                </p>
              </>
            ) : (
              <div className="h-[56px]" />
            )}
          </Card>
        ))}
      </div>

      {d && (
        <div className="mb-5 grid gap-4 lg:grid-cols-2">
          <Card className="anim-fade-up p-5 sm:p-6">
            <p className="mb-4 text-[15px] font-semibold">Clicks by study</p>
            {topProjects.length ? (
              <Columns data={topProjects.map((p) => ({ label: String(p.project_id).slice(-6), value: num(p.total_clicks) }))} />
            ) : (
              <p className="py-8 text-center text-[14px] text-ink-3">No data</p>
            )}
          </Card>
          <Card className="anim-fade-up p-5 sm:p-6" style={{ animationDelay: "80ms" }}>
            <p className="mb-4 text-[15px] font-semibold">Top clients by traffic</p>
            {topClients.length ? (
              <BarList color="var(--purple)" items={topClients.map((c) => ({ label: c.client_name, value: num(c.total_clicks), sub: `${num(c.total_completes)} completes · ${money(c.total_revenue)}` }))} />
            ) : (
              <p className="py-8 text-center text-[14px] text-ink-3">No traffic in this range</p>
            )}
          </Card>
        </div>
      )}

      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <Segmented
          value={tab}
          onChange={setTab}
          options={[
            { value: "projects", label: "Studies", count: d?.projects.length },
            { value: "clients", label: "Clients", count: d?.clients.length },
            { value: "vendors", label: "Vendors", count: d?.vendors.length },
          ]}
        />
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
      {tab === "clients" && <DataTable columns={cCols} rows={clients} rowKey={(c) => c.client_code} loading={q.loading} empty={<EmptyState title="No clients" />} />}
      {tab === "vendors" && <DataTable columns={vCols} rows={vendors} rowKey={(v) => v.vendor_id} loading={q.loading} empty={<EmptyState title="No vendor activity" />} />}
    </div>
  );
}
