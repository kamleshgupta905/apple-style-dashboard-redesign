import { useEffect, useState, useMemo } from "react";
import { Copy, Check, Database, BookOpen, KeyRound } from "lucide-react";
import { api } from "../lib/api";
import { getPublicOrigin } from "../lib/data";
import { usePermissions } from "../lib/permissions";
import {
  buildSanitizedSupplyStudies,
  getVendorAccessKey,
  isAccessKey32,
  resolveVendorByAccessKey,
} from "../lib/partnerKey";

export function VendorFeed() {
  const { user } = usePermissions();
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(true);
  const [feedData, setFeedData] = useState<any>(null);
  const [resolvedKey, setResolvedKey] = useState<string>("");

  const hash = typeof window !== "undefined" ? window.location.hash || "" : "";
  const queryStr = hash.includes("?")
    ? hash.split("?")[1]
    : typeof window !== "undefined"
    ? window.location.search.replace(/^\?/, "")
    : "";
  const params = useMemo(() => new URLSearchParams(queryStr), [queryStr]);
  const paramToken = (
    params.get("key") ||
    params.get("access_key") ||
    params.get("api_key") ||
    params.get("vid") ||
    params.get("vendor_code") ||
    params.get("vendor_id") ||
    params.get("v") ||
    ""
  ).trim();

  const fallbackUserVid = (user?.vendor_code || user?.supplier_id || (user?.role_id === 3 ? user?.username : "") || "").trim();
  const activeTokenOrVid = paramToken || fallbackUserVid;

  useEffect(() => {
    const prevTitle = document.title;
    document.title = "VMH GROUP · Partner Survey JSON Feed";
    return () => {
      document.title = prevTitle;
    };
  }, []);

  useEffect(() => {
    let active = true;

    const fetchFeed = async () => {
      setLoading(true);
      const origin = getPublicOrigin();

      if (!activeTokenOrVid) {
        if (!active) return;
        setResolvedKey("");
        setFeedData({
          success: false,
          brand: "VMH GROUP",
          status: 401,
          error: "A valid 32-character access-key (?key=...) is required to view assigned surveys.",
          total: 0,
          generated_at: new Date().toISOString(),
          surveys: [],
        });
        setLoading(false);
        return;
      }

      try {
        // Resolve vendor strictly if a 32-char key was supplied; fallback cleanly for legacy ?vid=
        const strict = isAccessKey32(activeTokenOrVid);
        const vendor = await resolveVendorByAccessKey(activeTokenOrVid, { strictKeyOnly: strict });

        if (!vendor) {
          if (!active) return;
          setResolvedKey("");
          setFeedData({
            success: false,
            brand: "VMH GROUP",
            status: 401,
            error: strict
              ? "Invalid or revoked 32-character Partner Access Key."
              : "Partner account could not be verified.",
            total: 0,
            generated_at: new Date().toISOString(),
            surveys: [],
          });
          setLoading(false);
          return;
        }

        const effectiveKey = vendor.access_key || (await getVendorAccessKey(vendor.vendor_code));
        if (active) setResolvedKey(effectiveKey);

        // Prefer live Node /api/supply/projects when running full-stack server
        try {
          const res = await fetch("/api/supply/projects", {
            headers: { "access-key": effectiveKey },
          });
          const ct = res.headers.get("content-type") || "";
          if (ct.includes("application/json")) {
            const payload = await res.json();
            if (active && payload && typeof payload.success === "boolean") {
              setFeedData(payload);
              setLoading(false);
              return;
            }
          }
        } catch {
          // Static fallback below
        }

        const [allotsRes, projectsRes, marketRes] = await Promise.all([
          api.get<{ data: any[] }>("/vendor/allotments").catch(() => ({ data: [] })),
          api.get<{ data: any[] }>("/manage/projects").catch(() => ({ data: [] })),
          api.get<{ data: any[] }>("/zamplia").catch(() => ({ data: [] })),
        ]);

        const surveys = buildSanitizedSupplyStudies({
          vendorCode: vendor.vendor_code,
          accessKey: effectiveKey,
          allots: allotsRes.data || [],
          projects: projectsRes.data || [],
          market: marketRes.data || [],
          origin,
        });

        if (!active) return;
        setFeedData({
          success: true,
          brand: "VMH GROUP",
          total: surveys.length,
          generated_at: new Date().toISOString(),
          universal_router_url: `${origin}/#/router?key=${encodeURIComponent(effectiveKey)}&uid=[RESPONDENT_ID]`,
          surveys,
        });
      } catch (err: any) {
        if (!active) return;
        setFeedData({
          success: false,
          brand: "VMH GROUP",
          error: err?.message || "Unable to fetch partner survey feed.",
          surveys: [],
        });
      } finally {
        if (active) setLoading(false);
      }
    };

    void fetchFeed();
    return () => {
      active = false;
    };
  }, [activeTokenOrVid]);

  const copyJson = () => {
    if (!feedData) return;
    navigator.clipboard?.writeText(JSON.stringify(feedData, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const maskedKey = resolvedKey
    ? `${resolvedKey.slice(0, 6)}...${resolvedKey.slice(-6)}`
    : activeTokenOrVid
    ? `${activeTokenOrVid.slice(0, 6)}...`
    : "MISSING";

  return (
    <div className="min-h-screen w-full bg-[#0b0c0e] text-[#eef0f3] p-4 sm:p-8 font-mono text-xs">
      <div className="max-w-5xl mx-auto space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-4 rounded-xl bg-[#13151a] border border-white/10">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 shrink-0 rounded-lg bg-indigo-500/15 border border-indigo-500/25 text-indigo-400 flex items-center justify-center">
              <Database className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="text-sm font-semibold text-white flex items-center gap-2.5 font-sans">
                <span>VMH GROUP · Partner Survey Feed</span>
                <span className="text-[11px] font-mono text-emerald-400 tabular-nums">
                  · {feedData?.total ?? feedData?.total_active_surveys ?? 0} Live Studies
                </span>
              </div>
              <div className="text-[11px] text-white/55 flex items-center gap-1.5 mt-0.5 truncate">
                <KeyRound className="w-3 h-3 text-indigo-400 shrink-0" />
                <span>access-key: <span className="text-indigo-300">{maskedKey}</span></span>
                <span>·</span>
                <span>GET /api/supply/projects</span>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={copyJson}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-white/10 hover:bg-white/15 text-white text-xs font-medium transition cursor-pointer font-sans"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              {copied ? "Copied JSON" : "Copy JSON"}
            </button>
            <a
              href={`#/api-docs${resolvedKey ? `?key=${encodeURIComponent(resolvedKey)}` : ""}`}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium transition font-sans"
            >
              <BookOpen className="w-3.5 h-3.5" />
              Partner API Docs
            </a>
          </div>
        </div>

        <div className="relative rounded-xl bg-[#090d13] border border-white/10 p-5 overflow-x-auto shadow-2xl">
          {loading ? (
            <div className="py-20 text-center text-white/45 font-sans">Loading partner supply inventory...</div>
          ) : (
            <pre className="text-emerald-400/95 leading-relaxed text-[12px] font-mono tabular-nums">
              {JSON.stringify(feedData, null, 2)}
            </pre>
          )}
        </div>
      </div>
    </div>
  );
}
