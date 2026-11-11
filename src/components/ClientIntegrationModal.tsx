import { useState } from "react";
import {
  Copy,
  Check,
  Link2,
  Code2,
  ShieldCheck,
  ExternalLink,
  ArrowRight,
  Globe,
  Key,
} from "lucide-react";
import { supabase } from "../lib/supabase";
import { Badge, Button, CopyButton, Field, Input, Modal, Segmented } from "./ui";
import { useFeedback } from "./feedback";

export function ClientIntegrationModal({
  client,
  onClose,
  onSaved,
}: {
  client: any | null;
  onClose: () => void;
  onSaved?: () => void;
}) {
  const { toast } = useFeedback();
  const [tab, setTab] = useState<"inbound" | "s2s" | "outbound">("inbound");
  const [copiedAll, setCopiedAll] = useState(false);
  const [busy, setBusy] = useState(false);

  // Outbound redirects state
  const [completeRedirect, setCompleteRedirect] = useState(client?.complete_redirect || "");
  const [terminateRedirect, setTerminateRedirect] = useState(client?.terminate_redirect || "");
  const [overquotaRedirect, setOverquotaRedirect] = useState(client?.overquota_redirect || "");
  const [securityRedirect, setSecurityRedirect] = useState(client?.security_redirect || "");

  if (!client) return null;

  const cCode = client.client_code || client.client_name?.replace(/\s+/g, "_").toUpperCase() || "CLIENT";
  const cName = client.client_name || cCode;
  const origin = typeof window !== "undefined" ? window.location.origin : "https://api.vmhgroupsmr.com";

  // Inbound Return Redirect URLs (Given to Client)
  const cbComplete = `${origin}/#/callback?status=10&pid=[PID]&uid=[UID]`;
  const cbTerm = `${origin}/#/callback?status=20&pid=[PID]&uid=[UID]`;
  const cbOverquota = `${origin}/#/callback?status=30&pid=[PID]&uid=[UID]`;
  const cbSecurity = `${origin}/#/callback?status=40&pid=[PID]&uid=[UID]`;

  // Server S2S Endpoints
  const srvComplete = `${origin}/redirects/c/${encodeURIComponent(cCode)}/complete?rid=[identifier]&hash=[hash]`;
  const srvTerm = `${origin}/redirects/c/${encodeURIComponent(cCode)}/terminate?rid=[identifier]&hash=[hash]`;
  const srvOverquota = `${origin}/redirects/c/${encodeURIComponent(cCode)}/quotafull?rid=[identifier]&hash=[hash]`;
  const srvSecurity = `${origin}/redirects/c/${encodeURIComponent(cCode)}/quality_terminate?rid=[identifier]&hash=[hash]`;

  const copyAllRedirects = () => {
    const text =
      `*SMR Platform Inbound Return Redirects for ${cName} (Code: ${cCode})*\n` +
      `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
      `Please configure your survey software to redirect respondents to the matching URL upon survey exit:\n\n` +
      `1. COMPLETE / SUCCESS (Status 10):\n${cbComplete}\n` +
      `   (Server REST: ${srvComplete})\n\n` +
      `2. TERMINATE / SCREENOUT (Status 20):\n${cbTerm}\n` +
      `   (Server REST: ${srvTerm})\n\n` +
      `3. OVERQUOTA / QUOTA FULL (Status 30):\n${cbOverquota}\n` +
      `   (Server REST: ${srvOverquota})\n\n` +
      `4. SECURITY / QUALITY SCREENOUT (Status 40):\n${cbSecurity}\n` +
      `   (Server REST: ${srvSecurity})\n\n` +
      `Anti-Tamper Security: ${client.hash_algorithm || "SHA-256"} Verification Enabled\n` +
      `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
      `Note: Replace [UID] with the respondent identifier and [PID] with your assigned study ID.`;

    navigator.clipboard.writeText(text);
    setCopiedAll(true);
    toast("All 4 Inbound Redirect URLs copied to clipboard!", "success");
    setTimeout(() => setCopiedAll(false), 2500);
  };

  const saveOutbound = async () => {
    setBusy(true);
    try {
      const { error } = await supabase
        .from("smr_clients")
        .update({
          complete_redirect: completeRedirect.trim() || null,
          terminate_redirect: terminateRedirect.trim() || null,
          overquota_redirect: overquotaRedirect.trim() || null,
          security_redirect: securityRedirect.trim() || null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", client.id);

      if (error) throw error;
      toast(`Outbound redirect URLs updated for ${cName}!`);
      onSaved?.();
    } catch (e: any) {
      toast(e.message || "Failed to save redirects", "error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open={true}
      onClose={onClose}
      title={`Client Integration & Redirects · ${cName}`}
      subtitle={`Code: ${cCode} · Manage return redirects to give to client and S2S API credentials`}
      size="lg"
      footer={
        <div className="flex w-full items-center justify-between">
          <span className="text-[12px] text-ink-3">
            Realtime SMR Data Gateway · VMH GROUP
          </span>
          <Button variant="secondary" onClick={onClose}>
            Close
          </Button>
        </div>
      }
    >
      <Segmented
        value={tab}
        onChange={(t) => setTab(t as any)}
        options={[
          { value: "inbound", label: "Inbound Redirects" },
          { value: "s2s", label: "S2S API & Keys" },
          { value: "outbound", label: "Outbound URLs" },
        ]}
        className="w-full mb-5"
      />

      {/* ──────────────── TAB 1: INBOUND REDIRECTS (Give to Client) ──────────────── */}
      {tab === "inbound" && (
        <div className="space-y-4">
          {/* Dashboard UI styled Onboarding Card */}
          <div className="rounded-2xl border border-line bg-fill/50 p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="flex h-7 w-7 items-center justify-center rounded-xl bg-accent-soft text-accent">
                  <Link2 size={15} />
                </span>
                <h4 className="text-[14px] font-semibold text-ink">
                  Client Onboarding Redirect Package
                </h4>
              </div>
              <p className="text-[12px] text-ink-3 leading-relaxed">
                Send these 4 links to <strong className="font-semibold text-ink">{cName}</strong> so their questionnaire redirects respondents back to your SMR platform.
              </p>
            </div>
            <Button
              variant="primary"
              size="sm"
              icon={copiedAll ? <Check size={14} className="text-white" /> : <Copy size={14} />}
              onClick={copyAllRedirects}
              className="shrink-0 font-medium"
            >
              {copiedAll ? "All 4 Copied!" : "Copy All 4 Redirects"}
            </Button>
          </div>

          <div className="space-y-3">
            {/* 1. Complete */}
            <div className="rounded-2xl border border-line bg-surface p-4 space-y-2.5 transition-colors hover:border-line-hover">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="h-2 w-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)] shrink-0" />
                  <span className="text-[13px] font-semibold text-ink truncate">
                    1. Complete Redirect
                  </span>
                  <Badge tone="green">Status 10</Badge>
                </div>
                <CopyButton text={cbComplete} />
              </div>
              <div className="rounded-xl border border-line/50 bg-fill p-2.5 font-mono text-[12px] text-ink break-all select-all">
                {cbComplete}
              </div>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 pt-0.5 text-[11px] text-ink-3">
                <div className="flex items-center gap-1.5 min-w-0">
                  <span className="shrink-0 text-ink-3">Server REST S2S:</span>
                  <span className="font-mono text-ink-2 truncate">{srvComplete}</span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(srvComplete);
                    toast("Server REST Complete URL copied!");
                  }}
                  className="shrink-0 text-[11px] font-medium text-accent hover:underline flex items-center gap-1 cursor-pointer"
                >
                  <Copy size={11} /> Copy S2S
                </button>
              </div>
            </div>

            {/* 2. Terminate */}
            <div className="rounded-2xl border border-line bg-surface p-4 space-y-2.5 transition-colors hover:border-line-hover">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="h-2 w-2 rounded-full bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.5)] shrink-0" />
                  <span className="text-[13px] font-semibold text-ink truncate">
                    2. Terminate / Screenout
                  </span>
                  <Badge tone="red">Status 20</Badge>
                </div>
                <CopyButton text={cbTerm} />
              </div>
              <div className="rounded-xl border border-line/50 bg-fill p-2.5 font-mono text-[12px] text-ink break-all select-all">
                {cbTerm}
              </div>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 pt-0.5 text-[11px] text-ink-3">
                <div className="flex items-center gap-1.5 min-w-0">
                  <span className="shrink-0 text-ink-3">Server REST S2S:</span>
                  <span className="font-mono text-ink-2 truncate">{srvTerm}</span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(srvTerm);
                    toast("Server REST Terminate URL copied!");
                  }}
                  className="shrink-0 text-[11px] font-medium text-accent hover:underline flex items-center gap-1 cursor-pointer"
                >
                  <Copy size={11} /> Copy S2S
                </button>
              </div>
            </div>

            {/* 3. Overquota */}
            <div className="rounded-2xl border border-line bg-surface p-4 space-y-2.5 transition-colors hover:border-line-hover">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="h-2 w-2 rounded-full bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.5)] shrink-0" />
                  <span className="text-[13px] font-semibold text-ink truncate">
                    3. Overquota / Quota Full
                  </span>
                  <Badge tone="amber">Status 30</Badge>
                </div>
                <CopyButton text={cbOverquota} />
              </div>
              <div className="rounded-xl border border-line/50 bg-fill p-2.5 font-mono text-[12px] text-ink break-all select-all">
                {cbOverquota}
              </div>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 pt-0.5 text-[11px] text-ink-3">
                <div className="flex items-center gap-1.5 min-w-0">
                  <span className="shrink-0 text-ink-3">Server REST S2S:</span>
                  <span className="font-mono text-ink-2 truncate">{srvOverquota}</span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(srvOverquota);
                    toast("Server REST Overquota URL copied!");
                  }}
                  className="shrink-0 text-[11px] font-medium text-accent hover:underline flex items-center gap-1 cursor-pointer"
                >
                  <Copy size={11} /> Copy S2S
                </button>
              </div>
            </div>

            {/* 4. Security */}
            <div className="rounded-2xl border border-line bg-surface p-4 space-y-2.5 transition-colors hover:border-line-hover">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="h-2 w-2 rounded-full bg-purple-500 shadow-[0_0_8px_rgba(168,85,247,0.5)] shrink-0" />
                  <span className="text-[13px] font-semibold text-ink truncate">
                    4. Security / Fraud Screenout
                  </span>
                  <Badge tone="purple">Status 40</Badge>
                </div>
                <CopyButton text={cbSecurity} />
              </div>
              <div className="rounded-xl border border-line/50 bg-fill p-2.5 font-mono text-[12px] text-ink break-all select-all">
                {cbSecurity}
              </div>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 pt-0.5 text-[11px] text-ink-3">
                <div className="flex items-center gap-1.5 min-w-0">
                  <span className="shrink-0 text-ink-3">Server REST S2S:</span>
                  <span className="font-mono text-ink-2 truncate">{srvSecurity}</span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(srvSecurity);
                    toast("Server REST Security Screenout URL copied!");
                  }}
                  className="shrink-0 text-[11px] font-medium text-accent hover:underline flex items-center gap-1 cursor-pointer"
                >
                  <Copy size={11} /> Copy S2S
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ──────────────── TAB 2: S2S API & WEBHOOKS ──────────────── */}
      {tab === "s2s" && (
        <div className="space-y-4">
          <div className="rounded-2xl border border-line bg-surface p-4 space-y-3">
            <h4 className="text-[14px] font-semibold text-ink flex items-center gap-2">
              <Code2 size={16} className="text-accent" />
              S2S Callback Webhook Endpoint
            </h4>
            <p className="text-[12px] text-ink-3">
              If {cName} notifies your platform via server-to-server webhook, give them this endpoint:
            </p>
            <div className="flex items-center justify-between rounded-xl bg-fill p-2.5">
              <span className="font-mono text-[12px] text-ink break-all">
                {origin}/api/s2s/callback
              </span>
              <CopyButton text={`${origin}/api/s2s/callback`} />
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-2xl border border-line bg-surface p-3.5 space-y-1">
              <span className="text-[11px] font-semibold uppercase text-ink-3">Client Code</span>
              <div className="flex items-center justify-between">
                <span className="font-mono text-[13px] font-bold text-ink">{cCode}</span>
                <CopyButton text={cCode} />
              </div>
            </div>

            <div className="rounded-2xl border border-line bg-surface p-3.5 space-y-1">
              <span className="text-[11px] font-semibold uppercase text-ink-3">Hash Algorithm</span>
              <div className="flex items-center justify-between">
                <span className="font-mono text-[13px] font-bold text-ink uppercase">
                  {client.hash_algorithm || "SHA-256"}
                </span>
                <Badge tone="blue">HMAC Signed</Badge>
              </div>
            </div>

            <div className="rounded-2xl border border-line bg-surface p-3.5 space-y-1 sm:col-span-2">
              <span className="text-[11px] font-semibold uppercase text-ink-3">API Token</span>
              <div className="flex items-center justify-between">
                <span className="font-mono text-[12px] text-ink break-all">
                  {client.api_token || `tok_${cCode.toLowerCase()}_2026`}
                </span>
                <CopyButton text={client.api_token || `tok_${cCode.toLowerCase()}_2026`} />
              </div>
            </div>

            <div className="rounded-2xl border border-line bg-surface p-3.5 space-y-1 sm:col-span-2">
              <span className="text-[11px] font-semibold uppercase text-ink-3">Secret Key (HMAC Key)</span>
              <div className="flex items-center justify-between">
                <span className="font-mono text-[12px] text-ink break-all">
                  {client.secret_key || `sk_${cCode.toLowerCase()}_hmac`}
                </span>
                <CopyButton text={client.secret_key || `sk_${cCode.toLowerCase()}_hmac`} />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ──────────────── TAB 3: CLIENT OUTBOUND REDIRECTS ──────────────── */}
      {tab === "outbound" && (
        <div className="space-y-4">
          <p className="text-[13px] text-ink-3">
            If {cName} requires custom forwarding destinations when completing surveys on external partners:
          </p>
          <div className="space-y-3">
            <Field label="Complete Forwarding URL">
              <Input
                value={completeRedirect}
                onChange={(e) => setCompleteRedirect(e.target.value)}
                placeholder="https://..."
              />
            </Field>
            <Field label="Terminate Forwarding URL">
              <Input
                value={terminateRedirect}
                onChange={(e) => setTerminateRedirect(e.target.value)}
                placeholder="https://..."
              />
            </Field>
            <Field label="Overquota Forwarding URL">
              <Input
                value={overquotaRedirect}
                onChange={(e) => setOverquotaRedirect(e.target.value)}
                placeholder="https://..."
              />
            </Field>
            <Field label="Security Screenout Forwarding URL">
              <Input
                value={securityRedirect}
                onChange={(e) => setSecurityRedirect(e.target.value)}
                placeholder="https://..."
              />
            </Field>
            <Button loading={busy} onClick={saveOutbound} className="w-full mt-2">
              Save Outbound URLs
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
}
