import { useMemo, useState } from "react";
import { Building2, Eye, EyeOff, Pencil, Plug, Plus, ShieldCheck, Trash2, Link2, Copy, Check, Sparkles } from "lucide-react";
import { api, type Client } from "../lib/api";
import { useQuery } from "../lib/useQuery";
import { initials, mask } from "../lib/utils";
import { cn } from "../utils/cn";
import { ClientIntegrationModal } from "../components/ClientIntegrationModal";
import { useRealtime } from "../lib/useRealtime";
import {
  Badge,
  Button,
  Card,
  CopyButton,
  EmptyState,
  ErrorState,
  Field,
  Input,
  Modal,
  PageHeader,
  SearchInput,
  Select,
  Skeleton,
  Toggle,
} from "../components/ui";
import { useFeedback } from "../components/feedback";
import { PERMS, usePermissions } from "../lib/permissions";

const blank = {
  client_name: "",
  client_code: "",
  email: "",
  phone: "",
  api_type: "marketxcel",
  feed_api_url: "",
  s2s_callback_url: "",
  master_data_url: "",
  complete_redirect: "",
  terminate_redirect: "",
  overquota_redirect: "",
  security_redirect: "",
  secret_key: "",
  api_token: "",
  hash_algorithm: "sha3-256",
  security_enabled: 1,
  status: "Y",
};

export function Clients() {
  const { can, user: currentAuthUser } = usePermissions();
  const { toast, confirm } = useFeedback();
  const isAdmin =
    currentAuthUser?.role_id === 1 ||
    currentAuthUser?.role_name?.toLowerCase().includes("admin") ||
    currentAuthUser?.username === "admin" ||
    currentAuthUser?.role_name === "Developer";

  const canEdit = isAdmin || can(PERMS.CLIENTS_EDIT) || can(PERMS.CLIENTS);
  const canDelete = isAdmin || can(PERMS.CLIENTS_DELETE) || can(PERMS.CLIENTS);
  const canCreate = isAdmin || can(PERMS.CLIENTS_CREATE) || can(PERMS.CLIENTS);

  const q = useQuery(async () => (await api.get<{ data: Client[] }>("/clients")).data || [], []);
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState<Client | null>(null);
  const [form, setForm] = useState<null | { id?: number; values: typeof blank }>(null);
  const [integrationClient, setIntegrationClient] = useState<Client | null>(null);
  const [copiedAllHeader, setCopiedAllHeader] = useState(false);

  // Live Supabase Realtime Subscription: auto-sync any database changes immediately
  useRealtime("smr_clients", () => q.reload());

  const copyUniversalRedirects = () => {
    const origin = typeof window !== "undefined" ? window.location.origin : "https://api.vmhgroupsmr.com";
    const text =
      `*SMR Platform Standard Static Inbound Return Redirects*\n` +
      `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
      `Configure your survey platform with these 4 static exit redirects:\n\n` +
      `1. COMPLETE / SUCCESS:\n${origin}/#/complete?uid=[UID]\n\n` +
      `2. TERMINATE / SCREENOUT:\n${origin}/#/terminate?uid=[UID]\n\n` +
      `3. OVERQUOTA / QUOTA FULL:\n${origin}/#/overquota?uid=[UID]\n\n` +
      `4. SECURITY / QUALITY SCREENOUT:\n${origin}/#/security?uid=[UID]\n\n` +
      `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
      `Note: Replace [UID] with the respondent identifier upon survey exit. No project ID or status code parameters required.`;

    navigator.clipboard.writeText(text);
    setCopiedAllHeader(true);
    toast("Standard Static SMR Client Redirects copied to clipboard!", "success");
    setTimeout(() => setCopiedAllHeader(false), 2200);
  };

  const rows = useMemo(() => {
    const t = search.toLowerCase();
    return (q.data || []).filter((c) => !t || c.client_name.toLowerCase().includes(t) || c.client_code.toLowerCase().includes(t));
  }, [q.data, search]);

  if (q.error && !q.data) return <ErrorState message={q.error} onRetry={q.reset} />;

  const toggleSecurity = async (c: Client, on: boolean) => {
    q.setData((d) => (d || []).map((x) => (x.id === c.id ? { ...x, security_enabled: on ? 1 : 0 } : x)));
    setOpen((o) => (o && o.id === c.id ? { ...o, security_enabled: on ? 1 : 0 } : o));
    try {
      await api.post("/clients/toggle-security", { client_id: c.id, security_enabled: on ? 1 : 0 });
      toast(`Security gate ${on ? "enabled" : "disabled"} for ${c.client_name}`);
    } catch (e: any) {
      toast(e.message, "error");
      q.reload();
    }
  };

  const toggleStatus = async (c: Client, on: boolean) => {
    const newStatus = on ? "Y" : "N";
    q.setData((d) => (d || []).map((x) => (x.id === c.id ? { ...x, status: newStatus } : x)));
    setOpen((o) => (o && o.id === c.id ? { ...o, status: newStatus } : o));
    try {
      await api.post("/clients/toggle-status", { client_id: c.id, status: newStatus });
      toast(`${c.client_name} is now ${on ? "Active" : "Inactive"}`);
    } catch (e: any) {
      toast(e.message, "error");
      q.reload();
    }
  };

  const remove = async (c: Client) => {
    if (
      !(await confirm({
        title: `Delete ${c.client_name}?`,
        message: "This client will be permanently removed. Studies linked to this client may stop routing.",
        confirmLabel: "Delete client",
        danger: true,
      }))
    )
      return;
    try {
      await api.del(`/clients/${c.id}`);
      toast(`${c.client_name} deleted successfully`, "success");
      setOpen(null);
      q.reload();
    } catch (e: any) {
      toast(e.message, "error");
    }
  };

  const edit = (c: Client) =>
    setForm({
      id: c.id,
      values: {
        ...blank,
        client_name: c.client_name || "",
        client_code: c.client_code || "",
        email: c.email || "",
        phone: c.phone || "",
        api_type: c.api_type || "marketxcel",
        feed_api_url: c.feed_api_url || "",
        s2s_callback_url: c.s2s_callback_url || "",
        master_data_url: c.master_data_url || "",
        complete_redirect: c.complete_redirect || "",
        terminate_redirect: c.terminate_redirect || "",
        overquota_redirect: c.overquota_redirect || "",
        security_redirect: c.security_redirect || "",
        secret_key: c.secret_key || "",
        api_token: c.api_token || "",
        hash_algorithm: c.hash_algorithm || "sha3-256",
        security_enabled: Number(c.security_enabled ?? 1),
        status: c.status || "Y",
      },
    });

  return (
    <div>
      <PageHeader
        title="Clients"
        subtitle="Demand partners, their APIs and outbound redirect endpoints."
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              icon={copiedAllHeader ? <Check size={14} className="text-green" /> : <Copy size={14} />}
              onClick={copyUniversalRedirects}
              title="Copy universal SMR 4 Inbound Return Redirect URLs for clients"
            >
              {copiedAllHeader ? "Redirects Copied!" : "Copy SMR Redirects"}
            </Button>
            {canCreate && (
              <Button icon={<Plus size={16} />} onClick={() => setForm({ values: blank })}>
                Add client
              </Button>
            )}
          </div>
        }
      />
      <SearchInput value={search} onChange={setSearch} placeholder="Search clients" className="mb-5 sm:max-w-sm" />

      {q.loading ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-44 rounded-3xl" />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <Card>
          <EmptyState title="No clients found" message="Add your first demand partner to start routing traffic." />
        </Card>
      ) : (
        <div className="stagger grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {rows.map((c) => (
            <Card key={c.id} hover className="flex cursor-pointer flex-col p-5" onClick={() => setOpen(c)}>
              <div className="mb-4 flex items-start gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-accent-soft text-[14px] font-bold text-accent">
                  {initials(c.client_name)}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[16px] font-semibold text-ink">{c.client_name}</p>
                  <p className="font-mono text-[12px] text-ink-3">{c.client_code}</p>
                </div>
                <Badge tone={c.status === "Y" || c.status === "Active" ? "green" : "gray"} dot>
                  {c.status === "Y" || c.status === "Active" ? "Active" : "Inactive"}
                </Badge>
              </div>
              <dl className="mb-4 space-y-1.5 text-[13px]">
                <div className="flex justify-between gap-3">
                  <dt className="text-ink-3">API</dt>
                  <dd className="font-medium capitalize text-ink">{c.api_type || "—"}</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-ink-3">Hashing</dt>
                  <dd className="font-medium uppercase text-ink">{c.hash_algorithm || "—"}</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-ink-3">Contact</dt>
                  <dd className="max-w-[60%] truncate font-medium text-ink">{c.email || "—"}</dd>
                </div>
              </dl>
              <div className="mt-auto space-y-2">
                <div
                  className="flex items-center justify-between rounded-2xl bg-fill px-3.5 py-2.5"
                  onClick={(e) => e.stopPropagation()}
                >
                  <span className="flex items-center gap-2 text-[13px] font-medium text-ink">
                    <span className={cn("h-2.5 w-2.5 rounded-full", (c.status === "Y" || c.status === "Active") ? "bg-green" : "bg-ink-3")} />
                    {(c.status === "Y" || c.status === "Active") ? "Active Partner" : "Inactive Partner"}
                  </span>
                  <Toggle
                    checked={c.status === "Y" || c.status === "Active"}
                    onChange={(on) => toggleStatus(c, on)}
                    label="Toggle client active status"
                  />
                </div>

                <div
                  className="flex items-center justify-between rounded-2xl bg-fill px-3.5 py-2"
                  onClick={(e) => e.stopPropagation()}
                >
                  <span className="flex items-center gap-2 text-[12px] font-medium text-ink-3">
                    <ShieldCheck size={15} className={c.security_enabled ? "text-green" : "text-ink-3"} /> Security gate
                  </span>
                  <Toggle checked={!!Number(c.security_enabled)} onChange={(v) => toggleSecurity(c, v)} label="Toggle security gate" />
                </div>

                {/* Direct Action Buttons: Integration / Redirects, Edit and Delete */}
                <div
                  className="flex items-center justify-between gap-2 pt-2 border-t border-line/60"
                  onClick={(e) => e.stopPropagation()}
                >
                  <Button
                    size="sm"
                    variant="secondary"
                    icon={<Link2 size={13} className="text-accent" />}
                    onClick={() => setIntegrationClient(c)}
                    title="View & copy SMR Return Redirects and API keys for this client"
                  >
                    Redirects & API
                  </Button>

                  <div className="flex items-center gap-1.5">
                    {canEdit && (
                      <Button
                        size="sm"
                        variant="secondary"
                        icon={<Pencil size={13} />}
                        onClick={() => edit(c)}
                      >
                        Edit
                      </Button>
                    )}
                    {canDelete && (
                      <Button
                        size="sm"
                        variant="dangerSoft"
                        icon={<Trash2 size={13} />}
                        onClick={() => remove(c)}
                      >
                        Delete
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      <ClientDrawer
        client={open}
        canEdit={canEdit}
        canDelete={canDelete}
        onClose={() => setOpen(null)}
        onOpenIntegration={(c) => {
          setOpen(null);
          setIntegrationClient(c);
        }}
        onEdit={(c) => {
          setOpen(null);
          edit(c);
        }}
        onDelete={remove}
        onToggleStatus={toggleStatus}
      />
      <ClientForm
        state={form}
        onClose={() => setForm(null)}
        onSaved={() => {
          q.reload();
          setForm(null);
        }}
      />
      {integrationClient && (
        <ClientIntegrationModal
          client={integrationClient}
          onClose={() => setIntegrationClient(null)}
          onSaved={() => q.reload()}
        />
      )}
    </div>
  );
}

function ClientDrawer({
  client: c,
  canEdit,
  canDelete,
  onClose,
  onEdit,
  onDelete,
  onToggleStatus,
  onOpenIntegration,
}: {
  client: Client | null;
  canEdit?: boolean;
  canDelete?: boolean;
  onClose: () => void;
  onEdit: (c: Client) => void;
  onDelete: (c: Client) => void;
  onToggleStatus?: (c: Client, on: boolean) => void;
  onOpenIntegration?: (c: Client) => void;
}) {
  const { can } = usePermissions();
  const { toast } = useFeedback();
  const [reveal, setReveal] = useState(false);
  const [testing, setTesting] = useState(false);
  const [result, setResult] = useState<any>(null);

  const test = async () => {
    if (!c) return;
    setTesting(true);
    setResult(null);
    try {
      const r = await api.post<any>("/clients/test-handshake", {
        client_code: c.client_code,
        clientCode: c.client_code,
        apiType: c.api_type,
        feed_api_url: c.feed_api_url,
        s2s_callback_url: c.s2s_callback_url,
        master_data_url: c.master_data_url,
      });
      setResult(r);
    } catch (e: any) {
      toast(e.message, "error");
    } finally {
      setTesting(false);
    }
  };

  const redirects: [string, string | undefined][] = c
    ? [
        ["Complete", c.complete_redirect],
        ["Terminate", c.terminate_redirect],
        ["Over quota", c.overquota_redirect],
        ["Security terminate", c.security_redirect],
      ]
    : [];
  const endpoints: [string, string | undefined][] = c
    ? [
        ["Feed API", c.feed_api_url],
        ["S2S callback", c.s2s_callback_url],
        ["Master data", c.master_data_url],
      ]
    : [];

  return (
    <Modal
      open={!!c}
      onClose={() => {
        onClose();
        setResult(null);
        setReveal(false);
      }}
      drawer
      title={c?.client_name}
      subtitle={c?.client_code}
      footer={
        c && (
          <>
            {canDelete && (
              <Button variant="dangerSoft" icon={<Trash2 size={15} />} onClick={() => onDelete(c)}>
                Delete client
              </Button>
            )}
            {canEdit && (
              <Button variant="secondary" icon={<Pencil size={15} />} onClick={() => onEdit(c)}>
                Edit client
              </Button>
            )}
            {can(PERMS.CLIENTS_API) && (
              <Button loading={testing} icon={<Plug size={15} />} onClick={test}>
                Test handshake
              </Button>
            )}
          </>
        )
      }
    >
      {c && (
        <div className="space-y-6">
          <div className="flex items-center justify-between rounded-2xl bg-fill p-3.5">
            <span className="flex items-center gap-2 text-[14px] font-semibold text-ink">
              <span className={cn("h-2.5 w-2.5 rounded-full", (c.status === "Y" || c.status === "Active") ? "bg-green" : "bg-ink-3")} />
              {(c.status === "Y" || c.status === "Active") ? "Active Partner" : "Inactive Partner"}
            </span>
            {onToggleStatus && (
              <Toggle
                checked={c.status === "Y" || c.status === "Active"}
                onChange={(on) => onToggleStatus(c, on)}
                label="Toggle client status"
              />
            )}
          </div>
          {result && (
            <div className="anim-scale-in rounded-2xl bg-green-soft p-4">
              <p className="text-[14px] font-semibold text-green">{String(result.result?.status || "OK").replace(/_/g, " ")}</p>
              <ul className="mt-2 space-y-1 text-[13px] text-ink-2">
                {["feedApi", "s2sCallback", "masterData"].map(
                  (k) =>
                    result.result?.[k] && (
                      <li key={k} className="flex justify-between gap-3">
                        <span className="capitalize">{k.replace(/([A-Z])/g, " $1")}</span>
                        <span className="font-medium">{result.result[k].status}</span>
                      </li>
                    ),
                )}
                {result.result?.latency && (
                  <li className="flex justify-between gap-3">
                    <span>Latency</span>
                    <span className="font-medium">{result.result.latency}</span>
                  </li>
                )}
              </ul>
            </div>
          )}

          {can(PERMS.CLIENTS_SECURITY_KEYS) && (
            <section>
              <h3 className="mb-2 text-[15px] font-semibold">Credentials</h3>
              <div className="divide-y divide-line overflow-hidden rounded-2xl border border-line text-[14px]">
                {[
                  ["Secret key", c.secret_key],
                  ["API token", c.api_token],
                ].map(([k, v]) => (
                  <div key={k} className="flex items-center justify-between gap-3 px-4 py-3">
                    <span className="text-ink-3">{k}</span>
                    <span className="min-w-0 truncate font-mono text-[13px]">{reveal ? v || "—" : mask(v as string)}</span>
                  </div>
                ))}
                <div className="flex items-center justify-between px-4 py-3">
                  <span className="text-ink-3">Hash algorithm</span>
                  <span className="font-medium uppercase">{c.hash_algorithm}</span>
                </div>
              </div>
              <Button className="mt-2" size="sm" variant="ghost" icon={reveal ? <EyeOff size={14} /> : <Eye size={14} />} onClick={() => setReveal((r) => !r)}>
                {reveal ? "Hide secrets" : "Reveal secrets"}
              </Button>
            </section>
          )}

          {can(PERMS.CLIENTS_API) && (
            <section>
              <h3 className="mb-2 text-[15px] font-semibold">Client endpoints</h3>
              <ul className="space-y-2">
                {endpoints.map(([k, v]) => (
                  <li key={k} className="rounded-2xl bg-fill px-4 py-3">
                    <p className="text-[12px] font-semibold uppercase tracking-wide text-ink-3">{k}</p>
                    <p className="mt-0.5 break-all font-mono text-[12px] text-ink-2">{v || "—"}</p>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <div className="rounded-2xl border border-accent/20 bg-accent-soft/30 p-4">
            <h4 className="text-[14px] font-semibold text-ink flex items-center gap-1.5 mb-1">
              <Link2 size={16} className="text-accent" />
              SMR Return Redirects (For Client Onboarding)
            </h4>
            <p className="text-[12px] text-ink-3 mb-3">
              Generate & copy the 4 formatted inbound return redirect URLs or S2S API credentials to send to {c.client_name}.
            </p>
            <Button
              variant="primary"
              size="sm"
              icon={<Copy size={14} />}
              onClick={() => onOpenIntegration?.(c)}
              className="w-full"
            >
              Open Integration & Copy 4 Redirects
            </Button>
          </div>

          <section>
            <h3 className="mb-2 text-[15px] font-semibold">Redirect URLs</h3>
            <p className="mb-3 text-[13px] text-ink-3">Give these to the client so respondents return to the router with the right outcome.</p>
            <ul className="space-y-2">
              {redirects.map(([k, v]) => (
                <li key={k} className="rounded-2xl border border-line p-3">
                  <div className="mb-1.5 flex items-center justify-between">
                    <span className="text-[13px] font-semibold">{k}</span>
                    {v && <CopyButton text={v} />}
                  </div>
                  <p className="break-all font-mono text-[11.5px] text-ink-3">{v || "—"}</p>
                </li>
              ))}
            </ul>
          </section>
        </div>
      )}
    </Modal>
  );
}

function ClientForm({
  state,
  onClose,
  onSaved,
}: {
  state: null | { id?: number; values: typeof blank };
  onClose: () => void;
  onSaved: () => void;
}) {
  const { toast } = useFeedback();
  const [v, setV] = useState(blank);
  const [busy, setBusy] = useState(false);
  const [key, setKey] = useState<unknown>(null);
  if (state && key !== state) {
    setKey(state);
    setV(state.values);
  }
  const set = (k: keyof typeof blank) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setV((p) => ({ ...p, [k]: e.target.value }));

  const save = async () => {
    if (!v.client_name.trim()) return toast("Client name is required.", "error");
    const code = (v.client_code || v.client_name).trim().replace(/\s+/g, "_").toUpperCase();
    setBusy(true);
    try {
      const body = {
        ...v,
        client_code: code,
        api_type: v.api_type,
        apiType: v.api_type,
        feed_api_url: v.feed_api_url,
        feedApiUrl: v.feed_api_url,
        s2s_callback_url: v.s2s_callback_url,
        master_data_url: v.master_data_url,
        complete_redirect: v.complete_redirect || null,
        terminate_redirect: v.terminate_redirect || null,
        overquota_redirect: v.overquota_redirect || null,
        security_redirect: v.security_redirect || null,
        security_enabled: Number(v.security_enabled) ? 1 : 0,
        status: v.status === "Y" || v.status === "Active" ? "Y" : "N",
      };
      if (state?.id) {
        await api.put(`/clients/${state.id}`, { id: state.id, ...body });
      } else {
        await api.post("/clients", body);
      }
      toast(state?.id ? "Client updated successfully" : "Client added successfully", "success");
      onSaved();
    } catch (e: any) {
      toast(e.message, "error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open={!!state}
      onClose={onClose}
      size="lg"
      title={state?.id ? "Edit client" : "Add client"}
      subtitle="Demand partner connection details"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button loading={busy} onClick={save} icon={<Building2 size={16} />}>
            {state?.id ? "Save changes" : "Add client"}
          </Button>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Client name">
          <Input value={v.client_name} onChange={set("client_name")} placeholder="Acme Research" />
        </Field>
        <Field label="Client code" hint="Identifier for tracking and routing">
          <Input value={v.client_code} onChange={set("client_code")} placeholder="ACME" />
        </Field>
        <Field label="Email">
          <Input type="email" value={v.email} onChange={set("email")} placeholder="partner@example.com" />
        </Field>
        <Field label="Phone">
          <Input value={v.phone} onChange={set("phone")} placeholder="+1 (555) 000-0000" />
        </Field>
        <Field label="API type">
          <Select value={v.api_type} onChange={set("api_type")}>
            <option value="marketxcel">MarketXcel</option>
            <option value="zamplia">Zamplia</option>
            <option value="S2S">S2S API</option>
            <option value="direct">Direct</option>
          </Select>
        </Field>
        <Field label="Hash algorithm">
          <Select value={v.hash_algorithm} onChange={set("hash_algorithm")}>
            <option value="sha3-256">SHA3-256</option>
            <option value="hmac-sha256">HMAC-SHA256</option>
            <option value="sha256">SHA256</option>
            <option value="md5">MD5</option>
          </Select>
        </Field>
        <Field label="Feed API URL" className="sm:col-span-2">
          <Input value={v.feed_api_url} onChange={set("feed_api_url")} placeholder="https://" />
        </Field>
        <Field label="S2S callback URL" className="sm:col-span-2">
          <Input value={v.s2s_callback_url} onChange={set("s2s_callback_url")} placeholder="https://" />
        </Field>
        <Field label="Master data URL" className="sm:col-span-2">
          <Input value={v.master_data_url} onChange={set("master_data_url")} placeholder="https://" />
        </Field>

        <div className="sm:col-span-2 pt-2 border-t border-line/60">
          <p className="text-[13px] font-semibold text-ink mb-2">Redirect URLs (Return Callbacks)</p>
        </div>
        <Field label="Complete redirect URL" className="sm:col-span-2">
          <Input value={v.complete_redirect} onChange={set("complete_redirect")} placeholder="https://..." />
        </Field>
        <Field label="Terminate redirect URL" className="sm:col-span-2">
          <Input value={v.terminate_redirect} onChange={set("terminate_redirect")} placeholder="https://..." />
        </Field>
        <Field label="Over quota redirect URL" className="sm:col-span-2">
          <Input value={v.overquota_redirect} onChange={set("overquota_redirect")} placeholder="https://..." />
        </Field>
        <Field label="Security redirect URL" className="sm:col-span-2">
          <Input value={v.security_redirect} onChange={set("security_redirect")} placeholder="https://..." />
        </Field>

        <div className="sm:col-span-2 pt-2 border-t border-line/60">
          <p className="text-[13px] font-semibold text-ink mb-2">API Security & Access</p>
        </div>
        <Field label="Secret key">
          <Input type="password" autoComplete="new-password" value={v.secret_key} onChange={set("secret_key")} placeholder="Secret key" />
        </Field>
        <Field label="API token">
          <Input type="password" autoComplete="new-password" value={v.api_token} onChange={set("api_token")} placeholder="API token" />
        </Field>

        <div className="flex items-center justify-between rounded-2xl bg-fill px-4 py-3 sm:col-span-2">
          <div>
            <p className="text-[14px] font-medium">Active Partner</p>
            <p className="text-[12px] text-ink-3">Inactive clients will hide their surveys from the Marketplace</p>
          </div>
          <Toggle checked={v.status === "Y" || v.status === "Active"} onChange={(on) => setV((p) => ({ ...p, status: on ? "Y" : "N" }))} label="Active client" />
        </div>

        <div className="flex items-center justify-between rounded-2xl bg-fill px-4 py-3 sm:col-span-2">
          <div>
            <p className="text-[14px] font-medium">Security gate</p>
            <p className="text-[12px] text-ink-3">Run fraud checks on this client's traffic</p>
          </div>
          <Toggle checked={!!v.security_enabled} onChange={(on) => setV((p) => ({ ...p, security_enabled: on ? 1 : 0 }))} label="Security gate" />
        </div>
      </div>
    </Modal>
  );
}
