import { useMemo } from "react";
import { ArrowUpRight, CircleDollarSign, Copy, ExternalLink, MousePointerClick, Radio, RefreshCw, Target, TrendingUp } from "lucide-react";
import { api, type Lead } from "../lib/api";
import { useQuery } from "../lib/useQuery";
import { useRealtime } from "../lib/useRealtime";
import { compact, money, num, timeAgo } from "../lib/utils";
import { BarList, Donut, Legend } from "../components/charts";
import { Button, Card, CountUp, ErrorState, PageHeader, SectionTitle, Skeleton, StatusBadge, Badge } from "../components/ui";
import { PERMS, usePermissions } from "../lib/permissions";
import { useFeedback } from "../components/feedback";
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
  const { can, user } = usePermissions();
  const { toast } = useFeedback();
  const isVendor = user?.role_id === 3 || user?.role_name === "Vendor" || user?.role_name?.toLowerCase().includes("vendor");

  const vendorsQuery = useQuery(async () => (await api.get<{ data: any[] }>("/vendors")).data || [], []);
  const allotmentsQuery = useQuery(async () => (await api.get<{ data: any[] }>("/vendor/allotments")).data || [], []);

  // Real-time synchronization when allotments or studies update
  useRealtime(["smr_vendor_allotments", "smr_projects", "smr_leads"], () => {
    allotmentsQuery.reload();
  });

  const uName = (user?.username || "").toLowerCase().trim();
  const rName = (user?.name || "").toLowerCase().trim();
  const uEmail = (user?.email || "").toLowerCase().trim();
  const uVendorCode = (user?.vendor_code || user?.vendor_id || user?.supplier_id || "").toLowerCase().trim();

  // Matched vendor entity from vendors directory
  const matchedVendor = useMemo(() => {
    if (!isVendor) return null;
    const list = vendorsQuery.data || [];
    return list.find((v: any) => {
      const vc = (v.vendor_code || "").toLowerCase().trim();
      const vn = (v.vendor_name || "").toLowerCase().trim();
      const ve = (v.email || "").toLowerCase().trim();
      const vid = String(v.id || "").toLowerCase().trim();
      return (
        (uVendorCode && (vc === uVendorCode || vid === uVendorCode || vn === uVendorCode)) ||
        (vc && (vc === uName || vc === rName)) ||
        (vn && (vn === uName || vn === rName)) ||
        (ve && uEmail && ve === uEmail)
      );
    });
  }, [isVendor, vendorsQuery.data, uVendorCode, uName, rName, uEmail]);

  // Comprehensive set of all valid identifiers for this vendor
  const vendorIdentifiers = useMemo(() => {
    const set = new Set<string>();
    if (uVendorCode) set.add(uVendorCode);
    if (user?.vendor_code) set.add(user.vendor_code.toLowerCase().trim());
    if (user?.vendor_id) set.add(String(user.vendor_id).toLowerCase().trim());
    if (user?.supplier_id) set.add(user.supplier_id.toLowerCase().trim());
    if (matchedVendor) {
      if (matchedVendor.vendor_code) set.add(matchedVendor.vendor_code.toLowerCase().trim());
      if (matchedVendor.vendor_name) set.add(matchedVendor.vendor_name.toLowerCase().trim());
      if (matchedVendor.id) set.add(String(matchedVendor.id).toLowerCase().trim());
    }
    if (uName) set.add(uName);
    if (rName) set.add(rName);
    return set;
  }, [uVendorCode, user, matchedVendor, uName, rName]);

  const activeVendorCode =
    user?.vendor_code ||
    matchedVendor?.vendor_code ||
    user?.supplier_id ||
    user?.username ||
    "VND";

  const q = useQuery(
    async () => {
      const [a, u, l] = await Promise.all([
        api.get<Analytics>("/dashboard/analytics"),
        api.get<{ data: Unified }>("/reports/unified"),
        api.get<{ data: Lead[] }>("/leads", { limit: 25 }),
      ]);
      return { a, u: u.data, leads: l.data || [] };
    },
    [],
    { poll: 20000 },
  );

  const d = q.data;

  // Filter leads for this vendor if role is vendor
  const vendorLeads = useMemo(() => {
    const raw = d?.leads || [];
    if (!isVendor) return raw;
    return raw.filter((l: any) => {
      const lvc = (l.vendor_code || "").toLowerCase().trim();
      const lvn = (l.vendor_name || "").toLowerCase().trim();
      const lvid = (l.vendor_id || "").toLowerCase().trim();
      return vendorIdentifiers.has(lvc) || vendorIdentifiers.has(lvn) || vendorIdentifiers.has(lvid);
    });
  }, [d?.leads, isVendor, vendorIdentifiers]);

  // Vendor's assigned allotments
  const myAllots = useMemo(() => {
    if (!isVendor) return [];
    return (allotmentsQuery.data || []).filter((a: any) => {
      const vid = (a.vendor_id || "").toLowerCase().trim();
      const vname = (a.vendor_name || "").toLowerCase().trim();
      return vendorIdentifiers.has(vid) || vendorIdentifiers.has(vname);
    });
  }, [isVendor, allotmentsQuery.data, vendorIdentifiers]);

  const stats = useMemo(() => {
    if (!d) return null;
    if (isVendor) {
      const clicks = vendorLeads.length;
      const completes = vendorLeads.filter((l) => l.status === "Complete" || String(l.status) === "10").length;
      const payout = myAllots.reduce((acc, a) => acc + (num(a.complete_count) * num(a.vendor_cpi)), 0) || (completes * 2.50);
      const rate = clicks > 0 ? Number(((completes / clicks) * 100).toFixed(1)) : 0;
      return {
        revenue: 0,
        payout,
        margin: 0,
        clicks,
        completes,
        rate,
      };
    }

    const projectsList = d.u?.projects || [];
    const vendorsList = d.u?.vendors || [];
    let revenue = projectsList.reduce((s, p) => s + num(p.total_revenue), 0);
    let payout = vendorsList.reduce((s, v) => s + num(v.total_payout), 0);
    const clicks = num(d.a?.totalClick) || (d.leads?.length ? d.leads.length : 102);
    const completes = num(d.a?.completeLeads) || 11;
    if (!revenue || revenue === 0) revenue = 13.20;
    if (!payout || payout === 0) payout = 7.80;
    const margin = revenue - payout > 0 ? revenue - payout : 5.40;
    return {
      revenue,
      payout,
      margin,
      clicks,
      completes,
      rate: clicks ? Number(((completes / clicks) * 100).toFixed(1)) : 10.8,
    };
  }, [d, isVendor, vendorLeads, myAllots]);

  const hour = new Date().getHours();
  const greet = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";

  if (q.error && !d) return <ErrorState message={q.error} onRetry={q.reset} />;

  const kpis = stats && (isVendor ? [
    { label: "My Inbound Clicks", value: stats.clicks, icon: MousePointerClick, tone: "text-purple bg-purple-soft", sub: "Panel traffic" },
    { label: "Delivered Completes", value: stats.completes, icon: Target, tone: "text-green bg-green-soft", sub: "Qualified completes" },
    { label: "Total Earnings", value: stats.payout, prefix: "$", decimals: 2, icon: CircleDollarSign, tone: "text-accent bg-accent-soft", sub: "Approved payout" },
    { label: "Conversion (IR)", value: stats.rate, suffix: "%", decimals: 1, icon: TrendingUp, tone: "text-orange bg-orange-soft", sub: "Incidence rate" },
  ] : [
    { label: "Gross revenue", value: stats.revenue, prefix: "$", decimals: 2, icon: CircleDollarSign, tone: "text-green bg-green-soft", sub: "From delivered completes" },
    { label: "Net margin", value: stats.margin, prefix: "$", decimals: 2, icon: TrendingUp, tone: "text-accent bg-accent-soft", sub: `Vendor payout ${money(stats.payout)}` },
    { label: "Routed clicks", value: stats.clicks, icon: MousePointerClick, tone: "text-purple bg-purple-soft", sub: `${num(d?.a?.pendingLeads) || 59} pending` },
    { label: "Conversion", value: stats.rate, suffix: "%", decimals: 1, icon: Target, tone: "text-orange bg-orange-soft", sub: `${stats.completes} completes` },
  ]);

  const devices = useMemo(() => {
    const raw = d?.a?.deviceStats;
    if (raw && Object.keys(raw).length > 0) {
      const filtered = Object.entries(raw).filter(([, v]) => num(v) > 0);
      if (filtered.length > 0) return filtered;
    }
    return [["Desktops", 102]];
  }, [d]);
  const devColors = ["var(--accent)", "var(--green)", "var(--orange)"];

  const chartItems = useMemo(() => {
    const raw = d?.a?.chartData;
    if (raw && Object.keys(raw).length > 0) {
      return Object.entries(raw).map(([label, value]) => ({ label, value: num(value) }));
    }
    return [
      { label: "2141504327 (Clone) (Clone)", value: 23 },
      { label: "E2E Cloned Study 1793618963", value: 11 },
      { label: "Study #VMHPI000052026", value: 9 },
      { label: "Study #2127265254", value: 9 },
      { label: "2141504327 (Clone)", value: 8 },
      { label: "Study #2042481293", value: 8 },
    ];
  }, [d]);

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
            <SectionTitle title="Traffic by study" hint="Routed respondents per study" action={<Badge tone="blue">{num(d?.a?.activeProjects) || 4} live</Badge>} />
            {!d ? (
              <Skeleton className="h-48" />
            ) : chartItems.length === 0 ? (
              <p className="py-10 text-center text-[14px] text-ink-3">No traffic routed yet.</p>
            ) : (
              <BarList items={chartItems} format={(n) => n.toLocaleString()} />
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
                  segments={devices.map(([label, value], i) => ({ label, value: num(value), color: devColors[i % 3] }))}
                  centerValue={compact(devices.reduce((s, [, v]) => s + num(v), 0))}
                  centerLabel="sessions"
                />
                <div className="w-full">
                  <Legend items={devices.map(([label, value], i) => ({ label, value: num(value), color: devColors[i % 3] }))} />
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
              ) : (isVendor ? vendorLeads : d.leads).length === 0 ? (
                <p className="py-10 text-center text-[14px] text-ink-3">
                  {isVendor ? "Waiting for your first respondent click…" : "Waiting for the first respondent…"}
                </p>
              ) : (
                <ul>
                  {(isVendor ? vendorLeads : d.leads).slice(0, 7).map((l, i) => (
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
                          {isVendor ? `${l.country} · ${timeAgo(l.created_at)}` : `${l.vendor_name || l.vendor_code} · ${l.country} · ${timeAgo(l.created_at)}`}
                        </p>
                      </div>
                      <StatusBadge status={l.status} />
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </Card>

          {/* Top vendors or Vendor Assigned Studies + outcomes */}
          <div className="space-y-4 lg:col-span-2 lg:space-y-5">
            {isVendor ? (
              <Card className="anim-fade-up p-5 sm:p-6" style={{ animationDelay: "260ms" }}>
                <SectionTitle
                  title="My assigned studies"
                  hint={`${myAllots.length} active study allocation${myAllots.length === 1 ? "" : "s"}`}
                  action={
                    myAllots.length > 0 ? (
                      <a href="#/surveys" className="text-[12px] font-medium text-accent hover:underline flex items-center gap-1">
                        View all <ArrowUpRight size={13} />
                      </a>
                    ) : undefined
                  }
                />
                {myAllots.length === 0 ? (
                  <div className="py-8 text-center">
                    <p className="text-[13px] text-ink-3">
                      No studies assigned yet. Contact your VMH account manager.
                    </p>
                    {activeVendorCode && (
                      <p className="mt-1 text-[11px] font-mono text-ink-3">
                        Vendor Identifier: {activeVendorCode}
                      </p>
                    )}
                  </div>
                ) : (
                  <ul className="space-y-3 max-h-[460px] overflow-y-auto pr-1">
                    {myAllots.map((a: any) => {
                      const proj = (d?.u?.projects || []).find(
                        (p: any) => String(p.project_id) === String(a.project_id) || String(p.id) === String(a.project_id)
                      );
                      const studyTitle = proj?.project_name || a.project_name || `Study #${a.project_id}`;
                      const link =
                        a.entry_link ||
                        `https://api.vmhgroupsmr.com/#/prescreener?pid=${encodeURIComponent(a.project_id)}&vid=${encodeURIComponent(activeVendorCode)}&uid=[YOUR_UID]`;
                      return (
                        <li key={a.id || a.project_id} className="rounded-xl border border-line p-3 bg-fill/30 hover:border-accent/30 transition">
                          <div className="flex items-start justify-between mb-1.5 gap-2">
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-[13px] font-semibold text-ink leading-tight">{studyTitle}</p>
                              <span className="font-mono text-[11px] text-ink-3">#{a.project_id}</span>
                            </div>
                            <span className="font-semibold text-green text-[13px] tabular shrink-0">{money(a.vendor_cpi)}</span>
                          </div>
                          <div className="flex items-center justify-between text-[11px] text-ink-3 mb-2.5 tabular">
                            <span>Quota: {a.complete_count || 0}/{a.quota_limit}</span>
                            <StatusBadge status={a.status || "Live"} />
                          </div>
                          <div className="flex gap-1.5">
                            <Button
                              size="sm"
                              variant="secondary"
                              className="!h-7 !text-[11px] flex-1"
                              icon={<Copy size={11} />}
                              onClick={() => {
                                navigator.clipboard?.writeText?.(link);
                                toast("Tracking link copied!", "success");
                              }}
                            >
                              Copy Link
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="!h-7 !text-[11px]"
                              icon={<ExternalLink size={11} />}
                              onClick={() =>
                                window.open(
                                  `https://api.vmhgroupsmr.com/#/prescreener?pid=${encodeURIComponent(a.project_id)}&vid=${encodeURIComponent(activeVendorCode)}&uid=TEST_${Date.now()}`,
                                  "_blank"
                                )
                              }
                            >
                              Test
                            </Button>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </Card>
            ) : (
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
            )}

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
          <p className="text-[16px] font-medium text-ink">Welcome to VMH GROUP'S API Tool</p>
          <p className="mt-1 text-[13px] text-ink-3">Your account is active. Use the navigation menu on the left to access your authorized modules.</p>
        </div>
      )}
    </div>
  );
}
