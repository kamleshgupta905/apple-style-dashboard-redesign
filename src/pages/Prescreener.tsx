import { useEffect, useState } from "react";
import { CheckCircle2, AlertTriangle, RefreshCw, ShieldCheck, ArrowRight, Laptop, Smartphone, Tablet } from "lucide-react";
import { supabase } from "../lib/supabase";
import {
  recordStudyClickAndCheckAutoPause,
  findNextAvailableStudy,
  markStudyAttempted,
} from "../lib/waterfall";

const DEVICE_OPTIONS = [
  { id: "desktop", label: "Laptop / Desktop Computer", icon: Laptop },
  { id: "mobile", label: "Smartphone (iOS or Android)", icon: Smartphone },
  { id: "tablet", label: "Tablet / iPad", icon: Tablet },
];

export function Prescreener() {
  // Step 0: Age (manual input), Step 1: Gender (dropdown), Step 2: Device (selection)
  const [step, setStep] = useState<number>(0);
  const [ageInput, setAgeInput] = useState<string>("");
  const [ageError, setAgeError] = useState<string>("");
  const [genderInput, setGenderInput] = useState<string>("");
  const [genderError, setGenderError] = useState<string>("");
  const [selectedDevice, setSelectedDevice] = useState<string>("");
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [status, setStatus] = useState<"checking" | "screening" | "connecting" | "disqualified" | "blocked">("checking");
  const [blockReason, setBlockReason] = useState<string>("");
  const [redirectCountdown, setRedirectCountdown] = useState<number>(1);
  const [finalUrl, setFinalUrl] = useState<string>("");
  const [dbLiveUrl, setDbLiveUrl] = useState<string>("");

  // Parse URL Parameters
  const params = new URLSearchParams(
    window.location.hash.includes("?")
      ? window.location.hash.split("?")[1]
      : window.location.search
  );

  const vid = params.get("vid") || "VND-AFC01";
  const pid = params.get("pid") || "VMHPI000142026";
  const rawUid = params.get("uid") || "";
  const uid = rawUid && rawUid !== "[RESPONDENT_ID]" && rawUid !== "%5BRESPONDENT_ID%5D"
    ? rawUid
    : `RESP_${Math.random().toString(36).substring(2, 10).toUpperCase()}`;
  const targetParam = params.get("target") || "";

  // Browser Tab Title - Always VMH GROUP Branding
  useEffect(() => {
    const prevTitle = document.title;
    document.title = "VMH GROUP • Research Study Screener";
    return () => {
      document.title = prevTitle;
    };
  }, []);

  // Entrance Click tracking, Auto-pause check, and Security duplicate validation
  useEffect(() => {
    if (!pid) return;

    markStudyAttempted(uid, pid);

    const initSession = async () => {
      // 1. Check duplicate session in fraud logs
      try {
        const { data: dup } = await supabase
          .from("smr_fraud_logs")
          .select("id, reason")
          .eq("uid", uid)
          .eq("project_id", pid)
          .maybeSingle();

        if (dup) {
          setBlockReason(dup.reason || "Duplicate session detected");
          setStatus("blocked");
          return;
        }
      } catch (e) {
        console.warn("Security check bypass:", e);
      }

      // 2. Track click entrance and automatically evaluate 50-clicks auto-pause condition
      try {
        const result = await recordStudyClickAndCheckAutoPause(pid, vid, uid);
        if (result.liveUrl && !targetParam) {
          setDbLiveUrl(result.liveUrl);
        }

        // If the study was auto-paused, is not live, or is missing a liveUrl (and pid is not a direct numeric exchange ID):
        if (result.autoPaused || !result.isLive || (!result.liveUrl && !targetParam && !/^\d{8,12}$/.test(pid.trim()))) {
          console.warn(`[Prescreener Waterfall] Study #${pid} is paused or lacks destination. Rerouting respondent to next available study.`);
          const next = await findNextAvailableStudy(pid, vid, uid);
          if (next) {
            const nextTarget = next.live_url ? `&target=${encodeURIComponent(next.live_url)}` : "";
            window.location.hash = `#/prescreener?vid=${encodeURIComponent(vid)}&pid=${encodeURIComponent(next.project_id)}&uid=${encodeURIComponent(uid)}${nextTarget}&rerouted=1`;
            return;
          }
        }
      } catch (e) {
        console.warn("Entrance check error:", e);
      }

      setStatus("screening");
    };

    const timer = setTimeout(initSession, 300);
    return () => clearTimeout(timer);
  }, [uid, pid, vid, targetParam]);

  const TOTAL_STEPS = 3;
  const percent = Math.round(((step + 1) / TOTAL_STEPS) * 100);

  // Step 0: Age handler (manual numeric entry)
  const handleAgeSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const trimmed = ageInput.trim();
    if (!trimmed) {
      setAgeError("Please enter your age to continue");
      return;
    }
    const numAge = parseInt(trimmed, 10);
    if (isNaN(numAge) || numAge < 14 || numAge > 99) {
      setAgeError("Please enter a valid age between 14 and 99");
      return;
    }
    setAgeError("");
    setAnswers((prev) => ({ ...prev, age: String(numAge) }));
    setStep(1);
  };

  // Step 1: Gender handler (dropdown select)
  const handleGenderSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!genderInput) {
      setGenderError("Please select your gender to continue");
      return;
    }
    setGenderError("");
    setAnswers((prev) => ({ ...prev, gender: genderInput }));
    setStep(2);
  };

  // Step 2: Device handler (device selection)
  const handleDeviceSelect = (devId: string) => {
    setSelectedDevice(devId);
    setAnswers((prev) => ({ ...prev, device: devId }));
    setTimeout(() => {
      completeScreener(devId);
    }, 220);
  };

  const completeScreener = (_device?: string) => {
    setStatus("connecting");

    // Resolve Final Target Survey URL
    const rawTarget = targetParam || dbLiveUrl;
    let resolved = "";
    if (rawTarget) {
      resolved = rawTarget
        .replace(/\[#UID#\]/gi, uid)
        .replace(/\[identifier\]/gi, uid)
        .replace(/\[RESPONDENT_ID\]/gi, uid)
        .replace(/\[TransactionId\]/gi, uid)
        .replace(/\{\{UID\}\}/gi, uid)
        .replace(/\[UID\]/gi, uid)
        .replace(/\[uid\]/gi, uid)
        .replace(/\[rid\]/gi, uid)
        .replace(/\[RID\]/gi, uid)
        .replace(/vmhgroupss/gi, uid);
      const sep = resolved.includes("?") ? "&" : "?";
      if (!resolved.includes("transaction_id") && !resolved.includes("rid") && !resolved.includes("uid=")) {
        resolved = `${resolved}${sep}transaction_id=${encodeURIComponent(uid)}&rid=${encodeURIComponent(uid)}`;
      }
    } else if (/^\d{8,12}$/.test(pid.trim())) {
      // Valid numeric Zamplia / PureSpectrum exchange study ID
      resolved = `https://res.zamplia.com/?vid=2138&isMap=1&sid=${encodeURIComponent(pid)}&username=${encodeURIComponent(vid)}&cid=42&transaction_id=${encodeURIComponent(uid)}&rid=${encodeURIComponent(uid)}`;
    } else {
      // Study has no destination URL or is closed: gracefully show SMR Quota Full / Complete callback instead of Calibr8 404
      resolved = `#/callback?status=30&pid=${encodeURIComponent(pid)}&uid=${encodeURIComponent(uid)}&vid=${encodeURIComponent(vid)}&reason=study_closed_or_quota_reached`;
    }

    setFinalUrl(resolved);

    let seconds = 1;
    setRedirectCountdown(1);
    const interval = setInterval(() => {
      seconds -= 1;
      setRedirectCountdown(seconds);
      if (seconds <= 0) {
        clearInterval(interval);
        if (resolved.startsWith("#")) {
          window.location.hash = resolved;
        } else {
          window.location.href = resolved;
        }
      }
    }, 800);
  };

  return (
    <div className="min-h-screen w-full bg-[#f8fafc] text-slate-800 flex flex-col items-center justify-center p-4 sm:p-6 font-[-apple-system,BlinkMacSystemFont,'Segoe_UI','Inter',sans-serif]">
      {/* Centered White Card (VMH Group Research Screener) */}
      <div className="relative w-full max-w-[560px] bg-white rounded-[32px] p-7 sm:p-10 shadow-[0_20px_50px_rgba(0,0,0,0.06)] border border-slate-100">
        
        {/* VMH GROUP Top Branding Header */}
        <div className="flex items-center justify-between pb-4 mb-6 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <img
              src="/vmh-logo.png"
              alt="VMH GROUP"
              className="h-7 w-auto object-contain rounded"
              onError={(e) => {
                (e.target as HTMLElement).style.display = "none";
              }}
            />
            <div>
              <div className="text-[13px] font-bold tracking-tight text-slate-900 uppercase">
                VMH GROUP
              </div>
              <div className="text-[10px] text-slate-400 font-medium">
                Research Pre-Screener Gate
              </div>
            </div>
          </div>
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200/60">
            <ShieldCheck className="w-3 h-3 text-emerald-600" />
            Verified Session
          </span>
        </div>
        
        {/* State 1: Verification Check */}
        {status === "checking" && (
          <div className="py-14 text-center flex flex-col items-center">
            <div className="w-10 h-10 rounded-full border-2 border-emerald-500/20 border-t-emerald-600 animate-spin mb-4" />
            <h3 className="text-base font-semibold text-slate-800 mb-1">Verifying session security...</h3>
            <p className="text-xs text-slate-500">Checking study parameters and device security</p>
          </div>
        )}

        {/* State 2: Active Screening Questions */}
        {status === "screening" && (
          <div>
            {/* Top Progress bar and percentage */}
            <div className="flex items-center gap-4 mb-7">
              <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-[#10b981] rounded-full transition-all duration-300"
                  style={{ width: `${percent}%` }}
                />
              </div>
              <span className="text-xs font-semibold text-slate-700 tabular-nums">
                {percent}%
              </span>
            </div>

            {/* Step 0: Age (Manual numeric entry) */}
            {step === 0 && (
              <div>
                <h2 className="text-[17px] sm:text-[18px] font-bold text-[#1e293b] text-center leading-snug mb-2 max-w-md mx-auto">
                  What is your age?
                </h2>
                <p className="text-xs text-slate-400 text-center mb-6">
                  Please enter your age in years
                </p>

                <form onSubmit={handleAgeSubmit} className="flex flex-col items-center">
                  <div className="w-full max-w-xs">
                    <input
                      type="number"
                      min="14"
                      max="99"
                      autoFocus
                      value={ageInput}
                      onChange={(e) => {
                        setAgeInput(e.target.value);
                        setAgeError("");
                      }}
                      placeholder="Enter age (e.g. 28)"
                      className="w-full text-center text-2xl font-bold tracking-tight py-3.5 px-5 rounded-2xl border border-slate-200 bg-white text-slate-900 focus:border-indigo-600 focus:ring-4 focus:ring-indigo-100 outline-none transition-all shadow-sm placeholder:text-slate-300 placeholder:font-normal placeholder:text-base"
                    />
                    {ageError && (
                      <p className="text-xs text-rose-500 font-medium text-center mt-2.5">
                        {ageError}
                      </p>
                    )}
                  </div>

                  <button
                    type="submit"
                    disabled={!ageInput.trim()}
                    className="mt-6 w-full max-w-xs py-3.5 px-6 rounded-2xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-semibold shadow-sm transition-all flex items-center justify-center gap-2 cursor-pointer"
                  >
                    Continue
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </form>
              </div>
            )}

            {/* Step 1: Gender (Dropdown box) */}
            {step === 1 && (
              <div>
                <h2 className="text-[17px] sm:text-[18px] font-bold text-[#1e293b] text-center leading-snug mb-2 max-w-md mx-auto">
                  What is your gender?
                </h2>
                <p className="text-xs text-slate-400 text-center mb-6">
                  Please select your gender from the dropdown
                </p>

                <form onSubmit={handleGenderSubmit} className="flex flex-col items-center">
                  <div className="w-full max-w-xs">
                    <div className="relative">
                      <select
                        autoFocus
                        value={genderInput}
                        onChange={(e) => {
                          setGenderInput(e.target.value);
                          setGenderError("");
                        }}
                        className="w-full text-base font-medium py-3.5 px-4 rounded-2xl border border-slate-200 bg-white text-slate-800 focus:border-indigo-600 focus:ring-4 focus:ring-indigo-100 outline-none transition-all shadow-sm cursor-pointer appearance-none"
                      >
                        <option value="">-- Select Gender --</option>
                        <option value="Male">Male</option>
                        <option value="Female">Female</option>
                        <option value="Other">Other / Prefer not to say</option>
                      </select>
                      <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-slate-500">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                        </svg>
                      </div>
                    </div>
                    {genderError && (
                      <p className="text-xs text-rose-500 font-medium text-center mt-2.5">
                        {genderError}
                      </p>
                    )}
                  </div>

                  <button
                    type="submit"
                    disabled={!genderInput}
                    className="mt-6 w-full max-w-xs py-3.5 px-6 rounded-2xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-semibold shadow-sm transition-all flex items-center justify-center gap-2 cursor-pointer"
                  >
                    Continue
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </form>
              </div>
            )}

            {/* Step 2: Device (Which device are you using) */}
            {step === 2 && (
              <div>
                <h2 className="text-[17px] sm:text-[18px] font-bold text-[#1e293b] text-center leading-snug mb-2 max-w-md mx-auto">
                  Which device are you using to take this survey?
                </h2>
                <p className="text-xs text-slate-400 text-center mb-6">
                  Select your current device to begin
                </p>

                <div className="space-y-3 max-w-md mx-auto">
                  {DEVICE_OPTIONS.map((opt) => {
                    const isSelected = selectedDevice === opt.id;
                    const IconComponent = opt.icon;
                    return (
                      <button
                        type="button"
                        key={opt.id}
                        onClick={() => handleDeviceSelect(opt.id)}
                        className={`w-full flex items-center gap-3.5 px-4.5 py-3.5 rounded-2xl border transition-all cursor-pointer text-left ${
                          isSelected
                            ? "border-indigo-500 bg-indigo-50/30 shadow-sm"
                            : "border-slate-200/90 hover:border-slate-300 hover:bg-slate-50/50 bg-white"
                        }`}
                      >
                        <div
                          className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 transition-colors ${
                            isSelected ? "bg-indigo-600 text-white" : "bg-slate-100 text-slate-600"
                          }`}
                        >
                          <IconComponent className="w-5 h-5" />
                        </div>
                        <div className="flex-1">
                          <span className="text-[14.5px] font-semibold text-slate-800 leading-snug block">
                            {opt.label}
                          </span>
                        </div>
                        <div
                          className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors ${
                            isSelected ? "border-indigo-600 bg-white" : "border-slate-300 bg-white"
                          }`}
                        >
                          {isSelected && <div className="w-2.5 h-2.5 rounded-full bg-indigo-600" />}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* State 3: Qualified & Redirecting */}
        {status === "connecting" && (
          <div className="py-10 text-center flex flex-col items-center">
            <div className="w-14 h-14 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mb-4">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <h3 className="text-lg font-bold text-slate-800 mb-1">Pre-Screening Complete!</h3>
            <p className="text-xs text-slate-500 mb-6 max-w-sm">
              You match the requirements for this study. Transferring you to the research survey now...
            </p>

            <div className="w-full p-4 rounded-2xl bg-slate-50 border border-slate-150 text-left">
              <div className="text-xs font-semibold text-indigo-600 mb-1 flex items-center gap-2">
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                Connecting to study...
              </div>
              <div className="text-[11px] text-slate-400 truncate font-mono">
                {finalUrl || "Preparing secure survey link..."}
              </div>
            </div>
          </div>
        )}

        {/* State 4: Disqualified (Status 20) */}
        {status === "disqualified" && (
          <div className="py-10 text-center flex flex-col items-center">
            <div className="w-14 h-14 rounded-full bg-amber-50 text-amber-600 flex items-center justify-center mb-4">
              <AlertTriangle className="w-8 h-8" />
            </div>
            <h3 className="text-lg font-bold text-slate-800 mb-1">Survey Screening Notice</h3>
            <p className="text-xs text-slate-500 mb-6 max-w-sm">
              {blockReason || "Thank you for your time. Unfortunately, the demographic profile needed for this specific survey has already been fulfilled or does not match."}
            </p>

            <a
              href={`#/callback?status=20&uid=${encodeURIComponent(uid)}&vid=${encodeURIComponent(vid)}&pid=${encodeURIComponent(pid)}&reason=demographic_screenout`}
              className="inline-flex items-center justify-center px-8 py-3 rounded-full bg-slate-900 hover:bg-slate-800 text-white text-sm font-semibold shadow-sm transition-all"
            >
              View Screening Notice
            </a>
          </div>
        )}

        {/* State 5: Security Block (Status 40) */}
        {status === "blocked" && (
          <div className="py-10 text-center flex flex-col items-center">
            <div className="w-14 h-14 rounded-full bg-red-50 text-red-600 flex items-center justify-center mb-4">
              <AlertTriangle className="w-8 h-8" />
            </div>
            <h3 className="text-lg font-bold text-slate-800 mb-1">Verification Unsuccessful</h3>
            <p className="text-xs text-slate-500 mb-6 max-w-sm">
              {blockReason || "This session could not be verified by the security screening gate."}
            </p>

            <a
              href={`#/callback?status=40&uid=${encodeURIComponent(uid)}&vid=${encodeURIComponent(vid)}&pid=${encodeURIComponent(pid)}&reason=security_risk`}
              className="inline-flex items-center justify-center px-8 py-3 rounded-full bg-slate-900 hover:bg-slate-800 text-white text-sm font-semibold shadow-sm transition-all"
            >
              View Security Notice
            </a>
          </div>
        )}
      </div>
    </div>
  );
}
