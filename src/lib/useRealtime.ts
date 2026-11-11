import { useEffect } from "react";
import { supabase } from "./supabase";

/**
 * Universal Supabase Realtime Hook
 * Subscribes to postgres_changes on one or more tables and triggers onChange callback in real time.
 */
export function useRealtime(
  tables: string | string[],
  onChange: (payload: any) => void,
  enabled: boolean = true
) {
  useEffect(() => {
    if (!enabled) return;

    const tableList = Array.isArray(tables) ? tables : [tables];
    const channelId = `realtime_${tableList.join("_")}_${Date.now()}`;
    const channel = supabase.channel(channelId);

    tableList.forEach((table) => {
      channel.on(
        "postgres_changes",
        { event: "*", schema: "public", table },
        (payload) => {
          onChange(payload);
        }
      );
    });

    channel.subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [JSON.stringify(tables), enabled]);
}
