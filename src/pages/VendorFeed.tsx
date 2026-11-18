import { useEffect, useState, useMemo } from "react";
import { Copy, Check, Database, BookOpen } from "lucide-react";
import { supabase } from "../lib/supabase";
import { usePermissions } from "../lib/permissions";
import { num } from "../lib/utils";

export function VendorFeed() {
  const { user } = usePermissions();
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(true);
  const [feedData, setFeedData] = useState<any>(null);

  const hash = typeof window !== "undefined" ? window.location.hash || "" : "";
  const queryStr = hash.includes("?")
    ? hash.split("?")[1]
    : typeof window !== "undefined"
    ? window.location.search.replace(/^\?/, "")
    : "";
  const params = useMemo(() => new URLSearchParams(queryStr), [queryStr]);
  const paramVid =
    params.get("vid") || params.get("vendor_code") || params.get("vendor_id") || params.get("v") || params.get("access_key") || "";
  const activeVid = (paramVid || user?.vendor_code || user?.supplier_id || (user?.role_id === 3 ? user?.username : "") || "").trim();

  useEffect(() => {
    const fetchFeed = async () => {
      setLoading(true);
      const origin = typeof window !== "undefined" ? window.location.origin : "https://api.vmhgroupsmr.com";

      if (!activeVid) {
        setFeedData({
          success: false,
          brand: "VMH GROUP",
          message: "Partner vendor_id or access-key is required to access your allotted survey feed.",
          total_active_surveys: 0,
          generated_at: new Date().toISOString(),
          surveys: [],
        });
        setLoading(false);
        return;
      }

      try {
        const { data: allotments } = await supabase
          .from("smr_vendor_allotments")
          .select("*")
          .ilike("vendor_id", activeVid);

        const activeAllots = (allotments || []).filter(
          (a: any) => !a.status || ["active", "live"].includes(String(a.status).toLowerCase()),
        );

        const projectIds = activeAllots.map((a: any) => String(a.project_id));
        const { data: projects } = await supabase
          .from("smr_projects")
          .select("project_id, project_name, cpi, loi, ir, country, status, target_completes")
          .in("project_id", projectIds.length > 0 ? projectIds : ["__none__"]);

        const projMap = new Map((projects || []).map((p: any) => [String(p.project_id), p]));

        const studies = activeAllots
          .filter((a: any) => {
            const p = projMap.get(String(a.project_id));
            if (p) {
              return ["live", "active"].includes(String(p.status || "").toLowerCase());
            }
            // Include uncloned Marketplace numeric IDs directly allotted to this vendor
            return /^\d{8,12}$/.test(String(a.project_id || "").trim());
          })
          .map((a: any) => {
            const pid = String(a.project_id);
            const p = projMap.get(pid);
            const quotaLimit = num(a.quota_limit, 100);
            const completesRecorded = num(a.complete_count, 0);
            const remainingQuota = Math.max(0, quotaLimit - completesRecorded);
            return {
              survey_id: pid,
              survey_name: p?.project_name || `Study #${pid}`,
              brand: "VMH GROUP",
              cpi: Number(num(a.vendor_cpi).toFixed(2)),
              currency: "USD",
              loi_minutes: num(p?.loi, 10),
              ir_percentage: num(p?.ir, 70),
              quota_limit: quotaLimit,
              completes_recorded: completesRecorded,
              remaining_quota: remainingQuota,
              country: p?.country || "US",
              status: "Live",
              entry_link: `${origin}/#/prescreener?pid=${encodeURIComponent(pid)}&vid=${encodeURIComponent(activeVid)}&uid=[RESPONDENT_ID]`,
            };
          });

        setFeedData({
          success: true,
          brand: "VMH GROUP",
          endpoint: "VMH GROUP Partner Supply Inventory Feed",
          partner_code: activeVid,
          total_active_surveys: studies.length,
          generated_at: new Date().toISOString(),
          universal_router_url: `${origin}/#/router?vid=${encodeURIComponent(activeVid)}&uid=[RESPONDENT_ID]`,
          surveys: studies,
        });
      } catch (err) {
        console.error("Feed error:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchFeed();
  }, [activeVid]);

  const copyJson = () => {
    if (!feedData) return;
    navigator.clipboard?.writeText(JSON.stringify(feedData, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="min-h-screen w-full bg-[#0d1117] text-slate-100 p-4 sm:p-8 font-mono text-xs">
      <div className="max-w-4xl mx-auto space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-4 rounded-2xl bg-white/[0.04] border border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <div className="text-sm font-semibold text-white flex items-center gap-2 font-sans">
                VMH GROUP · Partner Live Survey Feed
                <span className="px-2 py-0.5 rounded-full text-[10px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  {feedData?.total_active_surveys ?? 0} Allotted
                </span>
              </div>
              <div className="text-[11px] text-white/50">
                Partner: <span className="text-indigo-400">{activeVid || "REQUIRED"}</span> · Strictly scoped JSON inventory
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={copyJson}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-white text-xs font-semibold transition cursor-pointer"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              {copied ? "Copied JSON" : "Copy JSON Feed"}
            </button>
            <a
              href="#/api-docs"
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-white/80 text-xs transition font-sans"
            >
              <BookOpen className="w-3.5 h-3.5" />
              API Docs
            </a>
            <a
              href="#/surveys"
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-white/70 text-xs transition font-sans"
            >
              My Surveys
            </a>
          </div>
        </div>

        <div className="relative rounded-2xl bg-[#090d13] border border-white/10 p-5 overflow-x-auto shadow-2xl">
          {loading ? (
            <div className="py-20 text-center text-white/40">Loading VMH GROUP partner inventory feed...</div>
          ) : (
            <pre className="text-emerald-400/90 leading-relaxed text-[12px] font-mono">
              {JSON.stringify(feedData, null, 2)}
            </pre>
          )}
        </div>
      </div>
    </div>
  );
}
