import { useEffect, useState } from "react";
import { ArrowRight, Check, Code2, Copy, ExternalLink, KeyRound, RefreshCw } from "lucide-react";
import { supabase } from "../lib/supabase";
import { UID_TAGS } from "../lib/data";
import {
  generateAccessKey32,
  getVendorAccessKey,
  saveVendorApiKeyOverride,
} from "../lib/partnerKey";
import { Badge, Button, CopyButton, Field, Input, Modal, Segmented } from "./ui";
import { useFeedback } from "./feedback";

export function VendorIntegrationModal({
  vendor,
  onClose,
  onSaved,
}: {
  vendor: any | null;
  onClose: () => void;
  onSaved?: () => void;
}) {
  const { toast, confirm } = useFeedback();
  const [tab, setTab] = useState<"links" | "callbacks" | "api">("links");
  const [busy, setBusy] = useState(false);
  const [rotatingKey, setRotatingKey] = useState(false);
  const [copiedSpec, setCopiedSpec] = useState(false);
  const [accessKey, setAccessKey] = useState("");

  // Callbacks state
  const [cbComplete, setCbComplete] = useState("");
  const [cbTerm, setCbTerm] = useState("");
  const [cbOverquota, setCbOverquota] = useState("");
  const [cbSecurity, setCbSecurity] = useState("");

  const vCode = vendor?.code || vendor?.vendor_code || "";
  const vName = vendor?.name || vendor?.vendor_name || vCode;

  // Load existing callback URLs + 32-char Partner Access Key
  useEffect(() => {
    let active = true;
    if (!vCode) return;

    supabase
      .from("smr_vendors")
      .select("callback_complete, callback_terminate, callback_overquota, callback_security")
      .eq("vendor_code", vCode)
      .maybeSingle()
      .then(({ data }) => {
        if (!active || !data) return;
        setCbComplete(data.callback_complete || "");
        setCbTerm(data.callback_terminate || "");
        setCbOverquota(data.callback_overquota || "");
        setCbSecurity(data.callback_security || "");
      });

    getVendorAccessKey(vCode)
      .then((key) => {
        if (active) setAccessKey(key);
      })
      .catch(() => {});

    return () => {
      active = false;
    };
  }, [vCode]);

  if (!vendor) return null;

  const publicOrigin =
    typeof window !== "undefined" && window.location.hostname.includes("vmhgroupsmr.com")
      ? window.location.origin
      : "https://api.vmhgroupsmr.com";
  const localOrigin = typeof window !== "undefined" ? window.location.origin : "https://api.vmhgroupsmr.com";
  const effectiveKey = accessKey || vCode;
  const routerUrl = `${publicOrigin}/#/router?key=${encodeURIComponent(effectiveKey)}&uid=[RESPONDENT_ID]`;
  const testRouterUrl = `${localOrigin}/#/router?key=${encodeURIComponent(effectiveKey)}&uid=TEST_USER_${Date.now().toString().slice(-4)}`;
  const campaignTemplate = `${publicOrigin}/#/prescreener?pid=[STUDY_ID]&key=${encodeURIComponent(effectiveKey)}&uid=[RESPONDENT_ID]`;
  const feedUrl = `${publicOrigin}/#/vendor-feed?key=${encodeURIComponent(effectiveKey)}`;
  const supplyEndpointUrl = `${publicOrigin}/api/supply/projects`;
  const supplyDocUrl = `${publicOrigin}/#/api-docs?key=${encodeURIComponent(effectiveKey)}`;
  const hashingDocUrl = `${publicOrigin}/#/hashing-guide?key=${encodeURIComponent(effectiveKey)}`;
  const s2sDocUrl = `${publicOrigin}/#/s2s-guide?key=${encodeURIComponent(effectiveKey)}`;

  const copyVendorOnboardingSpec = () => {
    const text =
      `Access Key: ${effectiveKey}\n` +
      `API Documentation: ${supplyDocUrl}\n` +
      `Live Supply API Endpoint (Header: access-key): ${supplyEndpointUrl}\n` +
      `Universal Router Link: ${routerUrl}\n\n` +
      `VMH GROUP Integration Spec — Relevant Documentation:\n\n` +
      `Supply API Documentation: ${supplyDocUrl}\n` +
      `Redirect URL Hashing Guide: ${hashingDocUrl}\n` +
      `S2S (Server-to-Server) Integration Guide: ${s2sDocUrl}\n` +
      `Live Survey Inventory JSON Feed: ${feedUrl}\n\n` +
      `Please share your 3 (+1 optional) Return Redirect URLs with [UID] macro:\n` +
      `• Complete (Status 10): https://yourdomain.com/callback?status=10&uid=[UID]\n` +
      `• Terminate (Status 20): https://yourdomain.com/callback?status=20&uid=[UID]\n` +
      `• Overquota (Status 30): https://yourdomain.com/callback?status=30&uid=[UID]\n` +
      `• Security (Status 40 · Optional): https://yourdomain.com/callback?status=40&uid=[UID]\n`;

    navigator.clipboard.writeText(text);
    setCopiedSpec(true);
    toast("Partner Integration Spec copied!");
    setTimeout(() => setCopiedSpec(false), 2500);
  };

  const rotateAccessKey = async () => {
    const ok = await confirm({
      title: "Regenerate Partner Access Key?",
      message: `${vName} will immediately need the new 32-character access-key for API calls and entry links.`,
      confirmLabel: "Regenerate Key",
      danger: true,
    });
    if (!ok) return;

    setRotatingKey(true);
    try {
      const nextKey = generateAccessKey32();
      await saveVendorApiKeyOverride(vCode, nextKey);
      setAccessKey(nextKey);
      toast(`New 32-char Access Key issued for ${vName}`);
    } catch (e: any) {
      toast(e?.message || "Failed to regenerate access key", "error");
    } finally {
      setRotatingKey(false);
    }
  };

  const saveCallbacks = async () => {
    setBusy(true);
    try {
      const { error } = await supabase
        .from("smr_vendors")
        .update({
          callback_complete: cbComplete.trim() || null,
          callback_terminate: cbTerm.trim() || null,
          callback_overquota: cbOverquota.trim() || null,
          callback_security: cbSecurity.trim() || null,
          updated_at: new Date().toISOString(),
        })
        .eq("vendor_code", vCode);

      if (error) throw error;
      toast(`Callback settings saved for partner ${vName}!`);
      onSaved?.();
    } catch (e: any) {
      toast(e.message || "Failed to save callbacks", "error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open={!!vendor}
      onClose={onClose}
      size="lg"
      title={`Vendor Integration · ${vName}`}
      subtitle={`Partner ID: ${vCode} · Share your 32-char Access Key & 3 integration guides`}
      footer={
        <div className="flex w-full items-center justify-between gap-3">
          <Button
            size="sm"
            variant="secondary"
            icon={copiedSpec ? <Check size={14} /> : <Copy size={14} />}
            onClick={copyVendorOnboardingSpec}
          >
            {copiedSpec ? "Copied!" : "Copy Full Partner Spec"}
          </Button>
          <Button variant="ghost" onClick={onClose}>
            Close
          </Button>
        </div>
      }
    >
      <div className="space-y-5">
        <Segmented
          value={tab}
          onChange={setTab as any}
          options={[
            { value: "links", label: "Entry Links (1)" },
            { value: "callbacks", label: "Return URLs (3–4)" },
            { value: "api", label: "API Key & 3 Guides" },
          ]}
        />

        {/* Tab 1: Survey Entry Links */}
        {tab === "links" && (
          <div className="space-y-4">
            <div className="grid gap-3 rounded-2xl border border-line bg-fill/50 p-4 sm:grid-cols-2">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <Badge tone="blue">We Give Vendor</Badge>
                  <span className="text-[12.5px] font-semibold text-ink">1 Entry Link + Key</span>
                </div>
                <p className="text-[12px] leading-relaxed text-ink-3">
                  Share <strong>1 Universal Router Link</strong> (authenticated by their 32-char Access Key) or study-specific entry links.
                </p>
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <Badge tone="green">Vendor Gives Us</Badge>
                  <span className="text-[12.5px] font-semibold text-ink">3 (+1) Return Redirects</span>
                </div>
                <p className="text-[12px] leading-relaxed text-ink-3">
                  Collect their <strong>Complete (10)</strong>, <strong>Terminate (20)</strong>, <strong>Overquota (30)</strong> (+ optional <strong>Security 40</strong>) URLs.
                </p>
              </div>
            </div>

            {/* 1. Universal Router Link */}
            <div className="rounded-2xl border border-accent/25 bg-accent-soft/20 p-4 space-y-3">
              <div>
                <h4 className="text-sm font-semibold text-ink mb-1">
                  1. Universal Survey Router Link (Recommended · 1 Single Link)
                </h4>
                <p className="text-xs text-ink-3 leading-relaxed">
                  Share this single router link with <strong>{vName}</strong>. Any live study assigned to them automatically routes traffic here.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <input
                  readOnly
                  value={routerUrl}
                  className="flex-1 rounded-xl border border-line bg-surface px-3 py-2.5 font-mono text-[12px] text-ink select-all focus:outline-none"
                />
                <CopyButton text={routerUrl} label="Copy Link" />
                <a
                  href={testRouterUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 px-3 py-2.5 rounded-xl border border-line bg-surface hover:bg-fill text-ink text-xs font-medium transition"
                  title="Test router with test respondent UID"
                >
                  Test
                  <ExternalLink size={12} />
                </a>
              </div>
            </div>

            {/* 2. Per-Study Link */}
            <div className="rounded-2xl border border-line bg-surface p-4 space-y-3">
              <div>
                <h4 className="text-sm font-semibold text-ink mb-1">
                  2. Per-Study Direct Entry Link Template
                </h4>
                <p className="text-xs text-ink-3 leading-relaxed">
                  Also returned inside each study record in <code className="font-mono">/api/supply/projects</code> with <code className="font-mono">[STUDY_ID]</code> pre-filled.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <input
                  readOnly
                  value={campaignTemplate}
                  className="flex-1 rounded-xl border border-line bg-fill px-3 py-2.5 font-mono text-[12px] text-ink select-all focus:outline-none"
                />
                <CopyButton text={campaignTemplate} label="Copy Template" />
              </div>
            </div>

            <div className="flex items-center justify-between rounded-xl border border-line bg-fill/40 px-4 py-2.5 text-[12px]">
              <span className="text-ink-2">Have you received the 3–4 return links from {vName}?</span>
              <button
                type="button"
                onClick={() => setTab("callbacks")}
                className="inline-flex cursor-pointer items-center gap-1 font-semibold text-accent hover:underline"
              >
                Configure Return URLs <ArrowRight size={13} />
              </button>
            </div>
          </div>
        )}

        {/* Tab 2: S2S Callbacks & Postbacks */}
        {tab === "callbacks" && (
          <div className="space-y-4">
            <p className="text-xs text-ink-3 leading-relaxed">
              Save <strong>{vName}&apos;s</strong> 3 core return links (Complete, Terminate, Overquota) plus optional Security link using <code className="font-mono">[UID]</code>.
            </p>

            <div className="space-y-3">
              <Field label="1. Complete Return URL (Status 10) *" hint="Required — redirects/fires when respondent completes the survey">
                <Input
                  value={cbComplete}
                  onChange={(e) => setCbComplete(e.target.value)}
                  placeholder="https://vendor.com/redirect?status=10&uid=[UID]"
                />
              </Field>

              <Field label="2. Terminate / Screenout Return URL (Status 20) *" hint="Required — fired when demographic criteria do not match">
                <Input
                  value={cbTerm}
                  onChange={(e) => setCbTerm(e.target.value)}
                  placeholder="https://vendor.com/redirect?status=20&uid=[UID]"
                />
              </Field>

              <Field label="3. Overquota / Quota Full Return URL (Status 30) *" hint="Required — fired when study quota is full or paused">
                <Input
                  value={cbOverquota}
                  onChange={(e) => setCbOverquota(e.target.value)}
                  placeholder="https://vendor.com/redirect?status=30&uid=[UID]"
                />
              </Field>

              <Field label="4. Security / Fraud Return URL (Status 40 · Optional)" hint="Optional — fired when duplicate IP / fraud protection triggers">
                <Input
                  value={cbSecurity}
                  onChange={(e) => setCbSecurity(e.target.value)}
                  placeholder="https://vendor.com/redirect?status=40&uid=[UID]"
                />
              </Field>

              <div className="pt-2 flex justify-end">
                <Button loading={busy} onClick={saveCallbacks}>
                  Save Return Callback URLs
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Tab 3: Supply API & 3-Guide Kit */}
        {tab === "api" && (
          <div className="space-y-4">
            <div className="rounded-2xl border border-line bg-fill/50 p-4 text-xs text-ink-3 leading-relaxed">
              Send <strong>{vName}</strong> their unique 32-character Access Key and the 3 public documentation guides below. Zero login is required, and client names, client CPIs, and margins are strictly hidden.
            </div>

            <div className="rounded-2xl border border-accent/25 bg-accent-soft/20 p-4 space-y-2.5">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <KeyRound size={15} className="text-accent" />
                  <h4 className="text-sm font-semibold text-ink">Partner Access Key (32-Char Hex)</h4>
                </div>
                <Badge tone="blue">Header: access-key</Badge>
              </div>
              <div className="flex items-center gap-2">
                <input
                  readOnly
                  value={accessKey || "Generating 32-char key..."}
                  className="flex-1 rounded-xl border border-line bg-surface px-3 py-2.5 font-mono text-[13px] font-semibold text-ink select-all focus:outline-none"
                />
                <CopyButton text={effectiveKey} label="Copy Key" />
                <Button
                  size="sm"
                  variant="secondary"
                  loading={rotatingKey}
                  icon={<RefreshCw size={13} />}
                  onClick={rotateAccessKey}
                  title="Issue a fresh random 32-char key"
                >
                  Regenerate
                </Button>
              </div>
            </div>

            <div className="rounded-2xl border border-line bg-surface p-4 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Code2 size={15} className="text-ink-2" />
                  <h4 className="text-sm font-semibold text-ink">Live Programmatic JSON Endpoint</h4>
                </div>
                <Badge tone="green">GET · application/json</Badge>
              </div>
              <div className="flex items-center gap-2">
                <input
                  readOnly
                  value={supplyEndpointUrl}
                  className="flex-1 rounded-xl border border-line bg-fill px-3 py-2 font-mono text-[12px] text-ink select-all focus:outline-none"
                />
                <CopyButton text={supplyEndpointUrl} label="Copy Endpoint" />
              </div>
              <div className="flex items-center gap-2">
                <input
                  readOnly
                  value={feedUrl}
                  className="flex-1 rounded-xl border border-line bg-fill px-3 py-2 font-mono text-[12px] text-ink select-all focus:outline-none"
                />
                <CopyButton text={feedUrl} label="Copy Feed UI" />
                <a
                  href={feedUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 px-3 py-2 rounded-xl border border-line bg-surface hover:bg-fill text-ink text-xs font-medium transition"
                >
                  Open
                  <ExternalLink size={12} />
                </a>
              </div>
            </div>

            <div className="rounded-2xl border border-line bg-surface divide-y divide-line">
              {[
                {
                  title: "1. Supply API Documentation (Interactive Swagger Portal)",
                  desc: "Live endpoints, schema reference & interactive Execute query runner",
                  url: supplyDocUrl,
                },
                {
                  title: "2. Redirect URL Hashing Guide (HMAC-SHA256)",
                  desc: "Parameter signing formula, examples & live hash verifier",
                  url: hashingDocUrl,
                },
                {
                  title: "3. S2S & Return Redirect Integration Guide",
                  desc: "Status codes (10/20/30/40), [UID] macros & callback URL builder",
                  url: s2sDocUrl,
                },
              ].map((g) => (
                <div key={g.url} className="p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                  <div className="min-w-0">
                    <h4 className="text-xs font-semibold text-ink">{g.title}</h4>
                    <p className="text-[11px] text-ink-3 mt-0.5">{g.desc}</p>
                    <p className="text-[11px] font-mono text-ink-3 truncate mt-1">{g.url}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <CopyButton text={g.url} label="Copy URL" />
                    <a
                      href={g.url}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-line bg-fill hover:bg-fill-2 text-ink text-xs font-medium transition"
                    >
                      Open <ExternalLink size={12} />
                    </a>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Macro Placeholders Guide footer */}
        <div className="pt-3 border-t border-line text-xs">
          <span className="text-[11px] font-semibold text-ink-3 uppercase block mb-1.5">
            Supported Respondent UID Macros:
          </span>
          <div className="flex flex-wrap gap-1.5">
            {UID_TAGS.map((tag) => (
              <span key={tag} className="font-mono text-[11px] bg-fill px-2 py-0.5 rounded border border-line text-ink-2">
                {tag}
              </span>
            ))}
          </div>
        </div>
      </div>
    </Modal>
  );
}
