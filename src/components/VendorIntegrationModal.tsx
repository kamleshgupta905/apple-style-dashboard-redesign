import { useEffect, useState } from "react";
import { Copy, Check, ExternalLink, Link2, Layers, Code2, ShieldCheck, CheckCircle2, ArrowRight } from "lucide-react";
import { api } from "../lib/api";
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
  const [tab, setTab] = useState<"router" | "campaign" | "feed" | "callbacks">("router");
  const [busy, setBusy] = useState(false);

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

  // Universal Router Link
  const routerUrl = `https://api.vmhgroupsmr.com/#/router?vid=${encodeURIComponent(vCode)}&uid=[RESPONDENT_ID]`;
  const testRouterUrl = `https://api.vmhgroupsmr.com/#/router?vid=${encodeURIComponent(vCode)}&uid=TEST_USER_${Date.now().toString().slice(-4)}`;

  // Campaign Template
  const campaignTemplate = `https://api.vmhgroupsmr.com/vendor/auth/${encodeURIComponent(vCode)}/project/[STUDY_ID]?uid=[RESPONDENT_ID]`;

  // Live Inventory Feed URL
  const feedUrl = `https://api.vmhgroupsmr.com/#/feed?vid=${encodeURIComponent(vCode)}`;

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
      title={`Integration Kit · ${vName}`}
      subtitle={`Partner code: ${vCode} · Connect this vendor to your SMR platform`}
      footer={
        <div className="flex w-full items-center justify-between">
          <span className="text-xs text-ink-3">VMH Group SMR Gateway</span>
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
            { value: "router", label: "Universal Router" },
            { value: "callbacks", label: "S2S Callbacks" },
            { value: "campaign", label: "Per-Study Link" },
            { value: "feed", label: "API Feed" },
          ]}
        />

        {/* Tab 1: Universal Router Link */}
        {tab === "router" && (
          <div className="space-y-4">
            <div className="rounded-2xl border border-indigo-500/20 bg-indigo-50/30 dark:bg-indigo-950/20 p-4">
              <div className="flex items-center gap-2 mb-1.5">
                <span className="flex h-2 w-2 rounded-full bg-indigo-600 animate-pulse" />
                <h4 className="text-sm font-semibold text-indigo-900 dark:text-indigo-200">
                  Universal Survey Router Integration Link (Recommended)
                </h4>
              </div>
              <p className="text-xs text-indigo-700/80 dark:text-indigo-300/80 leading-relaxed">
                Give this <strong>single link</strong> to your vendor to put in their dashboard as an Offer or Global Survey Router. 
                Any survey you assign to <strong>{vName}</strong> from your SMR dashboard will automatically receive traffic through this link!
              </p>
            </div>

            <div>
              <label className="text-xs font-semibold text-ink block mb-1.5">
                Vendor Integration Entry Link
              </label>
              <div className="flex items-center gap-2">
                <input
                  readOnly
                  value={routerUrl}
                  className="flex-1 rounded-xl border border-line bg-fill px-3 py-2.5 font-mono text-[12px] text-ink select-all focus:outline-none"
                />
                <CopyButton text={routerUrl} label="Copy Link" />
                <a
                  href={testRouterUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 px-3 py-2.5 rounded-xl border border-line bg-surface hover:bg-fill text-ink text-xs font-medium transition"
                  title="Test router with dummy respondent UID"
                >
                  Test
                  <ExternalLink size={12} />
                </a>
              </div>
            </div>

            {/* How it works breakdown */}
            <div className="rounded-2xl border border-line bg-surface p-4 space-y-2.5 text-xs">
              <h5 className="font-semibold text-ink flex items-center gap-1.5">
                <CheckCircle2 size={14} className="text-emerald-600" />
                How the integration works:
              </h5>
              <ol className="list-decimal list-inside space-y-1.5 text-ink-2 text-[12px] leading-relaxed">
                <li>
                  <strong>Vendor adds the link:</strong> Vendor puts this entry link into their dashboard / router.
                </li>
                <li>
                  <strong>You assign surveys here:</strong> In your <em>My Studies</em> table, click <strong>"Assign"</strong> and select <strong>{vName}</strong>.
                </li>
                <li>
                  <strong>Automatic matching:</strong> When a respondent clicks the link, SMR matches them to the highest paying active survey assigned to {vName}.
                </li>
                <li>
                  <strong>Zero link updates:</strong> You never have to send new links to the vendor for new surveys!
                </li>
              </ol>
            </div>
          </div>
        )}

        {/* Tab 2: S2S Callbacks & Postbacks */}
        {tab === "callbacks" && (
          <div className="space-y-4">
            <p className="text-xs text-ink-3 leading-relaxed">
              When a respondent from <strong>{vName}</strong> finishes or screens out of a study, SMR will redirect them or send a postback to these URLs. Use <code>[UID]</code> where the respondent ID belongs.
            </p>

            <div className="space-y-3">
              <Field label="Complete Postback URL (Status 10)" hint="Fired when respondent completes the survey successfully">
                <Input
                  value={cbComplete}
                  onChange={(e) => setCbComplete(e.target.value)}
                  placeholder="https://vendor.com/postback?status=10&uid=[UID]"
                />
              </Field>

              <Field label="Terminate / Screenout URL (Status 20)" hint="Fired when demographic criteria do not match">
                <Input
                  value={cbTerm}
                  onChange={(e) => setCbTerm(e.target.value)}
                  placeholder="https://vendor.com/postback?status=20&uid=[UID]"
                />
              </Field>

              <Field label="Quota Full URL (Status 30)" hint="Fired when study completes quota has been reached">
                <Input
                  value={cbOverquota}
                  onChange={(e) => setCbOverquota(e.target.value)}
                  placeholder="https://vendor.com/postback?status=30&uid=[UID]"
                />
              </Field>

              <Field label="Security Block URL (Status 40)" hint="Fired when security or fraud detection triggers">
                <Input
                  value={cbSecurity}
                  onChange={(e) => setCbSecurity(e.target.value)}
                  placeholder="https://vendor.com/postback?status=40&uid=[UID]"
                />
              </Field>

              <div className="pt-2 flex justify-end">
                <Button loading={busy} onClick={saveCallbacks}>
                  Save Callback URLs
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Tab 3: Per-Study Link */}
        {tab === "campaign" && (
          <div className="space-y-4">
            <p className="text-xs text-ink-3 leading-relaxed">
              If the vendor sets up individual campaigns manually for each project instead of a global router, use this per-study template. Replace <code>[STUDY_ID]</code> with the specific study reference.
            </p>

            <div>
              <label className="text-xs font-semibold text-ink block mb-1.5">
                Per-Study Entry URL Template
              </label>
              <div className="flex items-center gap-2">
                <input
                  readOnly
                  value={campaignTemplate}
                  className="flex-1 rounded-xl border border-line bg-fill px-3 py-2.5 font-mono text-[12px] text-ink select-all focus:outline-none"
                />
                <CopyButton text={campaignTemplate} label="Copy Template" />
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-fill border border-line text-xs space-y-1.5 font-mono text-ink-2">
              <div className="text-[11px] text-ink-3 uppercase font-sans font-semibold mb-1">Example live link for Study #2178484718:</div>
              <div className="break-all text-accent">
                https://api.vmhgroupsmr.com/vendor/auth/{vCode}/project/2178484718?uid=[RESPONDENT_ID]
              </div>
            </div>
          </div>
        )}

        {/* Tab 4: Live Inventory API Feed */}
        {tab === "feed" && (
          <div className="space-y-4">
            <p className="text-xs text-ink-3 leading-relaxed">
              For automated vendors who pull active survey inventory via API into their offerwalls or dynamic router panels:
            </p>

            <div>
              <label className="text-xs font-semibold text-ink block mb-1.5">
                Real-Time JSON Inventory Feed URL
              </label>
              <div className="flex items-center gap-2">
                <input
                  readOnly
                  value={feedUrl}
                  className="flex-1 rounded-xl border border-line bg-fill px-3 py-2.5 font-mono text-[12px] text-ink select-all focus:outline-none"
                />
                <CopyButton text={feedUrl} label="Copy Feed URL" />
                <a
                  href={feedUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 px-3 py-2.5 rounded-xl border border-line bg-surface hover:bg-fill text-ink text-xs font-medium transition"
                >
                  View JSON
                  <ExternalLink size={12} />
                </a>
              </div>
            </div>

            <div className="rounded-2xl border border-line bg-fill p-3.5 text-xs text-ink-3">
              This endpoint outputs all studies currently allotted to <strong>{vName}</strong> with live CPI, target completes, LOI, IR, and direct tracking links.
            </div>
          </div>
        )}

        {/* Macro Placeholders Guide footer */}
        <div className="pt-3 border-t border-line text-xs">
          <span className="text-[11px] font-semibold text-ink-3 uppercase block mb-1.5">
            Supported Respondent UID Tags:
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
