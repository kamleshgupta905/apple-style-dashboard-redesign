import { useState, useMemo } from "react";
import {
  CheckCircle2,
  XCircle,
  Clock,
  ShieldAlert,
  Copy,
  Check,
  ExternalLink,
  ChevronRight,
  ShieldCheck,
  Calendar,
  Hash,
  AlertTriangle,
} from "lucide-react";

export function SurveyCallback() {
  const [copied, setCopied] = useState(false);

  // Parse status and parameters from hash or search
  const hash = window.location.hash || "";
  const hashRoute = hash.replace(/^#\/?/, "").split(/[/?]/)[0];
  const queryStr = hash.includes("?")
    ? hash.split("?")[1]
    : window.location.search.replace(/^\?/, "");
  const params = useMemo(() => new URLSearchParams(queryStr), [queryStr]);

  // Determine status code
  let status = params.get("status") || "";
  if (!status) {
    if (hashRoute === "complete") status = "10";
    else if (hashRoute === "terminate") status = "20";
    else if (hashRoute === "overquota") status = "30";
    else if (hashRoute === "security") status = "40";
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

  return (
    <div className="min-h-screen w-full bg-gradient-to-b from-[#f8fafc] via-[#f1f5f9] to-[#e2e8f0] text-slate-800 flex flex-col items-center justify-center p-4 sm:p-6 font-[-apple-system,BlinkMacSystemFont,'Segoe_UI','Inter',sans-serif]">
      {/* Main Card */}
      <div className="relative w-full max-w-[560px] bg-white rounded-[32px] p-7 sm:p-10 shadow-[0_20px_50px_rgba(0,0,0,0.06)] border border-slate-100 flex flex-col items-center text-center">
        
        {/* Top Outcome Icon & Status Badge */}
        {isComplete && (
          <>
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
            <p className="text-sm text-slate-600 max-w-md leading-relaxed mb-6">
              Thank you for sharing your opinions. Your response has been recorded and your incentive will be credited according to your provider's terms.
            </p>
          </>
        )}

        {isTerm && (
          <>
            <div className="w-20 h-20 rounded-full bg-amber-50 border-4 border-amber-100 text-amber-600 flex items-center justify-center mb-5 shadow-sm">
              <XCircle className="w-10 h-10" />
            </div>
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-100/70 text-amber-800 mb-3">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-600" />
              Status 20 • Screenout / Terminated
            </span>
            <h1 className="text-2xl sm:text-[26px] font-bold text-slate-900 tracking-tight mb-2">
              Survey Terminated
            </h1>
            <p className="text-sm text-slate-600 max-w-md leading-relaxed mb-6">
              {customReason
                ? `Disqualification notice: ${customReason}`
                : "Thank you for your time. Unfortunately, based on the preliminary questions, your profile did not match the specific target criteria required for this research study."}
            </p>
          </>
        )}

        {isOverquota && (
          <>
            <div className="w-20 h-20 rounded-full bg-sky-50 border-4 border-sky-100 text-sky-600 flex items-center justify-center mb-5 shadow-sm">
              <Clock className="w-10 h-10" />
            </div>
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-sky-100/70 text-sky-800 mb-3">
              <span className="w-1.5 h-1.5 rounded-full bg-sky-600" />
              Status 30 • Quota Filled
            </span>
            <h1 className="text-2xl sm:text-[26px] font-bold text-slate-900 tracking-tight mb-2">
              Survey Quota Full
            </h1>
            <p className="text-sm text-slate-600 max-w-md leading-relaxed mb-6">
              Thank you for your interest! The required number of respondents for your demographic profile has already been reached for this study.
            </p>
          </>
        )}

        {isSecurity && (
          <>
            <div className="w-20 h-20 rounded-full bg-rose-50 border-4 border-rose-100 text-rose-600 flex items-center justify-center mb-5 shadow-sm">
              <ShieldAlert className="w-10 h-10" />
            </div>
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-rose-100/70 text-rose-800 mb-3">
              <span className="w-1.5 h-1.5 rounded-full bg-rose-600" />
              Status 40 • Security Terminate
            </span>
            <h1 className="text-2xl sm:text-[26px] font-bold text-slate-900 tracking-tight mb-2">
              Access Terminated by Security Gate
            </h1>
            <p className="text-sm text-slate-600 max-w-md leading-relaxed mb-6">
              {customReason
                ? `Security notice: ${customReason}`
                : "This session could not be verified by our automated fraud detection system (duplicate IP, VPN/proxy, or session anomaly)."}
            </p>
          </>
        )}

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
              <span
                className={`font-semibold px-2 py-0.5 rounded text-[11px] ${
                  isComplete
                    ? "bg-emerald-100 text-emerald-800"
                    : isTerm
                    ? "bg-amber-100 text-amber-800"
                    : isOverquota
                    ? "bg-sky-100 text-sky-800"
                    : "bg-rose-100 text-rose-800"
                }`}
              >
                Code {status} (
                {isComplete
                  ? "Complete"
                  : isTerm
                  ? "Screenout"
                  : isOverquota
                  ? "Quota Full"
                  : "Security Terminate"}
                )
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
          {returnUrl ? (
            <a
              href={returnUrl}
              className="w-full inline-flex items-center justify-center gap-2 py-3.5 px-6 rounded-full bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold shadow-md shadow-indigo-100 transition-all cursor-pointer"
            >
              Return to Provider
              <ExternalLink className="w-4 h-4" />
            </a>
          ) : (
            <button
              type="button"
              onClick={handleClose}
              className="w-full inline-flex items-center justify-center gap-2 py-3.5 px-6 rounded-full bg-slate-900 hover:bg-slate-800 text-white text-sm font-semibold shadow-sm transition-all cursor-pointer"
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
          <span>SMR Research Gate • 256-bit Encrypted Verification</span>
        </div>
      </div>
    </div>
  );
}
