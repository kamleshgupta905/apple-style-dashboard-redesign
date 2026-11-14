import { supabase } from "./supabase";
import { num } from "./utils";

export interface NextStudyCandidate {
  project_id: string;
  project_name: string;
  live_url: string | null;
  cpi: number;
}

/**
 * Retrieve the list of study IDs already attempted by this respondent UID
 */
export function getAttemptedStudies(uid: string): string[] {
  try {
    const raw = sessionStorage.getItem(`smr_attempted_${uid}`);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed.map(String);
    }
  } catch {}
  return [];
}

/**
 * Mark a study ID as attempted by this respondent UID
 */
export function markStudyAttempted(uid: string, pid: string): void {
  if (!uid || !pid) return;
  try {
    const existing = getAttemptedStudies(uid);
    if (!existing.includes(String(pid))) {
      existing.push(String(pid));
      sessionStorage.setItem(`smr_attempted_${uid}`, JSON.stringify(existing));
    }
  } catch {}
}

/**
 * Track an entrance / click for a study and automatically enforce the auto-pause condition:
 * If a study reaches `auto_pause_clicks` (default 50, or user configured limit like 10, 30, etc.)
 * with 0 completes, automatically set status to "Pause"!
 */
export async function recordStudyClickAndCheckAutoPause(
  pid: string,
  vid: string,
  uid: string,
): Promise<{ autoPaused: boolean; isLive: boolean; clicks: number; autoPauseLimit: number; liveUrl?: string }> {
  markStudyAttempted(uid, pid);

  try {
    // 1. Fetch current study state from smr_projects
    const { data: proj, error } = await supabase
      .from("smr_projects")
      .select("id, project_id, project_name, status, total_clicks, total_completes, auto_pause_clicks, live_url")
      .eq("project_id", pid)
      .maybeSingle();

    if (error || !proj) {
      return { autoPaused: false, isLive: true, clicks: 1, autoPauseLimit: 50 };
    }

    const currentClicks = num(proj.total_clicks, 0) + 1;
    const currentCompletes = num(proj.total_completes, 0);
    const autoPauseLimit = num(proj.auto_pause_clicks, 50);

    const shouldAutoPause =
      autoPauseLimit > 0 &&
      currentClicks >= autoPauseLimit &&
      currentCompletes === 0 &&
      proj.status === "Live";

    // 2. Update smr_projects with latest clicks & auto-pause status if triggered
    if (shouldAutoPause) {
      console.warn(`[Auto-Pause Triggered] Study #${pid} reached ${currentClicks} clicks with 0 completes (limit: ${autoPauseLimit}). Auto-pausing study.`);
      await supabase
        .from("smr_projects")
        .update({
          status: "Pause",
          total_clicks: currentClicks,
          updated_at: new Date().toISOString(),
        })
        .eq("project_id", pid);
    } else {
      await supabase
        .from("smr_projects")
        .update({
          total_clicks: currentClicks,
          updated_at: new Date().toISOString(),
        })
        .eq("project_id", pid);
    }

    // 3. Record click in smr_leads for live lead stream & analytics
    try {
      const isMobile = /mobile|android|iphone|ipad/i.test(navigator.userAgent || "");
      const dev = isMobile ? "Mobile" : "Desktop";
      const now = new Date().toISOString();
      const { error: leadInsertErr } = await supabase.from("smr_leads").insert([
        {
          project_id: pid,
          project_name: proj.project_name || pid,
          vendor_code: vid || "Direct",
          vendor_name: vid || "Direct",
          uid,
          status: "Pending",
          device: dev,
          ip_address: "Live Session",
          country: "—",
          created_at: now,
        },
      ]);
      if (leadInsertErr) {
        await supabase.from("smr_leads").insert([
          {
            project_id: pid,
            project_name: proj.project_name || pid,
            vendor: vid || "Direct",
            uid,
            status: "Pending",
            device: dev,
            ip: "Live Session",
            created_at: now,
          },
        ]);
      }
    } catch (leadErr) {
      console.warn("Could not insert smr_lead record:", leadErr);
    }

    return {
      autoPaused: shouldAutoPause,
      isLive: !shouldAutoPause && proj.status === "Live",
      clicks: currentClicks,
      autoPauseLimit,
      liveUrl: proj.live_url || undefined,
    };
  } catch (e) {
    console.warn("Click tracking error:", e);
    return { autoPaused: false, isLive: true, clicks: 1, autoPauseLimit: 50 };
  }
}

/**
 * Record a successful completion (Status 10) in smr_projects, smr_vendor_allotments & smr_leads
 */
export async function recordStudyComplete(pid: string, vid: string, uid: string): Promise<void> {
  markStudyAttempted(uid, pid);

  try {
    // 1. Increment total_completes in smr_projects
    const { data: proj } = await supabase
      .from("smr_projects")
      .select("id, total_completes")
      .eq("project_id", pid)
      .maybeSingle();

    if (proj) {
      const newCompletes = num(proj.total_completes, 0) + 1;
      await supabase
        .from("smr_projects")
        .update({
          total_completes: newCompletes,
          updated_at: new Date().toISOString(),
        })
        .eq("project_id", pid);
    }

    // 2. Increment complete_count in smr_vendor_allotments if vid is present
    if (vid) {
      const { data: allot } = await supabase
        .from("smr_vendor_allotments")
        .select("id, complete_count")
        .eq("vendor_id", vid)
        .eq("project_id", pid)
        .maybeSingle();

      if (allot) {
        const newAllotComp = num(allot.complete_count, 0) + 1;
        await supabase
          .from("smr_vendor_allotments")
          .update({
            complete_count: newAllotComp,
            updated_at: new Date().toISOString(),
          })
          .eq("id", allot.id);
      }
    }

    // 3. Update lead status in smr_leads
    try {
      await supabase
        .from("smr_leads")
        .update({ status: "Complete", updated_at: new Date().toISOString() })
        .eq("uid", uid)
        .eq("project_id", pid);
    } catch {}
  } catch (err) {
    console.warn("recordStudyComplete error:", err);
  }
}

/**
 * Record a disqualification (Terminate 20, Quota Full 30, Security 40)
 */
export async function recordStudyDisqualify(
  pid: string,
  vid: string,
  uid: string,
  status: "20" | "30" | "40",
  reason?: string,
): Promise<void> {
  markStudyAttempted(uid, pid);

  const statusName = status === "20" ? "Terminate" : status === "30" ? "Overquota" : "Security";

  try {
    // Update smr_leads
    await supabase
      .from("smr_leads")
      .update({
        status: statusName,
        reason: reason || null,
        updated_at: new Date().toISOString(),
      })
      .eq("uid", uid)
      .eq("project_id", pid);
  } catch {}

  // Also log security flags if status 40
  if (status === "40") {
    try {
      await supabase.from("smr_fraud_logs").insert([
        {
          project_id: pid,
          vendor: vid || "Unknown",
          uid,
          reason: reason || "Security Policy Gate Block",
          check_type: "Waterfall Security Block",
          risk_score: 85,
          action: "BLOCKED",
          created_at: new Date().toISOString(),
        },
      ]);
    } catch {}
  }
}

/**
 * Smart Waterfall Rerouter:
 * Searches for the next available, live, non-auto-paused study that this respondent
 * has not yet attempted. Prioritizes active vendor allotments by highest CPI first,
 * then falls back to any live SMR study.
 */
export async function findNextAvailableStudy(
  currentPid: string,
  vid: string,
  uid: string,
): Promise<NextStudyCandidate | null> {
  try {
    const attempted = getAttemptedStudies(uid);
    if (currentPid && !attempted.includes(String(currentPid))) {
      attempted.push(String(currentPid));
    }

    // 1. If vid is provided, check vendor's active allotments first
    if (vid) {
      const { data: allotments } = await supabase
        .from("smr_vendor_allotments")
        .select("project_id, quota_limit, complete_count, vendor_cpi")
        .eq("vendor_id", vid)
        .eq("status", "Active");

      if (allotments && allotments.length > 0) {
        // Filter out completed quotas and attempted projects
        const availableAllots = allotments.filter((a) => {
          if (attempted.includes(String(a.project_id))) return false;
          const limit = num(a.quota_limit, 0);
          const comp = num(a.complete_count, 0);
          return limit <= 0 || comp < limit;
        });

        const candidatePids = availableAllots.map((a) => String(a.project_id));

        if (candidatePids.length > 0) {
          // Check which of these are Live in smr_projects
          const { data: projects } = await supabase
            .from("smr_projects")
            .select("project_id, project_name, status, live_url, cpi, total_clicks, total_completes, auto_pause_clicks")
            .in("project_id", candidatePids)
            .eq("status", "Live");

          const validProjects = (projects || []).filter((p) => {
            const th = num(p.auto_pause_clicks, 50);
            const clicks = num(p.total_clicks, 0);
            const comp = num(p.total_completes, 0);
            // If study reached auto-pause click limit with 0 completes, auto-pause it and skip
            if (th > 0 && clicks >= th && comp === 0) {
              supabase.from("smr_projects").update({ status: "Pause" }).eq("project_id", p.project_id).then();
              return false;
            }
            return true;
          });

          if (validProjects.length > 0) {
            // Sort by highest CPI
            validProjects.sort((a, b) => num(b.cpi, 0) - num(a.cpi, 0));
            const best = validProjects[0];
            return {
              project_id: String(best.project_id),
              project_name: String(best.project_name || best.project_id),
              live_url: best.live_url || null,
              cpi: num(best.cpi, 0),
            };
          }
        }
      }
    }

    // 2. Global Fallback: Check all live studies in smr_projects that have not been attempted
    const { data: allLive } = await supabase
      .from("smr_projects")
      .select("project_id, project_name, status, live_url, cpi, total_clicks, total_completes, auto_pause_clicks")
      .eq("status", "Live");

    const fallbackCandidates = (allLive || []).filter((p) => {
      const pidStr = String(p.project_id);
      if (attempted.includes(pidStr)) return false;
      const th = num(p.auto_pause_clicks, 50);
      const clicks = num(p.total_clicks, 0);
      const comp = num(p.total_completes, 0);
      if (th > 0 && clicks >= th && comp === 0) {
        supabase.from("smr_projects").update({ status: "Pause" }).eq("project_id", p.project_id).then();
        return false;
      }
      return true;
    });

    if (fallbackCandidates.length > 0) {
      fallbackCandidates.sort((a, b) => num(b.cpi, 0) - num(a.cpi, 0));
      const best = fallbackCandidates[0];
      return {
        project_id: String(best.project_id),
        project_name: String(best.project_name || best.project_id),
        live_url: best.live_url || null,
        cpi: num(best.cpi, 0),
      };
    }

    return null;
  } catch (err) {
    console.warn("Waterfall findNextAvailableStudy lookup error:", err);
    return null;
  }
}
