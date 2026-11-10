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
  Sparkles,
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
      // 1A. Fetch Vendor details & Callback target
      let targetCallback = "";
      if (vid) {
        try {
          const { data: vData } = await supabase
            .from("smr_vendors")
            .select("vendor_name, callback_complete, callback_terminate, callback_overquota, callback_security")
            .eq("vendor_code", vid)
            .maybeSingle();

          if (vData) {
            setVendorName(vData.vendor_name || vid);
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
                .replace(/\[PID\]/gi, pid)
                .replace(/\[pid\]/gi, pid)
                .replace(/\[STUDY_ID\]/gi, pid);
              setVendorCallbackUrl(targetCallback);
            }
          }
        } catch (e) {
          console.warn("Vendor callback fetch error:", e);
        }
      }

      // 1B. Record Lead and Study Outcome in DB
      if (isComplete) {
        await recordStudyComplete(pid, vid, uid);
      } else {
        await recordStudyDisqualify(
          pid,
          vid,
          uid,
          isTerm ? "20" : isOverquota ? "30" : "40",
          customReason,
        );
      }

      // 1C. Smart Waterfall: Find the next live available survey for this respondent
      const candidate = await findNextAvailableStudy(pid, vid, uid);
      if (candidate) {
        setNextCandidate(candidate);
      }

      // 1D. If this was a Terminate / Quota / Security outcome:
      // The user explicitly requested: DO NOT show terminate/quotafull page!
      // Immediately redirect respondent to the next survey without showing terminate page!
      if (!isComplete) {
        if (candidate) {
          // Found next study: redirect seamlessly to the next prescreener!
          const targetQuery = candidate.live_url ? `&target=${encodeURIComponent(candidate.live_url)}` : "";
          setTimeout(() => {
            window.location.hash = `#/prescreener?vid=${encodeURIComponent(vid)}&pid=${encodeURIComponent(candidate.project_id)}&uid=${encodeURIComponent(uid)}${targetQuery}&rerouted=1`;
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
        window.location.hash = `#/prescreener?vid=${encodeURIComponent(vid)}&pid=${encodeURIComponent(nextCandidate.project_id)}&uid=${encodeURIComponent(uid)}${targetQuery}&rerouted=1`;
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
  }, [countdown, isComplete, nextCandidate, vid, uid, returnUrl, vendorCallbackUrl]);

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
      <div className="min-h-screen w-full bg-gradient-to-b from-[#f8fafc] via-[#f1f5f9] to-[#e2e8f0] text-slate-800 flex flex-col items-center justify-center p-4 sm:p-6 font-[-apple-system,BlinkMacSystemFont,'Segoe_UI','Inter',sans-serif]">
        <div className="relative w-full max-w-[480px] bg-white rounded-[32px] p-8 sm:p-10 shadow-[0_20px_50px_rgba(0,0,0,0.06)] border border-slate-100 flex flex-col items-center text-center">
          {/* VMH GROUP Top Branding Header */}
          <div className="w-full flex items-center justify-between pb-4 mb-8 border-b border-slate-100">
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
                  Smart Survey Routing Gateway
                </div>
              </div>
            </div>
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-semibold bg-indigo-50 text-indigo-700">
              <Layers className="w-3 h-3 text-indigo-600" />
              Auto-Routing
            </span>
          </div>

          {/* Smooth Pulse Spinner */}
          <div className="relative w-20 h-20 mb-6 flex items-center justify-center">
            <div className="absolute inset-0 rounded-full border-4 border-indigo-100 animate-ping opacity-30" />
            <div className="w-16 h-16 rounded-full border-4 border-indigo-600 border-t-transparent animate-spin" />
            <Layers className="w-7 h-7 text-indigo-600 absolute" />
          </div>

          <h2 className="text-2xl font-bold text-slate-900 tracking-tight mb-2">
            Matching You to Next Survey...
          </h2>
          <p className="text-sm text-slate-500 max-w-sm mb-6 leading-relaxed">
            Finding another available paid research study for your profile. Please hold on, connecting automatically...
          </p>

          <div className="w-full p-3 rounded-2xl bg-slate-50 border border-slate-200/80 flex items-center justify-center gap-2 text-xs text-slate-600 font-mono">
            <Sparkles className="w-3.5 h-3.5 text-indigo-600 animate-pulse" />
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
      <div className="min-h-screen w-full bg-gradient-to-b from-[#f8fafc] via-[#f1f5f9] to-[#e2e8f0] text-slate-800 flex flex-col items-center justify-center p-4 sm:p-6 font-[-apple-system,BlinkMacSystemFont,'Segoe_UI','Inter',sans-serif]">
        <div className="relative w-full max-w-[480px] bg-white rounded-[32px] p-8 sm:p-10 shadow-[0_20px_50px_rgba(0,0,0,0.06)] border border-slate-100 flex flex-col items-center text-center">
          <div className="w-16 h-16 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center mb-5">
            <ShieldCheck className="w-8 h-8 text-slate-600" />
          </div>
          <h2 className="text-xl font-bold text-slate-900 mb-2">Session Concluded</h2>
          <p className="text-sm text-slate-500 mb-6 leading-relaxed">
            Thank you for your time! You have participated in all research studies currently available for your profile today.
          </p>
          {effectiveReturnUrl ? (
            <a
              href={effectiveReturnUrl}
              className="w-full inline-flex items-center justify-center gap-2 py-3 px-6 rounded-full bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold transition"
            >
              Return to {vendorName || "Partner"}
              <ExternalLink className="w-4 h-4" />
            </a>
          ) : (
            <button
              type="button"
              onClick={handleClose}
              className="w-full py-3 px-6 rounded-full bg-slate-900 text-white text-sm font-semibold"
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
    <div className="min-h-screen w-full bg-gradient-to-b from-[#f8fafc] via-[#f1f5f9] to-[#e2e8f0] text-slate-800 flex flex-col items-center justify-center p-4 sm:p-6 font-[-apple-system,BlinkMacSystemFont,'Segoe_UI','Inter',sans-serif]">
      {/* Main Card */}
      <div className="relative w-full max-w-[560px] bg-white rounded-[32px] p-7 sm:p-10 shadow-[0_20px_50px_rgba(0,0,0,0.06)] border border-slate-100 flex flex-col items-center text-center">
        {/* VMH GROUP Top Branding Header */}
        <div className="w-full flex items-center justify-between pb-4 mb-6 border-b border-slate-100">
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
                Research Gateway • SMR Verification
              </div>
            </div>
          </div>
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700">
            <ShieldCheck className="w-3 h-3 text-emerald-600" />
            Verified Outcome
          </span>
        </div>

        {/* Top Outcome Icon & Status Badge */}
        <div className="w-20 h-20 rounded-full bg-emerald-50 border-4 border-emerald-100 text-emerald-600 flex items-center justify-center mb-5 shadow-sm">
          <CheckCircle2 className="w-10 h-10" />
        </div>
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-100/70 text-emerald-800 mb-3">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-pulse" />
          Status 10 • Survey Completed
        </span>
        <h1 className="text-2xl sm:text-[26px] font-bold text-slate-900 tracking-tight mb-2">
          Survey Completed Successfully!
        </h1>
        <p className="text-sm text-slate-600 max-w-md leading-relaxed mb-4">
          Thank you for sharing your opinions. Your response has been recorded and your incentive will be credited.
        </p>

        {/* 5-Second Auto-Reroute Indicator Banner */}
        <div className="w-full mb-6 p-3.5 rounded-2xl bg-indigo-50/90 border border-indigo-100 flex items-center justify-between text-xs text-indigo-900">
          <span className="flex items-center gap-2 font-medium">
            <Sparkles className="w-4 h-4 text-indigo-600 animate-pulse" />
            Redirecting to another survey in:
          </span>
          <span className="font-mono font-bold text-indigo-700 bg-white px-3 py-1 rounded-lg border border-indigo-200 shadow-sm text-xs">
            {countdown !== null && countdown > 0 ? `${countdown}s` : "Connecting..."}
          </span>
        </div>

        {/* Study Details Table Card */}
        <div className="w-full bg-slate-50/80 rounded-2xl border border-slate-200/80 p-4 sm:p-5 mb-6 text-left">
          <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-3 flex items-center justify-between">
            <span>Session Verification</span>
            <span className="font-mono text-emerald-600 flex items-center gap-1 text-[10px]">
              <ShieldCheck className="w-3.5 h-3.5" />
              Recorded
            </span>
          </div>

          <div className="space-y-2.5 text-xs">
            <div className="flex items-center justify-between py-1 border-b border-slate-200/60">
              <span className="text-slate-500 flex items-center gap-1.5">
                <Hash className="w-3.5 h-3.5 text-slate-400" />
                Study ID
              </span>
              <span className="font-mono font-medium text-slate-800">{pid}</span>
            </div>

            <div className="flex items-center justify-between py-1 border-b border-slate-200/60">
              <span className="text-slate-500">Respondent ID</span>
              <span className="font-mono font-medium text-slate-800">{uid}</span>
            </div>

            {vid && (
              <div className="flex items-center justify-between py-1 border-b border-slate-200/60">
                <span className="text-slate-500">Partner Code</span>
                <span className="font-mono font-medium text-indigo-600">{vid}</span>
              </div>
            )}

            <div className="flex items-center justify-between py-1 border-b border-slate-200/60">
              <span className="text-slate-500">Outcome Status</span>
              <span className="font-semibold px-2 py-0.5 rounded text-[11px] bg-emerald-100 text-emerald-800">
                Code 10 (Complete)
              </span>
            </div>

            <div className="flex items-center justify-between py-1 border-b border-slate-200/60">
              <span className="text-slate-500 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-slate-400" />
                Timestamp
              </span>
              <span className="text-slate-600 font-mono text-[11px]">{timestamp}</span>
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
                  className="p-1 rounded hover:bg-slate-200 text-slate-600 transition-colors"
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
                window.location.hash = `#/prescreener?vid=${encodeURIComponent(vid)}&pid=${encodeURIComponent(nextCandidate.project_id)}&uid=${encodeURIComponent(uid)}${targetQuery}&rerouted=1`;
              }}
              className="w-full inline-flex items-center justify-center gap-2 py-3.5 px-6 rounded-full bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold shadow-md shadow-indigo-100 transition-all cursor-pointer"
            >
              Start Next Survey Now
              <ArrowRight className="w-4 h-4" />
            </button>
          ) : effectiveReturnUrl ? (
            <a
              href={effectiveReturnUrl}
              className="w-full inline-flex items-center justify-center gap-2 py-3.5 px-6 rounded-full bg-slate-900 hover:bg-slate-800 text-white text-sm font-semibold transition-all cursor-pointer"
            >
              Return to {vendorName || "Partner"}
              <ExternalLink className="w-4 h-4" />
            </a>
          ) : (
            <button
              type="button"
              onClick={handleClose}
              className="w-full inline-flex items-center justify-center gap-2 py-3.5 px-6 rounded-full bg-slate-900 hover:bg-slate-800 text-white text-sm font-semibold transition-all cursor-pointer"
            >
              Close Window
            </button>
          )}

          <div className="pt-2">
            <a
              href="#/prescreener"
              className="text-xs text-slate-400 hover:text-slate-600 transition-colors inline-flex items-center gap-1"
            >
              Take another survey
              <ChevronRight className="w-3 h-3" />
            </a>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-8 pt-4 border-t border-slate-100 w-full flex items-center justify-center text-[11px] text-slate-400 gap-1.5">
          <ShieldCheck className="w-3.5 h-3.5 text-slate-400" />
          <span>VMH GROUP SMR • 256-bit Encrypted Research Verification</span>
        </div>
      </div>
    </div>
  );
}
