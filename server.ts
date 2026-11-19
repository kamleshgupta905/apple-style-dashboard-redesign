import path from "path";
import { fileURLToPath } from "url";
import express, { type Request, type Response } from "express";
import { supabase } from "./src/lib/supabase.ts";
import {
  buildSanitizedSupplyStudies,
  isAccessKey32,
  resolveVendorByAccessKey,
} from "./src/lib/partnerKey.ts";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PORT = Number(process.env.PORT) || 3000;
const GATEWAY_BASE = "https://api.vmhgroupsmr.com/api";

function getPublicOrigin(req: Request): string {
  const host = String(req.get("x-forwarded-host") || req.get("host") || "");
  if (host.includes("vmhgroupsmr.com")) {
    const proto = String(req.get("x-forwarded-proto") || req.protocol || "https");
    return `${proto}://${host}`;
  }
  return "https://api.vmhgroupsmr.com";
}

function extractAccessKey(req: Request): string {
  const hdr =
    req.header("access-key") ||
    req.header("x-access-key") ||
    req.header("x-api-key") ||
    "";
  if (hdr) return hdr.trim();

  const auth = req.header("authorization") || "";
  if (auth.toLowerCase().startsWith("bearer ")) {
    return auth.slice(7).trim();
  }

  const q = req.query;
  const fromQuery = q.key || q.access_key || q.api_key || q.vid || q.vendor_id;
  return typeof fromQuery === "string" ? fromQuery.trim() : "";
}

async function fetchGatewayArray(pathname: string): Promise<any[]> {
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 3500);
    const res = await fetch(`${GATEWAY_BASE}${pathname}`, { signal: ctrl.signal });
    clearTimeout(timer);
    if (!res.ok) return [];
    const json: any = await res.json();
    return Array.isArray(json?.data) ? json.data : [];
  } catch {
    return [];
  }
}

async function loadMergedSupplyTables() {
  const [supaAllots, supaProjects, gwAllots, gwProjects] = await Promise.all([
    supabase.from("smr_vendor_allotments").select("*").order("id", { ascending: false }),
    supabase.from("smr_projects").select("*").order("id", { ascending: false }),
    fetchGatewayArray("/vendor/allotments"),
    fetchGatewayArray("/manage/projects"),
  ]);

  const allotMap = new Map<string, any>();
  gwAllots.forEach((a: any, i: number) => {
    const k = `${String(a.vendor_id || "").toLowerCase().trim()}::${String(a.project_id || "").toLowerCase().trim()}`;
    allotMap.set(k !== "::" ? k : `gw-${a.id ?? i}`, a);
  });
  (supaAllots.data || []).forEach((a: any, i: number) => {
    const k = `${String(a.vendor_id || "").toLowerCase().trim()}::${String(a.project_id || "").toLowerCase().trim()}`;
    allotMap.set(k !== "::" ? k : `supa-${a.id ?? i}`, a);
  });

  const projMap = new Map<string, any>();
  gwProjects.forEach((p: any) => {
    const k = String(p.project_id || p.id || "").toLowerCase().trim();
    if (k) projMap.set(k, p);
  });
  (supaProjects.data || []).forEach((p: any) => {
    const k = String(p.project_id || p.id || "").toLowerCase().trim();
    if (k) projMap.set(k, p);
  });

  return {
    allots: Array.from(allotMap.values()),
    projects: Array.from(projMap.values()),
  };
}

async function start() {
  const app = express();
  app.use(express.json());

  // CORS for programmatic supply partner API requests
  app.use("/api", (req, res, next) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, access-key, x-access-key, x-api-key, authorization");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    if (req.method === "OPTIONS") {
      res.status(204).end();
      return;
    }
    next();
  });

  app.get("/api/health", (_req: Request, res: Response) => {
    res.json({ ok: true, brand: "VMH GROUP", service: "vmh-partner-supply-api" });
  });

  // OpenAPI 3.0.3 JSON specification
  app.get("/api/supply/openapi.json", (req: Request, res: Response) => {
    const origin = getPublicOrigin(req);
    res.json({
      openapi: "3.0.3",
      info: {
        title: "VMH GROUP · Supply Partner API",
        version: "1.0.0",
        description:
          "Programmatic Supply API for VMH GROUP survey partners. Authenticate using your 32-character partner access-key header to retrieve allotted live studies, remaining quotas, payout CPIs, and entry links.",
      },
      servers: [{ url: origin, description: "VMH GROUP Production API Gateway" }],
      components: {
        securitySchemes: {
          AccessKeyAuth: {
            type: "apiKey",
            in: "header",
            name: "access-key",
            description: "32-character partner Access Key issued by VMH GROUP",
          },
        },
        schemas: {
          SupplySurvey: {
            type: "object",
            properties: {
              survey_id: { type: "string", example: "2141504327" },
              survey_name: { type: "string", example: "Consumer Insights Study" },
              brand: { type: "string", example: "VMH GROUP" },
              cpi: { type: "number", format: "float", example: 1.25 },
              currency: { type: "string", example: "USD" },
              loi: { type: "integer", example: 12 },
              ir: { type: "integer", example: 70 },
              quota_limit: { type: "integer", example: 250 },
              completes: { type: "integer", example: 8 },
              remaining_quota: { type: "integer", example: 242 },
              country: { type: "string", example: "US" },
              status: { type: "string", example: "Live" },
              entry_link: {
                type: "string",
                example: `${origin}/#/prescreener?pid=2141504327&key=<32-char-access-key>&uid=[RESPONDENT_ID]`,
              },
            },
          },
        },
      },
      security: [{ AccessKeyAuth: [] }],
      paths: {
        "/api/supply/projects": {
          get: {
            summary: "Get Live Allotted Surveys",
            description: "Returns only active surveys currently assigned to your partner Access Key.",
            responses: {
              "200": {
                description: "Allotted surveys retrieved successfully",
                content: {
                  "application/json": {
                    schema: {
                      type: "object",
                      properties: {
                        success: { type: "boolean" },
                        brand: { type: "string" },
                        total: { type: "integer" },
                        universal_router_url: { type: "string" },
                        surveys: {
                          type: "array",
                          items: { $ref: "#/components/schemas/SupplySurvey" },
                        },
                      },
                    },
                  },
                },
              },
              "401": { description: "Missing or invalid 32-character access-key" },
            },
          },
        },
        "/api/supply/projects/{survey_id}": {
          get: {
            summary: "Get Single Survey Specification",
            parameters: [
              {
                name: "survey_id",
                in: "path",
                required: true,
                schema: { type: "string" },
                description: "Assigned Survey ID",
              },
            ],
            responses: {
              "200": {
                description: "Survey details retrieved",
                content: {
                  "application/json": {
                    schema: {
                      type: "object",
                      properties: {
                        success: { type: "boolean" },
                        brand: { type: "string" },
                        survey: { $ref: "#/components/schemas/SupplySurvey" },
                      },
                    },
                  },
                },
              },
              "401": { description: "Missing or invalid 32-character access-key" },
              "404": { description: "Survey not found or not assigned to this access-key" },
            },
          },
        },
      },
    });
  });

  // Live Programmatic Supply API: List Allotted Projects
  const handleListProjects = async (req: Request, res: Response, strictKeyOnly: boolean) => {
    try {
      const token = extractAccessKey(req);
      if (!token) {
        res.status(401).json({
          success: false,
          brand: "VMH GROUP",
          error: "Missing access-key header. Pass your 32-character Partner Access Key in header: access-key.",
        });
        return;
      }

      if (strictKeyOnly && !isAccessKey32(token)) {
        res.status(401).json({
          success: false,
          brand: "VMH GROUP",
          error: "Invalid access-key format. Expected 32-character hexadecimal Access Key.",
        });
        return;
      }

      const vendor = await resolveVendorByAccessKey(token, { strictKeyOnly });
      if (!vendor) {
        res.status(401).json({
          success: false,
          brand: "VMH GROUP",
          error: "Invalid or revoked access-key.",
        });
        return;
      }

      if (String(vendor.status || "").toLowerCase() === "inactive") {
        res.status(403).json({
          success: false,
          brand: "VMH GROUP",
          error: "Partner account is currently inactive.",
        });
        return;
      }

      const origin = getPublicOrigin(req);
      const { allots, projects } = await loadMergedSupplyTables();
      const surveys = buildSanitizedSupplyStudies({
        vendorCode: vendor.vendor_code,
        accessKey: vendor.access_key,
        allots,
        projects,
        origin,
      });

      res.json({
        success: true,
        brand: "VMH GROUP",
        total: surveys.length,
        generated_at: new Date().toISOString(),
        universal_router_url: `${origin}/#/router?key=${encodeURIComponent(vendor.access_key)}&uid=[RESPONDENT_ID]`,
        surveys,
      });
    } catch (err: any) {
      res.status(500).json({
        success: false,
        brand: "VMH GROUP",
        error: err?.message || "Failed to query supply inventory.",
      });
    }
  };

  // Live Programmatic Supply API: Single Project
  const handleSingleProject = async (req: Request, res: Response, strictKeyOnly: boolean) => {
    try {
      const token = extractAccessKey(req);
      if (!token || (strictKeyOnly && !isAccessKey32(token))) {
        res.status(401).json({
          success: false,
          brand: "VMH GROUP",
          error: "Invalid or missing 32-character access-key header.",
        });
        return;
      }

      const vendor = await resolveVendorByAccessKey(token, { strictKeyOnly });
      if (!vendor) {
        res.status(401).json({
          success: false,
          brand: "VMH GROUP",
          error: "Invalid or revoked access-key.",
        });
        return;
      }

      const surveyId = String(req.params.studyId || req.query.survey_id || "").trim();
      if (!surveyId) {
        res.status(400).json({ success: false, brand: "VMH GROUP", error: "survey_id is required." });
        return;
      }

      const origin = getPublicOrigin(req);
      const { allots, projects } = await loadMergedSupplyTables();
      const surveys = buildSanitizedSupplyStudies({
        vendorCode: vendor.vendor_code,
        accessKey: vendor.access_key,
        allots,
        projects,
        origin,
      });
      const match = surveys.find((s) => s.survey_id.toLowerCase() === surveyId.toLowerCase());

      if (!match) {
        res.status(404).json({
          success: false,
          brand: "VMH GROUP",
          error: "Survey not found or not currently live/allotted for this access-key.",
        });
        return;
      }

      res.json({
        success: true,
        brand: "VMH GROUP",
        survey: match,
      });
    } catch (err: any) {
      res.status(500).json({
        success: false,
        brand: "VMH GROUP",
        error: err?.message || "Failed to query survey specification.",
      });
    }
  };

  app.get("/api/supply/projects", (req, res) => void handleListProjects(req, res, true));
  app.get("/api/supply/projects/:studyId", (req, res) => void handleSingleProject(req, res, true));
  app.get("/api/supplier/getAllSurveys", (req, res) => void handleListProjects(req, res, false));
  app.get("/api/supplier/getSurveyDetails", (req, res) => void handleSingleProject(req, res, false));

  if (process.env.NODE_ENV !== "production") {
    const { createServer } = await import("vite");
    const vite = await createServer({
      server: { middlewareMode: true, hmr: false },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(__dirname, "dist");
    app.use(express.static(distDir));
    app.get("*", (_req, res) => {
      res.sendFile(path.join(distDir, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`VMH GROUP server listening on http://0.0.0.0:${PORT}`);
  });
}

void start();
