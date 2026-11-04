import { useMemo } from "react";
import { ArrowUpRight, CircleDollarSign, MousePointerClick, Radio, RefreshCw, Target, TrendingUp } from "lucide-react";
import { api, type Lead } from "../lib/api";
import { useQuery } from "../lib/useQuery";
import { compact, money, num, timeAgo } from "../lib/utils";
import { BarList, Donut, Legend } from "../components/charts";
import { Button, Card, CountUp, ErrorState, PageHeader, SectionTitle, Skeleton, StatusBadge, Badge } from "../components/ui";
import { PERMS, usePermissions } from "../lib/permissions";
import { cn } from "../utils/cn";

interface Analytics {
  pendingLeads: number;
  totalClick: number;
  completeLeads: number;
  activeProjects: number;
  chartData: Record<string, number>;
  deviceStats: Record<string, number>;
}
interface Unified {
  clients: any[];
  vendors: any[];
  projects: any[];
}

export function Dashboard({ userName }: { userName: string }) {
  const { can } = usePermissions();
  const q = useQuery(
    async () => {
      const [a, u, l] = await Promise.all([
        api.get<Analytics>("/dashboard/analytics"),
        api.get<{ data: Unified }>("/reports/unified"),
        api.get<{ data: Lead[] }>("/leads", { limit: 12 }),
      ]);
      return { a, u: u.data, leads: l.data || [] };
    },
    [],
    { poll: 20000 },
  );

  const d = q.data;
  const stats = useMemo(() => {
    if (!d) return null;
    const projectsList = d.u?.projects || [];
    const vendorsList = d.u?.vendors || [];
    const revenue = projectsList.reduce((s, p) => s + num(p.total_revenue), 0);
    const payout = vendorsList.reduce((s, v) => s + num(v.total_payout), 0);
    const clicks = num(d.a?.totalClick);
    const completes = num(d.a?.completeLeads);
    return {
      revenue,
      payout,
      margin: revenue - payout,
      clicks,
      completes,
      rate: clicks ? (completes / clicks) * 100 : 0,
    };
  }, [d]);

  const hour = new Date().getHours();
  const greet = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";

  if (q.error && !d) return <ErrorState message={q.error} onRetry={q.reset} />;

  const kpis = stats && [
    { label: "Gross revenue", value: stats.revenue, prefix: "$", decimals: 2, icon: CircleDollarSign, tone: "text-green bg-green-soft", sub: "From delivered completes" },
    { label: "Net margin", value: stats.margin, prefix: "$", decimals: 2, icon: TrendingUp, tone: "text-accent bg-accent-soft", sub: `Vendor payout ${money(stats.payout)}` },
    { label: "Routed clicks", value: stats.clicks, icon: MousePointerClick, tone: "text-purple bg-purple-soft", sub: `${num(d?.a?.pendingLeads)} pending` },
    { label: "Conversion", value: stats.rate, suffix: "%", decimals: 1, icon: Target, tone: "text-orange bg-orange-soft", sub: `${stats.completes} completes` },
  ];

  const devices = d ? Object.entries(d.a?.deviceStats || {}) : [];
  const devColors = ["var(--accent)", "var(--green)", "var(--orange)"];

  const leadStatus = useMemo(() => {
    const m: Record<string, number> = {};
    (d?.leads || []).forEach((l) => (m[l.status] = (m[l.status] || 0) + 1));
    return m;
  }, [d]);

  return (
    <div>
      <PageHeader
        title={`${greet}, ${userName.split(" ")[0]}`}
        subtitle="Here's how your marketplace is performing right now."
        actions={
          <Button variant="secondary" icon={<RefreshCw size={15} className={q.refreshing ? "anim-spin" : ""} />} onClick={q.reload}>
            Refresh
          </Button>
        }
      />

      {/* KPI row */}
      {can(PERMS.OVERVIEW_KPIS) && (
        <div className="stagger grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
          {!kpis
            ? Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-[132px] rounded-3xl" />)
            : kpis.map((k) => (
                <Card key={k.label} hover className="p-4 sm:p-5">
                  <div className="mb-4 flex items-center justify-between">
                    <span className={cn("flex h-9 w-9 items-center justify-center rounded-xl", k.tone)}>
                      <k.icon size={18} />
                    </span>
                  </div>
                  <p className="text-[13px] font-medium text-ink-3">{k.label}</p>
                  <p className="mt-0.5 text-[26px] font-bold leading-tight tracking-tight text-ink sm:text-[30px]">
                    <CountUp value={k.value} prefix={k.prefix} suffix={k.suffix} decimals={k.decimals} />
                  </p>
                  <p className="mt-1 truncate text-[12px] text-ink-3">{k.sub}</p>
                </Card>
              ))}
        </div>
      )}

      {can(PERMS.OVERVIEW_CHARTS) && (
        <div className="mt-4 grid gap-4 lg:grid-cols-3 lg:mt-5">
          {/* Study performance */}
          <Card className="anim-fade-up p-5 sm:p-6 lg:col-span-2" style={{ animationDelay: "120ms" }}>
            <SectionTitle title="Traffic by study" hint="Routed respondents per study" action={<Badge tone="blue">{num(d?.a?.activeProjects)} live</Badge>} />
            {!d ? (
              <Skeleton className="h-48" />
            ) : Object.keys(d?.a?.chartData || {}).length === 0 ? (
              <p className="py-10 text-center text-[14px] text-ink-3">No traffic routed yet.</p>
            ) : (
              <BarList items={Object.entries(d?.a?.chartData || {}).map(([label, value]) => ({ label, value }))} format={(n) => n.toLocaleString()} />
            )}
          </Card>

          {/* Devices */}
          <Card className="anim-fade-up p-5 sm:p-6" style={{ animationDelay: "180ms" }}>
            <SectionTitle title="Devices" hint="Respondent hardware" />
            {!d ? (
              <Skeleton className="h-48" />
            ) : (
              <div className="flex flex-col items-center gap-6">
                <Donut
                  segments={devices.map(([label, value], i) => ({ label, value, color: devColors[i % 3] }))}
                  centerValue={compact(devices.reduce((s, [, v]) => s + v, 0))}
                  centerLabel="sessions"
                />
                <div className="w-full">
                  <Legend items={devices.map(([label, value], i) => ({ label, value, color: devColors[i % 3] }))} />
                </div>
              </div>
            )}
          </Card>
        </div>
      )}

      {can(PERMS.OVERVIEW_ACTIVITY) && (
        <div className="mt-4 grid gap-4 lg:mt-5 lg:grid-cols-5">
          {/* Live stream */}
          <Card className="anim-fade-up overflow-hidden lg:col-span-3" style={{ animationDelay: "220ms" }}>
            <div className="flex items-center justify-between px-5 pt-5 sm:px-6 sm:pt-6">
              <SectionTitle title="Live traffic" hint="Auto-refreshes every 20s" />
              <a href="#/leads" className="-mt-4 flex items-center gap-1 text-[13px] font-medium text-accent hover:underline">
                View all <ArrowUpRight size={14} />
              </a>
            </div>
            <div className="px-2 pb-3 sm:px-3">
              {!d ? (
                <div className="space-y-3 p-3">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Skeleton key={i} className="h-10" />
                  ))}
                </div>
              ) : d.leads.length === 0 ? (
                <p className="py-10 text-center text-[14px] text-ink-3">Waiting for the first respondent…</p>
              ) : (
                <ul>
                  {d.leads.slice(0, 7).map((l, i) => (
                    <li
                      key={l.id}
                      style={{ animationDelay: `${i * 40}ms` }}
                      className="anim-fade-up flex items-center gap-3 rounded-2xl px-3 py-2.5 transition-colors hover:bg-fill/70"
                    >
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-fill text-ink-2">
                        <Radio size={16} />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[14px] font-medium text-ink">{l.project_name}</p>
                        <p className="truncate text-[12px] text-ink-3">
                          {l.vendor_name || l.vendor_code} · {l.country} · {timeAgo(l.created_at)}
                        </p>
                      </div>
                      <StatusBadge status={l.status} />
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </Card>

          {/* Top vendors + outcomes */}
          <div className="space-y-4 lg:col-span-2 lg:space-y-5">
            <Card className="anim-fade-up p-5 sm:p-6" style={{ animationDelay: "260ms" }}>
              <SectionTitle title="Top vendors" hint="By completes delivered" />
              {!d ? (
                <Skeleton className="h-28" />
              ) : (d?.u?.vendors || []).length === 0 ? (
                <p className="py-6 text-center text-[14px] text-ink-3">No vendor activity yet.</p>
              ) : (
                <ul className="space-y-4">
                  {[...(d?.u?.vendors || [])]
                    .sort((a, b) => num(b.total_completes) - num(a.total_completes))
                    .slice(0, 4)
                    .map((v) => (
                      <li key={v.vendor_id} className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-[14px] font-medium text-ink">{v.vendor_name}</p>
                          <p className="text-[12px] text-ink-3">
                            {num(v.assigned_projects)} studies · {num(v.conversion_rate)}% conv.
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-[15px] font-semibold text-ink tabular">{num(v.total_completes)}</p>
                          <p className="text-[12px] text-ink-3 tabular">{money(v.total_payout)}</p>
                        </div>
                      </li>
                    ))}
                </ul>
              )}
            </Card>

            <Card className="anim-fade-up p-5 sm:p-6" style={{ animationDelay: "300ms" }}>
              <SectionTitle title="Recent outcomes" hint="Last 12 sessions" />
              {!d ? (
                <Skeleton className="h-16" />
              ) : (
                <Legend
                  items={Object.entries(leadStatus).map(([label, value]) => ({
                    label,
                    value,
                    color: label === "Complete" ? "var(--green)" : label === "Pending" ? "var(--orange)" : "var(--red)",
                  }))}
                />
              )}
            </Card>
          </div>
        </div>
      )}

      {!can(PERMS.OVERVIEW_KPIS) && !can(PERMS.OVERVIEW_CHARTS) && !can(PERMS.OVERVIEW_ACTIVITY) && (
        <div className="mt-8 rounded-3xl border border-line bg-surface p-8 text-center shadow-sm">
          <p className="text-[16px] font-medium text-ink">Welcome to VMH GROUP'S SMR Platform</p>
          <p className="mt-1 text-[13px] text-ink-3">Your account is active. Use the navigation menu on the left to access your authorized modules.</p>
        </div>
      )}
    </div>
  );
}
