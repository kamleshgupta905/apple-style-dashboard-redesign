import { createClient } from "@supabase/supabase-js";

const envViteUrl = typeof import.meta !== "undefined" && (import.meta as any).env?.VITE_SUPABASE_URL;
const envNodeUrl = typeof process !== "undefined" ? process.env?.VITE_SUPABASE_URL : undefined;
const envViteKey = typeof import.meta !== "undefined" && (import.meta as any).env?.VITE_SUPABASE_ANON_KEY;
const envNodeKey = typeof process !== "undefined" ? process.env?.VITE_SUPABASE_ANON_KEY : undefined;

export const SUPABASE_URL =
  (envViteUrl as string) ||
  envNodeUrl ||
  "https://ggpuufujpameiielimpw.supabase.co";

export const SUPABASE_ANON_KEY =
  (envViteKey as string) ||
  envNodeKey ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdncHV1ZnVqcGFtZWlpZWxpbXB3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk2MDUwODcsImV4cCI6MjA3NTE4MTA4N30.qE34BAEDls62iYqQTWzegL7dVsOkoBdzZ94HhQHd1TM";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
