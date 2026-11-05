import { useEffect, useRef, useState } from "react";
import { CheckCircle2, AlertTriangle, ShieldCheck, ArrowRight, RefreshCw, Smartphone, Monitor } from "lucide-react";
import { supabase } from "../lib/supabase";

interface Question {
  id: string;
  title: string;
  subtitle?: string;
  options: { id: string; label: string; disqualify?: boolean }[];
}

const QUESTIONS: Question[] = [
  {
    id: "age",
    title: "What is your current age?",
    subtitle: "Please select your age bracket to find matching research studies.",
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
    subtitle: "Demographic qualification for survey quota distribution.",
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
    subtitle: "Certain surveys require specific professional experience.",
    options: [
      { id: "full_time", label: "Employed Full-Time (35+ hrs/week)" },
      { id: "part_time", label: "Employed Part-Time" },
      { id: "self_employed", label: "Self-Employed / Business Owner" },
      { id: "student", label: "Student" },
      { id: "homemaker", label: "Homemaker / Caregiver" },
      { id: "retired", label: "Retired" },
      { id: "seeking", label: "Currently seeking employment" },
    ],
  },
];

export function Prescreener() {
  const [step, setStep] = useState<number>(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [status, setStatus] = useState<"checking" | "screening" | "connecting" | "disqualified" | "blocked">("checking");
  const [blockReason, setBlockReason] = useState<string>("");
  const [redirectCountdown, setRedirectCountdown] = useState<number>(3);
  const [finalUrl, setFinalUrl] = useState<string>("");

  // Parse URL Parameters from window.location.hash or search
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

  // Initial Security & Safeguard Check
  useEffect(() => {
    const timer = setTimeout(async () => {
      // 1. Check duplicate UID in Supabase fraud logs or leads
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
    }, 700);

    return () => clearTimeout(timer);
  }, [uid, pid]);

  // Handle Question Answer
  const handleSelectOption = (qId: string, opt: { id: string; label: string; disqualify?: boolean }) => {
    setAnswers((prev) => ({ ...prev, [qId]: opt.id }));

    if (opt.disqualify) {
      setStatus("disqualified");
      setBlockReason("Demographic criteria screening requirements were not met for this specific study.");
      return;
    }

    if (step < QUESTIONS.length - 1) {
      setStep((prev) => prev + 1);
    } else {
      // All questions passed! Connect to survey
      completeScreener();
    }
  };

  const completeScreener = () => {
    setStatus("connecting");

    // Resolve Final Target Survey URL
    let resolved = targetParam;
    if (!resolved) {
      // Default live Zamplia Survey router
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

    // Countdown and redirect
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

  const currentQ = QUESTIONS[step];

  return (
    <div className="min-h-screen w-full bg-[#0a0d14] text-[#f5f5f7] flex flex-col items-center justify-center p-4 sm:p-6 font-[-apple-system,BlinkMacSystemFont,'SF_Pro_Text','Inter',sans-serif]">
      {/* Background radial glow */}
      <div className="fixed inset-0 pointer-events-none bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-blue-900/20 via-transparent to-transparent" />

      {/* Main Apple-Style Card */}
      <div className="relative w-full max-w-lg bg-[#141824]/90 backdrop-blur-2xl border border-white/10 rounded-3xl p-6 sm:p-8 shadow-2xl shadow-black/60">
        {/* Brand Header */}
        <div className="flex items-center justify-between pb-6 border-b border-white/10 mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-500/30">
              <ShieldCheck className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="text-sm font-semibold text-white tracking-wide">VMH GROUP'S SMR</div>
              <div className="text-xs text-white/50">Verified Respondent Verification</div>
            </div>
          </div>
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-medium">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            Live Gateway
          </div>
        </div>

        {/* State 1: Checking Safeguards */}
        {status === "checking" && (
          <div className="py-12 text-center flex flex-col items-center">
            <div className="w-12 h-12 rounded-full border-3 border-blue-500/20 border-t-blue-500 animate-spin mb-4" />
            <h3 className="text-base font-semibold text-white mb-1">Verifying security safeguards...</h3>
            <p className="text-xs text-white/60">Checking study qualification and quota parameters</p>
          </div>
        )}

        {/* State 2: Active Screening Questions */}
        {status === "screening" && currentQ && (
          <div>
            {/* Progress indicators */}
            <div className="flex items-center justify-between text-xs text-white/50 mb-2">
              <span>Question {step + 1} of {QUESTIONS.length}</span>
              <span>{Math.round(((step + 1) / QUESTIONS.length) * 100)}% Complete</span>
            </div>
            <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden mb-6">
              <div
                className="h-full bg-gradient-to-r from-blue-500 to-indigo-500 transition-all duration-300"
                style={{ width: `${((step + 1) / QUESTIONS.length) * 100}%` }}
              />
            </div>

            {/* Question Details */}
            <h2 className="text-xl font-bold text-white mb-2 tracking-tight">{currentQ.title}</h2>
            {currentQ.subtitle && (
              <p className="text-xs text-white/60 mb-6">{currentQ.subtitle}</p>
            )}

            {/* Option Buttons */}
            <div className="space-y-2.5">
              {currentQ.options.map((opt) => (
                <button
                  key={opt.id}
                  onClick={() => handleSelectOption(currentQ.id, opt)}
                  className="w-full text-left px-4 py-3.5 rounded-2xl bg-white/[0.04] hover:bg-blue-500/10 border border-white/10 hover:border-blue-500/40 text-sm font-medium text-white/90 hover:text-white transition-all duration-150 flex items-center justify-between group active:scale-[0.99]"
                >
                  <span>{opt.label}</span>
                  <ArrowRight className="w-4 h-4 text-white/30 group-hover:text-blue-400 group-hover:translate-x-0.5 transition-all" />
                </button>
              ))}
            </div>

            {/* Respondent Meta Footnote */}
            <div className="mt-6 pt-4 border-t border-white/5 flex items-center justify-between text-[11px] text-white/40">
              <span>Study #{pid}</span>
              <span>UID: {uid.substring(0, 14)}...</span>
            </div>
          </div>
        )}

        {/* State 3: Connecting to Survey */}
        {status === "connecting" && (
          <div className="py-8 text-center flex flex-col items-center">
            <div className="w-14 h-14 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center mb-4">
              <CheckCircle2 className="w-7 h-7" />
            </div>
            <h3 className="text-lg font-bold text-white mb-1">Pre-Screening Verified!</h3>
            <p className="text-xs text-white/60 mb-6">
              You match the requirements for Study #{pid}. Transferring you to the research survey now...
            </p>

            <div className="w-full p-4 rounded-2xl bg-blue-500/10 border border-blue-500/20 mb-6 text-left">
              <div className="text-xs font-semibold text-blue-300 mb-1 flex items-center gap-2">
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                Redirecting in {redirectCountdown}s...
              </div>
              <div className="text-[11px] text-white/50 truncate font-mono">
                {finalUrl || "Preparing secure token transfer..."}
              </div>
            </div>

            <a
              href={finalUrl || "#"}
              className="inline-flex items-center justify-center gap-2 w-full px-5 py-3 rounded-2xl bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold shadow-lg shadow-blue-500/25 transition-all"
            >
              Continue to Survey Immediately
              <ArrowRight className="w-4 h-4" />
            </a>
          </div>
        )}

        {/* State 4: Disqualified (Status 20) */}
        {status === "disqualified" && (
          <div className="py-8 text-center flex flex-col items-center">
            <div className="w-14 h-14 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center mb-4">
              <AlertTriangle className="w-7 h-7" />
            </div>
            <h3 className="text-lg font-bold text-white mb-1">Study Disqualification</h3>
            <p className="text-xs text-white/60 mb-6 max-w-sm">
              {blockReason || "Thank you for your interest. Unfortunately, your demographic criteria did not match the specific quotas required for this study."}
            </p>

            <a
              href={`https://api.vmhgroupsmr.com/survey/callback?status=20&uid=${encodeURIComponent(uid)}&vid=${encodeURIComponent(vid)}&pid=${encodeURIComponent(pid)}&reason=demographic_screenout`}
              className="inline-flex items-center justify-center gap-2 w-full px-5 py-3 rounded-2xl bg-white/10 hover:bg-white/15 text-white text-sm font-medium transition-all"
            >
              Return to Supplier Portal
            </a>
          </div>
        )}

        {/* State 5: Security Block (Status 40) */}
        {status === "blocked" && (
          <div className="py-8 text-center flex flex-col items-center">
            <div className="w-14 h-14 rounded-full bg-red-500/10 border border-red-500/20 text-red-400 flex items-center justify-center mb-4">
              <AlertTriangle className="w-7 h-7" />
            </div>
            <h3 className="text-lg font-bold text-white mb-1">Security Gate Block</h3>
            <p className="text-xs text-white/60 mb-6 max-w-sm">
              {blockReason || "This session was flagged by our real-time security gate."}
            </p>

            <a
              href={`https://api.vmhgroupsmr.com/survey/callback?status=40&uid=${encodeURIComponent(uid)}&vid=${encodeURIComponent(vid)}&pid=${encodeURIComponent(pid)}&reason=security_risk`}
              className="inline-flex items-center justify-center gap-2 w-full px-5 py-3 rounded-2xl bg-white/10 hover:bg-white/15 text-white text-sm font-medium transition-all"
            >
              Exit Verification Gate
            </a>
          </div>
        )}
      </div>

      {/* Floating Developer Test Bar (Visible for test runs) */}
      {isTest && (
        <div className="mt-6 flex flex-wrap items-center justify-center gap-2 p-3 bg-black/60 backdrop-blur-md border border-white/15 rounded-2xl text-xs max-w-md w-full">
          <span className="font-semibold text-blue-400">Test Mode Active:</span>
          <button
            onClick={completeScreener}
            className="px-2.5 py-1 rounded-lg bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30"
          >
            Force Pass (10)
          </button>
          <button
            onClick={() => {
              setStatus("disqualified");
              setBlockReason("Simulated screenout test");
            }}
            className="px-2.5 py-1 rounded-lg bg-amber-500/20 text-amber-300 hover:bg-amber-500/30"
          >
            Simulate Term (20)
          </button>
          <button
            onClick={() => {
              setStatus("blocked");
              setBlockReason("Simulated fraud risk test");
            }}
            className="px-2.5 py-1 rounded-lg bg-red-500/20 text-red-300 hover:bg-red-500/30"
          >
            Simulate Fraud (40)
          </button>
        </div>
      )}
    </div>
  );
}
