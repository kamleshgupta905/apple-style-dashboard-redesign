import { useEffect, useState } from "react";
import { Beaker, ShieldAlert, ShieldCheck } from "lucide-react";
import { api } from "../lib/api";
import { useQuery } from "../lib/useQuery";
import { formatDate, num } from "../lib/utils";
import {
  Badge,
  Button,
  Card,
  DataTable,
  EmptyState,
  ErrorState,
  Field,
  Input,
  PageHeader,
  SectionTitle,
  Segmented,
  Select,
  Skeleton,
  Toggle,
  type Column,
} from "../components/ui";
import { useFeedback } from "../components/feedback";
import { cn } from "../utils/cn";

type Policy = Record<string, boolean | number>;

const GROUPS: { title: string; hint: string; items: { key: string; label: string; desc: string }[] }[] = [
  {
    title: "Respondent checks",
    hint: "Applied to every inbound session",
    items: [
      { key: "preScreenEnabled", label: "Pre-screen", desc: "Qualify respondents before routing them to the client" },
      { key: "excludeDuplicates", label: "Exclude duplicates", desc: "Block respondents who already attempted the study" },
      { key: "geoLocationValidation", label: "Geo-location validation", desc: "Reject IPs outside the study's target country" },
      { key: "dynamicThanksUrl", label: "Dynamic thank-you URL", desc: "Signed redirects that cannot be replayed" },
      { key: "verifyEmail", label: "Verify email", desc: "Validate email domain & deliverability" },
    ],
  },
  {
    title: "Fraud detection",
    hint: "Behavioural & network signals",
    items: [
      { key: "speederCheck", label: "Speeder check", desc: "Flag completes finished far quicker than the median LOI" },
      { key: "lhProtection", label: "Straight-liner protection", desc: "Detect low-effort, repetitive answer patterns" },
      { key: "fraudCops", label: "Fraud engine", desc: "Cross-reference known bad actors & device fingerprints" },
      { key: "vpnDetection", label: "VPN / proxy detection", desc: "Block anonymised traffic" },
      { key: "botProtection", label: "Bot protection", desc: "Challenge automated user agents" },
      { key: "browserSecurity", label: "Browser security", desc: "Check browser integrity and headless markers" },
      { key: "textAnalyzer", label: "Open-end text analyser", desc: "Score gibberish and copy-pasted answers" },
      { key: "motionDetection", label: "Motion detection", desc: "Require natural pointer/touch movement" },
      { key: "rocSecurity", label: "ROC security", desc: "Rate-of-completion anomaly monitoring" },
      { key: "offLocationHour", label: "Off-hours blocking", desc: "Reject sessions outside local daytime hours" },
      { key: "excludeGroup", label: "Exclude survey group", desc: "Prevent cross-study group participation" },
    ],
  },
  {
    title: "Allowed devices",
    hint: "Which hardware can enter studies",
    items: [
      { key: "allowDesktop", label: "Desktop", desc: "Laptops and desktop browsers" },
      { key: "allowMobile", label: "Mobile", desc: "Phones" },
      { key: "allowTablet", label: "Tablet", desc: "iPads and Android tablets" },
    ],
  },
];

export function Security() {
  const [tab, setTab] = useState<"policy" | "logs" | "sim">("policy");
  return (
    <div>
      <PageHeader title="Security & fraud" subtitle="Control the gate every respondent passes through." />
      <Segmented
        className="mb-5"
        value={tab}
        onChange={setTab}
        options={[
          { value: "policy", label: "Policy" },
          { value: "logs", label: "Fraud log" },
          { value: "sim", label: "Simulator" },
        ]}
      />
      {tab === "policy" && <PolicyTab />}
      {tab === "logs" && <LogsTab />}
      {tab === "sim" && <SimTab />}
    </div>
  );
}

function PolicyTab() {
  const { toast } = useFeedback();
  const q = useQuery(async () => (await api.get<{ data: Policy }>("/security/policy")).data, []);
  const [p, setP] = useState<Policy | null>(null);
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    if (q.data) setP(q.data);
  }, [q.data]);

  if (q.error && !q.data) return <ErrorState message={q.error} onRetry={q.reset} />;
  if (!p) return <Skeleton className="h-96 rounded-3xl" />;

  const dirty = JSON.stringify(p) !== JSON.stringify(q.data);
  const enabled = GROUPS.flatMap((g) => g.items).filter((i) => p[i.key]).length;
  const total = GROUPS.flatMap((g) => g.items).length;

  const save = async () => {
    setSaving(true);
    try {
      await api.put("/security/policy", p);
      toast("Security policy saved");
      q.reload();
    } catch (e: any) {
      toast(e.message, "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-5">
      <Card className="flex items-center gap-4 p-5">
        <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-green-soft text-green">
          <ShieldCheck size={24} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[16px] font-semibold">
            {enabled} of {total} protections active
          </p>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-fill">
            <div className="h-full rounded-full bg-green transition-all duration-700" style={{ width: `${(enabled / total) * 100}%`, transitionTimingFunction: "var(--ease)" }} />
          </div>
        </div>
      </Card>

      {GROUPS.map((g) => (
        <Card key={g.title} className="anim-fade-up overflow-hidden">
          <div className="px-5 pb-1 pt-5 sm:px-6">
            <SectionTitle title={g.title} hint={g.hint} />
          </div>
          <ul className="divide-y divide-line">
            {g.items.map((i) => (
              <li key={i.key} className="flex items-center justify-between gap-4 px-5 py-3.5 sm:px-6">
                <div className="min-w-0">
                  <p className="text-[15px] font-medium text-ink">{i.label}</p>
                  <p className="text-[13px] text-ink-3">{i.desc}</p>
                </div>
                <Toggle checked={!!p[i.key]} onChange={(v) => setP({ ...p, [i.key]: v })} label={i.label} />
              </li>
            ))}
          </ul>
        </Card>
      ))}

      <Card className="grid gap-4 p-5 sm:grid-cols-2 sm:p-6">
        <Field label="Unique IP limit" hint="Max sessions per IP per study">
          <Input type="number" min={1} value={num(p.uniqueIpLimit, 1)} onChange={(e) => setP({ ...p, uniqueIpLimit: num(e.target.value, 1) })} />
        </Field>
        <Field label="Speeder threshold" hint="Fraction of median LOI considered too fast (0.3 = 30%)">
          <Input type="number" step="0.05" min={0} max={1} value={num(p.speederThresholdPercent, 0.3)} onChange={(e) => setP({ ...p, speederThresholdPercent: num(e.target.value, 0.3) })} />
        </Field>
      </Card>

      {/* sticky save bar */}
      <div className={cn("fixed inset-x-0 bottom-20 z-40 flex justify-center px-4 transition-all duration-500 lg:bottom-6 lg:pl-[264px]", dirty ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-8 opacity-0")}>
        <div className="glass flex items-center gap-3 rounded-full border border-line py-2 pl-5 pr-2 shadow-[var(--shadow-lg)]">
          <span className="text-[14px] font-medium">Unsaved changes</span>
          <Button size="sm" variant="ghost" onClick={() => setP(q.data!)}>Discard</Button>
          <Button size="sm" className="!rounded-full" loading={saving} onClick={save}>Save policy</Button>
        </div>
      </div>
    </div>
  );
}

interface FraudLog {
  id: number;
  uid: string;
  projectId: string;
  vendor: string;
  check: string;
  riskScore: number;
  ip: string | null;
  device: string | null;
  timestamp: string;
  action: string;
}

function LogsTab() {
  const q = useQuery(async () => (await api.get<{ data: FraudLog[] }>("/security/fraud-logs")).data || [], []);
  if (q.error && !q.data) return <ErrorState message={q.error} onRetry={q.reset} />;
  const cols: Column<FraudLog>[] = [
    { key: "timestamp", header: "When", sortValue: (l) => l.timestamp, render: (l) => formatDate(l.timestamp) },
    { key: "uid", header: "Respondent", primary: true, render: (l) => <span className="font-mono text-[13px] font-semibold">{l.uid}</span> },
    { key: "check", header: "Violation", render: (l) => <span className="block max-w-[320px]">{l.check}</span> },
    { key: "projectId", header: "Study", render: (l) => <span className="font-mono text-[12.5px]">#{l.projectId}</span> },
    { key: "vendor", header: "Vendor", render: (l) => <span className="font-mono text-[12.5px]">{l.vendor}</span> },
    { key: "risk", header: "Risk", align: "right", sortValue: (l) => l.riskScore, render: (l) => <Badge tone={l.riskScore >= 80 ? "red" : l.riskScore >= 50 ? "orange" : "green"}>{l.riskScore}</Badge> },
    { key: "action", header: "Action", render: (l) => <Badge tone={l.action === "BLOCKED" ? "red" : "orange"} dot>{l.action}</Badge> },
  ];
  return (
    <DataTable
      columns={cols}
      rows={q.data || []}
      rowKey={(l) => l.id}
      loading={q.loading}
      empty={<EmptyState title="No fraud events" message="Blocked and flagged sessions will appear here." />}
    />
  );
}

function SimTab() {
  const { toast } = useFeedback();
  const [f, setF] = useState({ ip: "8.8.8.8", uid: "TEST_USER_01", device: "Desktop", timeTaken: "300", loi: "15" });
  const [busy, setBusy] = useState(false);
  const [res, setRes] = useState<any>(null);
  const ua: Record<string, string> = {
    Desktop: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Safari/605.1.15",
    Mobile: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148",
    Bot: "python-requests/2.31.0",
  };
  const run = async () => {
    setBusy(true);
    setRes(null);
    try {
      setRes(
        await api.post("/security/simulate-check", {
          ip: f.ip,
          uid: f.uid,
          userAgent: ua[f.device],
          timeTaken: num(f.timeTaken),
          loi: num(f.loi),
        }),
      );
    } catch (e: any) {
      toast(e.message, "error");
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <Card className="p-5 sm:p-6">
        <SectionTitle title="Test a session" hint="Run a respondent through the live policy without logging it" />
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="IP address">
            <Input value={f.ip} onChange={(e) => setF({ ...f, ip: e.target.value })} />
          </Field>
          <Field label="Respondent UID">
            <Input value={f.uid} onChange={(e) => setF({ ...f, uid: e.target.value })} />
          </Field>
          <Field label="Device">
            <Select value={f.device} onChange={(e) => setF({ ...f, device: e.target.value })}>
              <option>Desktop</option>
              <option>Mobile</option>
              <option>Bot</option>
            </Select>
          </Field>
          <Field label="Time taken (sec)">
            <Input type="number" min={0} value={f.timeTaken} onChange={(e) => setF({ ...f, timeTaken: e.target.value })} />
          </Field>
          <Field label="Study LOI (min)" className="sm:col-span-2">
            <Input type="number" min={1} value={f.loi} onChange={(e) => setF({ ...f, loi: e.target.value })} />
          </Field>
        </div>
        <Button className="mt-5 w-full" size="lg" loading={busy} icon={<Beaker size={17} />} onClick={run}>
          Run security check
        </Button>
      </Card>

      <Card className="flex min-h-[260px] flex-col items-center justify-center p-6 text-center">
        {!res ? (
          <>
            <span className="mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-fill text-ink-3">
              <ShieldCheck size={26} />
            </span>
            <p className="text-[15px] font-medium">Verdict will appear here</p>
          </>
        ) : (
          <div className="anim-scale-in w-full">
            <span className={cn("mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-full", res.isAllowed ? "bg-green-soft text-green" : "bg-red-soft text-red")}>
              {res.isAllowed ? <ShieldCheck size={32} /> : <ShieldAlert size={32} />}
            </span>
            <p className="text-[20px] font-semibold">{res.isAllowed ? "Allowed" : "Blocked"}</p>
            <p className="mt-1 text-[14px] text-ink-3">{res.decision}</p>
            <p className="mt-4 text-[13px] font-medium text-ink-3">Risk score</p>
            <p className={cn("text-[40px] font-bold leading-none tabular", num(res.riskScore) >= 50 ? "text-red" : "text-green")}>{res.riskScore ?? "—"}</p>
            {res.details?.reasons?.length > 0 && (
              <ul className="mt-4 space-y-1.5 text-left">
                {res.details.reasons.map((r: string) => (
                  <li key={r} className="rounded-xl bg-red-soft px-3 py-2 text-[13px] font-medium text-red">{r}</li>
                ))}
              </ul>
            )}
          </div>
        )}
      </Card>
    </div>
  );
}
