import { useEffect, useState } from "react";
import { supabase } from "./supabase";

const STORAGE_KEY = "smr_hidden_nav_items";
const POLICY_KEY = "ui_hidden_nav_items";
const EVENT_NAME = "smr-nav-config-changed";

export function getHiddenNavItems(): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((x) => typeof x === "string" && x !== "settings") : [];
  } catch {
    return [];
  }
}

function broadcastHiddenNavItems(ids: string[]) {
  const clean = Array.from(new Set(ids.filter((x) => typeof x === "string" && x !== "settings")));
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(clean));
  } catch {
    // ignore storage errors
  }
  window.dispatchEvent(new CustomEvent(EVENT_NAME, { detail: clean }));
  return clean;
}

export async function fetchHiddenNavItems(): Promise<string[]> {
  try {
    const { data, error } = await supabase
      .from("smr_security_policy")
      .select("value")
      .eq("key", POLICY_KEY)
      .maybeSingle();
    if (!error && data && Array.isArray(data.value)) {
      return broadcastHiddenNavItems(data.value);
    }
  } catch (e) {
    console.warn("Could not load navbar visibility settings:", e);
  }
  return getHiddenNavItems();
}

export async function saveHiddenNavItems(ids: string[]): Promise<string[]> {
  const clean = broadcastHiddenNavItems(ids);
  try {
    const { error } = await supabase.from("smr_security_policy").upsert(
      {
        key: POLICY_KEY,
        name: "Hidden Navbar Items",
        value: clean,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "key" },
    );
    if (error) throw error;
  } catch (e) {
    console.warn("Could not persist navbar visibility to Supabase:", e);
    throw e;
  }
  return clean;
}

export function useHiddenNavItems() {
  const [hiddenIds, setHiddenIds] = useState<string[]>(() => getHiddenNavItems());

  useEffect(() => {
    let active = true;
    fetchHiddenNavItems().then((ids) => {
      if (active) setHiddenIds(ids);
    });

    const onLocal = (e: Event) => {
      const detail = (e as CustomEvent<string[]>).detail;
      if (Array.isArray(detail)) {
        setHiddenIds(detail);
      } else {
        setHiddenIds(getHiddenNavItems());
      }
    };
    const onStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) {
        setHiddenIds(getHiddenNavItems());
      }
    };

    window.addEventListener(EVENT_NAME, onLocal);
    window.addEventListener("storage", onStorage);
    return () => {
      active = false;
      window.removeEventListener(EVENT_NAME, onLocal);
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  return hiddenIds;
}
