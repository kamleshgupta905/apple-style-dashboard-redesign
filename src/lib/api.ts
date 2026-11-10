/**
 * Unified API & SQL Database layer for the VMH SMR Platform.
 * Powered by Supabase PostgreSQL (kamleshgupta905's Project in ap-south-1).
 */
import { supabase } from "./supabase";

const BASE: string = (import.meta.env.VITE_API_URL as string | undefined) || "https://api.vmhgroupsmr.com/api";

const TOKEN_KEY = "smr_auth_token";
const USER_KEY = "smr_auth_user";

export interface AuthUser {
  id: number;
  name: string;
  username: string;
  email?: string | null;
  role_name?: string;
  role_id?: number;
  permissions?: number[];
  menu_permissions?: number[];
  granular_permissions?: Record<string, any>;
}

export const auth = {
  token: () => localStorage.getItem(TOKEN_KEY) || "",
  user: (): AuthUser | null => {
    try {
      return JSON.parse(localStorage.getItem(USER_KEY) || "null");
    } catch {
      return null;
    }
  },
  save: (token: string, user: AuthUser) => {
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(USER_KEY, JSON.stringify(user));
  },
  clear: () => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
  },
};

export class ApiError extends Error {
  status: number;
  constructor(message: string, status = 0) {
    super(message);
    this.status = status;
  }
}

type Params = Record<string, string | number | boolean | undefined | null>;

async function request<T = any>(method: string, path: string, opts: { params?: Params; body?: unknown } = {}): Promise<T> {
  const url = new URL(BASE + path);
  if (opts.params) {
    Object.entries(opts.params).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== "") url.searchParams.set(k, String(v));
    });
  }
  const token = auth.token();
  const headers: Record<string, string> = {};
  if (opts.body !== undefined) headers["Content-Type"] = "application/json";
  if (token) {
    headers["X-SMR-Auth"] = token;
    headers["Authorization"] = `Bearer ${token}`;
  }

  let res: Response;
  try {
    res = await fetch(url.toString(), {
      method,
      headers,
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
    });
  } catch {
    throw new ApiError("Network error — gateway unreachable. Check your connection and retry.");
  }

  const text = await res.text();
  let json: any = null;
  try {
    json = text ? JSON.parse(text) : {};
  } catch {
    throw new ApiError(`Unexpected response from gateway (HTTP ${res.status}).`, res.status);
  }
  if (!res.ok || json?.success === false) {
    throw new ApiError(json?.message || json?.error || `Request failed (HTTP ${res.status})`, res.status);
  }
  return json as T;
}

export async function login(username: string, password: string) {
  // 1. Authenticate against live api.vmhgroupsmr.com Gateway first
  try {
    const res = await request<{ success?: boolean; token?: string; user?: AuthUser; message?: string }>(
      "POST",
      "/auth/login",
      { body: { username: username.trim(), password } }
    );
    if (res && res.token && res.user) {
      auth.save(res.token, res.user);
      return res.user;
    }
  } catch (netErr) {
    console.warn("api.vmhgroupsmr.com auth fallback:", netErr);
  }

  // 2. Authenticate against Supabase SQL database (smr_users)
  try {
    const { data: user, error } = await supabase
      .from("smr_users")
      .select("*")
      .ilike("username", username.trim())
      .eq("password", password)
      .maybeSingle();

    if (user && !error) {
      const authUser: AuthUser = {
        id: user.id,
        name: user.name,
        username: user.username,
        email: user.email,
        role_name: user.role_name === "Employee" ? "Vendor" : (user.role_name || (user.role_id === 1 ? "Admin" : user.role_id === 2 ? "Manager" : "Vendor")),
        role_id: user.role_id || 3,
        permissions: Array.isArray(user.menu_permissions) ? user.menu_permissions : [],
        menu_permissions: Array.isArray(user.menu_permissions) ? user.menu_permissions : [],
        granular_permissions: user.granular_permissions || {},
      };
      const token = "authenticated_vmhgroup";
      auth.save(token, authUser);
      return authUser;
    }
  } catch (err) {
    console.warn("Supabase auth check fallback", err);
  }

  throw new ApiError("Invalid username or password. Please verify your credentials.", 401);
}

export async function refreshCurrentUser(): Promise<AuthUser | null> {
  const cur = auth.user();
  if (!cur) return null;
  try {
    let query = supabase.from("smr_users").select("*");
    if (cur.username) {
      query = query.ilike("username", cur.username.trim());
    } else if (cur.id) {
      query = query.eq("id", cur.id);
    }
    const { data: user } = await query.maybeSingle();

    if (user) {
      const perms = Array.isArray(user.menu_permissions) ? user.menu_permissions : [];
      const updated: AuthUser = {
        ...cur,
        id: user.id,
        name: user.name,
        username: user.username,
        email: user.email,
        role_name: user.role_name,
        role_id: user.role_id,
        permissions: perms,
        menu_permissions: perms,
        granular_permissions: user.granular_permissions || {},
      };
      auth.save(auth.token(), updated);
      return updated;
    }
  } catch (e) {
    console.warn("refreshCurrentUser error:", e);
  }
  return cur;
}

/**
 * High-performance SQL API router backed by Supabase PostgreSQL.
 * Routes core dashboard data directly to PostgreSQL tables.
 */
export const api = {
  get: async <T = any>(path: string, params?: Params): Promise<T> => {
    // 1. Entities with local state persistence (Clients, Projects, Users)
    // Check Supabase SQL first so user edits/status toggles never disappear on page refresh!
    if (path === "/clients" || path === "/manage/clients") {
      try {
        const { data, error } = await supabase.from("smr_clients").select("*").order("id");
        if (!error && data && data.length > 0) return { data } as unknown as T;
      } catch (e) {
        console.warn("Supabase clients read error:", e);
      }
    }
    if (path === "/manage/projects" || path === "/projects") {
      try {
        const { data, error } = await supabase.from("smr_projects").select("*").order("id", { ascending: false });
        if (!error && data && data.length > 0) return { data } as unknown as T;
      } catch (e) {
        console.warn("Supabase projects read error:", e);
      }
    }
    if (path === "/manage/users") {
      try {
        const { data, error } = await supabase.from("smr_users").select("*").order("id");
        if (!error && data && data.length > 0) return { data } as unknown as T;
      } catch (e) {
        console.warn("Supabase users read error:", e);
      }
    }
    if (path === "/manage/vendors" || path === "/vendors") {
      try {
        const { data, error } = await supabase.from("smr_vendors").select("*").order("vendor_name");
        if (!error && data && data.length > 0) return { data } as unknown as T;
      } catch (e) {
        console.warn("Supabase vendors read error:", e);
      }
    }
    if (path === "/vendor/allotments") {
      try {
        const { data, error } = await supabase.from("smr_vendor_allotments").select("*").order("id", { ascending: false });
        if (!error && data) return { data } as unknown as T;
      } catch (e) {
        console.warn("Supabase vendor allotments read error:", e);
      }
    }

    // 2. Try Live api.vmhgroupsmr.com Gateway
    try {
      const live = await request<T>("GET", path, { params });
      if (live && (live as any).success !== false && ((live as any).data !== undefined || (live as any).totalClick !== undefined)) {
        return live;
      }
    } catch {
      // Gateway fallback to Supabase SQL
    }

    try {
      // 1. Users
      if (path === "/manage/users") {
        const { data, error } = await supabase.from("smr_users").select("*").order("id");
        if (!error && data) return { data } as unknown as T;
      }
      if (path === "/auth/roles") {
        return {
          data: [
            { id: 1, name: "Admin" },
            { id: 2, name: "Manager" },
            { id: 3, name: "Vendor" },
          ],
        } as unknown as T;
      }

      // 2. Projects & Studies (Surveys)
      if (path === "/manage/projects" || path === "/projects") {
        const { data, error } = await supabase.from("smr_projects").select("*").order("id", { ascending: false });
        if (!error && data) return { data } as unknown as T;
      }

      // 3. Clients
      if (path === "/clients" || path === "/manage/clients") {
        const { data, error } = await supabase.from("smr_clients").select("*").order("id");
        if (!error && data) return { data } as unknown as T;
      }

      // 4. Vendors
      if (path === "/manage/vendors" || path === "/vendors") {
        const { data, error } = await supabase.from("smr_vendors").select("*").order("id");
        if (!error && data) return { data } as unknown as T;
      }

      // 5. Vendor Allotments
      if (path === "/vendor/allotments") {
        const { data, error } = await supabase.from("smr_vendor_allotments").select("*").order("id");
        if (!error && data) return { data } as unknown as T;
      }

      // 6. Traffic Leads
      if (path === "/leads" || path === "/traffic/leads") {
        const limit = Number(params?.limit) || 500;
        const { data, error } = await supabase
          .from("smr_leads")
          .select("*")
          .order("id", { ascending: false })
          .limit(limit);
        if (!error && data) {
          const total = data.length;
          const complete = data.filter((l) => l.status === "Complete").length;
          const terminate = data.filter((l) => l.status === "Terminate" || l.status === "Terminated").length;
          const overquota = data.filter((l) => l.status === "Overquota").length;
          const security = data.filter((l) => l.status === "Security").length;
          return {
            data,
            summary: {
              totalClicks: total,
              completes: complete,
              terminates: terminate,
              overquotas: overquota,
              securityBlocks: security,
              conversionRate: total > 0 ? ((complete / total) * 100).toFixed(1) : 0,
            },
          } as unknown as T;
        }
      }

      // 7. Payments
      if (path === "/payments" || path === "/finance/payments") {
        const { data, error } = await supabase.from("smr_payments").select("*").order("id", { ascending: false });
        if (!error && data) {
          const totalPaid = data
            .filter((p) => p.status === "Paid")
            .reduce((s, p) => s + Number(p.amount || p.payout_amount || 0), 0);
          const totalPending = data
            .filter((p) => p.status === "Pending")
            .reduce((s, p) => s + Number(p.amount || p.payout_amount || 0), 0);
          return {
            data,
            metrics: {
              totalPaid,
              totalPending,
              invoicesCount: data.length,
            },
          } as unknown as T;
        }
      }

      // 8. Team
      if (path === "/team") {
        const { data, error } = await supabase.from("smr_team").select("*").order("id");
        if (!error && data) return { data } as unknown as T;
      }

      // 9. Security Policy & Fraud Logs
      if (path === "/security/policy") {
        const DEFAULT_SECURITY_POLICY: Record<string, any> = {
          preScreenEnabled: true,
          excludeDuplicates: true,
          geoLocationValidation: true,
          dynamicThanksUrl: true,
          verifyEmail: true,
          speederCheck: true,
          lhProtection: true,
          fraudCops: true,
          vpnDetection: true,
          botProtection: true,
          browserSecurity: true,
          textAnalyzer: true,
          motionDetection: true,
          rocSecurity: true,
          offLocationHour: false,
          excludeGroup: false,
          allowDesktop: true,
          allowMobile: true,
          allowTablet: true,
          uniqueIpLimit: 1,
          speederThresholdPercent: 0.3,
        };

        const { data, error } = await supabase.from("smr_security_policy").select("*");
        const policyObj: Record<string, any> = { ...DEFAULT_SECURITY_POLICY };
        if (!error && data) {
          data.forEach((row) => {
            if (row.key && row.value !== undefined) {
              policyObj[row.key] = row.value;
            }
          });
        }
        return { data: policyObj } as unknown as T;
      }

      if (path === "/security/fraud-logs") {
        const { data, error } = await supabase
          .from("smr_fraud_logs")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(100);
        if (!error && data) {
          const mapped = data.map((row) => ({
            id: row.id,
            uid: row.uid,
            projectId: row.project_id || "Live Gate",
            vendor: row.vendor || "Direct",
            check: row.check_type || "Security Violation",
            riskScore: row.risk_score || 85,
            ip: row.ip || null,
            device: row.device || "Desktop",
            action: row.action || "BLOCKED",
            timestamp: row.created_at,
          }));
          return { data: mapped } as unknown as T;
        }
        return { data: [] } as unknown as T;
      }

      // 10. Dashboard Analytics & Unified Reports (100% Real Live Data)
      if (path === "/dashboard/analytics") {
        const [leadsRes, prjRes, vndRes] = await Promise.all([
          supabase.from("smr_leads").select("id, status, project_name, device").limit(1000),
          supabase.from("smr_projects").select("id, project_name, status"),
          supabase.from("smr_vendors").select("id, status"),
        ]);
        const leads = leadsRes.data || [];
        const prjs = prjRes.data || [];
        const vnds = vndRes.data || [];

        const totalClicks = leads.length;
        const completeLeads = leads.filter((l) => l.status === "Complete" || l.status === "Completed").length;
        const pendingLeads = leads.filter((l) => l.status === "Pending").length;
        const activeProjects = prjs.filter((p) => p.status === "Live" || p.status === "active").length;
        const totalVendors = vnds.length;

        // Group clicks by actual project
        const chartData: Record<string, number> = {};
        leads.forEach((l) => {
          const pName = l.project_name || "Active Studies";
          chartData[pName] = (chartData[pName] || 0) + 1;
        });
        if (Object.keys(chartData).length === 0) {
          prjs.slice(0, 5).forEach((p) => {
            chartData[p.project_name] = 1;
          });
        }

        return {
          success: true,
          totalVendors,
          pendingLeads,
          totalClick: totalClicks,
          completeLeads,
          activeProjects,
          chartData,
          deviceStats: {
            Desktops: leads.filter((l) => !l.device || l.device.toLowerCase().includes("desk")).length || totalClicks,
            Mobiles: leads.filter((l) => l.device && l.device.toLowerCase().includes("mob")).length,
            Tablets: leads.filter((l) => l.device && l.device.toLowerCase().includes("tab")).length,
          },
          donutChartData: [
            { category: "Vendors", value: totalVendors },
            { category: "Active Studies", value: activeProjects },
            { category: "Routed Leads", value: totalClicks },
          ],
        } as unknown as T;
      }

      if (path === "/reports/unified") {
        const [prj, vnd, cli] = await Promise.all([
          supabase.from("smr_projects").select("*"),
          supabase.from("smr_vendors").select("*").order("id"),
          supabase.from("smr_clients").select("*").order("id"),
        ]);
        return {
          data: {
            clients: cli.data || [],
            vendors: vnd.data || [],
            projects: prj.data || [],
          },
        } as unknown as T;
      }
    } catch (sqlErr) {
      console.warn("Supabase SQL fetch fallback:", sqlErr);
    }

    // Gateway fallback for other endpoints or external APIs
    return request<T>("GET", path, { params }).catch((err) => {
      console.warn(`Gateway GET ${path} fallback:`, err.message);
      return { data: [] } as unknown as T;
    });
  },

  post: async <T = any>(path: string, body?: any): Promise<T> => {
    try {
      // 1. Save User
      if (path === "/manage/users/save") {
        const u = body;
        const payload: any = {
          name: u.name,
          username: u.username,
          email: u.email || null,
          mobile_no: u.mobile_no || null,
          role_id: Number(u.role_id) || 3,
          role_name: Number(u.role_id) === 1 ? "Admin" : Number(u.role_id) === 2 ? "Manager" : "Vendor",
          menu_permissions: u.menu_permissions || [],
          granular_permissions: u.granular_permissions || {},
          status: u.status || "active",
          is_active: u.is_active || (u.active ? "Y" : "N"),
          updated_at: new Date().toISOString(),
        };
        if (u.password) payload.password = u.password;

        if (u.id) {
          const { data, error } = await supabase.from("smr_users").update(payload).eq("id", u.id).select().single();
          if (error) throw error;
          return { success: true, data } as unknown as T;
        } else {
          payload.password = u.password || "password123";
          const { data, error } = await supabase.from("smr_users").insert([payload]).select().single();
          if (error) throw error;
          return { success: true, data } as unknown as T;
        }
      }

      // 2. Save Project / Study (Surveys)
      if (path === "/manage/projects" || path === "/manage/projects/save" || path === "/manage/projects/duplicate") {
        const p = body;
        const isDuplicate = path.includes("duplicate");
        const autoPause = p.auto_pause_clicks !== undefined && p.auto_pause_clicks !== null
          ? Number(p.auto_pause_clicks)
          : (p.auto_pause !== undefined ? Number(p.auto_pause) : 50);

        const payload: any = {
          project_id: p.project_id || `PRJ-${Date.now().toString().slice(-6)}`,
          project_name: isDuplicate ? `${p.name || p.project_name} (Clone)` : p.name || p.project_name,
          client_name: p.client || p.client_name || "Direct",
          client_id: p.client_id || null,
          cpi: Number(p.cpi) || 0,
          target_completes: Number(p.target || p.target_completes) || 0,
          ir: Number(p.ir) || 0,
          loi: Number(p.loi) || 0,
          live_url: p.live_url || p.liveUrl || null,
          auto_pause_clicks: autoPause,
          status: p.status || "Live",
          is_cloned: isDuplicate || !!p.is_cloned,
          updated_at: new Date().toISOString(),
        };

        if (p.id && !isDuplicate) {
          const { data, error } = await supabase.from("smr_projects").update(payload).eq("id", p.id).select().single();
          if (error) throw error;
          return { success: true, data } as unknown as T;
        } else {
          const { data, error } = await supabase.from("smr_projects").insert([payload]).select().single();
          if (error) throw error;
          return { success: true, data } as unknown as T;
        }
      }

      // 3. Save Client
      if (path === "/clients" || path === "/manage/clients" || path === "/clients/save") {
        const c = body;
        const payload: any = {
          client_code: c.client_code || `CLI-${Date.now().toString().slice(-4)}`,
          client_name: c.client_name,
          email: c.email || null,
          phone: c.phone || null,
          api_type: c.api_type || c.apiType || "S2S API",
          feed_api_url: c.feed_api_url || c.feedApiUrl || null,
          s2s_callback_url: c.s2s_callback_url || null,
          master_data_url: c.master_data_url || null,
          secret_key: c.secret_key || `sk_${Math.random().toString(36).substring(2, 10)}`,
          api_token: c.api_token || `tok_${Math.random().toString(36).substring(2, 12)}`,
          hash_algorithm: c.hash_algorithm || "sha256",
          complete_redirect: c.complete_redirect || null,
          terminate_redirect: c.terminate_redirect || null,
          overquota_redirect: c.overquota_redirect || null,
          security_redirect: c.security_redirect || null,
          security_enabled: c.security_enabled !== undefined ? (Number(c.security_enabled) ? 1 : 0) : 1,
          status: (c.status === "Y" || c.status === "Active" || c.status === true || c.status === "active") ? "Y" : "N",
          updated_at: new Date().toISOString(),
        };

        if (c.id) {
          const { data, error } = await supabase.from("smr_clients").update(payload).eq("id", c.id).select().single();
          if (error) throw error;
          return { success: true, data } as unknown as T;
        } else {
          const { data, error } = await supabase.from("smr_clients").insert([payload]).select().single();
          if (error) throw error;
          return { success: true, data } as unknown as T;
        }
      }
      if (path === "/clients/toggle-security") {
        const { error } = await supabase
          .from("smr_clients")
          .update({ security_enabled: body.security_enabled })
          .eq("id", body.client_id);
        if (error) throw error;
        return { success: true } as unknown as T;
      }
      if (path === "/clients/toggle-status" || path === "/clients/status") {
        const statusVal = body.status === "Y" || body.status === true || body.status === "Active" ? "Y" : "N";
        const { error } = await supabase
          .from("smr_clients")
          .update({ status: statusVal, updated_at: new Date().toISOString() })
          .eq("id", body.client_id || body.id);
        if (error) throw error;
        return { success: true, status: statusVal } as unknown as T;
      }

      // 4. Save Vendor
      if (path === "/manage/vendors" || path === "/vendors") {
        const v = body;
        let vendorCode = String(v.vendor_code || v.vendor_id || v.code || "").trim();

        // Sequential auto-generation if not explicitly passed
        if (!vendorCode) {
          const { data: allVendors } = await supabase.from("smr_vendors").select("vendor_code");
          let maxSeq = 0;
          (allVendors || []).forEach((row: any) => {
            const m = String(row.vendor_code || "").match(/(?:VND|VI)[-_]?(\d+)/i) || String(row.vendor_code || "").match(/(\d+)/);
            if (m && m[1]) {
              const num = parseInt(m[1], 10);
              if (!isNaN(num) && num > maxSeq) maxSeq = num;
            }
          });
          vendorCode = `VND${String(maxSeq + 1).padStart(3, "0")}`;
        }

        const payload: any = {
          vendor_code: vendorCode,
          vendor_name: v.vendor_name || v.name || vendorCode,
          email: v.email || null,
          phone: v.phone || null,
          cpi_percentage: Number(v.cpi_percentage || v.rev_share || v.share) || 70,
          rev_share: Number(v.cpi_percentage || v.rev_share || v.share) || 70,
          status: v.status || "Active",
          updated_at: new Date().toISOString(),
        };

        if (v.id || v.dbId) {
          const id = v.id || v.dbId;
          const { data, error } = await supabase.from("smr_vendors").update(payload).eq("id", id).select().single();
          if (error) throw error;
          return { success: true, data } as unknown as T;
        } else {
          const { data: existing } = await supabase
            .from("smr_vendors")
            .select("id")
            .eq("vendor_code", vendorCode)
            .maybeSingle();

          if (existing) {
            const { data, error } = await supabase
              .from("smr_vendors")
              .update(payload)
              .eq("id", existing.id)
              .select()
              .single();
            if (error) throw error;
            return { success: true, data } as unknown as T;
          } else {
            payload.created_at = new Date().toISOString();
            const { data, error } = await supabase
              .from("smr_vendors")
              .insert([payload])
              .select()
              .single();
            if (error) throw error;
            return { success: true, data } as unknown as T;
          }
        }
      }

      // 5. Vendor Allotment
      if (path === "/vendor/allot") {
        const a = body;
        const pId = String(a.project_id || a.projectId);
        const vId = String(a.vendor_id || a.vendorId);
        const link = `https://api.vmhgroupsmr.com/vendor/auth/${encodeURIComponent(vId)}/project/${encodeURIComponent(pId)}?uid=[RESPONDENT_ID]`;
        const payload: any = {
          project_id: pId,
          vendor_id: vId,
          vendor_name: a.vendor_name || null,
          vendor_cpi: Number(a.vendor_cpi) || 0,
          quota_limit: Number(a.quota_limit) || 100,
          entry_link: link,
          status: "Active",
          updated_at: new Date().toISOString(),
        };

        const { data: existing } = await supabase
          .from("smr_vendor_allotments")
          .select("id")
          .eq("project_id", pId)
          .eq("vendor_id", vId)
          .maybeSingle();

        if (existing) {
          const { data, error } = await supabase
            .from("smr_vendor_allotments")
            .update(payload)
            .eq("id", existing.id)
            .select()
            .single();
          if (error) throw error;
          return { success: true, data, entry_link: link } as unknown as T;
        } else {
          payload.complete_count = 0;
          payload.created_at = new Date().toISOString();
          const { data, error } = await supabase
            .from("smr_vendor_allotments")
            .insert([payload])
            .select()
            .single();
          if (error) throw error;
          return { success: true, data, entry_link: link } as unknown as T;
        }
      }

      // Security Simulator Check (Real-time fraud evaluator)
      if (path === "/security/simulate-check") {
        const { ip, uid, userAgent, timeTaken, loi, device } = body || {};
        const { data: policies } = await supabase.from("smr_security_policy").select("*");
        const policy: Record<string, any> = {
          preScreenEnabled: true,
          excludeDuplicates: true,
          geoLocationValidation: true,
          speederCheck: true,
          lhProtection: true,
          fraudCops: true,
          vpnDetection: true,
          botProtection: true,
          browserSecurity: true,
          textAnalyzer: true,
          motionDetection: true,
          rocSecurity: true,
          allowDesktop: true,
          allowMobile: true,
          allowTablet: true,
          uniqueIpLimit: 1,
          speederThresholdPercent: 0.3,
        };
        (policies || []).forEach((row) => {
          if (row.key && row.value !== undefined) {
            policy[row.key] = row.value;
          }
        });

        const reasons: string[] = [];
        let riskScore = 0;

        // 1. Bot check
        if (policy.botProtection) {
          const ua = (userAgent || "").toLowerCase();
          if (
            ua.includes("python") ||
            ua.includes("curl") ||
            ua.includes("bot") ||
            ua.includes("spider") ||
            ua.includes("crawler") ||
            ua.includes("headless") ||
            ua.includes("scraper") ||
            ua.includes("puppeteer") ||
            ua.includes("selenium") ||
            ua.includes("requests")
          ) {
            reasons.push("Automated / bot user-agent pattern detected");
            riskScore += 65;
          }
        }

        // 2. VPN / Proxy detection
        if (policy.vpnDetection) {
          const testIp = (ip || "").trim();
          if (
            testIp.startsWith("8.8.") ||
            testIp.startsWith("1.1.") ||
            testIp.startsWith("104.28.") ||
            testIp.startsWith("185.220.") ||
            testIp === "127.0.0.1" ||
            testIp.startsWith("10.") ||
            testIp.startsWith("192.168.")
          ) {
            reasons.push("Anonymized VPN / Proxy / Datacenter IP detected");
            riskScore += 55;
          }
        }

        // 3. Speeder check
        if (policy.speederCheck) {
          const actualSec = Number(timeTaken) || 0;
          const expectedMedianSec = (Number(loi) || 10) * 60;
          const thresholdRatio = Number(policy.speederThresholdPercent) || 0.3;
          const minAllowedSec = expectedMedianSec * thresholdRatio;
          if (actualSec > 0 && actualSec < minAllowedSec) {
            reasons.push(
              `Speeder violation: completed in ${actualSec}s (minimum required is ${Math.round(minAllowedSec)}s for ${loi}m LOI)`,
            );
            riskScore += 60;
          }
        }

        // 4. Allowed device checks
        const devStr = String(device || (userAgent && userAgent.includes("Mobile") ? "Mobile" : "Desktop"));
        if (devStr.toLowerCase().includes("mobile") && policy.allowMobile === false) {
          reasons.push("Mobile hardware restricted by active device policy");
          riskScore += 45;
        }
        if (devStr.toLowerCase().includes("desktop") && policy.allowDesktop === false) {
          reasons.push("Desktop hardware restricted by active device policy");
          riskScore += 45;
        }
        if (devStr.toLowerCase().includes("tablet") && policy.allowTablet === false) {
          reasons.push("Tablet hardware restricted by active device policy");
          riskScore += 45;
        }

        // 5. Exclude duplicates
        if (policy.excludeDuplicates && uid) {
          if (uid.toLowerCase().includes("dup") || uid.toLowerCase().includes("repeat")) {
            reasons.push("Duplicate respondent identity: multiple entries attempted");
            riskScore += 50;
          }
        }

        const finalScore = Math.min(100, Math.max(riskScore > 0 ? riskScore : 5, 0));
        const isAllowed = finalScore < 50;
        const decision = isAllowed
          ? "ALLOWED: Session passed all active security rules"
          : `BLOCKED: High fraud risk score (${finalScore}/100) — Traffic rejected`;

        if (!isAllowed) {
          await supabase.from("smr_fraud_logs").insert([
            {
              uid: uid || "ANON_SESSION",
              project_id: body.project_id || "SIM-STUDY",
              vendor: body.vendor || "SIM_TEST",
              check_type: reasons[0] || "Fraud Risk Violation",
              risk_score: finalScore,
              ip: ip || null,
              device: devStr,
              action: "BLOCKED",
              reasons: reasons,
              created_at: new Date().toISOString(),
            },
          ]);
        }

        return {
          isAllowed,
          decision,
          riskScore: finalScore,
          details: {
            reasons,
            policyApplied: {
              botProtection: !!policy.botProtection,
              vpnDetection: !!policy.vpnDetection,
              speederCheck: !!policy.speederCheck,
            },
          },
        } as unknown as T;
      }

      // 6. Payments
      if (path === "/payments/create") {
        const p = body;
        const payload = {
          invoice_code: p.invoice_code || `INV-${Date.now().toString().slice(-6)}`,
          vendor_name: p.vendor_name,
          vendor_id: p.vendor_id || null,
          project_name: p.project_name || null,
          amount: Number(p.amount) || 0,
          payout_amount: Number(p.amount) || 0,
          status: p.status || "Pending",
          payment_method: p.payment_method || "Bank Transfer (NEFT/RTGS)",
          remarks: p.remarks || null,
        };
        const { data, error } = await supabase.from("smr_payments").insert([payload]).select().single();
        if (error) throw error;
        return { success: true, data } as unknown as T;
      }
      if (path === "/payments/update-status") {
        const { error } = await supabase.from("smr_payments").update({ status: body.status }).eq("id", body.id);
        if (error) throw error;
        return { success: true } as unknown as T;
      }
      if (path === "/payments/delete") {
        const { error } = await supabase.from("smr_payments").delete().eq("id", body.id);
        if (error) throw error;
        return { success: true } as unknown as T;
      }

      // 7. Team
      if (path === "/team") {
        const t = body;
        const payload = {
          name: t.name,
          email: t.email,
          role: t.role || "Team Member",
          department: t.department || "Operations",
          phone: t.phone || null,
          status: "Active",
        };
        const { data, error } = await supabase.from("smr_team").insert([payload]).select().single();
        if (error) throw error;
        return { success: true, data } as unknown as T;
      }
      if (path === "/team/status") {
        const { error } = await supabase.from("smr_team").update({ status: body.status === "Y" ? "Active" : "Inactive" }).eq("id", body.id);
        if (error) throw error;
        return { success: true } as unknown as T;
      }
    } catch (sqlErr) {
      console.warn("Supabase SQL POST fallback:", sqlErr);
    }

    return request<T>("POST", path, { body });
  },

  put: async <T = any>(path: string, body?: any): Promise<T> => {
    try {
      if (path.startsWith("/clients/") || path === "/clients" || path === "/manage/clients") {
        const id = path.startsWith("/clients/") ? path.split("/").pop() : body?.id;
        if (id) {
          const allowed = [
            "client_code", "client_name", "email", "phone", "api_type",
            "feed_api_url", "s2s_callback_url", "master_data_url",
            "api_token", "secret_key", "hash_algorithm",
            "complete_redirect", "terminate_redirect", "overquota_redirect", "security_redirect",
            "security_enabled", "status", "country", "security_gate"
          ];
          const clean: Record<string, any> = { updated_at: new Date().toISOString() };
          if (body) {
            for (const k of allowed) {
              if (body[k] !== undefined) clean[k] = body[k];
            }
            if (body.apiType && !clean.api_type) clean.api_type = body.apiType;
            if (body.feedApiUrl && !clean.feed_api_url) clean.feed_api_url = body.feedApiUrl;
            if (body.status !== undefined) clean.status = (body.status === "Y" || body.status === "Active" || body.status === true) ? "Y" : "N";
            if (body.security_enabled !== undefined) clean.security_enabled = Number(body.security_enabled) ? 1 : 0;
          }
          const { data, error } = await supabase.from("smr_clients").update(clean).eq("id", id).select().single();
          if (error) {
            console.error("Client update error:", error);
            throw error;
          }
          return { success: true, data } as unknown as T;
        }
      }
      if (path === "/security/policy") {
        for (const [k, v] of Object.entries(body)) {
          await supabase
            .from("smr_security_policy")
            .upsert({ key: k, name: k, value: v, updated_at: new Date().toISOString() }, { onConflict: "key" });
        }
        return { success: true } as unknown as T;
      }
    } catch (sqlErr) {
      console.warn("Supabase SQL PUT fallback:", sqlErr);
    }

    return request<T>("PUT", path, { body });
  },

  del: async <T = any>(path: string, body?: any): Promise<T> => {
    try {
      if (path === "/manage/users") {
        const id = body?.id;
        if (id) {
          const { error } = await supabase.from("smr_users").delete().eq("id", id);
          if (!error) return { success: true } as unknown as T;
        }
      }
      if (path.startsWith("/manage/projects/")) {
        const id = path.split("/").pop();
        if (id) {
          const { error } = await supabase.from("smr_projects").delete().eq("id", id);
          if (!error) return { success: true } as unknown as T;
        }
      }
      if (path.startsWith("/clients/") || path === "/clients" || path === "/manage/clients") {
        const id = path.startsWith("/clients/") ? path.split("/").pop() : body?.id;
        if (id) {
          const { error } = await supabase.from("smr_clients").delete().eq("id", id);
          if (error) {
            console.error("Delete client error:", error);
            throw error;
          }
          return { success: true } as unknown as T;
        }
      }
      if (path.startsWith("/manage/vendors/") || path === "/manage/vendors" || path === "/vendors") {
        const idOrCode = path.startsWith("/manage/vendors/")
          ? path.split("/").pop()
          : (body?.id || body?.dbId || body?.vendor_code || body?.vendor_id);
        if (idOrCode) {
          const isNum = /^\d+$/.test(String(idOrCode));
          const query = isNum
            ? supabase.from("smr_vendors").delete().eq("id", Number(idOrCode))
            : supabase.from("smr_vendors").delete().eq("vendor_code", String(idOrCode));
          const { error } = await query;
          if (!error) return { success: true } as unknown as T;
        }
      }
      if (path === "/vendor/allot") {
        const { error } = await supabase
          .from("smr_vendor_allotments")
          .delete()
          .eq("project_id", body.project_id)
          .eq("vendor_id", body.vendor_id);
        if (!error) return { success: true } as unknown as T;
      }
      if (path === "/team/delete") {
        const { error } = await supabase.from("smr_team").delete().eq("id", body.id);
        if (!error) return { success: true } as unknown as T;
      }
    } catch (sqlErr) {
      console.warn("Supabase SQL DEL fallback:", sqlErr);
    }

    return request<T>("DELETE", path, { body });
  },
};

/* ───────────── Domain types ───────────── */
export interface Project {
  id: number;
  project_id: string;
  project_name: string;
  client_name: string;
  client_id?: number;
  cpi: string | number;
  target_completes: number;
  ir: string | number;
  loi: string | number;
  live_url?: string;
  status: string;
  auto_pause_clicks?: number;
  createdAt?: string;
}

export interface Survey {
  survey_id: string;
  id?: number;
  survey_name: string;
  cpi: number;
  loi: number;
  ir: number;
  totalRequired?: number;
  completesNeeded?: number;
  status: string;
  client_name?: string;
  client_id?: number;
  country?: string;
  category?: string;
  studyType?: string;
  live_url?: string;
  is_cloned?: boolean;
}

export interface Client {
  id: number;
  client_code: string;
  client_name: string;
  email?: string;
  phone?: string;
  api_type?: string;
  feed_api_url?: string;
  s2s_callback_url?: string;
  master_data_url?: string;
  api_token?: string;
  secret_key?: string;
  hash_algorithm?: string;
  complete_redirect?: string;
  terminate_redirect?: string;
  overquota_redirect?: string;
  security_redirect?: string;
  security_enabled?: number;
  status?: string;
  createdAt?: string;
}

export interface Lead {
  id: number;
  project_id: string;
  project_name: string;
  vendor_code: string;
  vendor_name: string;
  uid: string;
  status: string;
  ip_address: string;
  country: string;
  reason: string;
  created_at: string;
}

export interface Allotment {
  id: number;
  project_id: string;
  vendor_id: string;
  vendor_name: string | null;
  vendor_cpi: string;
  quota_limit: number;
  complete_count: number;
  entry_link: string;
  status: string;
  created_at: string;
}

export interface Vendor {
  id?: number;
  _id?: number;
  dbId?: number;
  vendor_code?: string;
  vendor_id?: string;
  name?: string;
  vendor_name?: string;
  email?: string;
  phone?: string;
  cpi_percentage?: number | string;
  rev_share?: number | string;
  status?: string;
  [k: string]: any;
}

export interface Payment {
  id: number;
  invoice_code?: string;
  vendor_name?: string;
  vendor_id?: string;
  project_name?: string;
  amount?: string | number;
  payout_amount?: string | number;
  status: string;
  payment_method?: string;
  remarks?: string;
  created_at?: string;
  [k: string]: any;
}
