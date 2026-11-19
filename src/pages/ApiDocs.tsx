import { useEffect, useMemo, useState } from "react";
import {
  Check,
  ChevronDown,
  ChevronRight,
  Code2,
  Copy,
  Database,
  ExternalLink,
  KeyRound,
  Loader2,
  Lock,
  Moon,
  Send,
  ShieldCheck,
  Sun,
  Webhook,
  X,
} from "lucide-react";
import { api } from "../lib/api";
import { getPublicOrigin } from "../lib/data";
import { usePermissions } from "../lib/permissions";
import {
  buildSanitizedSupplyStudies,
  getVendorAccessKey,
  hmacSha256Hex,
  isAccessKey32,
  resolveVendorByAccessKey,
} from "../lib/partnerKey";
import { cn } from "../utils/cn";

export type GuideSection = "supply" | "hashing" | "s2s";
type LangTab = "curl" | "node" | "python" | "php";

interface EndpointSpec {
  id: string;
  method: "GET";
  path: string;
  summary: string;
  description: string;
  hasStudyParam?: boolean;
  isSpecJson?: boolean;
  params: { name: string; location: "header" | "path"; type: string; required: boolean; desc: string }[];
  sample: (origin: string, accessKey: string) => any;
}

const ENDPOINTS: EndpointSpec[] = [
  {
    id: "get-supplyproject",
    method: "GET",
    path: "/api/supply/projects",
    summary: "Fetch Live Allotted Surveys",
    description:
      "Returns only live surveys assigned to your partner account with payout CPI (USD), LOI, IR, remaining quota, and VMH GROUP entry links.",
    params: [
      {
        name: "access-key",
        location: "header",
        type: "string (32-hex)",
        required: true,
        desc: "Your 32-character VMH GROUP Partner Access Key.",
      },
    ],
    sample: (origin, accessKey) => {
      const k = accessKey || "<YOUR_32_CHAR_ACCESS_KEY>";
      return {
        success: true,
        brand: "VMH GROUP",
        total: 1,
        generated_at: "2026-11-18T12:00:00.000Z",
        universal_router_url: `${origin}/#/router?key=${k}&uid=[RESPONDENT_ID]`,
        surveys: [
          {
            survey_id: "2141504327",
            survey_name: "Consumer Insights Study",
            brand: "VMH GROUP",
            cpi: 1.25,
            currency: "USD",
            loi: 12,
            ir: 70,
            quota_limit: 250,
            completes: 8,
            remaining_quota: 242,
            country: "US",
            status: "Live",
            entry_link: `${origin}/#/prescreener?pid=2141504327&key=${k}&uid=[RESPONDENT_ID]`,
          },
        ],
      };
    },
  },
  {
    id: "get-single-project",
    method: "GET",
    path: "/api/supply/projects/{survey_id}",
    summary: "Fetch Single Survey Specification",
    description:
      "Retrieves real-time remaining quota, payout CPI, and entry URL for one allotted study ID.",
    hasStudyParam: true,
    params: [
      {
        name: "survey_id",
        location: "path",
        type: "string",
        required: true,
        desc: "Numeric or alphanumeric Study ID from your allotted inventory.",
      },
      {
        name: "access-key",
        location: "header",
        type: "string (32-hex)",
        required: true,
        desc: "Your 32-character VMH GROUP Partner Access Key.",
      },
    ],
    sample: (origin, accessKey) => {
      const k = accessKey || "<YOUR_32_CHAR_ACCESS_KEY>";
      return {
        success: true,
        brand: "VMH GROUP",
        survey: {
          survey_id: "2141504327",
          survey_name: "Consumer Insights Study",
          brand: "VMH GROUP",
          cpi: 1.25,
          currency: "USD",
          loi: 12,
          ir: 70,
          quota_limit: 250,
          completes: 8,
          remaining_quota: 242,
          country: "US",
          status: "Live",
          entry_link: `${origin}/#/prescreener?pid=2141504327&key=${k}&uid=[RESPONDENT_ID]`,
        },
      };
    },
  },
  {
    id: "get-openapi",
    method: "GET",
    path: "/api/supply/openapi.json",
    summary: "OpenAPI 3.0.3 Machine Specification",
    description:
      "Download the OpenAPI 3.0.3 JSON definition for Postman, Insomnia, or SDK code generation.",
    isSpecJson: true,
    params: [],
    sample: (origin) => ({
      openapi: "3.0.3",
      info: { title: "VMH GROUP · Supply Partner API", version: "1.0.0" },
      servers: [{ url: origin }],
      paths: {
        "/api/supply/projects": { get: { summary: "Get Live Allotted Surveys" } },
        "/api/supply/projects/{survey_id}": { get: { summary: "Get Single Survey Specification" } },
      },
    }),
  },
];

const SCHEMA_FIELDS = [
  { field: "survey_id", type: "string", desc: "Unique study identifier for tracking & entry links" },
  { field: "survey_name", type: "string", desc: "Public study title sanitized for partner panels" },
  { field: "brand", type: "string", desc: 'Always "VMH GROUP"' },
  { field: "cpi", type: "number", desc: "Your net payout CPI per qualified complete" },
  { field: "currency", type: "string", desc: 'Settlement currency ("USD")' },
  { field: "loi", type: "integer", desc: "Estimated length of interview in minutes" },
  { field: "ir", type: "integer", desc: "Estimated incidence rate percentage (1–100)" },
  { field: "quota_limit", type: "integer", desc: "Total cap allotted to your partner account" },
  { field: "completes", type: "integer", desc: "Current verified completes recorded" },
  { field: "remaining_quota", type: "integer", desc: "Available completes remaining before pause" },
  { field: "country", type: "string", desc: "ISO 2-letter target country code (e.g. US, GB, IN)" },
  { field: "status", type: "string", desc: 'Live eligibility ("Live")' },
  { field: "entry_link", type: "string", desc: "Ready-to-launch entry URL; replace [RESPONDENT_ID]" },
];

export function ApiDocs({ initialSection = "supply" }: { initialSection?: GuideSection }) {
  const { user } = usePermissions();
  const isVendorUser =
    user?.role_id === 3 ||
    user?.role_name === "Vendor" ||
    user?.role_name?.toLowerCase().includes("vendor");

  const [dark, setDark] = useState(() => {
    if (typeof document === "undefined") return false;
    return document.documentElement.classList.contains("dark");
  });

  const toggleTheme = () => {
    setDark((prev) => {
      const next = !prev;
      document.documentElement.classList.toggle("dark", next);
      localStorage.setItem("smr_theme", next ? "dark" : "light");
      return next;
    });
  };

  const hash = typeof window !== "undefined" ? window.location.hash || "" : "";
  const queryStr = hash.includes("?")
    ? hash.split("?")[1]
    : typeof window !== "undefined"
    ? window.location.search.replace(/^\?/, "")
    : "";
  const urlParams = useMemo(() => new URLSearchParams(queryStr), [queryStr]);

  const urlTokenOrVid = (
    urlParams.get("key") ||
    urlParams.get("access_key") ||
    urlParams.get("api_key") ||
    urlParams.get("vid") ||
    urlParams.get("vendor_id") ||
    urlParams.get("vendor_code") ||
    ""
  ).trim();

  const urlSection = (urlParams.get("section") || "").toLowerCase() as GuideSection;
  const [section, setSection] = useState<GuideSection>(
    ["supply", "hashing", "s2s"].includes(urlSection) ? urlSection : initialSection,
  );

  useEffect(() => {
    if (["supply", "hashing", "s2s"].includes(urlSection)) {
      setSection(urlSection);
    } else {
      setSection(initialSection);
    }
  }, [urlSection, initialSection]);

  const [activeKey, setActiveKey] = useState<string>(() =>
    isAccessKey32(urlTokenOrVid) ? urlTokenOrVid.toLowerCase() : "",
  );
  const [partnerDisplayName, setPartnerDisplayName] = useState<string>("");
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [keyInput, setKeyInput] = useState("");
  const [authError, setAuthError] = useState("");
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Supply API Explorer state
  const [expanded, setExpanded] = useState<Record<string, boolean>>({
    "get-supplyproject": true,
  });
  const [snippetLang, setSnippetLang] = useState<LangTab>("curl");
  const [studyIdInput, setStudyIdInput] = useState("2141504327");
  const [execState, setExecState] = useState<
    Record<string, { status: number; ms: number; body: any; loading?: boolean }>
  >({});

  // Interactive Hash Generator state
  const [hashUid, setHashUid] = useState("RESP_884210");
  const [hashStatus, setHashStatus] = useState("10");
  const [hashSecret, setHashSecret] = useState("");
  const [computedHash, setComputedHash] = useState("");
  const [verifyHashInput, setVerifyHashInput] = useState("");

  // Interactive S2S Return URL Builder state
  const [cbBaseUrl, setCbBaseUrl] = useState("https://yourpanel.com/callback");
  const [includeHashMacro, setIncludeHashMacro] = useState(true);

  const origin = getPublicOrigin();

  useEffect(() => {
    const prev = document.title;
    document.title = "VMH GROUP · Partner API Documentation";
    return () => {
      document.title = prev;
    };
  }, []);

  // Resolve URL token or legacy vid / logged-in vendor silently
  useEffect(() => {
    let active = true;
    const candidate =
      urlTokenOrVid ||
      (isVendorUser ? user?.vendor_code || user?.supplier_id || user?.username || "" : "");

    if (!candidate) return;

    (async () => {
      if (isAccessKey32(candidate)) {
        const resolved = await resolveVendorByAccessKey(candidate, { strictKeyOnly: true });
        if (!active) return;
        setActiveKey(candidate.toLowerCase());
        setPartnerDisplayName(resolved?.vendor_name || "Authorized Partner");
        setHashSecret((prev) => prev || candidate.toLowerCase());
      } else {
        const key = await getVendorAccessKey(candidate);
        if (!active || !key) return;
        setActiveKey(key);
        setHashSecret((prev) => prev || key);
      }
    })();

    return () => {
      active = false;
    };
  }, [urlTokenOrVid, isVendorUser, user]);

  // Live HMAC-SHA256 computation for the Hashing Guide tool
  useEffect(() => {
    let active = true;
    const secret = (hashSecret || activeKey || "f3f5bf8fde5242a5964263444e1d9814").trim();
    const message = `${hashUid.trim()}:${hashStatus.trim()}`;
    hmacSha256Hex(secret, message)
      .then((digest) => {
        if (active) setComputedHash(digest);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [hashUid, hashStatus, hashSecret, activeKey]);

  const copyText = (id: string, text: string) => {
    navigator.clipboard?.writeText?.(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId((cur) => (cur === id ? null : cur)), 1800);
  };

  const navigateSection = (target: GuideSection) => {
    setSection(target);
    const keyQuery = activeKey ? `?key=${encodeURIComponent(activeKey)}` : "";
    const routeName =
      target === "hashing" ? "hashing-guide" : target === "s2s" ? "s2s-guide" : "api-docs";
    window.location.hash = `#/${routeName}${keyQuery}`;
  };

  const applyAccessKey = async () => {
    const cleaned = keyInput.trim().toLowerCase();
    if (!isAccessKey32(cleaned)) {
      setAuthError("Enter a valid 32-character hexadecimal Access Key (0-9, a-f).");
      return;
    }
    setAuthError("");
    const resolved = await resolveVendorByAccessKey(cleaned, { strictKeyOnly: true });
    if (!resolved) {
      setAuthError("Access Key could not be verified. Check with your VMH GROUP manager.");
      return;
    }
    setActiveKey(resolved.access_key);
    setPartnerDisplayName(resolved.vendor_name);
    setHashSecret(resolved.access_key);
    setAuthModalOpen(false);
    setKeyInput("");
  };

  const buildCodeSnippet = (ep: EndpointSpec, lang: LangTab): string => {
    const keyVal = activeKey || "YOUR_32_CHAR_ACCESS_KEY";
    const fullPath = ep.hasStudyParam
      ? `/api/supply/projects/${encodeURIComponent(studyIdInput.trim() || "2141504327")}`
      : ep.path;
    const url = `${origin}${fullPath}`;

    if (lang === "curl") {
      return ep.isSpecJson
        ? `curl -s "${url}"`
        : `curl -s "${url}" \\\n  -H "access-key: ${keyVal}"`;
    }
    if (lang === "node") {
      return `const res = await fetch("${url}", {${
        ep.isSpecJson ? "" : `\n  headers: { "access-key": "${keyVal}" },`
      }\n});\nconst data = await res.json();\nconsole.log(data);`;
    }
    if (lang === "python") {
      return `import requests\n\nres = requests.get(\n    "${url}",${
        ep.isSpecJson ? "" : `\n    headers={"access-key": "${keyVal}"},`
      }\n    timeout=10,\n)\nprint(res.json())`;
    }
    return `<?php\n$ch = curl_init("${url}");\ncurl_setopt_array($ch, [\n    CURLOPT_RETURNTRANSFER => true,${
      ep.isSpecJson ? "" : `\n    CURLOPT_HTTPHEADER => ["access-key: ${keyVal}"],`
    }\n]);\n$data = json_decode(curl_exec($ch), true);\nprint_r($data);\n`;
  };

  const executeEndpoint = async (ep: EndpointSpec) => {
    const start = performance.now();
    setExecState((prev) => ({
      ...prev,
      [ep.id]: { status: 0, ms: 0, body: null, loading: true },
    }));

    const keyToSend = activeKey;
    const targetPath = ep.hasStudyParam
      ? `/api/supply/projects/${encodeURIComponent(studyIdInput.trim() || "2141504327")}`
      : ep.path;

    try {
      const headers: Record<string, string> = {};
      if (keyToSend && !ep.isSpecJson) headers["access-key"] = keyToSend;

      const res = await fetch(targetPath, { headers });
      const ct = res.headers.get("content-type") || "";
      if (ct.includes("application/json")) {
        const json = await res.json();
        const ms = Math.max(1, Math.round(performance.now() - start));
        setExecState((prev) => ({
          ...prev,
          [ep.id]: { status: res.status, ms, body: json, loading: false },
        }));
        return;
      }
    } catch {
      // Fallback below when hosted on static Vite preview without Node proxy
    }

    // Client-side fallback execution matching exact server.ts rules
    try {
      if (ep.isSpecJson) {
        const ms = Math.max(1, Math.round(performance.now() - start));
        setExecState((prev) => ({
          ...prev,
          [ep.id]: {
            status: 200,
            ms,
            body: ep.sample(origin, keyToSend),
            loading: false,
          },
        }));
        return;
      }

      if (!keyToSend || !isAccessKey32(keyToSend)) {
        const ms = Math.max(1, Math.round(performance.now() - start));
        setExecState((prev) => ({
          ...prev,
          [ep.id]: {
            status: 401,
            ms,
            body: {
              success: false,
              brand: "VMH GROUP",
              error: "Missing or invalid 32-character access-key. Click 'Authorize Key' first.",
            },
            loading: false,
          },
        }));
        return;
      }

      const vendor = await resolveVendorByAccessKey(keyToSend, { strictKeyOnly: true });
      if (!vendor) {
        const ms = Math.max(1, Math.round(performance.now() - start));
        setExecState((prev) => ({
          ...prev,
          [ep.id]: {
            status: 401,
            ms,
            body: { success: false, brand: "VMH GROUP", error: "Invalid or revoked access-key." },
            loading: false,
          },
        }));
        return;
      }

      const [allotsRes, projectsRes, marketRes] = await Promise.all([
        api.get<{ data: any[] }>("/vendor/allotments").catch(() => ({ data: [] })),
        api.get<{ data: any[] }>("/manage/projects").catch(() => ({ data: [] })),
        api.get<{ data: any[] }>("/zamplia").catch(() => ({ data: [] })),
      ]);

      const surveys = buildSanitizedSupplyStudies({
        vendorCode: vendor.vendor_code,
        accessKey: vendor.access_key,
        allots: allotsRes.data || [],
        projects: projectsRes.data || [],
        market: marketRes.data || [],
        origin,
      });

      const ms = Math.max(1, Math.round(performance.now() - start));
      if (ep.hasStudyParam) {
        const targetStudy = studyIdInput.trim().toLowerCase();
        const found = surveys.find((s) => s.survey_id.toLowerCase() === targetStudy);
        setExecState((prev) => ({
          ...prev,
          [ep.id]: {
            status: found ? 200 : 404,
            ms,
            body: found
              ? { success: true, brand: "VMH GROUP", survey: found }
              : {
                  success: false,
                  brand: "VMH GROUP",
                  error: `Study ${studyIdInput.trim()} not found or not assigned to your access-key.`,
                },
            loading: false,
          },
        }));
      } else {
        setExecState((prev) => ({
          ...prev,
          [ep.id]: {
            status: 200,
            ms,
            body: {
              success: true,
              brand: "VMH GROUP",
              total: surveys.length,
              generated_at: new Date().toISOString(),
              universal_router_url: `${origin}/#/router?key=${encodeURIComponent(vendor.access_key)}&uid=[RESPONDENT_ID]`,
              surveys,
            },
            loading: false,
          },
        }));
      }
    } catch (err: any) {
      const ms = Math.max(1, Math.round(performance.now() - start));
      setExecState((prev) => ({
        ...prev,
        [ep.id]: {
          status: 500,
          ms,
          body: { success: false, brand: "VMH GROUP", error: err?.message || "Execution failed" },
          loading: false,
        },
      }));
    }
  };

  const displayKey = activeKey || "YOUR_32_CHAR_ACCESS_KEY";
  const cleanCbBase = cbBaseUrl.trim().replace(/\?$/, "") || "https://yourpanel.com/callback";
  const cbJoiner = cleanCbBase.includes("?") ? "&" : "?";
  const hashSuffix = includeHashMacro ? "&hash=[HASH]" : "";
  const generatedReturnUrls = [
    { status: "10", label: "Complete", url: `${cleanCbBase}${cbJoiner}status=10&uid=[UID]${hashSuffix}` },
    { status: "20", label: "Terminate / Screenout", url: `${cleanCbBase}${cbJoiner}status=20&uid=[UID]${hashSuffix}` },
    { status: "30", label: "Overquota / Quota Full", url: `${cleanCbBase}${cbJoiner}status=30&uid=[UID]${hashSuffix}` },
    { status: "40", label: "Security / Fraud (Optional)", url: `${cleanCbBase}${cbJoiner}status=40&uid=[UID]${hashSuffix}` },
  ];

  const maskedKey = activeKey ? `${activeKey.slice(0, 6)}...${activeKey.slice(-6)}` : "";
  const verifyMatch =
    verifyHashInput.trim().length > 0 &&
    verifyHashInput.trim().toLowerCase() === computedHash.toLowerCase();

  return (
    <div className="min-h-screen bg-[#f6f7f9] dark:bg-[#0b0c0e] text-[#111317] dark:text-[#eef0f3]">
      {/* Sticky Single-Row 3-Zone Top Header */}
      <header className="sticky top-0 z-40 h-16 border-b border-black/[0.08] dark:border-white/[0.08] bg-white/95 dark:bg-[#111318]/95 backdrop-blur">
        <div className="max-w-5xl mx-auto h-full px-4 sm:px-6 flex items-center justify-between gap-6">
          {/* Left Zone: Brand */}
          <div className="flex items-center gap-2.5 shrink-0 whitespace-nowrap">
            <img
              src="/vmh-logo.png"
              alt="VMH GROUP"
              className="h-7 w-auto object-contain rounded"
              onError={(e) => {
                (e.target as HTMLElement).style.display = "none";
              }}
            />
            <div className="flex items-baseline gap-2">
              <span className="text-[15px] font-bold tracking-tight text-slate-900 dark:text-white">
                VMH GROUP
              </span>
              <span className="hidden sm:inline text-xs font-medium text-slate-500 dark:text-slate-400">
                Developer Portal
              </span>
            </div>
          </div>

          {/* Center Zone: 3 Guide Links + Live Feed */}
          <nav className="flex items-center gap-5 sm:gap-7 overflow-x-auto h-full shrink-0 whitespace-nowrap">
            {(
              [
                { id: "supply", label: "Supply API" },
                { id: "hashing", label: "Hashing Guide" },
                { id: "s2s", label: "S2S Guide" },
              ] as const
            ).map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => navigateSection(item.id)}
                className={cn(
                  "h-full inline-flex items-center text-[13px] border-b-2 transition cursor-pointer whitespace-nowrap shrink-0",
                  section === item.id
                    ? "border-indigo-600 text-indigo-600 dark:text-indigo-400 dark:border-indigo-400 font-semibold"
                    : "border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white font-medium",
                )}
              >
                {item.label}
              </button>
            ))}
            <a
              href={`#/vendor-feed${activeKey ? `?key=${encodeURIComponent(activeKey)}` : ""}`}
              className="hidden md:inline-flex items-center gap-1 text-[13px] font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white whitespace-nowrap shrink-0"
            >
              Live Feed <ExternalLink size={12} />
            </a>
          </nav>

          {/* Right Zone: Theme + Authorize Key */}
          <div className="flex items-center gap-2 shrink-0 whitespace-nowrap">
            <button
              type="button"
              onClick={toggleTheme}
              aria-label="Toggle color theme"
              className="w-9 h-9 inline-flex items-center justify-center rounded-lg border border-black/[0.08] dark:border-white/10 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/[0.06] transition cursor-pointer"
            >
              {dark ? <Sun size={15} /> : <Moon size={15} />}
            </button>
            <button
              type="button"
              onClick={() => {
                setKeyInput(activeKey);
                setAuthError("");
                setAuthModalOpen(true);
              }}
              className={cn(
                "inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold border transition cursor-pointer whitespace-nowrap",
                activeKey
                  ? "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-500/30"
                  : "bg-indigo-600 hover:bg-indigo-500 text-white border-transparent",
              )}
            >
              <KeyRound size={13} />
              {activeKey ? `Key: ${maskedKey}` : "Authorize Key"}
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-7 space-y-6">
        {/* Intro & Metadata Strip */}
        <section className="rounded-xl border border-black/[0.08] dark:border-white/[0.09] bg-white dark:bg-[#13151a] p-5 sm:p-7">
          <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400 font-mono">
                <span>VMH GROUP Supply v1.0.0</span>
                <span>·</span>
                <span>OpenAPI 3.0.3</span>
                <span>·</span>
                <span>Header: access-key</span>
                {partnerDisplayName && (
                  <>
                    <span>·</span>
                    <span className="text-emerald-600 dark:text-emerald-400 font-sans font-semibold">
                      Partner: {partnerDisplayName}
                    </span>
                  </>
                )}
              </div>
              <h1 className="text-2xl sm:text-[28px] font-bold tracking-tight text-slate-900 dark:text-white">
                {section === "supply"
                  ? "Supply Partner API Reference"
                  : section === "hashing"
                  ? "Redirect URL Hashing & Security Guide"
                  : "S2S & Return Redirect Integration Guide"}
              </h1>
              <p className="text-sm text-slate-600 dark:text-slate-400 max-w-2xl leading-relaxed">
                {section === "supply"
                  ? "Query allotted live studies in real time using your 32-character partner Access Key, inspect schemas, and execute live HTTP tests."
                  : section === "hashing"
                  ? "Verify respondent completion callbacks using HMAC-SHA256 parameter signing alongside automated Fraud Gate screening."
                  : "Configure your 3 required return redirect URLs (Complete 10, Terminate 20, Overquota 30) plus optional Security 40 callbacks."}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2 shrink-0">
              <a
                href="/api/supply/openapi.json"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-black/[0.1] dark:border-white/10 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-white/[0.05] transition"
              >
                <Code2 size={13} />
                OpenAPI JSON
              </a>
              <button
                type="button"
                onClick={() => {
                  const specText =
                    `Access Key: ${displayKey}\n` +
                    `API Documentation: ${origin}/#/api-docs${activeKey ? `?key=${encodeURIComponent(activeKey)}` : ""}\n` +
                    `Supply Endpoint: ${origin}/api/supply/projects (Header: access-key)\n\n` +
                    `Supply API Documentation: ${origin}/#/api-docs${activeKey ? `?key=${encodeURIComponent(activeKey)}` : ""}\n` +
                    `Redirect URL Hashing Guide: ${origin}/#/hashing-guide${activeKey ? `?key=${encodeURIComponent(activeKey)}` : ""}\n` +
                    `S2S Integration Guide: ${origin}/#/s2s-guide${activeKey ? `?key=${encodeURIComponent(activeKey)}` : ""}\n`;
                  copyText("spec", specText);
                }}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-xs font-semibold hover:opacity-90 transition cursor-pointer"
              >
                {copiedId === "spec" ? <Check size={13} /> : <Copy size={13} />}
                {copiedId === "spec" ? "Copied Spec" : "Copy Integration Spec"}
              </button>
            </div>
          </div>

          {/* Base URL + Entry Route Quick Bar */}
          <div className="mt-5 pt-5 border-t border-black/[0.07] dark:border-white/[0.07] grid gap-3 sm:grid-cols-2 text-xs">
            <div className="rounded-lg bg-slate-50 dark:bg-black/30 border border-black/[0.07] dark:border-white/10 p-3 space-y-1">
              <div className="flex items-center justify-between text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                <span>Universal Router Link</span>
                <button
                  type="button"
                  onClick={() =>
                    copyText("router-url", `${origin}/#/router?key=${encodeURIComponent(displayKey)}&uid=[RESPONDENT_ID]`)
                  }
                  className="text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer"
                >
                  {copiedId === "router-url" ? "Copied" : "Copy"}
                </button>
              </div>
              <div className="font-mono text-[11.5px] text-slate-800 dark:text-slate-200 break-all select-all">
                {origin}/#/router?key={displayKey}&amp;uid=[RESPONDENT_ID]
              </div>
            </div>

            <div className="rounded-lg bg-slate-50 dark:bg-black/30 border border-black/[0.07] dark:border-white/10 p-3 space-y-1">
              <div className="flex items-center justify-between text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                <span>Per-Study Entry Link Format</span>
                <button
                  type="button"
                  onClick={() =>
                    copyText(
                      "entry-url",
                      `${origin}/#/prescreener?pid=[STUDY_ID]&key=${encodeURIComponent(displayKey)}&uid=[RESPONDENT_ID]`,
                    )
                  }
                  className="text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer"
                >
                  {copiedId === "entry-url" ? "Copied" : "Copy"}
                </button>
              </div>
              <div className="font-mono text-[11.5px] text-slate-800 dark:text-slate-200 break-all select-all">
                {origin}/#/prescreener?pid=[STUDY_ID]&amp;key={displayKey}&amp;uid=[RESPONDENT_ID]
              </div>
            </div>
          </div>
        </section>

        {/* SECTION 1: SUPPLY API SWAGGER REFERENCE */}
        {section === "supply" && (
          <div className="space-y-5">
            <div className="space-y-3">
              {ENDPOINTS.map((ep) => {
                const isOpen = !!expanded[ep.id];
                const exec = execState[ep.id];
                const snippet = buildCodeSnippet(ep, snippetLang);
                const jsonPreview = exec?.body ?? ep.sample(origin, displayKey);

                return (
                  <div
                    key={ep.id}
                    id={ep.id}
                    className="rounded-xl border border-black/[0.08] dark:border-white/[0.09] bg-white dark:bg-[#13151a] overflow-hidden"
                  >
                    <button
                      type="button"
                      onClick={() => setExpanded((p) => ({ ...p, [ep.id]: !p[ep.id] }))}
                      className="w-full px-5 py-4 flex items-center justify-between gap-3 text-left hover:bg-slate-50/70 dark:hover:bg-white/[0.02] transition cursor-pointer"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="px-2.5 py-0.5 rounded bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 font-mono text-[11px] font-bold shrink-0">
                          {ep.method}
                        </span>
                        <span className="font-mono text-xs sm:text-sm font-semibold text-slate-900 dark:text-white truncate">
                          {ep.path}
                        </span>
                        <span className="hidden md:inline text-xs text-slate-500 dark:text-slate-400 truncate">
                          — {ep.summary}
                        </span>
                      </div>
                      {isOpen ? (
                        <ChevronDown size={16} className="text-slate-400 shrink-0" />
                      ) : (
                        <ChevronRight size={16} className="text-slate-400 shrink-0" />
                      )}
                    </button>

                    {isOpen && (
                      <div className="p-5 sm:p-6 border-t border-black/[0.07] dark:border-white/[0.07] space-y-5 bg-slate-50/40 dark:bg-black/20">
                        <p className="text-xs sm:text-[13px] text-slate-600 dark:text-slate-300 leading-relaxed">
                          {ep.description}
                        </p>

                        {ep.params.length > 0 && (
                          <div className="space-y-2">
                            <h3 className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                              Request Parameters &amp; Headers
                            </h3>
                            <div className="rounded-lg border border-black/[0.08] dark:border-white/10 bg-white dark:bg-[#13151a] overflow-x-auto">
                              <table className="w-full text-left text-xs">
                                <thead className="bg-slate-100/70 dark:bg-white/[0.04] text-[11px] text-slate-500 dark:text-slate-400">
                                  <tr>
                                    <th className="p-2.5 font-semibold">Name</th>
                                    <th className="p-2.5 font-semibold">In</th>
                                    <th className="p-2.5 font-semibold">Type</th>
                                    <th className="p-2.5 font-semibold">Required</th>
                                    <th className="p-2.5 font-semibold">Description</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-black/[0.06] dark:divide-white/[0.06]">
                                  {ep.params.map((p) => (
                                    <tr key={p.name}>
                                      <td className="p-2.5 font-mono font-semibold text-indigo-600 dark:text-indigo-400">
                                        {p.name}
                                      </td>
                                      <td className="p-2.5 font-mono text-slate-500">{p.location}</td>
                                      <td className="p-2.5 font-mono text-slate-500">{p.type}</td>
                                      <td className="p-2.5 text-slate-700 dark:text-slate-300 font-medium">
                                        {p.required ? "Required" : "Optional"}
                                      </td>
                                      <td className="p-2.5 text-slate-600 dark:text-slate-400">{p.desc}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        )}

                        {/* Code Snippet & Live Try-It Bar */}
                        <div className="space-y-2.5">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div className="flex items-center gap-1 rounded-lg border border-black/[0.08] dark:border-white/10 bg-white dark:bg-[#13151a] p-0.5 text-xs">
                              {(["curl", "node", "python", "php"] as LangTab[]).map((lang) => (
                                <button
                                  key={lang}
                                  type="button"
                                  onClick={() => setSnippetLang(lang)}
                                  className={cn(
                                    "px-2.5 py-1 rounded-md font-medium capitalize transition cursor-pointer",
                                    snippetLang === lang
                                      ? "bg-slate-900 dark:bg-white text-white dark:text-slate-900"
                                      : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white",
                                  )}
                                >
                                  {lang === "curl" ? "cURL" : lang}
                                </button>
                              ))}
                            </div>

                            <div className="flex flex-wrap items-center gap-2">
                              {ep.hasStudyParam && (
                                <input
                                  type="text"
                                  value={studyIdInput}
                                  onChange={(e) => setStudyIdInput(e.target.value)}
                                  placeholder="survey_id"
                                  className="w-36 px-2.5 py-1.5 rounded-lg border border-black/[0.1] dark:border-white/10 bg-white dark:bg-[#13151a] font-mono text-xs text-slate-900 dark:text-white focus:outline-none"
                                />
                              )}
                              <button
                                type="button"
                                onClick={() => copyText(`snip-${ep.id}`, snippet)}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-black/[0.1] dark:border-white/10 bg-white dark:bg-[#13151a] text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-white/[0.05] transition cursor-pointer"
                              >
                                {copiedId === `snip-${ep.id}` ? <Check size={12} /> : <Copy size={12} />}
                                {copiedId === `snip-${ep.id}` ? "Copied" : "Copy Code"}
                              </button>
                              <button
                                type="button"
                                disabled={!!exec?.loading}
                                onClick={() => executeEndpoint(ep)}
                                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold transition cursor-pointer disabled:opacity-50"
                              >
                                {exec?.loading ? <Loader2 size={12} className="animate-spin" /> : <Send size={12} />}
                                Execute Live Request
                              </button>
                            </div>
                          </div>

                          <pre className="rounded-lg bg-[#0d1117] border border-slate-800 p-4 font-mono text-[11.5px] text-slate-200 overflow-x-auto">
                            {snippet}
                          </pre>
                        </div>

                        {/* Response Output */}
                        <div className="space-y-2">
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                              {exec ? "Live Server Response" : "Example 200 Response"}
                            </span>
                            {exec && exec.status > 0 && (
                              <span
                                className={cn(
                                  "font-mono text-[11px] font-semibold tabular-nums",
                                  exec.status >= 200 && exec.status < 300
                                    ? "text-emerald-600 dark:text-emerald-400"
                                    : "text-rose-600 dark:text-rose-400",
                                )}
                              >
                                HTTP {exec.status} · {exec.ms} ms
                              </span>
                            )}
                          </div>
                          <pre className="rounded-lg bg-[#0d1117] border border-slate-800 p-4 font-mono text-[11.5px] text-emerald-400 overflow-x-auto max-h-80 tabular-nums">
                            {JSON.stringify(jsonPreview, null, 2)}
                          </pre>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* SupplySurvey Schema Reference */}
            <div className="rounded-xl border border-black/[0.08] dark:border-white/[0.09] bg-white dark:bg-[#13151a] overflow-hidden">
              <div className="px-5 py-3.5 border-b border-black/[0.07] dark:border-white/[0.07] flex items-center justify-between">
                <h2 className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                  <Database size={15} className="text-indigo-600 dark:text-indigo-400" />
                  SupplySurvey Object Schema
                </h2>
                <span className="text-[11px] font-mono text-slate-500 dark:text-slate-400">
                  Client identities &amp; internal margins excluded
                </span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 dark:bg-white/[0.03] text-[11px] text-slate-500 dark:text-slate-400">
                    <tr>
                      <th className="p-3 font-semibold">Field</th>
                      <th className="p-3 font-semibold">Type</th>
                      <th className="p-3 font-semibold">Description</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-black/[0.06] dark:divide-white/[0.06]">
                    {SCHEMA_FIELDS.map((f) => (
                      <tr key={f.field}>
                        <td className="p-3 font-mono font-semibold text-indigo-600 dark:text-indigo-400">{f.field}</td>
                        <td className="p-3 font-mono text-slate-500">{f.type}</td>
                        <td className="p-3 text-slate-600 dark:text-slate-300">{f.desc}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* SECTION 2: REDIRECT URL HASHING GUIDE */}
        {section === "hashing" && (
          <div className="space-y-5">
            <section className="rounded-xl border border-black/[0.08] dark:border-white/[0.09] bg-white dark:bg-[#13151a] p-5 sm:p-7 space-y-5">
              <div className="flex items-center gap-2 text-slate-900 dark:text-white font-bold text-base">
                <Lock size={17} className="text-emerald-600 dark:text-emerald-400" />
                <h2>HMAC-SHA256 Signing Specification</h2>
              </div>

              <div className="grid gap-4 md:grid-cols-2 text-xs">
                <div className="rounded-lg bg-slate-50 dark:bg-black/30 border border-black/[0.07] dark:border-white/10 p-4 space-y-2.5">
                  <div className="font-semibold uppercase tracking-wider text-[11px] text-slate-500 dark:text-slate-400">
                    Canonical Signature Formula
                  </div>
                  <div className="font-mono text-xs p-3 rounded-lg bg-[#0d1117] text-emerald-400 break-all">
                    HMAC_SHA256(uid + &quot;:&quot; + status, access_key)
                  </div>
                  <p className="text-slate-600 dark:text-slate-300 leading-relaxed">
                    Digest output is lowercase 64-character hexadecimal. Passed via query parameter{" "}
                    <code className="font-mono text-indigo-600 dark:text-indigo-400">&amp;hash=[HASH]</code> on return redirects when signature verification is enabled.
                  </p>
                </div>

                <div className="rounded-lg bg-slate-50 dark:bg-black/30 border border-black/[0.07] dark:border-white/10 p-4 space-y-2.5">
                  <div className="font-semibold uppercase tracking-wider text-[11px] text-slate-500 dark:text-slate-400">
                    Node.js / Express Verification
                  </div>
                  <pre className="font-mono text-[11px] p-3 rounded-lg bg-[#0d1117] text-slate-200 overflow-x-auto">
{`const crypto = require("crypto");
const expected = crypto
  .createHmac("sha256", "${displayKey}")
  .update(\`\${req.query.uid}:\${req.query.status}\`)
  .digest("hex");

const isValid = expected === String(req.query.hash || "").toLowerCase();`}
                  </pre>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2 text-xs">
                <div className="space-y-1.5">
                  <div className="font-semibold uppercase tracking-wider text-[11px] text-slate-500 dark:text-slate-400">
                    Python Verification Example
                  </div>
                  <pre className="font-mono text-[11px] p-3.5 rounded-lg bg-[#0d1117] text-slate-200 overflow-x-auto">
{`import hmac, hashlib

msg = f"{uid}:{status}".encode()
expected = hmac.new(b"${displayKey}", msg, hashlib.sha256).hexdigest()`}
                  </pre>
                </div>
                <div className="space-y-1.5">
                  <div className="font-semibold uppercase tracking-wider text-[11px] text-slate-500 dark:text-slate-400">
                    PHP Verification Example
                  </div>
                  <pre className="font-mono text-[11px] p-3.5 rounded-lg bg-[#0d1117] text-slate-200 overflow-x-auto">
{`<?php
$expected = hash_hmac("sha256", "$uid:$status", "${displayKey}");
$valid = hash_equals($expected, strtolower($_GET["hash"] ?? ""));`}
                  </pre>
                </div>
              </div>
            </section>

            {/* Live Interactive Hash Generator & Verifier */}
            <section className="rounded-xl border border-black/[0.08] dark:border-white/[0.09] bg-white dark:bg-[#13151a] p-5 sm:p-7 space-y-4">
              <div>
                <h2 className="text-base font-bold text-slate-900 dark:text-white">
                  Interactive Hash Generator &amp; Verifier
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Compute live HMAC-SHA256 signatures in-browser using Web Crypto API to test your callback handler.
                </p>
              </div>

              <div className="grid gap-3 sm:grid-cols-3 text-xs">
                <label className="space-y-1 block">
                  <span className="font-medium text-slate-700 dark:text-slate-300">Access Key Secret</span>
                  <input
                    type="text"
                    value={hashSecret}
                    onChange={(e) => setHashSecret(e.target.value)}
                    placeholder={displayKey}
                    className="w-full px-3 py-2 rounded-lg border border-black/[0.1] dark:border-white/10 bg-slate-50 dark:bg-black/30 font-mono text-xs text-slate-900 dark:text-white focus:outline-none"
                  />
                </label>
                <label className="space-y-1 block">
                  <span className="font-medium text-slate-700 dark:text-slate-300">Respondent UID</span>
                  <input
                    type="text"
                    value={hashUid}
                    onChange={(e) => setHashUid(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-black/[0.1] dark:border-white/10 bg-slate-50 dark:bg-black/30 font-mono text-xs text-slate-900 dark:text-white focus:outline-none"
                  />
                </label>
                <label className="space-y-1 block">
                  <span className="font-medium text-slate-700 dark:text-slate-300">Status Code</span>
                  <select
                    value={hashStatus}
                    onChange={(e) => setHashStatus(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-black/[0.1] dark:border-white/10 bg-slate-50 dark:bg-black/30 font-mono text-xs text-slate-900 dark:text-white focus:outline-none"
                  >
                    <option value="10">10 · Complete</option>
                    <option value="20">20 · Terminate</option>
                    <option value="30">30 · Overquota</option>
                    <option value="40">40 · Security</option>
                  </select>
                </label>
              </div>

              <div className="rounded-lg bg-[#0d1117] border border-slate-800 p-4 space-y-2 text-xs font-mono">
                <div className="flex items-center justify-between text-slate-400">
                  <span>Computed HMAC-SHA256 Digest</span>
                  <button
                    type="button"
                    onClick={() => copyText("computed-hash", computedHash)}
                    className="text-indigo-400 hover:underline cursor-pointer"
                  >
                    {copiedId === "computed-hash" ? "Copied" : "Copy Digest"}
                  </button>
                </div>
                <div className="text-emerald-400 break-all text-[12.5px]">{computedHash}</div>
                <div className="pt-2 border-t border-slate-800 text-slate-400 text-[11px] break-all">
                  Signed Callback Sample: https://yourpanel.com/callback?status={hashStatus}&amp;uid={encodeURIComponent(hashUid)}&amp;hash={computedHash}
                </div>
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center gap-3 pt-1">
                <input
                  type="text"
                  value={verifyHashInput}
                  onChange={(e) => setVerifyHashInput(e.target.value)}
                  placeholder="Paste incoming &hash=... value here to verify match"
                  className="flex-1 px-3 py-2 rounded-lg border border-black/[0.1] dark:border-white/10 bg-slate-50 dark:bg-black/30 font-mono text-xs text-slate-900 dark:text-white focus:outline-none"
                />
                {verifyHashInput.trim() && (
                  <span
                    className={cn(
                      "px-3 py-2 rounded-lg text-xs font-semibold shrink-0",
                      verifyMatch
                        ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
                        : "bg-rose-500/15 text-rose-700 dark:text-rose-300",
                    )}
                  >
                    {verifyMatch ? "Valid Signature Match" : "Hash Mismatch"}
                  </span>
                )}
              </div>
            </section>
          </div>
        )}

        {/* SECTION 3: S2S & RETURN REDIRECT GUIDE */}
        {section === "s2s" && (
          <div className="space-y-5">
            <section className="rounded-xl border border-black/[0.08] dark:border-white/[0.09] bg-white dark:bg-[#13151a] p-5 sm:p-7 space-y-5">
              <div className="flex items-center gap-2 text-slate-900 dark:text-white font-bold text-base">
                <Webhook size={17} className="text-amber-600 dark:text-amber-400" />
                <h2>Return Redirect Status Codes &amp; S2S Macros</h2>
              </div>

              <p className="text-xs sm:text-[13px] text-slate-600 dark:text-slate-300 leading-relaxed">
                Provide your 3 core return redirect URLs (plus optional Security URL) containing the{" "}
                <code className="font-mono text-indigo-600 dark:text-indigo-400">[UID]</code> macro. Server-to-Server callbacks expect{" "}
                <code className="font-mono">HTTP 200</code> within 5 seconds and automatically retry up to 3 times on 5xx responses.
              </p>

              <div className="rounded-lg border border-black/[0.08] dark:border-white/10 overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 dark:bg-white/[0.04] text-slate-600 dark:text-slate-300">
                    <tr>
                      <th className="p-3 font-semibold">Status</th>
                      <th className="p-3 font-semibold">Outcome</th>
                      <th className="p-3 font-semibold">Billing Impact</th>
                      <th className="p-3 font-semibold">Recommended Return Format</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-black/[0.06] dark:divide-white/[0.06]">
                    <tr>
                      <td className="p-3 font-mono font-bold text-emerald-600 dark:text-emerald-400">10</td>
                      <td className="p-3 font-medium">Complete</td>
                      <td className="p-3 text-slate-600 dark:text-slate-300">Payout credited at study CPI</td>
                      <td className="p-3 font-mono text-slate-500">https://yourpanel.com/callback?status=10&amp;uid=[UID]</td>
                    </tr>
                    <tr>
                      <td className="p-3 font-mono font-bold text-amber-600 dark:text-amber-400">20</td>
                      <td className="p-3 font-medium">Terminate / Screenout</td>
                      <td className="p-3 text-slate-600 dark:text-slate-300">Non-payable qualification exit</td>
                      <td className="p-3 font-mono text-slate-500">https://yourpanel.com/callback?status=20&amp;uid=[UID]</td>
                    </tr>
                    <tr>
                      <td className="p-3 font-mono font-bold text-sky-600 dark:text-sky-400">30</td>
                      <td className="p-3 font-medium">Overquota</td>
                      <td className="p-3 text-slate-600 dark:text-slate-300">Study quota full or paused</td>
                      <td className="p-3 font-mono text-slate-500">https://yourpanel.com/callback?status=30&amp;uid=[UID]</td>
                    </tr>
                    <tr>
                      <td className="p-3 font-mono font-bold text-rose-600 dark:text-rose-400">40</td>
                      <td className="p-3 font-medium">Security / Fraud (Optional)</td>
                      <td className="p-3 text-slate-600 dark:text-slate-300">Duplicate IP, speeder, or invalid hash</td>
                      <td className="p-3 font-mono text-slate-500">https://yourpanel.com/callback?status=40&amp;uid=[UID]</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <div className="flex flex-wrap gap-4 text-xs text-slate-600 dark:text-slate-400 pt-1">
                <span><code className="font-mono text-indigo-600 dark:text-indigo-400">[UID]</code> Partner respondent ID</span>
                <span><code className="font-mono text-indigo-600 dark:text-indigo-400">[PID]</code> Study ID</span>
                <span><code className="font-mono text-indigo-600 dark:text-indigo-400">[HASH]</code> Optional HMAC-SHA256 digest</span>
              </div>
            </section>

            {/* Interactive Return Callback URL Builder */}
            <section className="rounded-xl border border-black/[0.08] dark:border-white/[0.09] bg-white dark:bg-[#13151a] p-5 sm:p-7 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                <div>
                  <h2 className="text-base font-bold text-slate-900 dark:text-white">
                    Return Callback URL Builder
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Enter your panel callback base URL to generate all 4 endpoints ready to share back with VMH GROUP.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    copyText(
                      "all-callbacks",
                      generatedReturnUrls.map((u) => `${u.label} (${u.status}): ${u.url}`).join("\n"),
                    )
                  }
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-xs font-semibold cursor-pointer shrink-0"
                >
                  {copiedId === "all-callbacks" ? <Check size={13} /> : <Copy size={13} />}
                  {copiedId === "all-callbacks" ? "Copied All 4 URLs" : "Copy All 4 URLs"}
                </button>
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                <input
                  type="text"
                  value={cbBaseUrl}
                  onChange={(e) => setCbBaseUrl(e.target.value)}
                  placeholder="https://yourpanel.com/callback"
                  className="flex-1 px-3 py-2 rounded-lg border border-black/[0.1] dark:border-white/10 bg-slate-50 dark:bg-black/30 font-mono text-xs text-slate-900 dark:text-white focus:outline-none"
                />
                <label className="inline-flex items-center gap-2 text-xs font-medium text-slate-700 dark:text-slate-300 cursor-pointer shrink-0">
                  <input
                    type="checkbox"
                    checked={includeHashMacro}
                    onChange={(e) => setIncludeHashMacro(e.target.checked)}
                    className="rounded accent-indigo-600"
                  />
                  Include &amp;hash=[HASH]
                </label>
              </div>

              <div className="space-y-2">
                {generatedReturnUrls.map((item) => (
                  <div
                    key={item.status}
                    className="rounded-lg border border-black/[0.07] dark:border-white/10 bg-slate-50 dark:bg-black/30 px-3.5 py-2.5 flex items-center justify-between gap-3 text-xs"
                  >
                    <div className="min-w-0">
                      <span className="font-semibold text-slate-800 dark:text-slate-200 mr-2">
                        Status {item.status} ({item.label}):
                      </span>
                      <span className="font-mono text-indigo-600 dark:text-indigo-400 break-all">{item.url}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => copyText(`cb-${item.status}`, item.url)}
                      className="text-slate-500 hover:text-slate-900 dark:hover:text-white shrink-0 cursor-pointer"
                    >
                      {copiedId === `cb-${item.status}` ? <Check size={14} className="text-emerald-500" /> : <Copy size={14} />}
                    </button>
                  </div>
                ))}
              </div>
            </section>
          </div>
        )}

        {/* Portal Footer */}
        <footer className="pt-4 border-t border-black/[0.08] dark:border-white/[0.08] flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-slate-500 dark:text-slate-400">
          <div className="flex items-center gap-2">
            <ShieldCheck size={15} className="text-indigo-600 dark:text-indigo-400" />
            <span>VMH GROUP Supply Partner Gateway</span>
          </div>
          <div>
            Partner-scoped inventory · Only surveys assigned to your 32-char Access Key are visible
          </div>
        </footer>
      </main>

      {/* Authorize Access Key Modal */}
      {authModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-xl border border-black/[0.1] dark:border-white/15 bg-white dark:bg-[#16181f] p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <KeyRound size={16} className="text-indigo-600 dark:text-indigo-400" />
                <h3 className="text-base font-bold text-slate-900 dark:text-white">Authorize Partner Access Key</h3>
              </div>
              <button
                type="button"
                onClick={() => setAuthModalOpen(false)}
                className="text-slate-400 hover:text-slate-700 dark:hover:text-white cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
              Enter your 32-character hexadecimal <code className="font-mono">access-key</code> issued by VMH GROUP to test live API queries.
            </p>

            <input
              type="text"
              value={keyInput}
              onChange={(e) => setKeyInput(e.target.value)}
              placeholder="f3f5bf8fde5242a5964263444e1d9814"
              className="w-full px-3 py-2.5 rounded-lg border border-black/[0.12] dark:border-white/15 bg-slate-50 dark:bg-black/30 font-mono text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
            />

            {authError && <p className="text-xs text-rose-600 dark:text-rose-400">{authError}</p>}

            <div className="flex items-center justify-between pt-2">
              {activeKey ? (
                <button
                  type="button"
                  onClick={() => {
                    setActiveKey("");
                    setPartnerDisplayName("");
                    setAuthModalOpen(false);
                  }}
                  className="text-xs font-medium text-rose-600 dark:text-rose-400 hover:underline cursor-pointer"
                >
                  Clear Key
                </button>
              ) : (
                <span />
              )}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setAuthModalOpen(false)}
                  className="px-3.5 py-2 rounded-lg text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/[0.06] cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={applyAccessKey}
                  className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold cursor-pointer"
                >
                  Authorize
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
