import { useEffect, useState } from "react";
import { api } from "../lib/api";
import { num } from "../lib/utils";
import { Button, Field, Input, Modal, Select } from "./ui";
import { useFeedback } from "./feedback";

export function EditAllotmentModal({
  allotment,
  onClose,
  onSaved,
}: {
  allotment: any | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { toast } = useFeedback();
  const [cpi, setCpi] = useState("");
  const [quota, setQuota] = useState("");
  const [status, setStatus] = useState("Active");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (allotment) {
      setCpi(String(allotment.vendor_cpi ?? ""));
      setQuota(String(allotment.quota_limit ?? "100"));
      setStatus(allotment.status || "Active");
    }
  }, [allotment]);

  if (!allotment) return null;

  const save = async () => {
    if (num(cpi) <= 0) return toast("Enter a valid vendor CPI.", "error");
    if (num(quota) <= 0) return toast("Quota must be greater than zero.", "error");
    setBusy(true);
    try {
      await api.post("/vendor/allot", {
        project_id: allotment.project_id,
        vendor_id: allotment.vendor_id,
        vendor_name: allotment.vendor_name,
        vendor_cpi: num(cpi),
        quota_limit: num(quota),
        status,
      });
      toast("Vendor allotment updated successfully");
      onSaved();
      onClose();
    } catch (e: any) {
      toast(e.message, "error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open={!!allotment}
      onClose={onClose}
      title="Edit vendor allotment"
      subtitle={`Study #${allotment.project_id} · Partner ${allotment.vendor_id}`}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button loading={busy} onClick={save}>
            Save changes
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Vendor CPI ($)" hint="Payout per verified survey completion">
          <Input type="number" step="0.01" min="0" value={cpi} onChange={(e) => setCpi(e.target.value)} />
        </Field>
        <Field label="Quota limit (completes)" hint="Target responses allocated to this partner">
          <Input type="number" min="1" value={quota} onChange={(e) => setQuota(e.target.value)} />
        </Field>
        <Field label="Allotment status">
          <Select value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="Active">Active</option>
            <option value="Paused">Paused</option>
            <option value="Closed">Closed</option>
          </Select>
        </Field>
      </div>
    </Modal>
  );
}
