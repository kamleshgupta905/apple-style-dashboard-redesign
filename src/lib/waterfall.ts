import { supabase } from "./supabase";
import { num } from "./utils";

export interface NextStudyCandidate {
  project_id: string;
  project_name: string;
  live_url: string | null;
  cpi: number;
}

export interface SecurityPolicyConfig {
  preScreenEnabled: boolean;
  excludeDuplicates: boolean;
  geoLocationValidation: boolean;
  dynamicThanksUrl: boolean;
  verifyEmail: boolean;
  speederCheck: boolean;
  lhProtection: boolean;
  fraudCops: boolean;
  vpnDetection: boolean;
  botProtection: boolean;
  browserSecurity: boolean;
  textAnalyzer: boolean;
  motionDetection: boolean;
  rocSecurity: boolean;
  offLocationHour: boolean;
  excludeGroup: boolean;
  allowDesktop: boolean;
  allowMobile: boolean;
  allowTablet: boolean;
  uniqueIpLimit: number;
  speederThresholdPercent: number;
}

export const DEFAULT_SECURITY_POLICY: SecurityPolicyConfig = {
  preScreenEnabled: true,
  excludeDuplicates: true,
  geoLocationValidation: true,
  dynamicThanksUrl: false,
  verifyEmail: false,
  speederCheck: true,
  lhProtection: true,
  fraudCops: true,
  vpnDetection: true,
  botProtection: true,
  browserSecurity: true,
  textAnalyzer: false,
  motionDetection: false,
  rocSecurity: false,
  offLocationHour: false,
  excludeGroup: false,
  allowDesktop: true,
  allowMobile: true,
  allowTablet: true,
  uniqueIpLimit: 1,
  speederThresholdPercent: 0.3,
};

/**
 * Load global Security & Fraud policy from Supabase `smr_security_policy`
 */
export async function getSecurityPolicy(): Promise<SecurityPolicyConfig> {
  const policy: SecurityPolicyConfig = { ...DEFAULT_SECURITY_POLICY };
  try {
    const { data: rows } = await supabase.from("smr_security_policy").select("key, value");
    (rows || []).forEach((r: any) => {
      if (r.key && r.value !== undefined && r.key in policy) {
        (policy as any)[r.key] = r.value;
      }
    });
  } catch (e) {
    console.warn("Could not load smr_security_policy, using defaults:", e);
  }
  return policy;
}

/**
 * Look up project's client security & hashing settings
 */
export async function getStudyClientConfig(pid: string): Promise<{
  securityEnabled: boolean;
  loi: number;
  hashAlgorithm: string;
  secretKey: string;
}> {
  const defaults = { securityEnabled: true, loi: 10, hashAlgorithm: "none", secretKey: "" };
  if (!pid) return defaults;

  try {
    const { data: proj } = await supabase
      .from("smr_projects")
      .select("project_id, loi, client_id, client_name")
      .eq("project_id", pid)
      .maybeSingle();

    if (!proj) return defaults;

    const loi = num(proj.loi, 10) || 10;
    let client: any = null;

    if (proj.client_id) {
      const { data: cById } = await supabase
        .from("smr_clients")
        .select("security_enabled, hash_algorithm, secret_key")
        .eq("id", proj.client_id)
        .maybeSingle();
      client = cById;
    }
    if (!client && proj.client_name) {
      const { data: cByName } = await supabase
        .from("smr_clients")
        .select("security_enabled, hash_algorithm, secret_key")
        .eq("client_name", proj.client_name)
        .maybeSingle();
      client = cByName;
    }

    return {
      securityEnabled: client ? Number(client.security_enabled ?? 1) !== 0 : true,
      loi,
      hashAlgorithm: String(client?.hash_algorithm || "none").toLowerCase(),
      secretKey: String(client?.secret_key || ""),
    };
  } catch {
    return defaults;
  }
}

export function detectHardwareDevice(userAgent?: string): "Desktop" | "Mobile" | "Tablet" {
  const ua = (userAgent || (typeof navigator !== "undefined" ? navigator.userAgent : "")).toLowerCase();
  if (/ipad|tablet|playbook|silk|(android(?!.*mobile))/i.test(ua)) return "Tablet";
  if (/mobile|iphone|ipod|android|blackberry|iemobile|opera mini/i.test(ua)) return "Mobile";
  return "Desktop";
}

async function logSecurityBlock(params: {
  pid: string;
  vid: string;
  uid: string;
  reason: string;
  checkType: string;
  riskScore: number;
  device: string;
}): Promise<void> {
  try {
    await supabase.from("smr_fraud_logs").insert([
      {
        project_id: params.pid,
        vendor: params.vid || "Direct",
        uid: params.uid,
        reason: params.reason,
        check_type: params.checkType,
        risk_score: params.riskScore,
        device: params.device,
        action: "BLOCKED",
        created_at: new Date().toISOString(),
      },
    ]);
  } catch {}
}

/**
 * Real-time Live Entrance Security Gate (runs on Prescreener entry)
 */
export async function evaluateLiveEntranceSecurity(opts: {
  pid: string;
  vid: string;
  uid: string;
  isTest?: boolean;
}): Promise<{
  allowed: boolean;
  reason?: string;
  checkType?: string;
  riskScore: number;
  policy: SecurityPolicyConfig;
  clientSecurityEnabled: boolean;
}> {
  const [policy, clientCfg] = await Promise.all([
    getSecurityPolicy(),
    getStudyClientConfig(opts.pid),
  ]);
  const device = detectHardwareDevice();

  // 1. Always respect existing explicit block records in smr_fraud_logs
  try {
    const { data: existingFraud } = await supabase
      .from("smr_fraud_logs")
      .select("id, reason, check_type")
      .eq("uid", opts.uid)
      .eq("project_id", opts.pid)
      .limit(1)
      .maybeSingle();

    if (existingFraud) {
      return {
        allowed: false,
        reason: existingFraud.reason || existingFraud.check_type || "Session previously flagged by security gate",
        checkType: existingFraud.check_type || "Security Block",
        riskScore: 90,
        policy,
        clientSecurityEnabled: clientCfg.securityEnabled,
      };
    }
  } catch {}

  if (!clientCfg.securityEnabled || opts.isTest) {
    return {
      allowed: true,
      riskScore: 5,
      policy,
      clientSecurityEnabled: clientCfg.securityEnabled,
    };
  }

  // 2. Bot & Browser Integrity Check
  if (policy.botProtection || policy.browserSecurity) {
    const ua = (typeof navigator !== "undefined" ? navigator.userAgent : "").toLowerCase();
    const isWebDriver = typeof navigator !== "undefined" && Boolean((navigator as any).webdriver);
    const botPattern = /(python-requests|curl\/|wget|bot|spider|crawler|headlesschrome|puppeteer|selenium|playwright|scraper)/i.test(ua);

    if ((policy.botProtection && (isWebDriver || botPattern)) || (policy.browserSecurity && isWebDriver)) {
      const reason = isWebDriver
        ? "Automated browser / WebDriver marker detected"
        : "Automated bot user-agent detected";
      await logSecurityBlock({
        pid: opts.pid,
        vid: opts.vid,
        uid: opts.uid,
        reason,
        checkType: "Bot / Browser Security",
        riskScore: 95,
        device,
      });
      return {
        allowed: false,
        reason,
        checkType: "Bot / Browser Security",
        riskScore: 95,
        policy,
        clientSecurityEnabled: true,
      };
    }
  }

  // 3. Hardware Device Policy Check
  if (
    (device === "Desktop" && policy.allowDesktop === false) ||
    (device === "Mobile" && policy.allowMobile === false) ||
    (device === "Tablet" && policy.allowTablet === false)
  ) {
    const reason = `${device} devices are restricted by active study security policy`;
    await logSecurityBlock({
      pid: opts.pid,
      vid: opts.vid,
      uid: opts.uid,
      reason,
      checkType: "Device Policy Block",
      riskScore: 80,
      device,
    });
    return {
      allowed: false,
      reason,
      checkType: "Device Policy Block",
      riskScore: 80,
      policy,
      clientSecurityEnabled: true,
    };
  }

  // 4. Duplicate Respondent Check against smr_leads
  if (policy.excludeDuplicates && opts.uid) {
    try {
      const { data: priorLeads } = await supabase
        .from("smr_leads")
        .select("id, status, created_at")
        .eq("uid", opts.uid)
        .eq("project_id", opts.pid)
        .limit(3);

      const hasDuplicate = (priorLeads || []).some((l: any) => {
        const st = String(l.status || "").toLowerCase();
        if (st && st !== "pending") return true;
        // Pending within last 24h is also duplicate entry
        const ageMs = l.created_at ? Date.now() - Date.parse(l.created_at) : 0;
        return ageMs >= 0 && ageMs < 86400000;
      });

      if (hasDuplicate) {
        const reason = "Duplicate respondent session: already attempted this study";
        await logSecurityBlock({
          pid: opts.pid,
          vid: opts.vid,
          uid: opts.uid,
          reason,
          checkType: "Duplicate Check",
          riskScore: 85,
          device,
        });
        return {
          allowed: false,
          reason,
          checkType: "Duplicate Check",
          riskScore: 85,
          policy,
          clientSecurityEnabled: true,
        };
      }
    } catch {}
  }

  return {
    allowed: true,
    riskScore: 5,
    policy,
    clientSecurityEnabled: true,
  };
}

/**
 * Evaluate Speeder Check on Survey Complete (Status 10)
 */
export async function checkSpeederOnComplete(opts: {
  pid: string;
  vid: string;
  uid: string;
  isTest?: boolean;
}): Promise<{ isSpeeder: boolean; elapsedSec: number; minRequiredSec: number }> {
  if (opts.isTest || !opts.uid || !opts.pid) {
    return { isSpeeder: false, elapsedSec: 0, minRequiredSec: 0 };
  }

  try {
    const [policy, clientCfg] = await Promise.all([
      getSecurityPolicy(),
      getStudyClientConfig(opts.pid),
    ]);

    if (!policy.speederCheck || !clientCfg.securityEnabled) {
      return { isSpeeder: false, elapsedSec: 0, minRequiredSec: 0 };
    }

    const { data: lead } = await supabase
      .from("smr_leads")
      .select("created_at")
      .eq("uid", opts.uid)
      .eq("project_id", opts.pid)
      .order("id", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!lead?.created_at) {
      return { isSpeeder: false, elapsedSec: 0, minRequiredSec: 0 };
    }

    const startMs = Date.parse(lead.created_at);
    if (Number.isNaN(startMs)) {
      return { isSpeeder: false, elapsedSec: 0, minRequiredSec: 0 };
    }

    const elapsedSec = Math.max(1, Math.floor((Date.now() - startMs) / 1000));
    const thresholdRatio = Number(policy.speederThresholdPercent) || 0.3;
    const minRequiredSec = Math.round(clientCfg.loi * 60 * thresholdRatio);

    if (minRequiredSec > 0 && elapsedSec < minRequiredSec) {
      const reason = `Speeder Violation: completed in ${elapsedSec}s (minimum ${minRequiredSec}s for ${clientCfg.loi}m LOI)`;
      await logSecurityBlock({
        pid: opts.pid,
        vid: opts.vid,
        uid: opts.uid,
        reason,
        checkType: "Speeder Check",
        riskScore: 95,
        device: detectHardwareDevice(),
      });
      return { isSpeeder: true, elapsedSec, minRequiredSec };
    }

    return { isSpeeder: false, elapsedSec, minRequiredSec };
  } catch {
    return { isSpeeder: false, elapsedSec: 0, minRequiredSec: 0 };
  }
}

function bytesToHex(buf: ArrayBuffer): string {
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function computeWebCryptoHash(algorithm: string, message: string, secretKey: string): Promise<string | null> {
  if (typeof window === "undefined" || !window.crypto?.subtle) return null;
  const enc = new TextEncoder();
  const alg = algorithm.toLowerCase();

  try {
    if (alg === "hmac-sha256" || alg === "hmac_sha256") {
      const key = await window.crypto.subtle.importKey(
        "raw",
        enc.encode(secretKey),
        { name: "HMAC", hash: "SHA-256" },
        false,
        ["sign"],
      );
      const sig = await window.crypto.subtle.sign("HMAC", key, enc.encode(message));
      return bytesToHex(sig);
    }
    if (alg === "sha256" || alg === "sha-256") {
      const digest = await window.crypto.subtle.digest("SHA-256", enc.encode(message));
      return bytesToHex(digest);
    }
    if (alg === "sha512" || alg === "sha-512") {
      const digest = await window.crypto.subtle.digest("SHA-512", enc.encode(message));
      return bytesToHex(digest);
    }
  } catch {}
  return null;
}

/**
 * Sign an outbound URL or template containing [HASH] using Web Crypto if client algorithm is supported
 */
export async function signUrlIfNeeded(url: string, pid: string, uid: string): Promise<string> {
  if (!url || !/\[HASH\]|\{\{HASH\}\}/i.test(url)) return url;
  const cfg = await getStudyClientConfig(pid);
  if (!cfg.secretKey || cfg.hashAlgorithm === "none") {
    return url.replace(/(\?|&)?(hash|sig)=\[HASH\]/gi, "").replace(/\[HASH\]|\{\{HASH\}\}/gi, "");
  }
  const cleanBase = url.replace(/(\?|&)?(hash|sig)=(\[HASH\]|\{\{HASH\}\})/gi, "");
  const payload = cfg.hashAlgorithm.includes("hmac") ? cleanBase : `${cleanBase}${cfg.secretKey}`;
  const hex = await computeWebCryptoHash(cfg.hashAlgorithm, payload, cfg.secretKey);
  if (!hex) {
    // Fallback digest if client uses SHA3-256/MD5 (full SHA3-256 requires server-side PHP/Edge)
    const fallbackHex = await computeWebCryptoHash("sha256", `${uid}${cfg.secretKey}`, cfg.secretKey);
    return url.replace(/\[HASH\]|\{\{HASH\}\}/gi, fallbackHex || "");
  }
  return url.replace(/\[HASH\]|\{\{HASH\}\}/gi, hex);
}

/**
 * Verify an incoming callback's redirect hash (`&hash=`, `&sig=`, `&hmac=`) against the client's configured algorithm & secret key
 */
export async function verifyIncomingRedirectHash(opts: {
  pid: string;
  vid: string;
  uid: string;
  fullUrl: string;
  providedHash: string;
}): Promise<{ checked: boolean; valid: boolean; reason?: string }> {
  if (!opts.providedHash) {
    return { checked: false, valid: true };
  }

  const cfg = await getStudyClientConfig(opts.pid);
  if (!cfg.secretKey || !cfg.hashAlgorithm || cfg.hashAlgorithm === "none") {
    return { checked: false, valid: true };
  }

  // SHA3-256 and MD5 are not supported natively by browser SubtleCrypto (handled by PHP server gateway)
  if (cfg.hashAlgorithm.includes("sha3") || cfg.hashAlgorithm.includes("md5")) {
    return { checked: false, valid: true };
  }

  const provided = opts.providedHash.trim().toLowerCase();
  const baseWithoutHash = opts.fullUrl.replace(/([?&])(hash|sig|signature|hmac)=[^&]*/gi, "").replace(/[?&]$/, "");
  const candidates = cfg.hashAlgorithm.includes("hmac")
    ? [baseWithoutHash, opts.uid, `${opts.uid}:${opts.pid}`]
    : [
        `${baseWithoutHash}${cfg.secretKey}`,
        `${opts.uid}${cfg.secretKey}`,
        `${cfg.secretKey}${opts.uid}`,
        `${opts.uid}:${opts.pid}:${cfg.secretKey}`,
      ];

  for (const msg of candidates) {
    const computed = await computeWebCryptoHash(cfg.hashAlgorithm, msg, cfg.secretKey);
    if (computed && computed.toLowerCase() === provided) {
      return { checked: true, valid: true };
    }
  }

  const reason = `Redirect URL hash signature mismatch (${cfg.hashAlgorithm.toUpperCase()})`;
  await logSecurityBlock({
    pid: opts.pid,
    vid: opts.vid,
    uid: opts.uid,
    reason,
    checkType: "Redirect Hash Verification",
    riskScore: 95,
    device: detectHardwareDevice(),
  });
  return { checked: true, valid: false, reason };
}

/**
 * Retrieve the list of study IDs already attempted by this respondent UID
 */
export function getAttemptedStudies(uid: string): string[] {
  try {
    const raw = sessionStorage.getItem(`smr_attempted_${uid}`);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed.map(String);
    }
  } catch {}
  return [];
}

/**
 * Mark a study ID as attempted by this respondent UID
 */
export function markStudyAttempted(uid: string, pid: string): void {
  if (!uid || !pid) return;
  try {
    const existing = getAttemptedStudies(uid);
    if (!existing.includes(String(pid))) {
      existing.push(String(pid));
      sessionStorage.setItem(`smr_attempted_${uid}`, JSON.stringify(existing));
    }
  } catch {}
}

/**
 * Track an entrance / click for a study and automatically enforce the auto-pause condition:
 * If a study reaches `auto_pause_clicks` (default 50, or user configured limit like 10, 30, etc.)
 * with 0 completes, automatically set status to "Pause"!
 */
export async function recordStudyClickAndCheckAutoPause(
  pid: string,
  vid: string,
  uid: string,
): Promise<{ autoPaused: boolean; isLive: boolean; clicks: number; autoPauseLimit: number; liveUrl?: string }> {
  markStudyAttempted(uid, pid);

  try {
    // 1. Fetch current study state from smr_projects
    const { data: proj, error } = await supabase
      .from("smr_projects")
      .select("id, project_id, project_name, status, total_clicks, total_completes, auto_pause_clicks, live_url")
      .eq("project_id", pid)
      .maybeSingle();

    if (error || !proj) {
      return { autoPaused: false, isLive: true, clicks: 1, autoPauseLimit: 50 };
    }

    const currentClicks = num(proj.total_clicks, 0) + 1;
    const currentCompletes = num(proj.total_completes, 0);
    const autoPauseLimit = num(proj.auto_pause_clicks, 50);

    const shouldAutoPause =
      autoPauseLimit > 0 &&
      currentClicks >= autoPauseLimit &&
      currentCompletes === 0 &&
      proj.status === "Live";

    // 2. Update smr_projects with latest clicks & auto-pause status if triggered
    if (shouldAutoPause) {
      console.warn(`[Auto-Pause Triggered] Study #${pid} reached ${currentClicks} clicks with 0 completes (limit: ${autoPauseLimit}). Auto-pausing study.`);
      await supabase
        .from("smr_projects")
        .update({
          status: "Pause",
          total_clicks: currentClicks,
          updated_at: new Date().toISOString(),
        })
        .eq("project_id", pid);
    } else {
      await supabase
        .from("smr_projects")
        .update({
          total_clicks: currentClicks,
          updated_at: new Date().toISOString(),
        })
        .eq("project_id", pid);
    }

    // 3. Record click in smr_leads for live lead stream & analytics
    try {
      const isMobile = /mobile|android|iphone|ipad/i.test(navigator.userAgent || "");
      const dev = isMobile ? "Mobile" : "Desktop";
      const now = new Date().toISOString();
      const { error: leadInsertErr } = await supabase.from("smr_leads").insert([
        {
          project_id: pid,
          project_name: proj.project_name || pid,
          vendor_code: vid || "Direct",
          vendor_name: vid || "Direct",
          uid,
          status: "Pending",
          device: dev,
          ip_address: "Live Session",
          country: "—",
          created_at: now,
        },
      ]);
      if (leadInsertErr) {
        await supabase.from("smr_leads").insert([
          {
            project_id: pid,
            project_name: proj.project_name || pid,
            vendor: vid || "Direct",
            uid,
            status: "Pending",
            device: dev,
            ip: "Live Session",
            created_at: now,
          },
        ]);
      }
    } catch (leadErr) {
      console.warn("Could not insert smr_lead record:", leadErr);
    }

    return {
      autoPaused: shouldAutoPause,
      isLive: !shouldAutoPause && proj.status === "Live",
      clicks: currentClicks,
      autoPauseLimit,
      liveUrl: proj.live_url || undefined,
    };
  } catch (e) {
    console.warn("Click tracking error:", e);
    return { autoPaused: false, isLive: true, clicks: 1, autoPauseLimit: 50 };
  }
}

/**
 * Record a successful completion (Status 10) in smr_projects, smr_vendor_allotments & smr_leads
 */
export async function recordStudyComplete(pid: string, vid: string, uid: string): Promise<void> {
  markStudyAttempted(uid, pid);

  try {
    // 1. Increment total_completes in smr_projects
    const { data: proj } = await supabase
      .from("smr_projects")
      .select("id, total_completes")
      .eq("project_id", pid)
      .maybeSingle();

    if (proj) {
      const newCompletes = num(proj.total_completes, 0) + 1;
      await supabase
        .from("smr_projects")
        .update({
          total_completes: newCompletes,
          updated_at: new Date().toISOString(),
        })
        .eq("project_id", pid);
    }

    // 2. Increment complete_count in smr_vendor_allotments if vid is present
    if (vid) {
      const { data: allot } = await supabase
        .from("smr_vendor_allotments")
        .select("id, complete_count")
        .eq("vendor_id", vid)
        .eq("project_id", pid)
        .maybeSingle();

      if (allot) {
        const newAllotComp = num(allot.complete_count, 0) + 1;
        await supabase
          .from("smr_vendor_allotments")
          .update({
            complete_count: newAllotComp,
            updated_at: new Date().toISOString(),
          })
          .eq("id", allot.id);
      }
    }

    // 3. Update lead status in smr_leads
    try {
      await supabase
        .from("smr_leads")
        .update({ status: "Complete", updated_at: new Date().toISOString() })
        .eq("uid", uid)
        .eq("project_id", pid);
    } catch {}
  } catch (err) {
    console.warn("recordStudyComplete error:", err);
  }
}

/**
 * Record a disqualification (Terminate 20, Quota Full 30, Security 40)
 */
export async function recordStudyDisqualify(
  pid: string,
  vid: string,
  uid: string,
  status: "20" | "30" | "40",
  reason?: string,
): Promise<void> {
  markStudyAttempted(uid, pid);

  const statusName = status === "20" ? "Terminate" : status === "30" ? "Overquota" : "Security";

  try {
    // Update smr_leads
    await supabase
      .from("smr_leads")
      .update({
        status: statusName,
        reason: reason || null,
        updated_at: new Date().toISOString(),
      })
      .eq("uid", uid)
      .eq("project_id", pid);
  } catch {}

  // Also log security flags if status 40
  if (status === "40") {
    try {
      await supabase.from("smr_fraud_logs").insert([
        {
          project_id: pid,
          vendor: vid || "Unknown",
          uid,
          reason: reason || "Security Policy Gate Block",
          check_type: "Waterfall Security Block",
          risk_score: 85,
          action: "BLOCKED",
          created_at: new Date().toISOString(),
        },
      ]);
    } catch {}
  }
}

/**
 * Smart Waterfall Rerouter:
 * Searches for the next available, live, non-auto-paused study that this respondent
 * has not yet attempted. Prioritizes active vendor allotments by highest CPI first,
 * then falls back to any live SMR study.
 */
export async function findNextAvailableStudy(
  currentPid: string,
  vid: string,
  uid: string,
): Promise<NextStudyCandidate | null> {
  try {
    const attempted = getAttemptedStudies(uid);
    if (currentPid && !attempted.includes(String(currentPid))) {
      attempted.push(String(currentPid));
    }

    // 1. If vid is provided, check vendor's active allotments first
    if (vid) {
      const { data: allotments } = await supabase
        .from("smr_vendor_allotments")
        .select("project_id, quota_limit, complete_count, vendor_cpi, status")
        .ilike("vendor_id", vid);

      const activeAllots = (allotments || []).filter(
        (a: any) => !a.status || ["active", "live"].includes(String(a.status).toLowerCase()),
      );

      if (activeAllots.length > 0) {
        // Filter out completed quotas and attempted projects
        const availableAllots = activeAllots.filter((a) => {
          if (attempted.includes(String(a.project_id))) return false;
          const limit = num(a.quota_limit, 0);
          const comp = num(a.complete_count, 0);
          return limit <= 0 || comp < limit;
        });

        const candidatePids = availableAllots.map((a) => String(a.project_id));

        if (candidatePids.length > 0) {
          // Check matching projects in smr_projects
          const { data: projects } = await supabase
            .from("smr_projects")
            .select("project_id, project_name, status, live_url, cpi, total_clicks, total_completes, auto_pause_clicks")
            .in("project_id", candidatePids);

          const projMap = new Map((projects || []).map((p: any) => [String(p.project_id), p]));
          const candidates: NextStudyCandidate[] = [];

          for (const a of availableAllots) {
            const pidStr = String(a.project_id);
            const p = projMap.get(pidStr);
            if (p) {
              const st = String(p.status || "").toLowerCase();
              if (!["live", "active"].includes(st)) continue;
              const th = num(p.auto_pause_clicks, 50);
              const clicks = num(p.total_clicks, 0);
              const comp = num(p.total_completes, 0);
              if (th > 0 && clicks >= th && comp === 0) {
                supabase.from("smr_projects").update({ status: "Pause" }).eq("project_id", p.project_id).then();
                continue;
              }
              candidates.push({
                project_id: pidStr,
                project_name: String(p.project_name || pidStr),
                live_url: p.live_url || null,
                cpi: num(p.cpi, num(a.vendor_cpi, 0)),
              });
            } else if (/^\d{8,12}$/.test(pidStr.trim())) {
              // Uncloned Zamplia / Marketplace numeric study directly allotted to vendor
              candidates.push({
                project_id: pidStr,
                project_name: `Study #${pidStr}`,
                live_url: null,
                cpi: num(a.vendor_cpi, 0),
              });
            }
          }

          if (candidates.length > 0) {
            candidates.sort((a, b) => num(b.cpi, 0) - num(a.cpi, 0));
            return candidates[0];
          }
        }
      }
    }

    // 2. Global Fallback: Check all live studies in smr_projects that have not been attempted
    const { data: allLive } = await supabase
      .from("smr_projects")
      .select("project_id, project_name, status, live_url, cpi, total_clicks, total_completes, auto_pause_clicks")
      .in("status", ["Live", "Active", "live", "active"]);

    const fallbackCandidates = (allLive || []).filter((p) => {
      const pidStr = String(p.project_id);
      if (attempted.includes(pidStr)) return false;
      const th = num(p.auto_pause_clicks, 50);
      const clicks = num(p.total_clicks, 0);
      const comp = num(p.total_completes, 0);
      if (th > 0 && clicks >= th && comp === 0) {
        supabase.from("smr_projects").update({ status: "Pause" }).eq("project_id", p.project_id).then();
        return false;
      }
      return true;
    });

    if (fallbackCandidates.length > 0) {
      fallbackCandidates.sort((a, b) => num(b.cpi, 0) - num(a.cpi, 0));
      const best = fallbackCandidates[0];
      return {
        project_id: String(best.project_id),
        project_name: String(best.project_name || best.project_id),
        live_url: best.live_url || null,
        cpi: num(best.cpi, 0),
      };
    }

    return null;
  } catch (err) {
    console.warn("Waterfall findNextAvailableStudy lookup error:", err);
    return null;
  }
}
