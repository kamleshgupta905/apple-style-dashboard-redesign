import { useEffect, useMemo, useState } from "react";
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
import { api } from "../lib/api";
import { getPublicOrigin } from "../lib/data";
import { usePermissions } from "../lib/permissions";
import { num } from "../lib/utils";
import { cn } from "../utils/cn";

type GuideSection = "supply" | "hashing" | "s2s";

interface EndpointDef {
  method: "GET";
  path: string;
  summary: string;
  description: string;
  params: { name: string; type: string; required: boolean; desc: string }[];
  sampleResponse: (vid: string, origin: string) => any;
}

const ENDPOINTS: EndpointDef[] = [
  {
    method: "GET",
    path: "/api/supplier/getAllSurveys",
    summary: "Fetch only the live surveys assigned to your Partner ID",
    description:
      "Returns exclusively the active studies allotted to your partner account with your payout CPI, LOI, IR, remaining quota, and ready-to-route VMH GROUP entry links.",
    params: [
      {
        name: "vendor_id",
        type: "string",
        required: true,
        desc: "Your VMH GROUP Partner Access Key (or pass via Header: access-key).",
      },
    ],
    sampleResponse: (vid, origin) => ({
      success: true,
      brand: "VMH GROUP",
      partner_id: vid,
      total: 1,
      universal_router_url: `${origin}/#/router?vid=${encodeURIComponent(vid)}&uid=[RESPONDENT_ID]`,
      surveys: [
        {
          survey_id: "2141504327",
          survey_name: "Consumer Insights Study",
          brand: "VMH GROUP",
          cpi: 1.25,
          currency: "USD",
          loi: 12,
          ir: 70,
          remaining_quota: 242,
          country: "US",
          status: "Live",
          entry_link: `${origin}/#/prescreener?pid=2141504327&vid=${encodeURIComponent(vid)}&uid=[RESPONDENT_ID]`,
        },
      ],
    }),
  },
  {
    method: "GET",
    path: "/api/supplier/getSurveyDetails",
    summary: "Fetch single allotted survey specification",
    description:
      "Retrieves payout CPI, LOI, IR, remaining quota, and entry link for a single assigned study.",
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
        desc: "Your VMH GROUP Partner Access Key.",
      },
    ],
    sampleResponse: (vid, origin) => ({
      success: true,
      brand: "VMH GROUP",
      partner_id: vid,
      survey: {
        survey_id: "2141504327",
        survey_name: "Consumer Insights Study",
        brand: "VMH GROUP",
        cpi: 1.25,
        currency: "USD",
        loi: 12,
        ir: 70,
        remaining_quota: 242,
        country: "US",
        status: "Live",
        entry_link: `${origin}/#/prescreener?pid=2141504327&vid=${encodeURIComponent(vid)}&uid=[RESPONDENT_ID]`,
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

  const hash = typeof window !== "undefined" ? window.location.hash || "" : "";
  const queryStr = hash.includes("?")
    ? hash.split("?")[1]
    : typeof window !== "undefined"
    ? window.location.search.replace(/^\?/, "")
    : "";
  const urlParams = useMemo(() => new URLSearchParams(queryStr), [queryStr]);

  const urlVid =
    urlParams.get("vid") ||
    urlParams.get("vendor_id") ||
    urlParams.get("vendor_code") ||
    urlParams.get("access_key") ||
    "";
  const urlSection = (urlParams.get("section") || "").toLowerCase() as GuideSection;

  const activeVendorCode = useMemo(
    () => (urlVid || user?.vendor_code || user?.supplier_id || (isVendor ? user?.username : "") || "VND001").trim(),
    [urlVid, user, isVendor],
  );

  const origin = getPublicOrigin();
  const [section, setSection] = useState<GuideSection>(
    ["supply", "hashing", "s2s"].includes(urlSection) ? urlSection : "supply",
  );

  useEffect(() => {
    if (["supply", "hashing", "s2s"].includes(urlSection)) {
      setSection(urlSection);
    }
  }, [urlSection]);

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
    const supplyDocUrl = `${origin}/#/api-docs?vid=${encodeURIComponent(activeVendorCode)}&section=supply`;
    const hashingDocUrl = `${origin}/#/api-docs?vid=${encodeURIComponent(activeVendorCode)}&section=hashing`;
    const s2sDocUrl = `${origin}/#/api-docs?vid=${encodeURIComponent(activeVendorCode)}&section=s2s`;
    const feedUrl = `${origin}/#/vendor-feed?vid=${encodeURIComponent(activeVendorCode)}`;
    const routerUrl = `${origin}/#/router?vid=${encodeURIComponent(activeVendorCode)}&uid=[RESPONDENT_ID]`;

    const guide =
      `VMH GROUP · Partner API Integration\n\n` +
      `Please find below the relevant documentation and credentials for the VMH GROUP API integration:\n\n` +
      `Partner Access Key (vid): ${activeVendorCode}\n` +
      `Live Assigned Surveys Feed: ${feedUrl}\n` +
      `Entry Router Link: ${routerUrl}\n\n` +
      `Supply API Documentation :- ${supplyDocUrl}\n` +
      `Redirect URL Hashing Guide :- ${hashingDocUrl}\n` +
      `S2S (Server-to-Server) Integration Guide :- ${s2sDocUrl}\n\n` +
      `Please share your 3 Return Redirect URLs (Complete 10, Terminate 20, Overquota 30) with [UID] macro.\n`;

    navigator.clipboard?.writeText?.(guide);
    setCopiedSpec(true);
    setTimeout(() => setCopiedSpec(false), 2000);
  };

  const runTest = async (ep: EndpointDef) => {
    setTesting((prev) => ({ ...prev, [ep.path]: true }));
    try {
      const [allotsRes, projectsRes, marketRes] = await Promise.all([
        api.get<{ data: any[] }>("/vendor/allotments").catch(() => ({ data: [] })),
        api.get<{ data: any[] }>("/manage/projects").catch(() => ({ data: [] })),
        api.get<{ data: any[] }>("/zamplia").catch(() => ({ data: [] })),
      ]);

      const vidLower = activeVendorCode.toLowerCase();
      const activeAllots = (allotsRes.data || []).filter((a: any) => {
        const avid = String(a.vendor_id || "").toLowerCase().trim();
        const avname = String(a.vendor_name || "").toLowerCase().trim();
        const isActive = !a.status || ["active", "live"].includes(String(a.status).toLowerCase());
        return isActive && (avid === vidLower || avname === vidLower);
      });

      const projMap = new Map<string, any>(
        (projectsRes.data || []).map((p: any) => [String(p.project_id || "").trim(), p]),
      );
      const marketMap = new Map<string, any>(
        (marketRes.data || []).map((m: any) => [String(m.survey_id ?? m.SurveyId ?? m.project_id ?? m.id ?? "").trim(), m]),
      );

      const scopedSurveys = activeAllots
        .filter((a: any) => {
          const pid = String(a.project_id || "").trim();
          const p = projMap.get(pid);
          if (p) return !p.status || ["live", "active"].includes(String(p.status).toLowerCase());
          return true;
        })
        .map((a: any) => {
          const pid = String(a.project_id || "").trim();
          const p = projMap.get(pid);
          const m = marketMap.get(pid);
          const quotaLimit = num(a.quota_limit, 100);
          const comp = num(a.complete_count, 0);
          return {
            survey_id: pid,
            survey_name: p?.project_name || m?.survey_name || m?.name || m?.Name || `Study #${pid}`,
            brand: "VMH GROUP",
            cpi: Number(num(a.vendor_cpi).toFixed(2)),
            currency: "USD",
            loi: num(p?.loi ?? m?.loi ?? m?.LOI, 10),
            ir: num(p?.ir ?? m?.ir ?? m?.IR, 70),
            remaining_quota: Math.max(0, quotaLimit - comp),
            country: p?.country || m?.country || "US",
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
            partner_id: activeVendorCode,
            total: scopedSurveys.length,
            universal_router_url: `${origin}/#/router?vid=${encodeURIComponent(activeVendorCode)}&uid=[RESPONDENT_ID]`,
            surveys: scopedSurveys,
          },
        }));
      } else {
        setTestResults((prev) => ({
          ...prev,
          [ep.path]: {
            success: true,
            brand: "VMH GROUP",
            partner_id: activeVendorCode,
            survey: scopedSurveys[0] || { message: "No active surveys currently allotted to this partner ID." },
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
    <div className="min-h-screen bg-[#f6f7f9] dark:bg-[#0b0c0e] text-[#111317] dark:text-[#eef0f3] py-6 sm:py-8 px-4 sm:px-8">
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Top Header Card */}
        <div className="rounded-2xl border border-black/[0.08] dark:border-white/[0.09] bg-white dark:bg-[#14161a] p-5 sm:p-8 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-black/[0.07] dark:border-white/[0.08] pb-5">
            <div>
              <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-md text-xs font-semibold bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 mb-2">
                VMH GROUP · Partner Integration Portal
              </div>
              <h1 className="text-xl sm:text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
                Partner API Documentation
              </h1>
              <p className="mt-1 text-xs sm:text-sm text-slate-500 dark:text-slate-400 max-w-2xl">
                Access your allotted live surveys, verify redirect security hashes, and integrate S2S return callbacks with <strong>VMH GROUP</strong>.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={copyPartnerGuide}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-sm transition cursor-pointer"
              >
                {copiedSpec ? <Check size={14} /> : <Copy size={14} />}
                {copiedSpec ? "Spec Copied!" : "Copy Integration Spec"}
              </button>
              <a
                href={`#/vendor-feed?vid=${encodeURIComponent(activeVendorCode)}`}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/[0.05] hover:bg-slate-100 dark:hover:bg-white/[0.1] text-xs font-medium transition"
              >
                <Code2 size={13} />
                Live JSON Feed
                <ExternalLink size={12} />
              </a>
            </div>
          </div>

          {/* 3-Guide Navigation Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-5">
            <button
              type="button"
              onClick={() => setSection("supply")}
              className={cn(
                "text-left p-4 rounded-2xl border transition cursor-pointer space-y-1.5",
                section === "supply"
                  ? "bg-indigo-50/70 dark:bg-indigo-950/30 border-indigo-500/40 ring-1 ring-indigo-500/30"
                  : "bg-slate-50 dark:bg-white/[0.02] border-slate-200/80 dark:border-white/5 hover:border-slate-300 dark:hover:border-white/15",
              )}
            >
              <div className="flex items-center gap-2 text-xs font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider">
                <Database size={14} />
                <span>1. Supply API Documentation</span>
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-300">
                Fetch only surveys allotted to <code className="font-mono font-semibold">{activeVendorCode}</code> &amp; entry links.
              </p>
            </button>

            <button
              type="button"
              onClick={() => setSection("hashing")}
              className={cn(
                "text-left p-4 rounded-2xl border transition cursor-pointer space-y-1.5",
                section === "hashing"
                  ? "bg-emerald-50/70 dark:bg-emerald-950/30 border-emerald-500/40 ring-1 ring-emerald-500/30"
                  : "bg-slate-50 dark:bg-white/[0.02] border-slate-200/80 dark:border-white/5 hover:border-slate-300 dark:hover:border-white/15",
              )}
            >
              <div className="flex items-center gap-2 text-xs font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">
                <Lock size={14} />
                <span>2. Redirect URL Hashing Guide</span>
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-300">
                SHA-256 / HMAC-SHA256 parameter signing &amp; Fraud Gate rules.
              </p>
            </button>

            <button
              type="button"
              onClick={() => setSection("s2s")}
              className={cn(
                "text-left p-4 rounded-2xl border transition cursor-pointer space-y-1.5",
                section === "s2s"
                  ? "bg-amber-50/70 dark:bg-amber-950/30 border-amber-500/40 ring-1 ring-amber-500/30"
                  : "bg-slate-50 dark:bg-white/[0.02] border-slate-200/80 dark:border-white/5 hover:border-slate-300 dark:hover:border-white/15",
              )}
            >
              <div className="flex items-center gap-2 text-xs font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wider">
                <Webhook size={14} />
                <span>3. S2S Integration Guide</span>
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-300">
                Return redirect status codes (<code className="font-mono">10/20/30/40</code>) &amp; <code className="font-mono">[UID]</code> postbacks.
              </p>
            </button>
          </div>
        </div>

        {/* Section 1: Supply API Documentation */}
        {section === "supply" && (
          <div className="anim-fade-up space-y-4">
            <div className="rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#14161a] p-5 sm:p-6 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <Database size={18} className="text-indigo-600" />
                  1. Supply API Documentation ({activeVendorCode})
                </h2>
                <span className="font-mono text-xs px-2.5 py-1 rounded-lg bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400">
                  access-key: {activeVendorCode}
                </span>
              </div>
              <div className="grid gap-3 sm:grid-cols-2 text-xs">
                <div className="rounded-xl bg-slate-50 dark:bg-white/[0.03] border border-slate-200/80 dark:border-white/10 p-3.5 space-y-1">
                  <div className="font-semibold text-slate-900 dark:text-white">Universal Router Link (1 Link for All Studies)</div>
                  <div className="font-mono text-[11px] text-indigo-600 dark:text-indigo-400 break-all select-all">
                    {origin}/#/router?vid={encodeURIComponent(activeVendorCode)}&amp;uid=[RESPONDENT_ID]
                  </div>
                </div>
                <div className="rounded-xl bg-slate-50 dark:bg-white/[0.03] border border-slate-200/80 dark:border-white/10 p-3.5 space-y-1">
                  <div className="font-semibold text-slate-900 dark:text-white">Per-Study Entry Link Format</div>
                  <div className="font-mono text-[11px] text-indigo-600 dark:text-indigo-400 break-all select-all">
                    {origin}/#/prescreener?pid=[STUDY_ID]&amp;vid={encodeURIComponent(activeVendorCode)}&amp;uid=[RESPONDENT_ID]
                  </div>
                </div>
              </div>
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

                        <div>
                          <h4 className="font-semibold text-slate-900 dark:text-white mb-2 uppercase tracking-wider text-[11px]">
                            Parameters
                          </h4>
                          <div className="rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-white/[0.03] overflow-x-auto">
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

                        <div>
                          <div className="flex items-center justify-between mb-2">
                            <h4 className="font-semibold text-slate-900 dark:text-white uppercase tracking-wider text-[11px]">
                              Partner Response ({activeVendorCode})
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
        )}

        {/* Section 2: Redirect URL Hashing Guide */}
        {section === "hashing" && (
          <div className="anim-fade-up rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#14161a] p-5 sm:p-7 space-y-5 text-xs sm:text-sm">
            <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 font-bold text-base sm:text-lg">
              <Lock size={18} />
              <h2>2. Redirect URL Hashing &amp; Security Guide</h2>
            </div>
            <p className="text-slate-600 dark:text-slate-300 leading-relaxed">
              VMH GROUP supports tamper-proof SHA-256 / HMAC-SHA256 redirect validation to prevent unauthorized status callbacks. Duplicate UID/IP blocking, Bot detection, and Speeder protection are also enforced automatically.
            </p>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-xl bg-slate-50 dark:bg-white/[0.03] border border-slate-200/80 dark:border-white/10 p-4 space-y-2">
                <div className="font-semibold text-slate-900 dark:text-white text-xs uppercase tracking-wider">Hash Formula</div>
                <div className="font-mono text-xs p-3 rounded-lg bg-white dark:bg-black/30 border border-slate-200 dark:border-white/10 text-emerald-600 dark:text-emerald-400 break-all">
                  HMAC_SHA256(uid + &quot;:&quot; + status, &quot;{activeVendorCode}&quot;)
                </div>
                <p className="text-xs text-slate-500">
                  Append <code className="font-mono">&amp;hash=[HASH]</code> to your return redirect URL if hashing is enabled on your partner profile.
                </p>
              </div>
              <div className="rounded-xl bg-slate-50 dark:bg-white/[0.03] border border-slate-200/80 dark:border-white/10 p-4 space-y-2">
                <div className="font-semibold text-slate-900 dark:text-white text-xs uppercase tracking-wider">Node.js Verification Example</div>
                <pre className="font-mono text-[11px] p-3 rounded-lg bg-[#0d1117] text-emerald-400 overflow-x-auto">
{`const crypto = require("crypto");
const expected = crypto
  .createHmac("sha256", "${activeVendorCode}")
  .update(\`\${uid}:\${status}\`)
  .digest("hex");`}
                </pre>
              </div>
            </div>
          </div>
        )}

        {/* Section 3: S2S Integration Guide */}
        {section === "s2s" && (
          <div className="anim-fade-up rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#14161a] p-5 sm:p-7 space-y-5 text-xs sm:text-sm">
            <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400 font-bold text-base sm:text-lg">
              <Webhook size={18} />
              <h2>3. S2S (Server-to-Server) &amp; Return Redirect Guide</h2>
            </div>
            <p className="text-slate-600 dark:text-slate-300 leading-relaxed">
              Provide your 3 core return redirect URLs (plus optional Security URL) using the <code className="font-mono text-indigo-600 dark:text-indigo-400">[UID]</code> placeholder so VMH GROUP credits completes and reconciles respondent statuses in real time.
            </p>
            <div className="rounded-xl border border-slate-200 dark:border-white/10 overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-100/80 dark:bg-white/[0.05] text-slate-600 dark:text-slate-300">
                  <tr>
                    <th className="p-3 font-semibold">Status Code</th>
                    <th className="p-3 font-semibold">Meaning</th>
                    <th className="p-3 font-semibold">Example Return URL Format</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                  <tr>
                    <td className="p-3 font-mono font-bold text-emerald-600">10</td>
                    <td className="p-3 font-medium">Complete (Payout Credited)</td>
                    <td className="p-3 font-mono text-slate-500">https://yourpanel.com/callback?status=10&amp;uid=[UID]</td>
                  </tr>
                  <tr>
                    <td className="p-3 font-mono font-bold text-amber-600">20</td>
                    <td className="p-3 font-medium">Terminate / Screenout</td>
                    <td className="p-3 font-mono text-slate-500">https://yourpanel.com/callback?status=20&amp;uid=[UID]</td>
                  </tr>
                  <tr>
                    <td className="p-3 font-mono font-bold text-sky-600">30</td>
                    <td className="p-3 font-medium">Overquota / Quota Full</td>
                    <td className="p-3 font-mono text-slate-500">https://yourpanel.com/callback?status=30&amp;uid=[UID]</td>
                  </tr>
                  <tr>
                    <td className="p-3 font-mono font-bold text-rose-600">40</td>
                    <td className="p-3 font-medium">Security / Quality Block (Optional)</td>
                    <td className="p-3 font-mono text-slate-500">https://yourpanel.com/callback?status=40&amp;uid=[UID]</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Footer info */}
        <div className="pt-4 border-t border-slate-200 dark:border-white/10 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500">
          <div className="flex items-center gap-2">
            <ShieldCheck size={16} className="text-indigo-600" />
            <span>VMH GROUP Partner API v1.0</span>
          </div>
          <div>
            Partner-scoped inventory · Only surveys assigned to your Partner ID are returned.
          </div>
        </div>
      </div>
    </div>
  );
}
