import { useEffect, useState, useMemo } from "react";
import { Loader2, AlertCircle, ArrowRight, ShieldCheck, CheckCircle2, Layers } from "lucide-react";
import { supabase } from "../lib/supabase";
import { num } from "../lib/utils";
import { findNextAvailableStudy } from "../lib/waterfall";

export function VendorRouter() {
  const [status, setStatus] = useState<"loading" | "routing" | "no_studies" | "invalid_vendor">("loading");
  const [vendorName, setVendorName] = useState<string>("");
  const [matchedStudy, setMatchedStudy] = useState<{ id: string; name: string } | null>(null);

  // Extract query parameters from hash or search
  const hash = window.location.hash || "";
  const queryStr = hash.includes("?")
    ? hash.split("?")[1]
    : window.location.search.replace(/^\?/, "");
  const params = useMemo(() => new URLSearchParams(queryStr), [queryStr]);

  const vid = params.get("vid") || params.get("vendor") || params.get("vendor_id") || params.get("v") || "";
  const rawUid = params.get("uid") || params.get("rid") || params.get("respondent_id") || params.get("user_id") || params.get("subid") || params.get("id") || "";
  const uid = rawUid && !rawUid.includes("[") && !rawUid.includes("{")
    ? rawUid
    : `RESP_${Math.random().toString(36).slice(2, 9).toUpperCase()}`;

  useEffect(() => {
    const prevTitle = document.title;
    document.title = "VMH GROUP • Survey Router Gateway";
    return () => {
      document.title = prevTitle;
    };
  }, []);

  useEffect(() => {
    if (!vid) {
      setStatus("invalid_vendor");
      return;
    }

    const routeTraffic = async () => {
      try {
        // 1. Verify Vendor Exists
        const { data: vendorData } = await supabase
          .from("smr_vendors")
          .select("vendor_code, vendor_name, status")
          .eq("vendor_code", vid)
          .maybeSingle();

        setVendorName(vendorData?.vendor_name || vid);

        // 2. Find Best Available Live Study via Smart Waterfall (Auto-Pause checks included)
        const candidate = await findNextAvailableStudy("", vid, uid);
        if (!candidate) {
          setStatus("no_studies");
          return;
        }

        setMatchedStudy({ id: candidate.project_id, name: candidate.project_name });
        setStatus("routing");

        // Smooth transition to prescreener after brief delay
        setTimeout(() => {
          const targetQuery = candidate.live_url ? `&target=${encodeURIComponent(candidate.live_url)}` : "";
          window.location.hash = `#/prescreener?vid=${encodeURIComponent(vid)}&pid=${encodeURIComponent(candidate.project_id)}&uid=${encodeURIComponent(uid)}${targetQuery}`;
        }, 600);

      } catch (e) {
        console.warn("Routing check error:", e);
        setStatus("no_studies");
      }
    };

    routeTraffic();
  }, [vid, uid]);

  return (
    <div className="min-h-screen w-full bg-[#f6f7f9] text-[#111317] flex flex-col items-center justify-center p-4 sm:p-6">
      <div className="relative w-full max-w-[520px] bg-white rounded-2xl p-7 sm:p-9 shadow-[0_1px_3px_rgba(16,24,40,0.06),0_12px_32px_rgba(16,24,40,0.05)] border border-black/[0.08] flex flex-col items-center text-center">
        
        {/* VMH GROUP Top Header */}
        <div className="w-full flex items-center justify-between pb-4 mb-5 border-b border-black/[0.07]">
          <div className="flex items-center gap-2.5">
            <img
              src="/vmh-logo.png"
              alt="VMH GROUP"
              className="h-7 w-auto object-contain rounded"
              onError={(e) => {
                (e.target as HTMLElement).style.display = "none";
              }}
            />
            <div className="text-left">
              <div className="text-[13px] font-bold tracking-tight text-slate-900 uppercase">
                VMH GROUP
              </div>
              <div className="text-[11px] text-slate-500 font-medium">
                Survey Router Gateway
              </div>
            </div>
          </div>
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200/70">
            <ShieldCheck className="w-3.5 h-3.5 text-indigo-600" />
            Router Active
          </span>
        </div>
        
        {/* State 1: Connecting / Routing */}
        {(status === "loading" || status === "routing") && (
          <div className="py-10 flex flex-col items-center">
            <div className="relative mb-5 flex items-center justify-center">
              <div className="w-14 h-14 rounded-full border-3 border-indigo-100 border-t-indigo-600 animate-spin" />
              <Layers className="w-5 h-5 text-indigo-600 absolute" />
            </div>

            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200/70 mb-3">
              Partner Router Active
            </span>

            <h2 className="text-xl font-bold text-slate-900 tracking-tight mb-2">
              {matchedStudy ? "Connecting to Research Study..." : "Matching Active Survey..."}
            </h2>
            <p className="text-xs text-slate-500 max-w-sm leading-relaxed mb-6">
              {matchedStudy
                ? `Matched with Study #${matchedStudy.id}. Transferring you securely...`
                : "Checking real-time partner inventory and study allocations."}
            </p>

            <div className="w-full bg-slate-50 rounded-xl border border-slate-200 p-3.5 text-left text-xs font-mono space-y-1">
              <div className="text-slate-500 text-[11px]">Partner: <span className="text-slate-800 font-semibold">{vendorName || vid}</span></div>
              <div className="text-slate-500 text-[11px]">Session ID: <span className="text-slate-800">{uid}</span></div>
            </div>
          </div>
        )}

        {/* State 2: No Studies Assigned Yet */}
        {status === "no_studies" && (
          <div className="py-6 flex flex-col items-center">
            <div className="w-14 h-14 rounded-2xl bg-amber-50 border border-amber-200 text-amber-600 flex items-center justify-center mb-4">
              <Layers className="w-7 h-7" />
            </div>

            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold bg-amber-50 text-amber-800 border border-amber-200/70 mb-3">
              Partner Active · Inventory Empty
            </span>

            <h2 className="text-xl font-bold text-slate-900 tracking-tight mb-2">
              No Active Surveys Assigned
            </h2>
            <p className="text-xs text-slate-600 max-w-md leading-relaxed mb-6">
              Your partner account (<strong>{vendorName || vid}</strong>) is connected to the router. However, there are currently no live studies allocated to this partner code.
            </p>

            <div className="w-full bg-slate-50 rounded-xl border border-slate-200 p-4 text-left text-xs space-y-2 mb-6">
              <div className="font-semibold text-slate-800 flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                How to activate studies:
              </div>
              <p className="text-slate-500 text-[12px] leading-relaxed">
                Open your dashboard, go to <strong>Surveys</strong> or <strong>Vendors</strong>, and assign a live study to partner <strong>{vid}</strong>. It will immediately route here for your respondents.
              </p>
            </div>

            <button
              type="button"
              onClick={() => window.location.reload()}
              className="w-full py-3 px-6 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold transition-colors cursor-pointer"
            >
              Refresh Router Status
            </button>
          </div>
        )}

        {/* State 3: Invalid or Missing Vendor Code */}
        {status === "invalid_vendor" && (
          <div className="py-6 flex flex-col items-center">
            <div className="w-14 h-14 rounded-2xl bg-rose-50 border border-rose-200 text-rose-600 flex items-center justify-center mb-4">
              <AlertCircle className="w-7 h-7" />
            </div>

            <h2 className="text-xl font-bold text-slate-900 mb-2">
              Missing Vendor Parameter
            </h2>
            <p className="text-xs text-slate-500 max-w-sm mb-6 leading-relaxed">
              This router endpoint requires a valid partner code parameter (e.g. <code>?vid=YOUR_VENDOR_CODE</code>).
            </p>

            <div className="w-full bg-slate-50 rounded-xl border border-slate-200 p-3.5 text-left font-mono text-[11px] text-slate-600 break-all mb-6">
              {typeof window !== "undefined" ? window.location.origin : "https://api.vmhgroupsmr.com"}/#/router?vid=VND001&uid=[RESPONDENT_ID]
            </div>

            <a
              href="#/vendors"
              className="w-full inline-flex items-center justify-center py-3 px-6 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold transition-colors"
            >
              Go to Vendors Management
            </a>
          </div>
        )}
      </div>
    </div>
  );
}
