import { useEffect, useRef } from "react";
import { supabase } from "./supabase";

/**
 * Emit an in-app realtime sync signal when local API mutations complete.
 * Guarantees instant UI updates alongside Supabase postgres_changes.
 */
export function emitRealtimeEvent(table: string, detail?: any) {
  if (typeof window === "undefined") return;
  try {
    window.dispatchEvent(new CustomEvent("smr:realtime", { detail: { table, ...detail } }));
  } catch {}
}

/**
 * Universal Supabase Realtime Hook
 * Subscribes to postgres_changes on one or more tables + local mutation broadcasts,
 * using a fresh callback ref and a 250ms debounce to coalesce bulk bursts.
 */
export function useRealtime(
  tables: string | string[],
  onChange: (payload: any) => void,
  enabled: boolean = true,
) {
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  const key = Array.isArray(tables) ? tables.join(",") : tables;

  useEffect(() => {
    if (!enabled) return;

    const tableList = Array.isArray(tables) ? tables : [tables];
    const tableSet = new Set(tableList);
    let debounceTimer: ReturnType<typeof setTimeout> | null = null;

    const trigger = (payload: any) => {
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        onChangeRef.current(payload);
      }, 250);
    };

    const channelId = `realtime_${tableList.join("_")}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const channel = supabase.channel(channelId);

    tableList.forEach((table) => {
      channel.on(
        "postgres_changes",
        { event: "*", schema: "public", table },
        (payload) => trigger(payload),
      );
    });

    channel.subscribe();

    const handleLocalEvent = (ev: Event) => {
      const detail = (ev as CustomEvent)?.detail;
      if (!detail?.table || tableSet.has(detail.table)) {
        trigger(detail || { eventType: "LOCAL_MUTATION" });
      }
    };

    if (typeof window !== "undefined") {
      window.addEventListener("smr:realtime", handleLocalEvent);
    }

    return () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      if (typeof window !== "undefined") {
        window.removeEventListener("smr:realtime", handleLocalEvent);
      }
      supabase.removeChannel(channel);
    };
  }, [key, enabled]);
}
