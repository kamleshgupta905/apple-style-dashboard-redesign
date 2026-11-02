import { useEffect, useState } from "react";
import { CheckCircle2, Link2 } from "lucide-react";
import { api } from "../lib/api";
import { entryLink, fetchVendorOptions, type NSurvey, type VendorOption } from "../lib/data";
import { exportCSV, money, num } from "../lib/utils";
import { Button, CopyButton, Field, Input, Modal, Select, Skeleton } from "./ui";
import { useFeedback } from "./feedback";

/** Allocate one or many surveys to a supply partner and hand back entry links. */
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
  const [vendor, setVendor] = useState(presetVendor || "");
  const [custom, setCustom] = useState("");
  const [pct, setPct] = useState(70);
  const [quota, setQuota] = useState(100);
  const [busy, setBusy] = useState(false);
  const [links, setLinks] = useState<{ id: string; name: string; link: string }[] | null>(null);

  useEffect(() => {
    if (!open) return;
    setLinks(null);
    setQuota(Math.min(100, ...surveys.map((s) => s.target || 100)));
    fetchVendorOptions().then((v) => {
      setVendors(v);
      const pick = v.find((x) => x.code === presetVendor) || v[0];
      if (pick) {
        setVendor(pick.code);
        setPct(pick.sharePct);
      } else setVendor("__custom");
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const code = vendor === "__custom" ? custom.trim() : vendor;
  const single = surveys.length === 1 ? surveys[0] : null;

  const submit = async () => {
    if (!code) return toast("Choose a vendor first.", "error");
    if (quota <= 0) return toast("Quota must be greater than zero.", "error");
    setBusy(true);
    try {
      const out: { id: string; name: string; link: string }[] = [];
      for (const s of surveys) {
        const res = await api.post<any>("/vendor/allot", {
          project_id: s.id,
          vendor_id: code,
          vendor_cpi: Number(((s.cpi * pct) / 100).toFixed(2)),
          quota_limit: quota,
          status: "Active",
        });
        const link = res?.entry_link || res?.data?.entry_link || entryLink(code, s.id);
        out.push({ id: s.id, name: s.name, link });
      }
      setLinks(out);
      toast(`Allocated ${out.length} ${out.length > 1 ? "studies" : "study"} to ${code}`);
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
      title={links ? "Entry links ready" : surveys.length > 1 ? `Assign ${surveys.length} surveys` : "Assign to vendor"}
      subtitle={links ? "Share these with your supply partner." : single ? `#${single.id} · ${single.name}` : "Same terms applied to every selected survey"}
      size="lg"
      footer={
        links ? (
          <>
            <Button
              variant="secondary"
              onClick={() => exportCSV("entry-links", ["Survey ID", "Name", "Vendor", "Entry link"], links.map((l) => [l.id, l.name, code, l.link]))}
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
            <Button loading={busy} onClick={submit} icon={<Link2 size={16} />}>
              Generate entry {surveys.length > 1 ? "links" : "link"}
            </Button>
          </>
        )
      }
    >
      {links ? (
        <ul className="space-y-3">
          <li className="flex items-center gap-2 rounded-2xl bg-green-soft px-4 py-3 text-[14px] font-medium text-green">
            <CheckCircle2 size={18} /> Allocation saved to the gateway
          </li>
          {links.map((l) => (
            <li key={l.id} className="rounded-2xl border border-line p-3.5">
              <div className="mb-2 flex items-center justify-between gap-2">
                <p className="truncate text-[13px] font-semibold">
                  #{l.id} <span className="font-normal text-ink-3">· {l.name}</span>
                </p>
                <CopyButton text={l.link} />
              </div>
              <p className="break-all rounded-lg bg-fill px-3 py-2 font-mono text-[12px] text-ink-2">{l.link}</p>
            </li>
          ))}
        </ul>
      ) : !vendors ? (
        <div className="space-y-3">
          <Skeleton className="h-11" />
          <Skeleton className="h-11" />
        </div>
      ) : (
        <div className="space-y-4">
          <Field label="Supply partner">
            <Select
              value={vendor}
              onChange={(e) => {
                setVendor(e.target.value);
                const v = vendors.find((x) => x.code === e.target.value);
                if (v) setPct(v.sharePct);
              }}
            >
              {vendors.map((v) => (
                <option key={v.code} value={v.code}>
                  {v.name} — {v.code}
                </option>
              ))}
              <option value="__custom">Other (enter vendor code)…</option>
            </Select>
          </Field>
          {vendor === "__custom" && (
            <Field label="Vendor code">
              <Input value={custom} onChange={(e) => setCustom(e.target.value)} placeholder="VND-XYZ-01" />
            </Field>
          )}
          <div className="grid grid-cols-2 gap-3">
            <Field label="Vendor share (%)" hint="Percent of client CPI paid out">
              <Input type="number" min={1} max={100} value={pct} onChange={(e) => setPct(num(e.target.value))} />
            </Field>
            <Field label={single ? "Quota (completes)" : "Quota per survey"}>
              <Input type="number" min={1} value={quota} onChange={(e) => setQuota(num(e.target.value))} />
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
                <p className="text-[17px] font-semibold tabular">{money((single.cpi * pct) / 100)}</p>
              </div>
              <div>
                <p className="text-[11px] font-semibold uppercase text-ink-3">Margin</p>
                <p className="text-[17px] font-semibold text-green tabular">{money((single.cpi * (100 - pct)) / 100)}</p>
              </div>
            </div>
          )}
          {!single && <p className="rounded-2xl bg-fill px-4 py-3 text-[13px] text-ink-2">{surveys.length} surveys will each get a unique entry link.</p>}
        </div>
      )}
    </Modal>
  );
}
