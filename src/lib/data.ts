import { api, type Vendor } from "./api";
import { supabase } from "./supabase";
import { num } from "./utils";

export interface NSurvey {
  id: string;
  name: string;
  client: string;
  clientId?: number;
  cpi: number;
  loi: number;
  ir: number;
  target: number;
  status: string;
  country: string;
  language: string;
  device: string;
  type: string;
  endDate?: string;
  createdAt?: string;
  liveUrl?: string;
  cloned: boolean;
}

/** The marketplace feed mixes raw Zamplia rows (PascalCase) and mapped project rows. */
export function normalizeSurvey(x: any): NSurvey {
  return {
    id: String(x.survey_id ?? x.SurveyId ?? x.surveyId ?? x.project_id ?? x.id),
    name: String(x.survey_name ?? x.name ?? x.Name ?? "Untitled study"),
    client: x.client_name ?? x.client ?? "Direct",
    clientId: x.client_id,
    cpi: num(x.cpi ?? x.CPI ?? x.cost_per_complete),
    loi: num(x.loi ?? x.LOI),
    ir: num(x.ir ?? x.IR),
    target: num(x.totalRequired ?? x.TotalCompleteRequired ?? x.max_limit ?? x.target_completes),
    status: x.status ?? "Live",
    country: x.country ?? x.LanguageCode?.split("-")[1] ?? "—",
    language: x.LanguageCode ?? "—",
    device: x.Device ?? "Both",
    type: x.studyType ?? x.StudyTypes ?? "—",
    endDate: x.SurveyEndDate,
    createdAt: x.SurveyCreatedAt ?? x.createdAt,
    liveUrl: x.live_url,
    cloned: !!x.is_cloned,
  };
}

export interface VendorOption {
  code: string;
  name: string;
  sharePct: number;
}

/** Vendors are spread over several tables — merge them all into a single picker list. */
export async function fetchVendorOptions(): Promise<VendorOption[]> {
  const map = new Map<string, VendorOption>();

  // 1. Direct Supabase Query (Real SMR / Hostinger Vendors)
  try {
    const { data: sv, error } = await supabase
      .from("smr_vendors")
      .select("*")
      .order("vendor_name");
    if (!error && sv && sv.length > 0) {
      sv.forEach((v: any) => {
        const code = v.vendor_code || v.vendor_id || String(v.id);
        if (code) {
          const rawShare = num(v.cpi_percentage ?? v.rev_share, 70);
          map.set(code, {
            code,
            name: v.vendor_name || v.name || code,
            sharePct: rawShare > 0 ? rawShare : 70,
          });
        }
      });
      if (map.size > 0) {
        return [...map.values()].sort((a, b) => a.name.localeCompare(b.name));
      }
    }
  } catch (err) {
    console.warn("Supabase smr_vendors query error:", err);
  }

  // 2. Gateway API Fallback
  const settle = async <T,>(p: Promise<T>) => {
    try {
      return await p;
    } catch {
      return null;
    }
  };
  const [mv, uni, al] = await Promise.all([
    settle(api.get<{ data: Vendor[] }>("/manage/vendors", { limit: 200 })),
    settle(api.get<{ data: { vendors: any[] } }>("/reports/unified")),
    settle(api.get<{ data: any[] }>("/vendor/allotments")),
  ]);
  (mv?.data || []).forEach((v) => {
    const code = v.vendor_code || v.vendor_id;
    if (code) {
      const rawShare = num(v.cpi_percentage ?? v.rev_share, 70);
      map.set(code, { code, name: v.name || v.vendor_name || code, sharePct: rawShare > 0 ? rawShare : 70 });
    }
  });
  (uni?.data?.vendors || []).forEach((v) => {
    if (v.vendor_id && !map.has(v.vendor_id)) {
      map.set(v.vendor_id, { code: v.vendor_id, name: v.vendor_name || v.vendor_id, sharePct: 70 });
    }
  });
  (al?.data || []).forEach((a) => {
    if (a.vendor_id && !map.has(a.vendor_id)) {
      map.set(a.vendor_id, { code: a.vendor_id, name: a.vendor_name || a.vendor_id, sharePct: 70 });
    }
  });
  return [...map.values()].sort((a, b) => a.name.localeCompare(b.name));
}

export const entryLink = (vendorOrProject: string, maybeProject?: string) => {
  if (maybeProject) {
    return `https://api.vmhgroupsmr.com/vendor/auth/${encodeURIComponent(vendorOrProject)}/project/${encodeURIComponent(maybeProject)}?uid=[RESPONDENT_ID]`;
  }
  // Single argument passed: project/study ID -> route via default inhouse vendor VI010032025
  return `https://api.vmhgroupsmr.com/vendor/auth/VI010032025/project/${encodeURIComponent(vendorOrProject)}?uid=[RESPONDENT_ID]`;
};

export const UID_TAGS = ["[RESPONDENT_ID]", "[UID]", "[#UID#]", "[identifier]", "[RID]", "[TransactionId]", "{{UID}}"];

export const DEFAULT_COUNTRIES = [
  { id: 1, name: "United States", code: "US" },
  { id: 2, name: "United Kingdom", code: "GB" },
  { id: 3, name: "Canada", code: "CA" },
  { id: 4, name: "Australia", code: "AU" },
  { id: 5, name: "India", code: "IN" },
  { id: 6, name: "Germany", code: "DE" },
  { id: 7, name: "France", code: "FR" },
  { id: 8, name: "Italy", code: "IT" },
  { id: 9, name: "Spain", code: "ES" },
  { id: 10, name: "Japan", code: "JP" },
  { id: 11, name: "Brazil", code: "BR" },
  { id: 12, name: "Mexico", code: "MX" },
  { id: 13, name: "Netherlands", code: "NL" },
  { id: 14, name: "Sweden", code: "SE" },
  { id: 15, name: "Switzerland", code: "CH" },
  { id: 16, name: "Singapore", code: "SG" },
  { id: 17, name: "New Zealand", code: "NZ" },
  { id: 18, name: "South Africa", code: "ZA" },
  { id: 19, name: "United Arab Emirates", code: "AE" },
  { id: 20, name: "Saudi Arabia", code: "SA" },
  { id: 21, name: "Poland", code: "PL" },
  { id: 22, name: "Turkey", code: "TR" },
  { id: 23, name: "Indonesia", code: "ID" },
  { id: 24, name: "Philippines", code: "PH" },
  { id: 25, name: "Vietnam", code: "VN" },
  { id: 26, name: "Thailand", code: "TH" },
  { id: 27, name: "Malaysia", code: "MY" },
  { id: 28, name: "Argentina", code: "AR" },
  { id: 29, name: "Chile", code: "CL" },
  { id: 30, name: "Colombia", code: "CO" },
  { id: 31, name: "Peru", code: "PE" },
  { id: 32, name: "Egypt", code: "EG" },
  { id: 33, name: "Nigeria", code: "NG" },
  { id: 34, name: "Kenya", code: "KE" },
  { id: 35, name: "South Korea", code: "KR" },
  { id: 36, name: "Ireland", code: "IE" },
  { id: 37, name: "Belgium", code: "BE" },
  { id: 38, name: "Austria", code: "AT" },
  { id: 39, name: "Portugal", code: "PT" },
  { id: 40, name: "Denmark", code: "DK" },
  { id: 41, name: "Norway", code: "NO" },
  { id: 42, name: "Finland", code: "FI" },
  { id: 43, name: "Czech Republic", code: "CZ" },
  { id: 44, name: "Romania", code: "RO" },
  { id: 45, name: "Israel", code: "IL" },
  { id: 46, name: "Greece", code: "GR" },
  { id: 47, name: "Hungary", code: "HU" },
  { id: 48, name: "Hong Kong", code: "HK" },
];

