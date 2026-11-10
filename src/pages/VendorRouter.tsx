import { useEffect, useState, useMemo } from "react";
import { Loader2, AlertCircle, ArrowRight, ShieldCheck, CheckCircle2, Layers } from "lucide-react";
import { supabase } from "../lib/supabase";
import { num } from "../lib/utils";

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

        // 2. Fetch Active Allotments for this Vendor
        const { data: allotments, error: allotErr } = await supabase
          .from("smr_vendor_allotments")
          .select("*")
          .eq("vendor_id", vid)
          .eq("status", "Active");

        if (allotErr || !allotments || allotments.length === 0) {
          setStatus("no_studies");
          return;
        }

        // Filter out over-quota allotments
        const availableAllotments = allotments.filter((a) => {
          const completes = num(a.complete_count, 0);
          const limit = num(a.quota_limit, 100);
          return limit <= 0 || completes < limit;
        });

        if (availableAllotments.length === 0) {
          setStatus("no_studies");
          return;
        }

        // 3. Verify Associated Projects are Live
        const projectIds = availableAllotments.map((a) => a.project_id);
        const { data: liveProjects } = await supabase
          .from("smr_projects")
          .select("project_id, project_name, status, live_url, cpi")
          .in("project_id", projectIds)
          .eq("status", "Live");

        const liveProjectMap = new Map((liveProjects || []).map((p) => [p.project_id, p]));

        // Match available allotments with live projects
        const validCandidates = availableAllotments
          .filter((a) => liveProjectMap.has(a.project_id))
          .sort((a, b) => num(b.vendor_cpi) - num(a.vendor_cpi)); // prioritize highest CPI

        if (validCandidates.length === 0) {
          setStatus("no_studies");
          return;
        }

        // Pick top available candidate
        const chosen = validCandidates[0];
        const proj = liveProjectMap.get(chosen.project_id)!;
        setMatchedStudy({ id: chosen.project_id, name: proj.project_name });
        setStatus("routing");

        // Smooth transition to prescreener after brief delay
        setTimeout(() => {
          const targetQuery = proj.live_url ? `&target=${encodeURIComponent(proj.live_url)}` : "";
          window.location.hash = `#/prescreener?vid=${encodeURIComponent(vid)}&pid=${encodeURIComponent(chosen.project_id)}&uid=${encodeURIComponent(uid)}${targetQuery}`;
        }, 700);

      } catch (e) {
        console.warn("Routing check error:", e);
        setStatus("no_studies");
      }
    };

    routeTraffic();
  }, [vid, uid]);

  return (
    <div className="min-h-screen w-full bg-gradient-to-b from-[#f8fafc] via-[#f1f5f9] to-[#e2e8f0] text-slate-800 flex flex-col items-center justify-center p-4 sm:p-6 font-[-apple-system,BlinkMacSystemFont,'Segoe_UI','Inter',sans-serif]">
      <div className="relative w-full max-w-[540px] bg-white rounded-[32px] p-8 sm:p-10 shadow-[0_20px_50px_rgba(0,0,0,0.06)] border border-slate-100 flex flex-col items-center text-center">
        
        {/* VMH GROUP Top Header */}
        <div className="w-full flex items-center justify-between pb-4 mb-4 border-b border-slate-100">
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
              <div className="text-[10px] text-slate-400 font-medium">
                Survey Router Gateway
              </div>
            </div>
          </div>
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200/60">
            <ShieldCheck className="w-3 h-3 text-indigo-600" />
            Router Active
          </span>
        </div>
        
        {/* State 1: Connecting / Routing */}
        {(status === "loading" || status === "routing") && (
          <div className="py-10 flex flex-col items-center">
            <div className="relative mb-5 flex items-center justify-center">
              <div className="w-16 h-16 rounded-full border-4 border-indigo-100 border-t-indigo-600 animate-spin" />
              <Layers className="w-6 h-6 text-indigo-600 absolute" />
            </div>

            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-700 mb-3">
              <span className="w-1.5 h-1.5 rounded-full bg-indigo-600 animate-pulse" />
              Partner Router Active
            </span>

            <h2 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight mb-2">
              {matchedStudy ? "Connecting to Research Study..." : "Matching Active Survey..."}
            </h2>
            <p className="text-xs text-slate-500 max-w-sm leading-relaxed mb-6">
              {matchedStudy
                ? `Matched with Study #${matchedStudy.id}. Transferring you securely...`
                : "Checking real-time partner inventory and study allocations."}
            </p>

            <div className="w-full bg-slate-50 rounded-2xl border border-slate-200/80 p-3.5 text-left text-xs font-mono space-y-1">
              <div className="text-slate-400 text-[11px]">Partner: <span className="text-slate-700 font-semibold">{vendorName || vid}</span></div>
              <div className="text-slate-400 text-[11px]">Session ID: <span className="text-slate-700">{uid}</span></div>
            </div>
          </div>
        )}

        {/* State 2: No Studies Assigned Yet */}
        {status === "no_studies" && (
          <div className="py-6 flex flex-col items-center">
            <div className="w-16 h-16 rounded-full bg-amber-50 border-4 border-amber-100 text-amber-600 flex items-center justify-center mb-4">
              <Layers className="w-8 h-8" />
            </div>

            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-800 mb-3">
              Partner Active • Inventory Empty
            </span>

            <h2 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight mb-2">
              No Active Surveys Assigned
            </h2>
            <p className="text-xs text-slate-600 max-w-md leading-relaxed mb-6">
              Your partner account (<strong>{vendorName || vid}</strong>) is connected to our SMR Router. However, there are currently no live studies allocated to this partner code.
            </p>

            <div className="w-full bg-slate-50/90 rounded-2xl border border-slate-200/80 p-4 text-left text-xs space-y-2 mb-6">
              <div className="font-semibold text-slate-700 flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                How to activate studies:
              </div>
              <p className="text-slate-500 text-[12px] leading-relaxed">
                Log into your VMH Group SMR Dashboard, go to <strong>My Studies</strong> or <strong>Vendors</strong>, and click <strong>"Assign"</strong> to allocate any study to partner <strong>{vid}</strong>. It will immediately appear here for your respondents.
              </p>
            </div>

            <button
              type="button"
              onClick={() => window.location.reload()}
              className="w-full py-3 px-6 rounded-full bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold transition-all cursor-pointer"
            >
              Refresh Router Status
            </button>
          </div>
        )}

        {/* State 3: Invalid or Missing Vendor Code */}
        {status === "invalid_vendor" && (
          <div className="py-6 flex flex-col items-center">
            <div className="w-16 h-16 rounded-full bg-rose-50 border-4 border-rose-100 text-rose-600 flex items-center justify-center mb-4">
              <AlertCircle className="w-8 h-8" />
            </div>

            <h2 className="text-xl font-bold text-slate-900 mb-2">
              Missing Vendor Parameter
            </h2>
            <p className="text-xs text-slate-500 max-w-sm mb-6 leading-relaxed">
              This router endpoint requires a valid partner code parameter (e.g. <code>?vid=YOUR_VENDOR_CODE</code>).
            </p>

            <div className="w-full bg-slate-50 rounded-2xl border border-slate-200/80 p-3.5 text-left font-mono text-[11px] text-slate-600 break-all mb-6">
              https://api.vmhgroupsmr.com/#/router?vid=VND001&uid=[RESPONDENT_ID]
            </div>

            <a
              href="#/vendors"
              className="w-full inline-flex items-center justify-center py-3 px-6 rounded-full bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold transition-all"
            >
              Go to Vendors Management
            </a>
          </div>
        )}

        {/* Calibr8 / SMR footer */}
        <div className="mt-8 pt-4 border-t border-slate-100 w-full flex items-center justify-center text-[11px] text-slate-400 gap-1.5">
          <ShieldCheck className="w-3.5 h-3.5 text-slate-400" />
          <span>VMH Group SMR Global Router • 256-bit Encrypted Session</span>
        </div>
      </div>
    </div>
  );
}
