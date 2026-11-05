import { useEffect, useState } from "react";
import { CheckCircle2, AlertTriangle, RefreshCw } from "lucide-react";
import { supabase } from "../lib/supabase";

interface Question {
  id: string;
  title: string;
  options: { id: string; label: string; disqualify?: boolean }[];
}

const QUESTIONS: Question[] = [
  {
    id: "internet",
    title: "Which type of internet connection do you primarily use at home?",
    options: [
      { id: "high_speed", label: "High-speed (fiber or cable)" },
      { id: "dsl_satellite", label: "DSL or satellite" },
      { id: "mobile_data", label: "Mobile data or hotspot" },
      { id: "no_internet", label: "No home internet access" },
      { id: "psychic_mind", label: "Psychic mind connection", disqualify: true }, // Attention trap check
    ],
  },
  {
    id: "age",
    title: "What is your current age?",
    options: [
      { id: "under_18", label: "Under 18 years old", disqualify: true },
      { id: "18_24", label: "18 - 24 years old" },
      { id: "25_34", label: "25 - 34 years old" },
      { id: "35_44", label: "35 - 44 years old" },
      { id: "45_54", label: "45 - 54 years old" },
      { id: "55_plus", label: "55 years or older" },
    ],
  },
  {
    id: "gender",
    title: "What is your gender?",
    options: [
      { id: "male", label: "Male" },
      { id: "female", label: "Female" },
      { id: "non_binary", label: "Non-binary / Other" },
      { id: "prefer_not", label: "Prefer not to say" },
    ],
  },
  {
    id: "employment",
    title: "What is your current employment status?",
    options: [
      { id: "full_time", label: "Employed full-time (35+ hours/week)" },
      { id: "part_time", label: "Employed part-time" },
      { id: "self_employed", label: "Self-employed / Business owner" },
      { id: "student", label: "Student" },
      { id: "homemaker", label: "Homemaker / Caregiver" },
      { id: "retired", label: "Retired" },
      { id: "not_employed", label: "Currently not employed" },
    ],
  },
  {
    id: "decision",
    title: "Are you the primary decision maker for household purchases?",
    options: [
      { id: "primary", label: "Yes, primary decision maker" },
      { id: "shared", label: "Yes, share decisions equally" },
      { id: "secondary", label: "No, secondary or not a decision maker" },
    ],
  },
];

export function Prescreener() {
  const [step, setStep] = useState<number>(0);
  const [selectedOption, setSelectedOption] = useState<string>("");
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [status, setStatus] = useState<"checking" | "screening" | "connecting" | "disqualified" | "blocked">("checking");
  const [blockReason, setBlockReason] = useState<string>("");
  const [redirectCountdown, setRedirectCountdown] = useState<number>(3);
  const [finalUrl, setFinalUrl] = useState<string>("");

  // Parse URL Parameters
  const params = new URLSearchParams(
    window.location.hash.includes("?")
      ? window.location.hash.split("?")[1]
      : window.location.search
  );

  const vid = params.get("vid") || "VI010032025";
  const pid = params.get("pid") || "2178484718";
  const rawUid = params.get("uid") || "";
  const uid = rawUid && rawUid !== "[RESPONDENT_ID]" && rawUid !== "%5BRESPONDENT_ID%5D"
    ? rawUid
    : `RESP_${Math.random().toString(36).substring(2, 10).toUpperCase()}`;
  const targetParam = params.get("target") || "";
  const isTest = params.get("test") === "1" || uid.startsWith("TEST");

  // Browser title
  useEffect(() => {
    const prevTitle = document.title;
    document.title = "CALIBR8";
    return () => {
      document.title = prevTitle;
    };
  }, []);

  // Initial Security & Duplicate Check
  useEffect(() => {
    const timer = setTimeout(async () => {
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

      setStatus("screening");
    }, 600);

    return () => clearTimeout(timer);
  }, [uid, pid]);

  const currentQ = QUESTIONS[step];
  const percent = Math.round(((step + 1) / QUESTIONS.length) * 100);

  const handleNext = () => {
    if (!selectedOption || !currentQ) return;

    const opt = currentQ.options.find((o) => o.id === selectedOption);
    setAnswers((prev) => ({ ...prev, [currentQ.id]: selectedOption }));

    if (opt?.disqualify) {
      setStatus("disqualified");
      setBlockReason("Demographic qualification criteria were not met for this specific study.");
      return;
    }

    if (step < QUESTIONS.length - 1) {
      setStep((prev) => prev + 1);
      setSelectedOption("");
    } else {
      completeScreener();
    }
  };

  const completeScreener = () => {
    setStatus("connecting");

    // Resolve Final Target Survey URL
    let resolved = targetParam;
    if (!resolved) {
      resolved = `https://res.zamplia.com/?vid=2138&isMap=1&sid=${encodeURIComponent(pid)}&username=${encodeURIComponent(vid)}&cid=42&transaction_id=${encodeURIComponent(uid)}&rid=${encodeURIComponent(uid)}`;
    } else {
      resolved = resolved
        .replace(/\[#UID#\]/g, uid)
        .replace(/\[identifier\]/g, uid)
        .replace(/\[RESPONDENT_ID\]/g, uid)
        .replace(/\[UID\]/g, uid)
        .replace(/\[uid\]/g, uid)
        .replace(/vmhgroupss/g, uid);
      const sep = resolved.includes("?") ? "&" : "?";
      if (!resolved.includes("transaction_id") && !resolved.includes("rid") && !resolved.includes("uid=")) {
        resolved = `${resolved}${sep}transaction_id=${encodeURIComponent(uid)}&rid=${encodeURIComponent(uid)}`;
      }
    }

    setFinalUrl(resolved);

    let seconds = 3;
    const interval = setInterval(() => {
      seconds -= 1;
      setRedirectCountdown(seconds);
      if (seconds <= 0) {
        clearInterval(interval);
        window.location.href = resolved;
      }
    }, 1000);
  };

  return (
    <div className="min-h-screen w-full bg-[#f8fafc] text-slate-800 flex flex-col items-center justify-center p-4 sm:p-6 font-[-apple-system,BlinkMacSystemFont,'Segoe_UI','Inter',sans-serif]">
      {/* Centered White Card */}
      <div className="relative w-full max-w-[560px] bg-white rounded-[32px] p-7 sm:p-10 shadow-[0_20px_50px_rgba(0,0,0,0.06)] border border-slate-100">
        
        {/* State 1: Security Verification Check */}
        {status === "checking" && (
          <div className="py-14 text-center flex flex-col items-center">
            <div className="w-10 h-10 rounded-full border-2 border-emerald-500/20 border-t-emerald-600 animate-spin mb-4" />
            <h3 className="text-base font-semibold text-slate-800 mb-1">Verifying session security...</h3>
            <p className="text-xs text-slate-500">Checking study parameters and device security</p>
          </div>
        )}

        {/* State 2: Active Screening Questions (Matches user screenshot) */}
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
                    onClick={() => setSelectedOption(opt.id)}
                    className={`flex items-center gap-3.5 px-4.5 py-3.5 rounded-2xl border transition-all cursor-pointer select-none ${
                      isSelected
                        ? "border-indigo-400 bg-indigo-50/20 shadow-sm"
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

            {/* Bottom Centered Next Button */}
            <div className="mt-8 flex justify-center">
              <button
                type="button"
                onClick={handleNext}
                disabled={!selectedOption}
                className={`px-12 py-3 rounded-full text-[14.5px] font-semibold text-white transition-all duration-150 ${
                  selectedOption
                    ? "bg-[#9cb6ff] hover:bg-[#86a4ff] shadow-sm shadow-indigo-200 cursor-pointer active:scale-95"
                    : "bg-[#9cb6ff]/50 cursor-not-allowed opacity-60"
                }`}
              >
                Next
              </button>
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

            <div className="w-full p-4 rounded-2xl bg-slate-50 border border-slate-150 mb-6 text-left">
              <div className="text-xs font-semibold text-indigo-600 mb-1 flex items-center gap-2">
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                Redirecting in {redirectCountdown}s...
              </div>
              <div className="text-[11px] text-slate-400 truncate font-mono">
                {finalUrl || "Preparing secure survey link..."}
              </div>
            </div>

            <a
              href={finalUrl || "#"}
              className="inline-flex items-center justify-center px-8 py-3 rounded-full bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold shadow-md shadow-indigo-100 transition-all"
            >
              Continue to Survey Immediately
            </a>
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
              href={`https://api.vmhgroupsmr.com/survey/callback?status=20&uid=${encodeURIComponent(uid)}&vid=${encodeURIComponent(vid)}&pid=${encodeURIComponent(pid)}&reason=demographic_screenout`}
              className="inline-flex items-center justify-center px-8 py-3 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-medium transition-all"
            >
              Return to Provider
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
              href={`https://api.vmhgroupsmr.com/survey/callback?status=40&uid=${encodeURIComponent(uid)}&vid=${encodeURIComponent(vid)}&pid=${encodeURIComponent(pid)}&reason=security_risk`}
              className="inline-flex items-center justify-center px-8 py-3 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-medium transition-all"
            >
              Close Window
            </a>
          </div>
        )}
      </div>

      {/* Floating Developer Test Simulation Bar (only visible when test=1 or uid starts with TEST) */}
      {isTest && (
        <div className="mt-6 flex flex-wrap items-center justify-center gap-2 p-2.5 bg-white/90 backdrop-blur-md border border-slate-200 shadow-sm rounded-full text-xs max-w-md w-full">
          <span className="font-semibold text-slate-600 text-[11px] px-2">Test Simulation:</span>
          <button
            onClick={completeScreener}
            className="px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 hover:bg-emerald-100 font-medium"
          >
            Force Pass (10)
          </button>
          <button
            onClick={() => {
              setStatus("disqualified");
              setBlockReason("Simulated screenout test");
            }}
            className="px-3 py-1 rounded-full bg-amber-50 text-amber-700 hover:bg-amber-100 font-medium"
          >
            Term (20)
          </button>
          <button
            onClick={() => {
              setStatus("blocked");
              setBlockReason("Simulated fraud risk test");
            }}
            className="px-3 py-1 rounded-full bg-red-50 text-red-700 hover:bg-red-100 font-medium"
          >
            Fraud (40)
          </button>
        </div>
      )}
    </div>
  );
}
