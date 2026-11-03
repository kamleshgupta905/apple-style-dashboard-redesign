import { useMemo, useState } from "react";
import { Building2, Eye, EyeOff, Pencil, Plug, Plus, ShieldCheck, Trash2 } from "lucide-react";
import { api, type Client } from "../lib/api";
import { useQuery } from "../lib/useQuery";
import { initials, mask } from "../lib/utils";
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
  secret_key: "",
  api_token: "",
  hash_algorithm: "sha3-256",
  security_enabled: 1,
  status: "Y",
};

export function Clients() {
  const { can } = usePermissions();
  const { toast, confirm } = useFeedback();
  const q = useQuery(async () => (await api.get<{ data: Client[] }>("/clients")).data || [], []);
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState<Client | null>(null);
  const [form, setForm] = useState<null | { id?: number; values: typeof blank }>(null);

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

  const remove = async (c: Client) => {
    if (!(await confirm({ title: `Remove ${c.client_name}?`, message: "Studies linked to this client may stop routing.", confirmLabel: "Remove", danger: true }))) return;
    try {
      await api.del(`/clients/${c.id}`);
      toast("Client removed");
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
        client_name: c.client_name,
        client_code: c.client_code,
        email: c.email || "",
        phone: c.phone || "",
        api_type: c.api_type || "marketxcel",
        feed_api_url: c.feed_api_url || "",
        s2s_callback_url: c.s2s_callback_url || "",
        master_data_url: c.master_data_url || "",
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
          can(PERMS.CLIENTS_CREATE) ? (
            <Button icon={<Plus size={16} />} onClick={() => setForm({ values: blank })}>
              Add client
            </Button>
          ) : undefined
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
              <div
                className="mt-auto flex items-center justify-between rounded-2xl bg-fill px-3.5 py-2.5"
                onClick={(e) => e.stopPropagation()}
              >
                <span className="flex items-center gap-2 text-[13px] font-medium text-ink-2">
                  <ShieldCheck size={16} className={c.security_enabled ? "text-green" : "text-ink-3"} /> Security gate
                </span>
                <Toggle checked={!!Number(c.security_enabled)} onChange={(v) => toggleSecurity(c, v)} label="Toggle security gate" />
              </div>
            </Card>
          ))}
        </div>
      )}

      <ClientDrawer
        client={open}
        onClose={() => setOpen(null)}
        onEdit={(c) => {
          setOpen(null);
          edit(c);
        }}
        onDelete={remove}
      />
      <ClientForm
        state={form}
        onClose={() => setForm(null)}
        onSaved={() => {
          q.reload();
          setForm(null);
        }}
      />
    </div>
  );
}

function ClientDrawer({
  client: c,
  onClose,
  onEdit,
  onDelete,
}: {
  client: Client | null;
  onClose: () => void;
  onEdit: (c: Client) => void;
  onDelete: (c: Client) => void;
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
            {can(PERMS.CLIENTS_DELETE) && (
              <Button variant="dangerSoft" icon={<Trash2 size={15} />} onClick={() => onDelete(c)}>
                Remove
              </Button>
            )}
            {can(PERMS.CLIENTS_EDIT) && (
              <Button variant="secondary" icon={<Pencil size={15} />} onClick={() => onEdit(c)}>
                Edit
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
      const body = { ...v, client_code: code, apiType: v.api_type, feedApiUrl: v.feed_api_url };
      if (state?.id) await api.put(`/clients/${state.id}`, { id: state.id, ...body });
      else await api.post("/clients", body);
      toast(state?.id ? "Client updated" : "Client added");
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
        <Field label="Client code" hint="Auto-generated if left empty">
          <Input value={v.client_code} onChange={set("client_code")} placeholder="ACME" disabled={!!state?.id} />
        </Field>
        <Field label="Email">
          <Input type="email" value={v.email} onChange={set("email")} />
        </Field>
        <Field label="Phone">
          <Input value={v.phone} onChange={set("phone")} />
        </Field>
        <Field label="API type">
          <Select value={v.api_type} onChange={set("api_type")}>
            <option value="marketxcel">MarketXcel</option>
            <option value="zamplia">Zamplia</option>
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
        <Field label="Secret key">
          <Input type="password" autoComplete="new-password" value={v.secret_key} onChange={set("secret_key")} />
        </Field>
        <Field label="API token">
          <Input type="password" autoComplete="new-password" value={v.api_token} onChange={set("api_token")} />
        </Field>
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
