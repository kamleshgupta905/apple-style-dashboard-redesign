import { api, type Vendor } from "./api";
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
    if (code) map.set(code, { code, name: v.name || v.vendor_name || code, sharePct: num(v.cpi_percentage ?? v.rev_share, 70) });
  });
  (uni?.data?.vendors || []).forEach((v) => {
    if (v.vendor_id && !map.has(v.vendor_id)) map.set(v.vendor_id, { code: v.vendor_id, name: v.vendor_name || v.vendor_id, sharePct: 70 });
  });
  (al?.data || []).forEach((a) => {
    if (a.vendor_id && !map.has(a.vendor_id)) map.set(a.vendor_id, { code: a.vendor_id, name: a.vendor_name || a.vendor_id, sharePct: 70 });
  });
  return [...map.values()];
}

export const entryLink = (vendor: string, project: string) =>
  `https://api.vmhgroupsmr.com/vendor/auth/${encodeURIComponent(vendor)}/project/${encodeURIComponent(project)}?uid=[RESPONDENT_ID]`;

export const UID_TAGS = ["[RESPONDENT_ID]", "[UID]", "[#UID#]", "[identifier]", "[RID]", "[TransactionId]", "{{UID}}"];
