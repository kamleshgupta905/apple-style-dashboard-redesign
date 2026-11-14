import { useState, useMemo, useEffect, useRef } from "react";
import {
  CheckCircle2,
  Copy,
  Check,
  ExternalLink,
  ChevronRight,
  ShieldCheck,
  Calendar,
  Hash,
  Layers,
  ArrowRight,
  Loader2,
} from "lucide-react";
import { supabase } from "../lib/supabase";
import {
  findNextAvailableStudy,
  recordStudyComplete,
  recordStudyDisqualify,
  type NextStudyCandidate,
} from "../lib/waterfall";

export function SurveyCallback() {
  const [copied, setCopied] = useState(false);

  // Parse status and parameters from hash or search
  const hash = window.location.hash || "";
  const hashRoute = hash.replace(/^#\/?/, "").split(/[/?]/)[0];
  const queryStr = hash.includes("?")
    ? hash.split("?")[1]
    : window.location.search.replace(/^\?/, "");
  const params = useMemo(() => new URLSearchParams(queryStr), [queryStr]);

  // Determine status code: 10 = Complete, 20 = Terminate, 30 = Overquota, 40 = Security
  let status = params.get("status") || "";
  if (!status) {
    if (hashRoute === "complete") status = "10";
    else if (hashRoute === "terminate") status = "20";
    else if (hashRoute === "overquota") status = "30";
    else if (
      hashRoute === "security" ||
      hashRoute === "security-notice" ||
      hashRoute === "security-terminate" ||
      hashRoute === "security-callback"
    ) status = "40";
    else status = "10"; // Default to complete
  }

  const pid = params.get("pid") || params.get("project_id") || params.get("study_id") || "SMR-STUDY-LIVE";
  const uid = params.get("uid") || params.get("rid") || params.get("respondent_id") || "RESP-ONLINE";
  const vid = params.get("vid") || params.get("vendor_code") || "";
  const customReason = params.get("reason") || "";
  const returnUrl = params.get("return_url") || params.get("redirect") || "";

  const isComplete = status === "10";
  const isTerm = status === "20";
  const isOverquota = status === "30";
  const isSecurity = status === "40";

  const [activeVid, setActiveVid] = useState<string>(vid);
  const [activePid, setActivePid] = useState<string>(pid);
  const [vendorCallbackUrl, setVendorCallbackUrl] = useState<string>("");
  const [vendorName, setVendorName] = useState<string>("");
  const [countdown, setCountdown] = useState<number | null>(isComplete ? 5 : null);
  const [nextCandidate, setNextCandidate] = useState<NextStudyCandidate | null>(null);
  const [isRouting, setIsRouting] = useState<boolean>(!isComplete);
  const [noMoreSurveys, setNoMoreSurveys] = useState<boolean>(false);

  const hasProcessedRef = useRef(false);

  // 1. Process Database records & Waterfall Reroute Lookup
  useEffect(() => {
    if (hasProcessedRef.current) return;
    hasProcessedRef.current = true;

    // Browser tab title
    const prevTitle = document.title;
    document.title = isComplete
      ? "VMH GROUP • Survey Completed"
      : "VMH GROUP • Connecting to Next Survey";

    const processOutcomeAndWaterfall = async () => {
      // 1A. Recover Vendor & Project from smr_leads if not in URL (supports 100% static redirects)
      let resolvedVid = vid;
      let resolvedPid = pid;

      if (!resolvedVid && uid && uid !== "RESP-ONLINE") {
        try {
          let lead: any = null;
          const byUid = await supabase
            .from("smr_leads")
            .select("*")
            .eq("uid", uid)
            .order("id", { ascending: false })
            .limit(1)
            .maybeSingle();

          if (!byUid.error && byUid.data) {
            lead = byUid.data;
          } else {
            const byAlt = await supabase
              .from("smr_leads")
              .select("*")
              .or(`lead_id.eq.${uid},respondent_id.eq.${uid}`)
              .order("id", { ascending: false })
              .limit(1)
              .maybeSingle();
            if (!byAlt.error && byAlt.data) {
              lead = byAlt.data;
            }
          }

          if (lead) {
            resolvedVid = lead.vendor_code || lead.vendor_id || lead.vendor || "";
            if (!resolvedPid || resolvedPid === "SMR-STUDY-LIVE") {
              resolvedPid = lead.project_id || "";
            }
          }
        } catch (e) {
          console.warn("Lead recovery error in SurveyCallback:", e);
        }
      }

      if (resolvedVid) setActiveVid(resolvedVid);
      if (resolvedPid) setActivePid(resolvedPid);

      // 1B. Fetch Vendor details & Callback target
      let targetCallback = "";
      if (resolvedVid) {
        try {
          const { data: vData } = await supabase
            .from("smr_vendors")
            .select("vendor_name, callback_complete, callback_terminate, callback_overquota, callback_security")
            .eq("vendor_code", resolvedVid)
            .maybeSingle();

          if (vData) {
            setVendorName(vData.vendor_name || resolvedVid);
            let rawTarget = "";
            if (isComplete) rawTarget = vData.callback_complete;
            else if (isTerm) rawTarget = vData.callback_terminate;
            else if (isOverquota) rawTarget = vData.callback_overquota;
            else if (isSecurity) rawTarget = vData.callback_security;

            if (rawTarget) {
              targetCallback = rawTarget
                .replace(/\[#UID#\]/gi, uid)
                .replace(/\[identifier\]/gi, uid)
                .replace(/\[RESPONDENT_ID\]/gi, uid)
                .replace(/\[TransactionId\]/gi, uid)
                .replace(/\{\{UID\}\}/gi, uid)
                .replace(/\[UID\]/gi, uid)
                .replace(/\[uid\]/gi, uid)
                .replace(/\[rid\]/gi, uid)
                .replace(/\[RID\]/gi, uid)
                .replace(/\[ID\]/gi, uid)
                .replace(/\[PID\]/gi, resolvedPid)
                .replace(/\[pid\]/gi, resolvedPid)
                .replace(/\[STUDY_ID\]/gi, resolvedPid);
              setVendorCallbackUrl(targetCallback);
            }
          }
        } catch (e) {
          console.warn("Vendor callback fetch error:", e);
        }
      }

      // 1C. Record Lead and Study Outcome in DB
      if (isComplete) {
        await recordStudyComplete(resolvedPid, resolvedVid, uid);
      } else {
        await recordStudyDisqualify(
          resolvedPid,
          resolvedVid,
          uid,
          isTerm ? "20" : isOverquota ? "30" : "40",
          customReason,
        );
      }

      // 1D. Smart Waterfall: Find the next live available survey for this respondent
      const candidate = await findNextAvailableStudy(resolvedPid, resolvedVid, uid);
      if (candidate) {
        setNextCandidate(candidate);
      }

      // 1E. If this was a Terminate / Quota / Security outcome:
      // Immediately redirect respondent to the next survey without showing terminate page!
      if (!isComplete) {
        if (candidate) {
          // Found next study: redirect seamlessly to the next prescreener!
          const targetQuery = candidate.live_url ? `&target=${encodeURIComponent(candidate.live_url)}` : "";
          setTimeout(() => {
            window.location.hash = `#/prescreener?vid=${encodeURIComponent(resolvedVid)}&pid=${encodeURIComponent(candidate.project_id)}&uid=${encodeURIComponent(uid)}${targetQuery}&rerouted=1`;
          }, 350);
        } else {
          // No more live studies available: redirect to vendor callback if exists
          const finalDest = returnUrl || targetCallback;
          if (finalDest) {
            setTimeout(() => {
              window.location.href = finalDest;
            }, 500);
          } else {
            setIsRouting(false);
            setNoMoreSurveys(true);
          }
        }
      }
    };

    processOutcomeAndWaterfall();

    return () => {
      document.title = prevTitle;
    };
  }, [pid, vid, uid, status, isComplete, isTerm, isOverquota, isSecurity, customReason, returnUrl]);

  // 2. Countdown Effect for Complete Page (Status 10)
  // Keeps the Complete page visible for exactly 5 seconds, then auto-redirects to another survey!
  useEffect(() => {
    if (!isComplete || countdown === null) return;

    if (countdown <= 0) {
      if (nextCandidate) {
        // Next survey found: redirect respondent to continue earning!
        const targetQuery = nextCandidate.live_url ? `&target=${encodeURIComponent(nextCandidate.live_url)}` : "";
        window.location.hash = `#/prescreener?vid=${encodeURIComponent(activeVid)}&pid=${encodeURIComponent(nextCandidate.project_id)}&uid=${encodeURIComponent(uid)}${targetQuery}&rerouted=1`;
      } else {
        // No other survey: redirect back to vendor complete callback
        const dest = returnUrl || vendorCallbackUrl;
        if (dest) {
          window.location.href = dest;
        } else {
          setNoMoreSurveys(true);
        }
      }
      return;
    }

    const t = setTimeout(() => {
      setCountdown((c) => (c !== null ? c - 1 : null));
    }, 1000);

    return () => clearTimeout(t);
  }, [countdown, isComplete, nextCandidate, activeVid, uid, returnUrl, vendorCallbackUrl]);

  const effectiveReturnUrl = returnUrl || vendorCallbackUrl;

  // Deterministic verification token
  const verificationCode = useMemo(() => {
    let hashNum = 0;
    const str = `${uid}-${pid}-${status}`;
    for (let i = 0; i < str.length; i++) {
      hashNum = (hashNum << 5) - hashNum + str.charCodeAt(i);
      hashNum |= 0;
    }
    const hex = Math.abs(hashNum).toString(16).toUpperCase().padStart(8, "0");
    return `VRF-${status}-${hex}`;
  }, [uid, pid, status]);

  const timestamp = useMemo(() => {
    return new Date().toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      timeZoneName: "short",
    });
  }, []);

  const handleCopyCode = () => {
    navigator.clipboard?.writeText(verificationCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleClose = () => {
    if (window.opener) {
      window.close();
    } else {
      window.history.back();
    }
  };

  // -------------------------------------------------------------
  // VIEW A: Seamless Matching Transition (When Terminated / Quota / Security)
  // Per user requirement: Do NOT show negative terminate page!
  // Reroutes automatically to another survey!
  // -------------------------------------------------------------
  if (!isComplete && (isRouting || !noMoreSurveys)) {
    return (
      <div className="min-h-screen w-full bg-[#f6f7f9] text-[#111317] flex flex-col items-center justify-center p-4 sm:p-6">
        <div className="relative w-full max-w-[480px] bg-white rounded-2xl p-8 sm:p-9 shadow-[0_1px_3px_rgba(16,24,40,0.06),0_12px_32px_rgba(16,24,40,0.05)] border border-black/[0.08] flex flex-col items-center text-center">
          {/* VMH GROUP Top Branding Header */}
          <div className="w-full flex items-center justify-between pb-4 mb-8 border-b border-black/[0.07]">
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
                  Smart Survey Routing Gateway
                </div>
              </div>
            </div>
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200/70">
              <Layers className="w-3.5 h-3.5 text-indigo-600" />
              Auto-Routing
            </span>
          </div>

          {/* Clean Routing Spinner */}
          <div className="relative w-16 h-16 mb-6 flex items-center justify-center">
            <div className="w-16 h-16 rounded-full border-3 border-indigo-100 border-t-indigo-600 animate-spin" />
            <Layers className="w-6 h-6 text-indigo-600 absolute" />
          </div>

          <h2 className="text-xl font-bold text-slate-900 tracking-tight mb-2">
            Matching You to Next Survey...
          </h2>
          <p className="text-sm text-slate-500 max-w-sm mb-6 leading-relaxed">
            Finding another available paid research study for your profile. Connecting automatically...
          </p>

          <div className="w-full p-3 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-center gap-2 text-xs text-slate-600 font-mono">
            <Loader2 className="w-3.5 h-3.5 text-indigo-600 animate-spin" />
            <span>Scanning live marketplace inventory</span>
          </div>
        </div>
      </div>
    );
  }

  // -------------------------------------------------------------
  // VIEW B: End of Session (Only if all available studies exhausted)
  // -------------------------------------------------------------
  if (!isComplete && noMoreSurveys) {
    return (
      <div className="min-h-screen w-full bg-[#f6f7f9] text-[#111317] flex flex-col items-center justify-center p-4 sm:p-6">
        <div className="relative w-full max-w-[480px] bg-white rounded-2xl p-8 sm:p-9 shadow-[0_1px_3px_rgba(16,24,40,0.06),0_12px_32px_rgba(16,24,40,0.05)] border border-black/[0.08] flex flex-col items-center text-center">
          <div className="w-14 h-14 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center mb-5">
            <ShieldCheck className="w-7 h-7" />
          </div>
          <h2 className="text-xl font-bold text-slate-900 mb-2">Session Concluded</h2>
          <p className="text-sm text-slate-500 mb-6 leading-relaxed">
            Thank you for your time. You have participated in all research studies currently available for your profile today.
          </p>
          {effectiveReturnUrl ? (
            <a
              href={effectiveReturnUrl}
              className="w-full inline-flex items-center justify-center gap-2 py-3 px-6 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold transition-colors"
            >
              Return to {vendorName || "Partner"}
              <ExternalLink className="w-4 h-4" />
            </a>
          ) : (
            <button
              type="button"
              onClick={handleClose}
              className="w-full py-3 px-6 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-sm font-semibold transition-colors cursor-pointer"
            >
              Close Window
            </button>
          )}
        </div>
      </div>
    );
  }

  // -------------------------------------------------------------
  // VIEW C: Survey Completed (Status 10)
  // Shown for exactly 5 seconds, then auto-redirects to another survey!
  // -------------------------------------------------------------
  return (
    <div className="min-h-screen w-full bg-[#f6f7f9] text-[#111317] flex flex-col items-center justify-center p-4 sm:p-6">
      {/* Main Card */}
      <div className="relative w-full max-w-[540px] bg-white rounded-2xl p-6 sm:p-9 shadow-[0_1px_3px_rgba(16,24,40,0.06),0_12px_32px_rgba(16,24,40,0.05)] border border-black/[0.08] flex flex-col items-center text-center">
        {/* VMH GROUP Top Branding Header */}
        <div className="w-full flex items-center justify-between pb-4 mb-6 border-b border-black/[0.07]">
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
                Research Gateway · Verification
              </div>
            </div>
          </div>
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200/70">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
            Verified Outcome
          </span>
        </div>

        {/* Top Outcome Icon & Status Badge */}
        <div className="w-16 h-16 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-600 flex items-center justify-center mb-4">
          <CheckCircle2 className="w-8 h-8" />
        </div>
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200/70 mb-3">
          Status 10 · Survey Completed
        </span>
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight mb-2">
          Survey Completed Successfully
        </h1>
        <p className="text-sm text-slate-600 max-w-md leading-relaxed mb-5">
          Thank you for sharing your opinions. Your response has been recorded and your incentive will be credited.
        </p>

        {/* 5-Second Auto-Reroute Indicator Banner */}
        <div className="w-full mb-5 p-3 rounded-xl bg-indigo-50/70 border border-indigo-200/70 flex items-center justify-between text-xs text-indigo-900">
          <span className="flex items-center gap-2 font-medium">
            <Loader2 className="w-3.5 h-3.5 text-indigo-600 animate-spin" />
            Redirecting to next available survey in:
          </span>
          <span className="font-mono font-bold text-indigo-700 bg-white px-2.5 py-1 rounded-md border border-indigo-200 text-xs tabular-nums">
            {countdown !== null && countdown > 0 ? `${countdown}s` : "Connecting..."}
          </span>
        </div>

        {/* Study Details Table Card */}
        <div className="w-full bg-slate-50 rounded-xl border border-slate-200 p-4 sm:p-5 mb-6 text-left">
          <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-3 flex items-center justify-between">
            <span>Session Verification</span>
            <span className="font-mono text-emerald-600 flex items-center gap-1 text-[10px]">
              <ShieldCheck className="w-3.5 h-3.5" />
              Recorded
            </span>
          </div>

          <div className="space-y-2.5 text-xs">
            <div className="flex items-center justify-between py-1 border-b border-slate-200/70">
              <span className="text-slate-500 flex items-center gap-1.5">
                <Hash className="w-3.5 h-3.5 text-slate-400" />
                Study ID
              </span>
              <span className="font-mono font-medium text-slate-800">{activePid}</span>
            </div>

            <div className="flex items-center justify-between py-1 border-b border-slate-200/70">
              <span className="text-slate-500">Respondent ID</span>
              <span className="font-mono font-medium text-slate-800">{uid}</span>
            </div>

            {activeVid && (
              <div className="flex items-center justify-between py-1 border-b border-slate-200/70">
                <span className="text-slate-500">Partner Code</span>
                <span className="font-mono font-medium text-indigo-600">{activeVid}</span>
              </div>
            )}

            <div className="flex items-center justify-between py-1 border-b border-slate-200/70">
              <span className="text-slate-500">Outcome Status</span>
              <span className="font-semibold px-2 py-0.5 rounded text-[11px] bg-emerald-100 text-emerald-800">
                Code 10 (Complete)
              </span>
            </div>

            <div className="flex items-center justify-between py-1 border-b border-slate-200/70">
              <span className="text-slate-500 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-slate-400" />
                Timestamp
              </span>
              <span className="text-slate-600 font-mono text-[11px] tabular-nums">{timestamp}</span>
            </div>

            {/* Verification Code with Copy */}
            <div className="flex items-center justify-between pt-1">
              <span className="text-slate-500">Confirmation Code</span>
              <div className="flex items-center gap-1.5">
                <span className="font-mono font-bold text-slate-900 bg-white px-2 py-0.5 rounded border border-slate-200 text-[11px]">
                  {verificationCode}
                </span>
                <button
                  type="button"
                  onClick={handleCopyCode}
                  title="Copy confirmation code"
                  className="p-1 rounded hover:bg-slate-200 text-slate-600 transition-colors cursor-pointer"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="w-full space-y-2.5">
          {nextCandidate ? (
            <button
              type="button"
              onClick={() => {
                const targetQuery = nextCandidate.live_url ? `&target=${encodeURIComponent(nextCandidate.live_url)}` : "";
                window.location.hash = `#/prescreener?vid=${encodeURIComponent(activeVid)}&pid=${encodeURIComponent(nextCandidate.project_id)}&uid=${encodeURIComponent(uid)}${targetQuery}&rerouted=1`;
              }}
              className="w-full inline-flex items-center justify-center gap-2 py-3 px-6 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold transition-colors cursor-pointer"
            >
              Start Next Survey Now
              <ArrowRight className="w-4 h-4" />
            </button>
          ) : effectiveReturnUrl ? (
            <a
              href={effectiveReturnUrl}
              className="w-full inline-flex items-center justify-center gap-2 py-3 px-6 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-sm font-semibold transition-colors cursor-pointer"
            >
              Return to {vendorName || "Partner"}
              <ExternalLink className="w-4 h-4" />
            </a>
          ) : (
            <button
              type="button"
              onClick={handleClose}
              className="w-full inline-flex items-center justify-center gap-2 py-3 px-6 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-sm font-semibold transition-colors cursor-pointer"
            >
              Close Window
            </button>
          )}

          <div className="pt-2">
            <a
              href="#/prescreener"
              className="text-xs text-slate-500 hover:text-slate-700 transition-colors inline-flex items-center gap-1"
            >
              Take another survey
              <ChevronRight className="w-3 h-3" />
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
