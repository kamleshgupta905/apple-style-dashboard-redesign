import { createClient } from "@supabase/supabase-js";

export const SUPABASE_URL =
  (import.meta.env.VITE_SUPABASE_URL as string) ||
  "https://ggpuufujpameiielimpw.supabase.co";

export const SUPABASE_ANON_KEY =
  (import.meta.env.VITE_SUPABASE_ANON_KEY as string) ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdncHV1ZnVqcGFtZWlpZWxpbXB3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk2MDUwODcsImV4cCI6MjA3NTE4MTA4N30.qE34BAEDls62iYqQTWzegL7dVsOkoBdzZ94HhQHd1TM";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
