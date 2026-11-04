import { useEffect, useMemo, useState } from "react";
import { Check, CheckCircle2, Copy, Link2, Plus, Search, Trash2, X } from "lucide-react";
import { api } from "../lib/api";
import { entryLink, fetchVendorOptions, type NSurvey, type VendorOption } from "../lib/data";
import { exportCSV, money, num } from "../lib/utils";
import { Badge, Button, CopyButton, Field, Input, Modal, Skeleton } from "./ui";
import { useFeedback } from "./feedback";
import { cn } from "../utils/cn";

export interface GeneratedLink {
  surveyId: string;
  surveyName: string;
  vendorCode: string;
  vendorName: string;
  link: string;
}

/**
 * Allocate one or many surveys to multiple supply partners simultaneously
 * and hand back live entry links in real time.
 */
export function AssignModal({
  surveys,
  onClose,
  onDone,
  presetVendor,
}: {
  surveys: NSurvey[];
  onClose: () => void;
  onDone?: () => void;
  presetVendor?: string;
}) {
  const { toast } = useFeedback();
  const open = surveys.length > 0;
  const [vendors, setVendors] = useState<VendorOption[] | null>(null);
  const [selectedVendors, setSelectedVendors] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const [custom, setCustom] = useState("");
  const [showCustom, setShowCustom] = useState(false);
  const [pct, setPct] = useState<string>("70");
  const [quota, setQuota] = useState<string>("100");
  const [busy, setBusy] = useState(false);
  const [links, setLinks] = useState<GeneratedLink[] | null>(null);

  useEffect(() => {
    if (!open) return;
    setLinks(null);
    setSearch("");
    setCustom("");
    setShowCustom(false);
    setQuota(String(Math.min(100, ...surveys.map((s) => s.target || 100))));

    fetchVendorOptions().then((v) => {
      setVendors(v);
      if (presetVendor) {
        setSelectedVendors([presetVendor]);
        const found = v.find((x) => x.code === presetVendor);
        if (found?.sharePct) setPct(String(found.sharePct));
      } else if (v.length > 0) {
        setSelectedVendors([v[0].code]);
        if (v[0].sharePct) setPct(String(v[0].sharePct));
      } else {
        setSelectedVendors([]);
      }
    });
  }, [open, presetVendor]);

  const single = surveys.length === 1 ? surveys[0] : null;
  const numPct = Math.max(1, Math.min(100, Number(pct) || 70));
  const numQuota = Math.max(1, Number(quota) || 100);

  const filteredVendors = useMemo(() => {
    if (!vendors) return [];
    const q = search.toLowerCase().trim();
    if (!q) return vendors;
    return vendors.filter(
      (v) => v.name.toLowerCase().includes(q) || v.code.toLowerCase().includes(q),
    );
  }, [vendors, search]);

  const toggleVendor = (code: string) => {
    setSelectedVendors((prev) =>
      prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code],
    );
  };

  const selectAll = () => {
    if (!vendors) return;
    setSelectedVendors(vendors.map((v) => v.code));
  };

  const clearAll = () => {
    setSelectedVendors([]);
  };

  const addCustomVendor = () => {
    const trimmed = custom.trim().toUpperCase();
    if (!trimmed) return;
    if (!selectedVendors.includes(trimmed)) {
      setSelectedVendors((prev) => [...prev, trimmed]);
    }
    setCustom("");
    setShowCustom(false);
  };

  const removeVendor = (code: string) => {
    setSelectedVendors((prev) => prev.filter((c) => c !== code));
  };

  const copyAllLinks = () => {
    if (!links || links.length === 0) return;
    const text = links.map((l) => `${l.surveyId} (${l.vendorCode}): ${l.link}`).join("\n");
    navigator.clipboard?.writeText?.(text);
    toast(`All ${links.length} entry links copied to clipboard!`, "success");
  };

  const submit = async () => {
    const finalVendors = Array.from(new Set(selectedVendors));
    if (finalVendors.length === 0) {
      return toast("Please select at least one supply partner.", "error");
    }
    if (numQuota <= 0) {
      return toast("Quota must be greater than zero.", "error");
    }

    setBusy(true);
    try {
      const out: GeneratedLink[] = [];
      for (const s of surveys) {
        for (const vCode of finalVendors) {
          const vObj = vendors?.find((x) => x.code === vCode);
          const vName = vObj?.name || vCode;
          const share = vObj?.sharePct || numPct;
          const vendorCpi = Number(((s.cpi * share) / 100).toFixed(2));

          const res = await api.post<any>("/vendor/allot", {
            project_id: s.id,
            vendor_id: vCode,
            vendor_name: vName,
            vendor_cpi: vendorCpi,
            quota_limit: numQuota,
            status: "Active",
          });

          const link = res?.entry_link || res?.data?.entry_link || entryLink(vCode, s.id);
          out.push({
            surveyId: s.id,
            surveyName: s.name,
            vendorCode: vCode,
            vendorName: vName,
            link,
          });
        }
      }

      setLinks(out);
      toast(
        `Successfully allotted ${surveys.length} survey(s) across ${finalVendors.length} supply partner(s)!`,
        "success",
      );
      onDone?.();
    } catch (e: any) {
      toast(e.message || "Allocation failed", "error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={
        links
          ? `Entry links ready (${links.length})`
          : surveys.length > 1
          ? `Assign ${surveys.length} surveys`
          : "Assign to supply partners"
      }
      subtitle={
        links
          ? "Share these unique tracking entry links with your selected supply partners."
          : single
          ? `#${single.id} · ${single.name}`
          : "Multi-select supply partners to generate individual entry links simultaneously."
      }
      size="lg"
      footer={
        links ? (
          <>
            <Button variant="secondary" icon={<Copy size={14} />} onClick={copyAllLinks}>
              Copy all links
            </Button>
            <Button
              variant="secondary"
              onClick={() =>
                exportCSV(
                  "entry-links",
                  ["Survey ID", "Survey Name", "Vendor Code", "Vendor Name", "Entry Link"],
                  links.map((l) => [l.surveyId, l.surveyName, l.vendorCode, l.vendorName, l.link]),
                )
              }
            >
              Export CSV
            </Button>
            <Button onClick={onClose}>Done</Button>
          </>
        ) : (
          <>
            <Button variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button
              loading={busy}
              onClick={submit}
              icon={<Link2 size={16} />}
              disabled={selectedVendors.length === 0}
            >
              Generate entry links ({selectedVendors.length * surveys.length})
            </Button>
          </>
        )
      }
    >
      {links ? (
        <div className="space-y-4">
          <div className="flex items-center justify-between rounded-2xl bg-green-soft px-4 py-3 text-[14px] font-medium text-green">
            <span className="flex items-center gap-2">
              <CheckCircle2 size={18} />
              <span>
                {links.length} entry links generated & registered to the gateway in real-time
              </span>
            </span>
            <Badge tone="green">{selectedVendors.length} partners</Badge>
          </div>

          <div className="max-h-[380px] overflow-y-auto space-y-2.5 pr-1">
            {links.map((l, idx) => (
              <div key={idx} className="rounded-2xl border border-line bg-surface p-3.5 shadow-sm">
                <div className="mb-2 flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-[13px] font-semibold text-ink">
                      #{l.surveyId} <span className="font-normal text-ink-3">· {l.surveyName}</span>
                    </p>
                    <p className="text-[12px] font-medium text-accent">
                      Partner: {l.vendorName} ({l.vendorCode})
                    </p>
                  </div>
                  <CopyButton text={l.link} />
                </div>
                <div className="rounded-xl bg-fill px-3 py-2">
                  <p className="break-all font-mono text-[11.5px] text-ink-2 select-all">{l.link}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : !vendors ? (
        <div className="space-y-3">
          <Skeleton className="h-11" />
          <Skeleton className="h-40" />
        </div>
      ) : (
        <div className="space-y-4">
          {/* Supply Partner Multi-Select Picker */}
          <div>
            <div className="mb-2 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <label className="text-[13px] font-semibold text-ink">
                  Supply partners (select multiple)
                </label>
                <Badge tone={selectedVendors.length > 0 ? "blue" : "gray"}>
                  {selectedVendors.length} selected
                </Badge>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={selectAll}
                  className="text-[12px] font-medium text-accent hover:underline cursor-pointer"
                >
                  Select all
                </button>
                <span className="text-ink-3 text-[12px]">•</span>
                <button
                  type="button"
                  onClick={clearAll}
                  className="text-[12px] font-medium text-ink-3 hover:text-ink cursor-pointer"
                >
                  Clear
                </button>
              </div>
            </div>

            {/* Search Filter */}
            <div className="relative mb-2">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-3" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search partners by name or code..."
                className="w-full rounded-xl border border-line bg-fill py-1.5 pl-8 pr-3 text-[13px] text-ink placeholder:text-ink-3 focus:outline-none focus:ring-1 focus:ring-accent"
              />
            </div>

            {/* Checkbox List */}
            <div className="max-h-48 overflow-y-auto rounded-2xl border border-line bg-fill/20 p-1 divide-y divide-line/40">
              {filteredVendors.length === 0 ? (
                <p className="py-4 text-center text-[12px] text-ink-3">No partners matching search</p>
              ) : (
                filteredVendors.map((v) => {
                  const isChecked = selectedVendors.includes(v.code);
                  return (
                    <label
                      key={v.code}
                      onClick={() => toggleVendor(v.code)}
                      className={cn(
                        "flex items-center gap-3 rounded-xl px-3 py-2 cursor-pointer transition select-none",
                        isChecked ? "bg-accent-soft/40 text-accent font-medium" : "hover:bg-fill text-ink",
                      )}
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => {}} // handled by parent onClick
                        className="h-4 w-4 rounded accent-accent cursor-pointer"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[13px]">{v.name}</p>
                        <p className="font-mono text-[11px] text-ink-3">{v.code}</p>
                      </div>
                      <Badge tone="gray">{v.sharePct}% share</Badge>
                    </label>
                  );
                })
              )}
            </div>

            {/* Selected Chips */}
            {selectedVendors.length > 0 && (
              <div className="mt-2.5 flex flex-wrap gap-1.5">
                {selectedVendors.map((code) => {
                  const v = vendors.find((x) => x.code === code);
                  return (
                    <span
                      key={code}
                      className="inline-flex items-center gap-1 rounded-full bg-accent-soft px-2.5 py-1 text-[11.5px] font-medium text-accent"
                    >
                      <span>{v?.name || code}</span>
                      <button
                        type="button"
                        onClick={() => removeVendor(code)}
                        className="rounded-full hover:bg-accent/20 p-0.5 cursor-pointer"
                        title="Remove"
                      >
                        <X size={11} />
                      </button>
                    </span>
                  );
                })}
              </div>
            )}

            {/* Custom Partner Code Accordion */}
            <div className="mt-2.5">
              {!showCustom ? (
                <button
                  type="button"
                  onClick={() => setShowCustom(true)}
                  className="flex items-center gap-1 text-[12px] font-medium text-accent hover:underline cursor-pointer"
                >
                  <Plus size={13} />
                  <span>Add other custom vendor code...</span>
                </button>
              ) : (
                <div className="flex items-center gap-2 rounded-xl bg-fill p-2 border border-line">
                  <Input
                    value={custom}
                    onChange={(e) => setCustom(e.target.value)}
                    placeholder="e.g. VI010992026"
                    className="flex-1 !h-8 text-[12px]"
                  />
                  <Button size="sm" onClick={addCustomVendor}>
                    Add
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setShowCustom(false)}>
                    Cancel
                  </Button>
                </div>
              )}
            </div>
          </div>

          {/* Allocation Terms */}
          <div className="grid grid-cols-2 gap-3 pt-2 border-t border-line/60">
            <Field label="Vendor share (%)" hint="Percent of client CPI paid out">
              <Input
                type="number"
                min={1}
                max={100}
                value={pct}
                onFocus={(e) => e.target.select()}
                onChange={(e) => setPct(e.target.value)}
                onBlur={() => {
                  const n = Number(pct);
                  if (pct === "" || isNaN(n) || n <= 0) setPct("70");
                  else if (n > 100) setPct("100");
                  else setPct(String(n));
                }}
              />
            </Field>
            <Field label={single ? "Quota (completes)" : "Quota per survey"}>
              <Input
                type="number"
                min={1}
                value={quota}
                onFocus={(e) => e.target.select()}
                onChange={(e) => setQuota(e.target.value)}
                onBlur={() => {
                  const n = Number(quota);
                  if (quota === "" || isNaN(n) || n <= 0) setQuota("100");
                  else setQuota(String(n));
                }}
              />
            </Field>
          </div>

          {single && (
            <div className="grid grid-cols-3 gap-2 rounded-2xl bg-fill p-4 text-center">
              <div>
                <p className="text-[11px] font-semibold uppercase text-ink-3">Client CPI</p>
                <p className="text-[17px] font-semibold tabular">{money(single.cpi)}</p>
              </div>
              <div>
                <p className="text-[11px] font-semibold uppercase text-ink-3">Vendor CPI</p>
                <p className="text-[17px] font-semibold tabular">
                  {money((single.cpi * numPct) / 100)}
                </p>
              </div>
              <div>
                <p className="text-[11px] font-semibold uppercase text-ink-3">Margin</p>
                <p className="text-[17px] font-semibold text-green tabular">
                  {money((single.cpi * (100 - numPct)) / 100)}
                </p>
              </div>
            </div>
          )}

          <div className="rounded-2xl bg-fill px-4 py-3 text-[13px] text-ink-2 flex items-center justify-between">
            <span>
              Total links to generate:{" "}
              <strong className="text-ink">
                {surveys.length} survey(s) × {selectedVendors.length} partner(s) ={" "}
                {surveys.length * selectedVendors.length} links
              </strong>
            </span>
          </div>
        </div>
      )}
    </Modal>
  );
}
