import { useEffect, useState, useMemo } from "react";
import { Copy, Check, ExternalLink, Code2, Database } from "lucide-react";
import { supabase } from "../lib/supabase";
import { money, num } from "../lib/utils";

export function VendorFeed() {
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(true);
  const [feedData, setFeedData] = useState<any>(null);

  const hash = window.location.hash || "";
  const queryStr = hash.includes("?")
    ? hash.split("?")[1]
    : window.location.search.replace(/^\?/, "");
  const params = useMemo(() => new URLSearchParams(queryStr), [queryStr]);
  const vid = params.get("vid") || params.get("vendor_code") || params.get("v") || "";

  useEffect(() => {
    const fetchFeed = async () => {
      setLoading(true);
      try {
        let allotmentsQuery = supabase
          .from("smr_vendor_allotments")
          .select("*")
          .eq("status", "Active");

        if (vid) {
          allotmentsQuery = allotmentsQuery.eq("vendor_id", vid);
        }

        const { data: allotments } = await allotmentsQuery;

        const projectIds = (allotments || []).map((a) => a.project_id);
        const { data: projects } = await supabase
          .from("smr_projects")
          .select("*")
          .in("project_id", projectIds.length > 0 ? projectIds : ["__none__"])
          .eq("status", "Live");

        const projMap = new Map((projects || []).map((p) => [p.project_id, p]));

        const studies = (allotments || [])
          .filter((a) => projMap.has(a.project_id))
          .map((a) => {
            const p = projMap.get(a.project_id)!;
            return {
              survey_id: a.project_id,
              survey_name: p.project_name,
              client: p.client_name,
              cpi: Number(num(a.vendor_cpi).toFixed(2)),
              quota_limit: num(a.quota_limit, 100),
              completes_recorded: num(a.complete_count, 0),
              loi_minutes: num(p.loi, 10),
              ir_percentage: num(p.ir, 70),
              status: "Live",
              entry_link:
                a.entry_link ||
                `https://api.vmhgroupsmr.com/vendor/auth/${encodeURIComponent(a.vendor_id)}/project/${encodeURIComponent(a.project_id)}?uid=[RESPONDENT_ID]`,
            };
          });

        const output = {
          success: true,
          endpoint: "VMH Group SMR Partner Inventory Feed API",
          partner_code: vid || "ALL_PARTNERS",
          total_active_surveys: studies.length,
          generated_at: new Date().toISOString(),
          universal_router_url: vid
            ? `https://api.vmhgroupsmr.com/#/router?vid=${encodeURIComponent(vid)}&uid=[RESPONDENT_ID]`
            : null,
          surveys: studies,
        };

        setFeedData(output);
      } catch (err) {
        console.error("Feed error:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchFeed();
  }, [vid]);

  const copyJson = () => {
    if (!feedData) return;
    navigator.clipboard?.writeText(JSON.stringify(feedData, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="min-h-screen w-full bg-[#0d1117] text-slate-100 p-4 sm:p-8 font-mono text-xs">
      <div className="max-w-4xl mx-auto space-y-4">
        {/* Header bar */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-4 rounded-2xl bg-white/[0.04] border border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <div className="text-sm font-semibold text-white flex items-center gap-2 font-sans">
                Vendor Live Inventory Feed API
                <span className="px-2 py-0.5 rounded-full text-[10px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  HTTP 200 OK
                </span>
              </div>
              <div className="text-[11px] text-white/50">
                Partner: <span className="text-indigo-400">{vid || "ALL"}</span> · Real-time JSON feed
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={copyJson}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-white text-xs font-semibold transition"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              {copied ? "Copied JSON" : "Copy JSON Feed"}
            </button>
            <a
              href="#/vendors"
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-white/70 text-xs transition font-sans"
            >
              Dashboard
            </a>
          </div>
        </div>

        {/* JSON Code block */}
        <div className="relative rounded-2xl bg-[#090d13] border border-white/10 p-5 overflow-x-auto shadow-2xl">
          {loading ? (
            <div className="py-20 text-center text-white/40">Loading partner inventory feed...</div>
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
