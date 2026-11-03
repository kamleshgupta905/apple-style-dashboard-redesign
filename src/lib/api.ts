/**
 * API layer for the VMH SMR gateway.
 * Endpoints were mapped from the original dashboard bundle + repo docs.
 */
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

export const api = {
  get: <T = any>(path: string, params?: Params) => request<T>("GET", path, { params }),
  post: <T = any>(path: string, body?: unknown) => request<T>("POST", path, { body: body ?? {} }),
  put: <T = any>(path: string, body?: unknown) => request<T>("PUT", path, { body: body ?? {} }),
  del: <T = any>(path: string, body?: unknown) => request<T>("DELETE", path, { body: body ?? {} }),
};

export async function login(username: string, password: string) {
  const res = await request<{ token: string; user: AuthUser }>("POST", "/auth/login", { body: { username, password } });
  auth.save(res.token, res.user);
  return res.user;
}

export async function refreshCurrentUser(): Promise<AuthUser | null> {
  const cur = auth.user();
  if (!cur) return null;
  try {
    const res = await api.get<{ data: any[] }>("/manage/users");
    if (res?.data && Array.isArray(res.data)) {
      const matched = res.data.find((u) => u.id === cur.id || u.username === cur.username);
      if (matched) {
        const updated: AuthUser = {
          ...cur,
          ...matched,
          permissions: matched.menu_permissions || matched.permissions || cur.permissions,
          menu_permissions: matched.menu_permissions || matched.permissions || cur.menu_permissions,
        };
        auth.save(auth.token(), updated);
        return updated;
      }
    }
  } catch {
    // Keep cached user if offline or network failure
  }
  return cur;
}

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
