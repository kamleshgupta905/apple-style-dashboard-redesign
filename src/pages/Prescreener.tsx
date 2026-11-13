import { useEffect, useState } from "react";
import { CheckCircle2, AlertTriangle, RefreshCw, ShieldCheck } from "lucide-react";
import { supabase } from "../lib/supabase";
import {
  recordStudyClickAndCheckAutoPause,
  findNextAvailableStudy,
  markStudyAttempted,
} from "../lib/waterfall";

interface Question {
  id: string;
  title: string;
  options: { id: string; label: string; disqualify?: boolean }[];
}

const QUESTIONS: Question[] = [
  {
    id: "age",
    title: "What is your age group?",
    options: [
      { id: "18_24", label: "18 – 24 years old" },
      { id: "25_34", label: "25 – 34 years old" },
      { id: "35_49", label: "35 – 49 years old" },
      { id: "50_plus", label: "50 years or older" },
    ],
  },
  {
    id: "device",
    title: "Which device are you primarily using to take this survey?",
    options: [
      { id: "mobile", label: "Smartphone (iOS or Android)" },
      { id: "desktop", label: "Laptop / Desktop Computer" },
      { id: "tablet", label: "Tablet / iPad" },
      { id: "other", label: "Other connected device" },
    ],
  },
];

export function Prescreener() {
  const [step, setStep] = useState<number>(0);
  const [selectedOption, setSelectedOption] = useState<string>("");
  const [isAdvancing, setIsAdvancing] = useState<boolean>(false);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [status, setStatus] = useState<"checking" | "screening" | "connecting" | "disqualified" | "blocked">("checking");
  const [blockReason, setBlockReason] = useState<string>("");
  const [redirectCountdown, setRedirectCountdown] = useState<number>(3);
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

  const currentQ = QUESTIONS[step];
  const percent = Math.round(((step + 1) / QUESTIONS.length) * 100);

  // Auto-advance on option click (No Next button required)
  const handleSelect = (opt: { id: string; label: string; disqualify?: boolean }) => {
    if (isAdvancing) return;
    setSelectedOption(opt.id);
    setIsAdvancing(true);

    setAnswers((prev) => ({ ...prev, [currentQ.id]: opt.id }));

    setTimeout(() => {
      if (opt.disqualify) {
        window.location.hash = `#/callback?status=20&pid=${encodeURIComponent(pid)}&uid=${encodeURIComponent(uid)}&vid=${encodeURIComponent(vid)}&reason=demographic_criteria_not_met`;
        return;
      }

      if (step < QUESTIONS.length - 1) {
        setStep((prev) => prev + 1);
        setSelectedOption("");
        setIsAdvancing(false);
      } else {
        completeScreener();
      }
    }, 220);
  };

  const completeScreener = () => {
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

        {/* State 2: Active Screening Questions (Auto-advance on click) */}
        {status === "screening" && currentQ && (
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

            {/* Question Title */}
            <h2 className="text-[17px] sm:text-[18px] font-bold text-[#1e293b] text-center leading-snug mb-7 max-w-md mx-auto">
              {currentQ.title}
            </h2>

            {/* Answer Options */}
            <div className="space-y-3">
              {currentQ.options.map((opt) => {
                const isSelected = selectedOption === opt.id;
                return (
                  <label
                    key={opt.id}
                    onClick={() => handleSelect(opt)}
                    className={`flex items-center gap-3.5 px-4.5 py-3.5 rounded-2xl border transition-all cursor-pointer select-none ${
                      isSelected
                        ? "border-indigo-500 bg-indigo-50/30 shadow-sm"
                        : "border-slate-200/90 hover:border-slate-300 hover:bg-slate-50/50 bg-white"
                    }`}
                  >
                    {/* Radio Indicator */}
                    <div
                      className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors ${
                        isSelected ? "border-indigo-600 bg-white" : "border-slate-300 bg-white"
                      }`}
                    >
                      {isSelected && <div className="w-2.5 h-2.5 rounded-full bg-indigo-600" />}
                    </div>
                    {/* Text Label */}
                    <span className="text-[14.5px] font-medium text-slate-700 leading-snug">
                      {opt.label}
                    </span>
                  </label>
                );
              })}
            </div>
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
