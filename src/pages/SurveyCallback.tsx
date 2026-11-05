import { useEffect, useState } from "react";
import { CheckCircle2, XCircle, AlertCircle, ShieldAlert, ArrowLeft } from "lucide-react";

export function SurveyCallback() {
  const params = new URLSearchParams(
    window.location.hash.includes("?")
      ? window.location.hash.split("?")[1]
      : window.location.search
  );

  const status = params.get("status") || "10";
  const pid = params.get("pid") || "";
  const uid = params.get("uid") || "";
  const reason = params.get("reason") || "";

  const isComplete = status === "10";
  const isTerm = status === "20";
  const isOverquota = status === "30";
  const isSecurity = status === "40";

  return (
    <div className="min-h-screen w-full bg-[#0a0d14] text-[#f5f5f7] flex flex-col items-center justify-center p-4 sm:p-6 font-[-apple-system,BlinkMacSystemFont,'SF_Pro_Text','Inter',sans-serif]">
      <div className="w-full max-w-md bg-[#141824]/90 backdrop-blur-2xl border border-white/10 rounded-3xl p-6 sm:p-8 shadow-2xl text-center">
        {/* Status Icon */}
        <div className="mb-4 inline-flex items-center justify-center w-16 h-16 rounded-full">
          {isComplete && (
            <div className="w-16 h-16 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center">
              <CheckCircle2 className="w-8 h-8" />
            </div>
          )}
          {isTerm && (
            <div className="w-16 h-16 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center">
              <XCircle className="w-8 h-8" />
            </div>
          )}
          {isOverquota && (
            <div className="w-16 h-16 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 flex items-center justify-center">
              <AlertCircle className="w-8 h-8" />
            </div>
          )}
          {isSecurity && (
            <div className="w-16 h-16 rounded-full bg-red-500/10 border border-red-500/20 text-red-400 flex items-center justify-center">
              <ShieldAlert className="w-8 h-8" />
            </div>
          )}
        </div>

        {/* Status Title */}
        <h2 className="text-xl font-bold text-white mb-2">
          {isComplete && "Survey Complete!"}
          {isTerm && "Study Disqualification"}
          {isOverquota && "Survey Quota Filled"}
          {isSecurity && "Security Verification Flagged"}
        </h2>

        {/* Status Description */}
        <p className="text-xs text-white/60 mb-6 leading-relaxed">
          {isComplete && "Thank you for sharing your valuable opinions! Your participation has been verified and recorded."}
          {isTerm && (reason ? `Criteria screenout: ${reason}` : "Thank you for your time. Your profile did not meet the specific target criteria for this study.")}
          {isOverquota && "Thank you for your interest! The required number of respondents for this research study has already been fulfilled."}
          {isSecurity && "Your session was stopped due to a security policy check (proxy/VPN or duplicate session)."}
        </p>

        {/* Study Details */}
        {(pid || uid) && (
          <div className="p-3 rounded-xl bg-white/[0.03] border border-white/5 text-[11px] text-white/40 mb-6 text-left font-mono space-y-1">
            {pid && <div>Study ID: <span className="text-white/70">{pid}</span></div>}
            {uid && <div>Session ID: <span className="text-white/70">{uid}</span></div>}
            <div>Status Code: <span className="text-white/70">{status}</span></div>
          </div>
        )}

        <button
          onClick={() => window.close()}
          className="inline-flex items-center justify-center gap-2 w-full px-5 py-3 rounded-2xl bg-white/10 hover:bg-white/15 text-white text-xs font-semibold transition-all"
        >
          Close Window
        </button>
      </div>
    </div>
  );
}
