import { useEffect, useState } from "react";
import { ArrowRight, Check, Code2, Copy, ExternalLink, KeyRound } from "lucide-react";
import { supabase } from "../lib/supabase";
import { UID_TAGS } from "../lib/data";
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
  const { toast } = useFeedback();
  const [tab, setTab] = useState<"links" | "callbacks" | "api">("links");
  const [busy, setBusy] = useState(false);
  const [copiedSpec, setCopiedSpec] = useState(false);

  // Callbacks state
  const [cbComplete, setCbComplete] = useState("");
  const [cbTerm, setCbTerm] = useState("");
  const [cbOverquota, setCbOverquota] = useState("");
  const [cbSecurity, setCbSecurity] = useState("");

  const vCode = vendor?.code || vendor?.vendor_code || "";
  const vName = vendor?.name || vendor?.vendor_name || vCode;

  // Load existing callback URLs from Supabase
  useEffect(() => {
    if (vCode) {
      supabase
        .from("smr_vendors")
        .select("callback_complete, callback_terminate, callback_overquota, callback_security")
        .eq("vendor_code", vCode)
        .maybeSingle()
        .then(({ data }) => {
          if (data) {
            setCbComplete(data.callback_complete || "");
            setCbTerm(data.callback_terminate || "");
            setCbOverquota(data.callback_overquota || "");
            setCbSecurity(data.callback_security || "");
          }
        });
    }
  }, [vCode]);

  if (!vendor) return null;

  const origin = typeof window !== "undefined" ? window.location.origin : "https://api.vmhgroupsmr.com";
  const routerUrl = `${origin}/#/router?vid=${encodeURIComponent(vCode)}&uid=[RESPONDENT_ID]`;
  const testRouterUrl = `${origin}/#/router?vid=${encodeURIComponent(vCode)}&uid=TEST_USER_${Date.now().toString().slice(-4)}`;
  const campaignTemplate = `${origin}/#/prescreener?pid=[STUDY_ID]&vid=${encodeURIComponent(vCode)}&uid=[RESPONDENT_ID]`;
  const feedUrl = `${origin}/#/vendor-feed?vid=${encodeURIComponent(vCode)}`;
  const apiDocsUrl = `${origin}/#/api-docs`;
  const accessKey = vendor?.api_key || vendor?.secret_key || vCode;

  const copyVendorOnboardingSpec = () => {
    const text =
      `*VMH GROUP · Partner Integration Spec for ${vName} (${vCode})*\n` +
      `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
      `1. ENTRY LINK WE PROVIDE TO YOU (Send respondent traffic here):\n` +
      `• Universal Router Link (All assigned studies): ${routerUrl}\n` +
      `• Per-Study Link Format: ${campaignTemplate}\n` +
      `  (Replace [RESPONDENT_ID] with your unique panelist ID)\n\n` +
      `2. RETURN REDIRECT LINKS YOU NEED TO SHARE WITH US (3 Required + 1 Security):\n` +
      `• Complete (Status 10): https://yourdomain.com/complete?uid=[UID]\n` +
      `• Terminate / Screenout (Status 20): https://yourdomain.com/terminate?uid=[UID]\n` +
      `• Overquota / Quota Full (Status 30): https://yourdomain.com/overquota?uid=[UID]\n` +
      `• Security / Fraud (Status 40 - Optional): https://yourdomain.com/security?uid=[UID]\n\n` +
      `3. OPTIONAL SUPPLY API INTEGRATION (If pulling surveys via API):\n` +
      `• Access Key (Header: access-key): ${accessKey}\n` +
      `• Live JSON Inventory Feed: ${feedUrl}\n` +
      `• API Docs: ${apiDocsUrl}\n`;

    navigator.clipboard.writeText(text);
    setCopiedSpec(true);
    toast("Vendor onboarding links & instructions copied!");
    setTimeout(() => setCopiedSpec(false), 2500);
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
      subtitle={`Vendor ID: ${vCode} · Entry links to share & return callbacks to collect`}
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
            { value: "api", label: "Supply API & Key" },
          ]}
        />

        {/* Tab 1: Survey Entry Links */}
        {tab === "links" && (
          <div className="space-y-4">
            <div className="grid gap-3 rounded-2xl border border-line bg-fill/50 p-4 sm:grid-cols-2">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <Badge tone="blue">We Give Vendor</Badge>
                  <span className="text-[12.5px] font-semibold text-ink">1 Entry Link</span>
                </div>
                <p className="text-[12px] leading-relaxed text-ink-3">
                  Give <strong>1 Universal Router Link</strong> (or 1 Per-Study Link when assigning a study) so they can send traffic to you.
                </p>
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <Badge tone="green">Vendor Gives Us</Badge>
                  <span className="text-[12.5px] font-semibold text-ink">3 (+1) Return Redirects</span>
                </div>
                <p className="text-[12px] leading-relaxed text-ink-3">
                  Collect their <strong>Complete (10)</strong>, <strong>Terminate (20)</strong>, <strong>Overquota (30)</strong> (+ optional <strong>Security 40</strong>) URLs and save them in the next tab.
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
                  Share this single link with <strong>{vName}</strong>. Any live study you assign to <code className="font-mono">{vCode}</code> automatically routes traffic without needing new links.
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
                  2. Per-Study Direct Entry Link (If sending study-by-study)
                </h4>
                <p className="text-xs text-ink-3 leading-relaxed">
                  When you assign a specific study in Surveys or Vendors, the system creates this study-specific link with <code>[STUDY_ID]</code> filled in automatically.
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
              Just like clients ask us for return redirects, <strong>{vName}</strong> gives us <strong>3 core return links</strong> (Complete, Terminate, Overquota) plus an optional <strong>Security</strong> link so their panelists return cleanly with <code>[UID]</code>.
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

              <Field label="4. Security / Fraud Return URL (Status 40 · Optional)" hint="Optional — fired when duplicate IP / fraud protection triggers (falls back to Terminate if empty)">
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

        {/* Tab 3: Supply API & Access Key */}
        {tab === "api" && (
          <div className="space-y-4">
            <div className="rounded-2xl border border-line bg-fill/50 p-4 text-xs text-ink-3 leading-relaxed">
              For standard link traffic, vendors do <strong>not</strong> need an API key—their Vendor ID (<code>{vCode}</code>) in the entry link is enough. Only share these credentials if <strong>{vName}</strong> wants to pull live assigned studies automatically via API.
            </div>

            <div className="rounded-2xl border border-accent/25 bg-accent-soft/20 p-4 space-y-2.5">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <KeyRound size={15} className="text-accent" />
                  <h4 className="text-sm font-semibold text-ink">Partner Access Key</h4>
                </div>
                <Badge tone="blue">Header: access-key</Badge>
              </div>
              <p className="text-xs text-ink-3">
                Vendor passes this key in request header <code className="font-mono">access-key: {accessKey}</code> or query param <code className="font-mono">?vendor_id={accessKey}</code>.
              </p>
              <div className="flex items-center gap-2">
                <input
                  readOnly
                  value={accessKey}
                  className="flex-1 rounded-xl border border-line bg-surface px-3 py-2.5 font-mono text-[13px] font-semibold text-ink select-all focus:outline-none"
                />
                <CopyButton text={accessKey} label="Copy Key" />
              </div>
            </div>

            <div className="rounded-2xl border border-line bg-surface p-4 space-y-2.5">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Code2 size={15} className="text-ink-2" />
                  <h4 className="text-sm font-semibold text-ink">Live Inventory JSON Feed URL</h4>
                </div>
                <Badge tone="green">Live Feed</Badge>
              </div>
              <div className="flex items-center gap-2">
                <input
                  readOnly
                  value={feedUrl}
                  className="flex-1 rounded-xl border border-line bg-fill px-3 py-2.5 font-mono text-[12px] text-ink select-all focus:outline-none"
                />
                <CopyButton text={feedUrl} label="Copy URL" />
                <a
                  href={feedUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 px-3 py-2.5 rounded-xl border border-line bg-surface hover:bg-fill text-ink text-xs font-medium transition"
                >
                  Open
                  <ExternalLink size={12} />
                </a>
              </div>
            </div>

            <div className="rounded-2xl border border-line bg-surface p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h4 className="text-sm font-semibold text-ink">REST API Endpoint &amp; Docs</h4>
                <p className="text-xs text-ink-3 font-mono mt-0.5">GET /api/supplier/getAllSurveys?vendor_id={vCode}</p>
              </div>
              <div className="flex items-center gap-2">
                <CopyButton text={apiDocsUrl} label="Copy Docs URL" />
                <a
                  href={apiDocsUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 px-3 py-2 rounded-xl border border-line bg-fill hover:bg-fill-2 text-ink text-xs font-medium transition"
                >
                  API Docs <ExternalLink size={12} />
                </a>
              </div>
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
