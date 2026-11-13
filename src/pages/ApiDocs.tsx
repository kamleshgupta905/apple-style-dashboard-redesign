import { useState } from "react";
import {
  ExternalLink,
  Copy,
  Check,
  Code2,
  FileText,
  Server,
  ShieldCheck,
  Sparkles,
  ChevronDown,
  ChevronRight,
  Layers,
  ArrowRight,
  Send,
  Loader2,
  Database,
  ArrowUpRight,
} from "lucide-react";
import { CopyButton, Badge, Button } from "../components/ui";

interface EndpointDef {
  method: "GET" | "POST";
  path: string;
  summary: string;
  description: string;
  params?: { name: string; type: string; required: boolean; desc: string; defaultVal?: string }[];
  sampleResponse: any;
}

const ENDPOINTS: EndpointDef[] = [
  {
    method: "GET",
    path: "/api/supplier/getAllSurveys",
    summary: "Get all assigned surveys for vendor",
    description: "Retrieves all market research studies currently allocated to your vendor account with real-time CPI, LOI, IR, quota, and dynamic entry links.",
    params: [
      { name: "vendor_id", type: "string", required: false, desc: "Your unique vendor code (e.g. VND-AFC01). Required if access-key header is omitted." }
    ],
    sampleResponse: {
      success: true,
      apiVersion: 1,
      message: "Active surveys retrieved successfully",
      result: {
        success: true,
        vendor_id: "VND-AFC01",
        total: 2,
        data: [
          {
            survey_id: "2141504327",
            survey_name: "Consumer Tech Survey",
            cpi: 1.20,
            loi: "13",
            ir: "74",
            total_quota: 656,
            remaining_quota: 656,
            country: "US",
            language: "en-US",
            live_url: "https://api.vmhgroupsmr.com/vendor/auth/VND-AFC01/project/2141504327?uid=[RESPONDENT_ID]"
          }
        ]
      }
    }
  },
  {
    method: "GET",
    path: "/api/supplier/getSurveyDetails",
    summary: "Get detailed study info & qualifications",
    description: "Retrieves detailed information including demographic qualifications, targeting criteria, and entry rules for a specific survey.",
    params: [
      { name: "survey_id", type: "string", required: true, desc: "The ID of the survey (e.g. 2141504327 or VMHPI000142026)" }
    ],
    sampleResponse: {
      success: true,
      apiVersion: 1,
      message: "Survey details retrieved successfully",
      result: {
        success: true,
        data: {
          survey_id: "2141504327",
          name: "Consumer Tech Survey",
          cpi: 1.20,
          loi: "13",
          ir: "74",
          status: "Live",
          quota_limit: 656,
          country: "US",
          language: "en-US",
          entry_link: "https://api.vmhgroupsmr.com/vendor/auth/VND-AFC01/project/2141504327?uid=[RESPONDENT_ID]",
          qualifications: [
            { name: "AGE", operator: "between", value: "18-99" },
            { name: "COUNTRY", operator: "equals", value: "US" }
          ]
        }
      }
    }
  },
  {
    method: "GET",
    path: "/api/supplier/getSurveyStats",
    summary: "Get real-time study statistics",
    description: "Retrieves current performance metrics for a specific survey including entrances, completes, terminates, and conversion rates.",
    params: [
      { name: "survey_id", type: "string", required: true, desc: "The ID of the survey" }
    ],
    sampleResponse: {
      success: true,
      apiVersion: 1,
      result: {
        success: true,
        data: {
          survey_id: "2141504327",
          total_clicks: 142,
          completes: 38,
          terminates: 82,
          overquota: 12,
          conversion_rate: "26.8%"
        }
      }
    }
  },
  {
    method: "GET",
    path: "/api/supplier/getDefinitions",
    summary: "Get system definitions & languages",
    description: "Retrieves supported standard ISO country codes, language mappings, and system definitions.",
    sampleResponse: {
      success: true,
      apiVersion: 1,
      result: {
        success: true,
        data: {
          languages: [
            { id: 1, country_code: "US", language: "en-US", language_name: "English" },
            { id: 2, country_code: "GB", language: "en-GB", language_name: "English" },
            { id: 3, country_code: "IN", language: "hi-IN", language_name: "Hindi" }
          ],
          countries: [
            { id: 1, country_code: "US", country_name: "United States" },
            { id: 2, country_code: "IN", country_name: "India" }
          ]
        }
      }
    }
  },
  {
    method: "GET",
    path: "/api/supplier/getQualifications",
    summary: "Get qualifications schema by language",
    description: "Retrieves standard demographic qualification questions and answer options for prescreening.",
    params: [
      { name: "lang_id", type: "number", required: true, desc: "Language ID from getDefinitions (e.g. 1)" }
    ],
    sampleResponse: {
      success: true,
      message: "getQualifications successful",
      data: [
        {
          qualification_id: 1,
          qualification_name: "Age & Gender",
          questions: [
            {
              question_id: 101,
              question_text: "What is your age?",
              question_type: "Numeric Open Ended"
            }
          ]
        }
      ]
    }
  }
];

export function ApiDocs() {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({
    "/api/supplier/getAllSurveys": true,
  });
  const [testResults, setTestResults] = useState<Record<string, any>>({});
  const [testing, setTesting] = useState<Record<string, boolean>>({});

  const toggle = (path: string) => {
    setExpanded((prev) => ({ ...prev, [path]: !prev[path] }));
  };

  const runTest = async (ep: EndpointDef) => {
    setTesting((prev) => ({ ...prev, [ep.path]: true }));
    try {
      let url = `https://api.vmhgroupsmr.com${ep.path}`;
      if (ep.params && ep.params.length > 0) {
        if (ep.path.includes("getSurveyDetails") || ep.path.includes("getSurveyStats")) {
          url += "?survey_id=VMHPI000142026";
        } else if (ep.path.includes("getQualifications")) {
          url += "?lang_id=1";
        }
      }
      const res = await fetch(url);
      const data = await res.json();
      setTestResults((prev) => ({ ...prev, [ep.path]: data }));
    } catch (err: any) {
      setTestResults((prev) => ({ ...prev, [ep.path]: { error: err.message } }));
    } finally {
      setTesting((prev) => ({ ...prev, [ep.path]: false }));
    }
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] dark:bg-[#090d16] text-slate-800 dark:text-slate-200 py-8 px-4 sm:px-8 font-[-apple-system,BlinkMacSystemFont,'Segoe_UI','Inter',sans-serif]">
      <div className="max-w-5xl mx-auto space-y-8">
        
        {/* Top Header Card */}
        <div className="rounded-3xl border border-slate-200 dark:border-white/10 bg-white dark:bg-white/[0.03] p-6 sm:p-8 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-100 dark:border-white/5 pb-6">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 mb-2">
                <Sparkles size={12} />
                OpenAPI 3.0 Specification
              </div>
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
                Suppliers API Documentation
              </h1>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400 max-w-2xl">
                Official REST API specifications for Supply Partners to integrate directly with VMH Group's API Tool Platform. Fetch allotted surveys, query study parameters, and process S2S callbacks automatically.
              </p>
            </div>
            <div className="flex items-center gap-2.5">
              <a
                href="/api-docs/"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-full bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-sm transition"
              >
                Swagger UI
                <ArrowUpRight size={14} />
              </a>
              <a
                href="/api-docs/openapi.json"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-full border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/[0.05] hover:bg-slate-100 dark:hover:bg-white/[0.1] text-xs font-medium transition"
              >
                <Code2 size={13} />
                Raw JSON
              </a>
            </div>
          </div>

          {/* Quick Specifications Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-6">
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-white/[0.02] border border-slate-200/80 dark:border-white/5">
              <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">
                Authentication
              </div>
              <p className="text-xs leading-relaxed text-slate-600 dark:text-slate-300">
                Pass your Partner Access Key in the request header:
              </p>
              <div className="mt-2 font-mono text-[11px] p-2 rounded-lg bg-white dark:bg-black/30 border border-slate-200 dark:border-white/5 text-indigo-600 dark:text-indigo-400">
                access-key: YOUR_KEY
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-white/[0.02] border border-slate-200/80 dark:border-white/5">
              <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">
                S2S Status Postbacks
              </div>
              <div className="space-y-1 text-xs">
                <div><span className="font-bold text-emerald-600">10</span> : Complete</div>
                <div><span className="font-bold text-amber-600">20</span> : Terminate / Screenout</div>
                <div><span className="font-bold text-sky-600">30</span> : Quota Full (Overquota)</div>
                <div><span className="font-bold text-rose-600">40</span> : Security / Fraud Gate</div>
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-white/[0.02] border border-slate-200/80 dark:border-white/5">
              <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">
                Dynamic Entry URL
              </div>
              <p className="text-xs leading-relaxed text-slate-600 dark:text-slate-300">
                Replace <code>[RESPONDENT_ID]</code> with your user's UID when sending traffic:
              </p>
              <div className="mt-2 font-mono text-[10px] p-2 rounded-lg bg-white dark:bg-black/30 border border-slate-200 dark:border-white/5 text-slate-600 dark:text-slate-400 break-all">
                .../project/[ID]?uid=<b>USER_ID</b>
              </div>
            </div>
          </div>
        </div>

        {/* Endpoints List */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Database size={18} className="text-indigo-600" />
              REST API Endpoints (Survey Sherpa Standard)
            </h2>
            <span className="text-xs text-slate-400">5 active endpoints</span>
          </div>

          <div className="space-y-3">
            {ENDPOINTS.map((ep) => {
              const isOpen = !!expanded[ep.path];
              const testData = testResults[ep.path];
              const isTesting = testing[ep.path];

              return (
                <div
                  key={ep.path}
                  className="rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-white/[0.03] overflow-hidden shadow-sm transition"
                >
                  {/* Endpoint Header Bar */}
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

                  {/* Expanded Body */}
                  {isOpen && (
                    <div className="p-5 sm:p-6 border-t border-slate-100 dark:border-white/5 space-y-5 bg-slate-50/50 dark:bg-black/20 text-xs">
                      <p className="text-slate-600 dark:text-slate-300 leading-relaxed">
                        {ep.description}
                      </p>

                      {/* Parameters Table */}
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

                      {/* Live Test & Sample Code */}
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <h4 className="font-semibold text-slate-900 dark:text-white uppercase tracking-wider text-[11px]">
                            Example Response &amp; Live Test
                          </h4>
                          <button
                            type="button"
                            onClick={() => runTest(ep)}
                            disabled={isTesting}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-medium transition cursor-pointer disabled:opacity-50"
                          >
                            {isTesting ? (
                              <Loader2 size={12} className="animate-spin" />
                            ) : (
                              <Send size={12} />
                            )}
                            Execute Live Query
                          </button>
                        </div>

                        <div className="relative rounded-xl border border-slate-800 bg-[#0d1117] p-4 text-emerald-400 font-mono text-[11px] overflow-x-auto max-h-72">
                          <pre>{JSON.stringify(testData || ep.sampleResponse, null, 2)}</pre>
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
            <span>VMH Group API Tool Gateway API v1.0.0</span>
          </div>
          <div>
            Swagger UI compatible with Survey Sherpa / Cint / Dynata supplier standards.
          </div>
        </div>

      </div>
    </div>
  );
}
