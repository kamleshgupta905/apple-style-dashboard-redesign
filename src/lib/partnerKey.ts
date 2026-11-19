import { supabase } from "./supabase.ts";

const KEY_STORE_POLICY_KEY = "vendor_api_keys";

function toHex(buf: ArrayBuffer | Uint8Array): string {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let out = "";
  for (let i = 0; i < bytes.length; i++) {
    out += bytes[i].toString(16).padStart(2, "0");
  }
  return out;
}

export function isAccessKey32(val?: string | null): boolean {
  return /^[a-f0-9]{32}$/i.test(String(val || "").trim());
}

/** Generate a cryptographically random 32-char lowercase hex token. */
export function generateAccessKey32(): string {
  const bytes = new Uint8Array(16);
  globalThis.crypto.getRandomValues(bytes);
  return toHex(bytes);
}

/** Deterministic 32-char hex token derived from vendor_code when no override exists yet. */
export async function deriveVendorAccessKey(vendorCode: string): Promise<string> {
  const clean = String(vendorCode || "").trim().toLowerCase();
  if (!clean) return "";
  const input = new TextEncoder().encode(`vmh-supply-key::${clean}::v1`);
  const digest = await globalThis.crypto.subtle.digest("SHA-256", input);
  return toHex(digest).slice(0, 32);
}

/** Compute lowercase hex HMAC-SHA256 digest (compatible with browser & Node Web Crypto). */
export async function hmacSha256Hex(secret: string, message: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await globalThis.crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await globalThis.crypto.subtle.sign("HMAC", key, enc.encode(message));
  return toHex(sig);
}

/** Read custom/rotated vendor access-key map from smr_security_policy. */
export async function loadVendorApiKeyMap(): Promise<Record<string, string>> {
  try {
    const { data, error } = await supabase
      .from("smr_security_policy")
      .select("value")
      .eq("key", KEY_STORE_POLICY_KEY)
      .maybeSingle();
    if (!error && data && data.value && typeof data.value === "object") {
      return data.value as Record<string, string>;
    }
  } catch (e) {
    console.warn("loadVendorApiKeyMap fallback:", e);
  }
  return {};
}

/** Persist a vendor's 32-char API key into smr_security_policy (and opportunistically smr_vendors). */
export async function saveVendorApiKeyOverride(vendorCode: string, accessKey: string): Promise<string> {
  const code = String(vendorCode || "").trim();
  const cleanKey = String(accessKey || "").trim().toLowerCase();
  if (!code || !isAccessKey32(cleanKey)) {
    throw new Error("Invalid vendor code or 32-char access key.");
  }

  const currentMap = await loadVendorApiKeyMap();
  const nextMap: Record<string, string> = {};
  for (const [k, v] of Object.entries(currentMap)) {
    if (k.toLowerCase() !== code.toLowerCase()) {
      nextMap[k] = v;
    }
  }
  nextMap[code] = cleanKey;

  const { error } = await supabase.from("smr_security_policy").upsert(
    {
      key: KEY_STORE_POLICY_KEY,
      name: KEY_STORE_POLICY_KEY,
      value: nextMap,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "key" },
  );
  if (error) throw error;
  return cleanKey;
}

/** Get the effective 32-char access key for a vendor code. */
export async function getVendorAccessKey(vendorCode: string): Promise<string> {
  const code = String(vendorCode || "").trim();
  if (!code) return "";
  const map = await loadVendorApiKeyMap();
  for (const [k, v] of Object.entries(map)) {
    if (k.toLowerCase() === code.toLowerCase() && isAccessKey32(v)) {
      return v.toLowerCase();
    }
  }
  return deriveVendorAccessKey(code);
}

export interface ResolvedVendor {
  id?: number;
  vendor_code: string;
  vendor_name: string;
  status: string;
  access_key: string;
}

/**
 * Resolve a vendor strictly by 32-char access key (preferred) or optional legacy vendor code.
 * When `strictKeyOnly` is true, only valid 32-char tokens stored/derived for active vendors match.
 */
export async function resolveVendorByAccessKey(
  tokenOrCode: string,
  opts: { strictKeyOnly?: boolean } = {},
): Promise<ResolvedVendor | null> {
  const input = String(tokenOrCode || "").trim();
  if (!input) return null;

  const [{ data: vendors }, keyMap] = await Promise.all([
    supabase.from("smr_vendors").select("id, vendor_code, vendor_name, status"),
    loadVendorApiKeyMap(),
  ]);

  const list = Array.isArray(vendors) ? vendors : [];
  const low = input.toLowerCase();
  const keyMapLower = new Map<string, string>();
  for (const [vc, k] of Object.entries(keyMap)) {
    if (isAccessKey32(k)) keyMapLower.set(vc.toLowerCase().trim(), k.toLowerCase());
  }

  // 1. Match by 32-char access key (override map or deterministic SHA-256 key)
  if (isAccessKey32(low)) {
    for (const v of list) {
      const vc = String(v.vendor_code || "").trim();
      if (!vc) continue;
      const effectiveKey = keyMapLower.get(vc.toLowerCase()) || (await deriveVendorAccessKey(vc));
      if (effectiveKey === low) {
        return {
          id: v.id,
          vendor_code: vc,
          vendor_name: v.vendor_name || vc,
          status: v.status || "Active",
          access_key: effectiveKey,
        };
      }
    }
    return null;
  }

  if (opts.strictKeyOnly) return null;

  // 2. Legacy/internal lookup by vendor_code or vendor_name (for backward-compatible entry links)
  for (const v of list) {
    const vc = String(v.vendor_code || "").trim();
    const vn = String(v.vendor_name || "").trim();
    if (vc.toLowerCase() === low || vn.toLowerCase() === low) {
      const effectiveKey = keyMapLower.get(vc.toLowerCase()) || (await deriveVendorAccessKey(vc));
      return {
        id: v.id,
        vendor_code: vc,
        vendor_name: vn || vc,
        status: v.status || "Active",
        access_key: effectiveKey,
      };
    }
  }

  return null;
}

export interface SanitizedSupplyStudy {
  survey_id: string;
  survey_name: string;
  brand: "VMH GROUP";
  cpi: number;
  currency: "USD";
  loi: number;
  ir: number;
  quota_limit: number;
  completes: number;
  remaining_quota: number;
  country: string;
  status: "Live";
  entry_link: string;
}

/** Strict allowlist projection stripping all client names, client CPIs, margins, and upstream URLs. */
export function buildSanitizedSupplyStudies(args: {
  vendorCode: string;
  accessKey: string;
  allots: any[];
  projects: any[];
  market?: any[];
  origin: string;
}): SanitizedSupplyStudy[] {
  const { vendorCode, accessKey, allots, projects, market = [], origin } = args;
  const vLower = vendorCode.toLowerCase().trim();

  const projMap = new Map<string, any>();
  for (const p of projects) {
    const pid = String(p.project_id || "").trim();
    if (pid) projMap.set(pid.toLowerCase(), p);
  }

  const mktMap = new Map<string, any>();
  for (const m of market) {
    const pid = String(m.survey_id ?? m.SurveyId ?? m.project_id ?? m.id ?? "").trim();
    if (pid) mktMap.set(pid.toLowerCase(), m);
  }

  const out: SanitizedSupplyStudy[] = [];

  for (const a of allots) {
    const avid = String(a.vendor_id || "").toLowerCase().trim();
    const avname = String(a.vendor_name || "").toLowerCase().trim();
    if (avid !== vLower && avname !== vLower) continue;

    const allotActive = !a.status || ["active", "live"].includes(String(a.status).toLowerCase().trim());
    if (!allotActive) continue;

    const pid = String(a.project_id || "").trim();
    if (!pid) continue;

    const p = projMap.get(pid.toLowerCase());
    if (p && p.status && !["live", "active"].includes(String(p.status).toLowerCase().trim())) {
      continue;
    }

    const m = mktMap.get(pid.toLowerCase());
    const quotaLimit = Number(a.quota_limit) > 0 ? Number(a.quota_limit) : 100;
    const completes = Math.max(0, Number(a.complete_count) || 0);
    const remaining = Math.max(0, quotaLimit - completes);
    const vendorCpi = Number((Number(a.vendor_cpi) || 0).toFixed(2));
    const loi = Number(p?.loi ?? m?.loi ?? m?.LOI) || 10;
    const ir = Number(p?.ir ?? m?.ir ?? m?.IR) || 70;

    out.push({
      survey_id: pid,
      survey_name: String(p?.project_name || m?.survey_name || m?.name || m?.Name || `Study #${pid}`),
      brand: "VMH GROUP",
      cpi: vendorCpi,
      currency: "USD",
      loi,
      ir,
      quota_limit: quotaLimit,
      completes,
      remaining_quota: remaining,
      country: String(p?.country || m?.country || "US"),
      status: "Live",
      entry_link: `${origin}/#/prescreener?pid=${encodeURIComponent(pid)}&key=${encodeURIComponent(accessKey)}&uid=[RESPONDENT_ID]`,
    });
  }

  return out;
}
