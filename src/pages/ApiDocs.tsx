import { useMemo, useState } from "react";
import {
  Code2,
  ShieldCheck,
  ChevronDown,
  ChevronRight,
  Send,
  Loader2,
  Database,
  Lock,
  Webhook,
  Copy,
  Check,
  ExternalLink,
} from "lucide-react";
import { supabase } from "../lib/supabase";
import { usePermissions } from "../lib/permissions";
import { num } from "../lib/utils";

interface EndpointDef {
  method: "GET" | "POST";
  path: string;
  summary: string;
  description: string;
  params?: { name: string; type: string; required: boolean; desc: string }[];
  sampleResponse: (vid: string, origin: string) => any;
}

const ENDPOINTS: EndpointDef[] = [
  {
    method: "GET",
    path: "/api/supplier/getAllSurveys",
    summary: "Get all surveys allotted to your partner account",
    description:
      "Retrieves ONLY the live studies currently assigned to your partner account with real-time payout CPI, LOI, IR, remaining quota, and ready-to-route VMH GROUP entry links.",
    params: [
      {
        name: "vendor_id",
        type: "string",
        required: true,
        desc: "Your unique VMH GROUP Partner Access Key / Vendor ID (or pass via Header: access-key).",
      },
    ],
    sampleResponse: (vid, origin) => ({
      success: true,
      brand: "VMH GROUP",
      apiVersion: "1.0",
      message: "Allotted active surveys retrieved successfully",
      result: {
        success: true,
        vendor_id: vid,
        total: 1,
        universal_router_url: `${origin}/#/router?vid=${encodeURIComponent(vid)}&uid=[RESPONDENT_ID]`,
        data: [
          {
            survey_id: "2141504327",
            survey_name: "Consumer Insights Study",
            brand: "VMH GROUP",
            cpi: 1.25,
            currency: "USD",
            loi: "12",
            ir: "70",
            total_quota: 250,
            remaining_quota: 242,
            country: "US",
            status: "Live",
            entry_link: `${origin}/#/prescreener?pid=2141504327&vid=${encodeURIComponent(vid)}&uid=[RESPONDENT_ID]`,
          },
        ],
      },
    }),
  },
  {
    method: "GET",
    path: "/api/supplier/getSurveyDetails",
    summary: "Get study specs & entry rules for an allotted survey",
    description:
      "Retrieves detailed targeting specifications, remaining quota, and entry URL for a specific survey assigned to your account.",
    params: [
      {
        name: "survey_id",
        type: "string",
        required: true,
        desc: "The Survey ID assigned to your partner account.",
      },
      {
        name: "vendor_id",
        type: "string",
        required: true,
        desc: "Your VMH GROUP Partner ID.",
      },
    ],
    sampleResponse: (vid, origin) => ({
      success: true,
      brand: "VMH GROUP",
      apiVersion: "1.0",
      message: "Survey details retrieved successfully",
      result: {
        success: true,
        data: {
          survey_id: "2141504327",
          survey_name: "Consumer Insights Study",
          brand: "VMH GROUP",
          cpi: 1.25,
          loi: "12",
          ir: "70",
          status: "Live",
          quota_limit: 250,
          remaining_quota: 242,
          country: "US",
          entry_link: `${origin}/#/prescreener?pid=2141504327&vid=${encodeURIComponent(vid)}&uid=[RESPONDENT_ID]`,
        },
      },
    }),
  },
];

export function ApiDocs() {
  const { user } = usePermissions();
  const isVendor =
    user?.role_id === 3 ||
    user?.role_name === "Vendor" ||
    user?.role_name?.toLowerCase().includes("vendor");

  const activeVendorCode = useMemo(
    () => user?.vendor_code || user?.supplier_id || (isVendor ? user?.username : "") || "VND001",
    [user, isVendor],
  );

  const origin = typeof window !== "undefined" ? window.location.origin : "https://api.vmhgroupsmr.com";

  const [expanded, setExpanded] = useState<Record<string, boolean>>({
    "/api/supplier/getAllSurveys": true,
  });
  const [testResults, setTestResults] = useState<Record<string, any>>({});
  const [testing, setTesting] = useState<Record<string, boolean>>({});
  const [copiedSpec, setCopiedSpec] = useState(false);

  const toggle = (path: string) => {
    setExpanded((prev) => ({ ...prev, [path]: !prev[path] }));
  };

  const copyPartnerGuide = () => {
    const guide =
      `VMH GROUP · Partner API Integration Specification (${activeVendorCode})\n` +
      `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
      `1. Supply API Documentation\n` +
      `• Partner Access Key (Header: access-key): ${activeVendorCode}\n` +
      `• Live Survey Inventory Feed: ${origin}/#/vendor-feed?vid=${encodeURIComponent(activeVendorCode)}\n` +
      `• Universal Survey Router Link: ${origin}/#/router?vid=${encodeURIComponent(activeVendorCode)}&uid=[RESPONDENT_ID]\n\n` +
      `2. Redirect URL Hashing & Security Guide\n` +
      `• Optional Parameter: &hash=[HASH] (SHA-256 / HMAC-SHA256 signature)\n` +
      `• Automated Fraud Gate: Duplicate UID/IP blocking, Bot detection & Speeder protection run before entry & on complete.\n\n` +
      `3. S2S (Server-to-Server) & Return Redirect Guide\n` +
      `• Status 10 = Complete\n` +
      `• Status 20 = Terminate / Screenout\n` +
      `• Status 30 = Quota Full (Overquota)\n` +
      `• Status 40 = Security / Fraud Gate\n` +
      `• Required Placeholder: [UID]\n`;
    navigator.clipboard?.writeText?.(guide);
    setCopiedSpec(true);
    setTimeout(() => setCopiedSpec(false), 2000);
  };

  const runTest = async (ep: EndpointDef) => {
    setTesting((prev) => ({ ...prev, [ep.path]: true }));
    try {
      // Strictly query vendor-scoped allotments so vendors only ever see their own allotted studies and VMH GROUP branding
      const { data: allotments } = await supabase
        .from("smr_vendor_allotments")
        .select("*")
        .ilike("vendor_id", activeVendorCode);

      const activeAllots = (allotments || []).filter(
        (a: any) => !a.status || ["active", "live"].includes(String(a.status).toLowerCase()),
      );

      const pids = activeAllots.map((a: any) => String(a.project_id));
      const { data: projs } = await supabase
        .from("smr_projects")
        .select("project_id, project_name, loi, ir, country, status")
        .in("project_id", pids.length > 0 ? pids : ["__none__"]);

      const projMap = new Map((projs || []).map((p: any) => [String(p.project_id), p]));

      const scopedSurveys = activeAllots
        .filter((a: any) => {
          const p = projMap.get(String(a.project_id));
          if (p) return ["live", "active"].includes(String(p.status || "").toLowerCase());
          return /^\d{8,12}$/.test(String(a.project_id || "").trim());
        })
        .map((a: any) => {
          const pid = String(a.project_id);
          const p = projMap.get(pid);
          const quotaLimit = num(a.quota_limit, 100);
          const comp = num(a.complete_count, 0);
          return {
            survey_id: pid,
            survey_name: p?.project_name || `Study #${pid}`,
            brand: "VMH GROUP",
            cpi: Number(num(a.vendor_cpi).toFixed(2)),
            currency: "USD",
            loi: String(num(p?.loi, 10)),
            ir: String(num(p?.ir, 70)),
            total_quota: quotaLimit,
            remaining_quota: Math.max(0, quotaLimit - comp),
            country: p?.country || "US",
            status: "Live",
            entry_link: `${origin}/#/prescreener?pid=${encodeURIComponent(pid)}&vid=${encodeURIComponent(activeVendorCode)}&uid=[RESPONDENT_ID]`,
          };
        });

      if (ep.path.includes("getAllSurveys")) {
        setTestResults((prev) => ({
          ...prev,
          [ep.path]: {
            success: true,
            brand: "VMH GROUP",
            apiVersion: "1.0",
            vendor_id: activeVendorCode,
            total: scopedSurveys.length,
            universal_router_url: `${origin}/#/router?vid=${encodeURIComponent(activeVendorCode)}&uid=[RESPONDENT_ID]`,
            data: scopedSurveys,
          },
        }));
      } else {
        setTestResults((prev) => ({
          ...prev,
          [ep.path]: {
            success: true,
            brand: "VMH GROUP",
            apiVersion: "1.0",
            vendor_id: activeVendorCode,
            data: scopedSurveys[0] || { message: "No active surveys currently allotted to this partner ID." },
          },
        }));
      }
    } catch (err: any) {
      setTestResults((prev) => ({ ...prev, [ep.path]: { error: err?.message || "Query failed" } }));
    } finally {
      setTesting((prev) => ({ ...prev, [ep.path]: false }));
    }
  };

  return (
    <div className="min-h-screen bg-[#f6f7f9] dark:bg-[#0b0c0e] text-[#111317] dark:text-[#eef0f3] py-8 px-4 sm:px-8">
      <div className="max-w-5xl mx-auto space-y-8">
        {/* Top Header Card */}
        <div className="rounded-2xl border border-black/[0.08] dark:border-white/[0.09] bg-white dark:bg-[#14161a] p-6 sm:p-8 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-black/[0.07] dark:border-white/[0.08] pb-6">
            <div>
              <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-md text-xs font-semibold bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 mb-2">
                VMH GROUP · Partner Integration Specification v1.0
              </div>
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
                Partner API &amp; Integration Guides
              </h1>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400 max-w-2xl">
                Official 3-part integration kit for VMH GROUP supply partners. Fetch only the live surveys allocated to your partner ID, verify redirect security hashes, and process real-time S2S callbacks.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2.5">
              <button
                type="button"
                onClick={copyPartnerGuide}
                className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-full bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-sm transition cursor-pointer"
              >
                {copiedSpec ? <Check size={14} /> : <Copy size={14} />}
                {copiedSpec ? "Spec Copied!" : "Copy 3-Part Spec"}
              </button>
              <a
                href={`#/vendor-feed?vid=${encodeURIComponent(activeVendorCode)}`}
                className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-full border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/[0.05] hover:bg-slate-100 dark:hover:bg-white/[0.1] text-xs font-medium transition"
              >
                <Code2 size={13} />
                Live JSON Feed
                <ExternalLink size={12} />
              </a>
            </div>
          </div>

          {/* 3-Guide Structure matching Partner Onboarding Spec */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-6">
            {/* Guide 1: Supply API Documentation */}
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-white/[0.02] border border-slate-200/80 dark:border-white/5 space-y-2">
              <div className="flex items-center gap-2 text-xs font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider">
                <Database size={14} />
                <span>1. Supply API Documentation</span>
              </div>
              <p className="text-xs leading-relaxed text-slate-600 dark:text-slate-300">
                Authenticate via header or query parameter to pull only your allotted live studies:
              </p>
              <div className="font-mono text-[11px] p-2.5 rounded-lg bg-white dark:bg-black/30 border border-slate-200 dark:border-white/5 text-indigo-600 dark:text-indigo-400 break-all">
                access-key: {activeVendorCode}
              </div>
              <div className="text-[11px] text-slate-500 dark:text-slate-400">
                Router: <code className="font-mono">/#/router?vid={activeVendorCode}&amp;uid=[UID]</code>
              </div>
            </div>

            {/* Guide 2: Redirect URL Hashing Guide */}
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-white/[0.02] border border-slate-200/80 dark:border-white/5 space-y-2">
              <div className="flex items-center gap-2 text-xs font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">
                <Lock size={14} />
                <span>2. Redirect URL Hashing Guide</span>
              </div>
              <p className="text-xs leading-relaxed text-slate-600 dark:text-slate-300">
                Supports optional <code className="font-mono">SHA-256</code> / <code className="font-mono">HMAC-SHA256</code> verification via <code className="font-mono">&amp;hash=[HASH]</code>.
              </p>
              <div className="font-mono text-[10.5px] p-2.5 rounded-lg bg-white dark:bg-black/30 border border-slate-200 dark:border-white/5 text-slate-600 dark:text-slate-300 break-all">
                SHA256(uid + ":" + status + ":" + accessKey)
              </div>
              <div className="text-[11px] text-slate-500 dark:text-slate-400">
                Duplicate IP/UID, Bot &amp; Speeder checks enforced automatically.
              </div>
            </div>

            {/* Guide 3: S2S Integration Guide */}
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-white/[0.02] border border-slate-200/80 dark:border-white/5 space-y-2">
              <div className="flex items-center gap-2 text-xs font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wider">
                <Webhook size={14} />
                <span>3. S2S Integration Guide</span>
              </div>
              <div className="space-y-1 text-xs">
                <div><span className="font-bold text-emerald-600">10</span> : Complete (Payout Credited)</div>
                <div><span className="font-bold text-amber-600">20</span> : Terminate / Screenout</div>
                <div><span className="font-bold text-sky-600">30</span> : Quota Full (Overquota)</div>
                <div><span className="font-bold text-rose-600">40</span> : Security / Fraud Block</div>
              </div>
              <div className="text-[11px] text-slate-500 dark:text-slate-400">
                Callback macro: <code className="font-mono">?uid=[UID]</code>
              </div>
            </div>
          </div>
        </div>

        {/* Endpoints List */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Database size={18} className="text-indigo-600" />
              VMH GROUP Supply API Endpoints ({activeVendorCode})
            </h2>
            <span className="text-xs text-slate-500 tabular-nums">{ENDPOINTS.length} endpoints</span>
          </div>

          <div className="space-y-3">
            {ENDPOINTS.map((ep) => {
              const isOpen = !!expanded[ep.path];
              const testData = testResults[ep.path];
              const isTesting = testing[ep.path];
              const sample = ep.sampleResponse(activeVendorCode, origin);

              return (
                <div
                  key={ep.path}
                  className="rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-white/[0.03] overflow-hidden shadow-sm transition"
                >
                  <div
                    onClick={() => toggle(ep.path)}
                    className="p-4 sm:p-5 flex items-center justify-between gap-3 cursor-pointer select-none hover:bg-slate-50/50 dark:hover:bg-white/[0.02]"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="px-2.5 py-1 rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-xs font-bold font-mono">
                        {ep.method}
                      </span>
                      <span className="font-mono text-xs sm:text-sm font-semibold text-slate-900 dark:text-white truncate">
                        {ep.path}
                      </span>
                      <span className="hidden md:inline text-xs text-slate-500 dark:text-slate-400">
                        — {ep.summary}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      {isOpen ? (
                        <ChevronDown size={16} className="text-slate-400" />
                      ) : (
                        <ChevronRight size={16} className="text-slate-400" />
                      )}
                    </div>
                  </div>

                  {isOpen && (
                    <div className="p-5 sm:p-6 border-t border-slate-100 dark:border-white/5 space-y-5 bg-slate-50/50 dark:bg-black/20 text-xs">
                      <p className="text-slate-600 dark:text-slate-300 leading-relaxed">
                        {ep.description}
                      </p>

                      {ep.params && ep.params.length > 0 && (
                        <div>
                          <h4 className="font-semibold text-slate-900 dark:text-white mb-2 uppercase tracking-wider text-[11px]">
                            Parameters
                          </h4>
                          <div className="rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-white/[0.03] overflow-hidden">
                            <table className="w-full text-left">
                              <thead className="bg-slate-100/70 dark:bg-white/[0.05] text-[11px] text-slate-500">
                                <tr>
                                  <th className="p-2.5 font-semibold">Name</th>
                                  <th className="p-2.5 font-semibold">Type</th>
                                  <th className="p-2.5 font-semibold">Required</th>
                                  <th className="p-2.5 font-semibold">Description</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                                {ep.params.map((p) => (
                                  <tr key={p.name}>
                                    <td className="p-2.5 font-mono text-indigo-600 dark:text-indigo-400 font-semibold">
                                      {p.name}
                                    </td>
                                    <td className="p-2.5 font-mono text-slate-500">{p.type}</td>
                                    <td className="p-2.5">
                                      <span
                                        className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                                          p.required
                                            ? "bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-400"
                                            : "bg-slate-100 text-slate-600 dark:bg-white/10 dark:text-slate-300"
                                        }`}
                                      >
                                        {p.required ? "required" : "optional"}
                                      </span>
                                    </td>
                                    <td className="p-2.5 text-slate-600 dark:text-slate-400">{p.desc}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      )}

                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <h4 className="font-semibold text-slate-900 dark:text-white uppercase tracking-wider text-[11px]">
                            Example &amp; Live Partner Query ({activeVendorCode})
                          </h4>
                          <button
                            type="button"
                            onClick={() => runTest(ep)}
                            disabled={isTesting}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-medium transition cursor-pointer disabled:opacity-50"
                          >
                            {isTesting ? <Loader2 size={12} className="animate-spin" /> : <Send size={12} />}
                            Execute Live Query
                          </button>
                        </div>

                        <div className="relative rounded-xl border border-slate-800 bg-[#0d1117] p-4 text-emerald-400 font-mono text-[11px] overflow-x-auto max-h-72">
                          <pre>{JSON.stringify(testData || sample, null, 2)}</pre>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Footer info */}
        <div className="pt-6 border-t border-slate-200 dark:border-white/10 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500">
          <div className="flex items-center gap-2">
            <ShieldCheck size={16} className="text-indigo-600" />
            <span>VMH GROUP Partner Gateway API v1.0</span>
          </div>
          <div>
            Strictly scoped partner inventory · Only surveys allotted to your Partner ID are visible.
          </div>
        </div>
      </div>
    </div>
  );
}
