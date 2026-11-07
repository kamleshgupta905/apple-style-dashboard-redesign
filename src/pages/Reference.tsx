import { useMemo, useState } from "react";
import { Download } from "lucide-react";
import { api } from "../lib/api";
import { useQuery } from "../lib/useQuery";
import { UID_TAGS } from "../lib/data";
import { exportCSV } from "../lib/utils";
import { Badge, Button, Card, CopyButton, DataTable, EmptyState, ErrorState, PageHeader, SearchInput, SectionTitle, type Column } from "../components/ui";

interface Country {
  id: number;
  name: string;
  code: string;
}

export function Reference() {
  const q = useQuery(async () => (await api.get<{ data: Country[] }>("/manage/countries")).data || [], []);
  const [search, setSearch] = useState("");
  const rows = useMemo(() => {
    const t = search.toLowerCase();
    return (q.data || []).filter((c) => !t || c.name.toLowerCase().includes(t) || c.code.toLowerCase().includes(t));
  }, [q.data, search]);

  if (q.error && !q.data) return <ErrorState message={q.error} onRetry={q.reset} />;

  const cols: Column<Country>[] = [
    { key: "code", header: "Code", sortValue: (c) => c.code, render: (c) => <Badge tone="blue">{c.code}</Badge> },
    { key: "name", header: "Country", primary: true, sortValue: (c) => c.name, render: (c) => <span className="font-medium">{c.name}</span> },
    { key: "id", header: "ID", align: "right", render: (c) => <span className="text-ink-3">{c.id}</span> },
  ];

  return (
    <div>
      <PageHeader
        title="Reference data"
        subtitle="Master lists and routing conventions."
        actions={
          <Button variant="secondary" icon={<Download size={15} />} onClick={() => exportCSV("countries", ["ID", "Code", "Country"], rows.map((c) => [c.id, c.code, c.name]))}>
            Export
          </Button>
        }
      />
      <div className="grid gap-5 lg:grid-cols-3">
        <div className="space-y-5 lg:order-2">
          <Card className="anim-fade-up p-5 sm:p-6">
            <SectionTitle title="Universal Router Link" hint="Single integration link for vendor dashboard" />
            <p className="break-all rounded-2xl bg-fill p-3.5 font-mono text-[12px] leading-relaxed text-ink-2">
              https://api.vmhgroupsmr.com/#/router?vid=<b className="text-accent">VND-CODE</b>&uid=<b className="text-green">[RESPONDENT_ID]</b>
            </p>
            <p className="mt-2.5 text-[13px] text-ink-3 leading-relaxed">
              Vendors configure this <b>one time</b> in their dashboard. When you assign any survey to that vendor in SMR, the router automatically serves it to their panelists.
            </p>
          </Card>
          <Card className="anim-fade-up p-5 sm:p-6" style={{ animationDelay: "40ms" }}>
            <SectionTitle title="Direct study link anatomy" hint="Per-campaign entry link" />
            <p className="break-all rounded-2xl bg-fill p-3.5 font-mono text-[12px] leading-relaxed text-ink-2">
              https://api.vmhgroupsmr.com/vendor/auth/<b className="text-accent">VND-CODE</b>/project/<b className="text-purple">STUDY_ID</b>?uid=<b className="text-green">[RESPONDENT_ID]</b>
            </p>
            <ul className="mt-3 space-y-1.5 text-[13px] text-ink-2">
              <li><b className="text-accent">VND-CODE</b> — the vendor's unique code</li>
              <li><b className="text-purple">STUDY_ID</b> — target survey / project ID</li>
              <li><b className="text-green">[RESPONDENT_ID]</b> — replaced with the panelist's own ID</li>
            </ul>
          </Card>
          <Card className="anim-fade-up p-5 sm:p-6" style={{ animationDelay: "80ms" }}>
            <SectionTitle title="UID placeholders" hint="All recognised by the router" />
            <ul className="space-y-2">
              {UID_TAGS.map((t) => (
                <li key={t} className="flex items-center justify-between rounded-xl bg-fill px-3 py-2">
                  <code className="font-mono text-[13px]">{t}</code>
                  <CopyButton text={t} />
                </li>
              ))}
            </ul>
          </Card>
          <Card className="anim-fade-up p-5 sm:p-6" style={{ animationDelay: "140ms" }}>
            <SectionTitle title="Outcome codes" hint="S2S status mapping" />
            <ul className="space-y-2 text-[14px]">
              {[
                ["Complete", "green"],
                ["Terminate / screen-out", "red"],
                ["Over quota", "purple"],
                ["Security / quality terminate", "orange"],
              ].map(([l, t]) => (
                <li key={l} className="flex items-center justify-between">
                  <span className="text-ink-2">{l}</span>
                  <Badge tone={t as any} dot>{l.split(" ")[0]}</Badge>
                </li>
              ))}
            </ul>
          </Card>
        </div>
        <div className="lg:order-1 lg:col-span-2">
          <DataTable
            columns={cols}
            rows={rows}
            rowKey={(c) => c.id}
            loading={q.loading}
            pageSize={12}
            toolbar={<SearchInput value={search} onChange={setSearch} placeholder="Search countries" className="sm:max-w-xs" />}
            empty={<EmptyState title="No countries" />}
          />
        </div>
      </div>
    </div>
  );
}
