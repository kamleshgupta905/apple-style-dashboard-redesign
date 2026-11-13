import { useEffect, useState } from "react";
import { ExternalLink } from "lucide-react";
import { supabase } from "../lib/supabase";
import { UID_TAGS } from "../lib/data";
import { Button, CopyButton, Field, Input, Modal, Segmented } from "./ui";
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
  const [tab, setTab] = useState<"links" | "callbacks">("links");
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
      title={`Vendor Integration Specification · ${vName}`}
      subtitle={`Partner code: ${vCode} · Essential Entry Links & S2S Callbacks`}
      footer={
        <div className="flex w-full items-center justify-between">
          <span className="text-xs text-ink-3">VMH Group API Tool Gateway</span>
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
            { value: "links", label: "Survey Entry Links" },
            { value: "callbacks", label: "S2S Callbacks (Return URLs)" },
          ]}
        />

        {/* Tab 1: Survey Entry Links */}
        {tab === "links" && (
          <div className="space-y-4">
            {/* 1. Universal Router Link */}
            <div className="rounded-2xl border border-indigo-500/20 bg-indigo-50/30 dark:bg-indigo-950/20 p-4 space-y-3">
              <div>
                <h4 className="text-sm font-semibold text-indigo-900 dark:text-indigo-200 mb-1">
                  1. Universal Survey Router Link (Recommended)
                </h4>
                <p className="text-xs text-indigo-700/80 dark:text-indigo-300/80 leading-relaxed">
                  Vendor adds this single entry link to their platform. Any study you assign to <strong>{vName}</strong> automatically receives traffic without changing links.
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
                  2. Per-Study Entry Link Template (Direct Campaign)
                </h4>
                <p className="text-xs text-ink-3 leading-relaxed">
                  For vendors who set up separate campaigns per project. Replace <code>[STUDY_ID]</code> with the assigned study ID.
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
          </div>
        )}

        {/* Tab 2: S2S Callbacks & Postbacks */}
        {tab === "callbacks" && (
          <div className="space-y-4">
            <p className="text-xs text-ink-3 leading-relaxed">
              When a respondent finishes or screens out, API Tool redirects them or fires a postback to these URLs with their dynamic <code>[UID]</code>.
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

              <Field label="Quota Full URL (Status 30)" hint="Fired when study quota is full or study is paused">
                <Input
                  value={cbOverquota}
                  onChange={(e) => setCbOverquota(e.target.value)}
                  placeholder="https://vendor.com/postback?status=30&uid=[UID]"
                />
              </Field>

              <Field label="Security Block URL (Status 40)" hint="Fired when fraud / duplicate IP detection triggers">
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
