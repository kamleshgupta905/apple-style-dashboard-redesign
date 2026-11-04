import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from "react";
import {
  AlertCircle,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Copy,
  Inbox,
  Loader2,
  Search,
  X,
} from "lucide-react";
import { cn } from "../utils/cn";

/* ───────────── Button ───────────── */
type BtnVariant = "primary" | "secondary" | "tinted" | "ghost" | "danger" | "dangerSoft";
export function Button({
  variant = "primary",
  size = "md",
  loading,
  icon,
  className,
  children,
  disabled,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: BtnVariant;
  size?: "sm" | "md" | "lg";
  loading?: boolean;
  icon?: ReactNode;
}) {
  const styles: Record<BtnVariant, string> = {
    primary: "bg-accent text-white hover:bg-accent-hover shadow-[var(--shadow-sm)]",
    secondary: "bg-surface text-ink border border-line-strong hover:bg-fill shadow-[var(--shadow-sm)]",
    tinted: "bg-accent-soft text-accent hover:bg-accent hover:text-white",
    ghost: "text-ink-2 hover:bg-fill",
    danger: "bg-red text-white hover:opacity-90",
    dangerSoft: "bg-red-soft text-red hover:bg-red hover:text-white",
  };
  const sizes = {
    sm: "h-8 px-3 text-[13px] gap-1.5 rounded-lg",
    md: "h-10 px-4 text-[14px] gap-2 rounded-xl",
    lg: "h-12 px-6 text-[15px] gap-2 rounded-2xl",
  };
  return (
    <button
      {...rest}
      disabled={disabled || loading}
      className={cn(
        "press inline-flex shrink-0 cursor-pointer items-center justify-center whitespace-nowrap font-medium disabled:cursor-not-allowed disabled:opacity-50",
        styles[variant],
        sizes[size],
        className,
      )}
    >
      {loading ? <Loader2 size={size === "sm" ? 14 : 16} className="anim-spin" /> : icon}
      {children}
    </button>
  );
}

export function IconButton({
  label,
  children,
  className,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) {
  return (
    <button
      {...rest}
      aria-label={label}
      title={label}
      className={cn(
        "press inline-flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-full text-ink-2 hover:bg-fill hover:text-ink disabled:opacity-40",
        className,
      )}
    >
      {children}
    </button>
  );
}

/* ───────────── Card & layout ───────────── */
export function Card({
  className,
  children,
  hover,
  ...rest
}: { className?: string; children: ReactNode; hover?: boolean } & React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      {...rest}
      className={cn(
        "rounded-3xl border border-line bg-surface shadow-[var(--shadow-sm)]",
        hover && "lift cursor-default",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: ReactNode }) {
  return (
    <div className="anim-fade-up mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        <h1 className="text-[28px] font-bold leading-tight tracking-tight text-ink sm:text-[34px]">{title}</h1>
        {subtitle && <p className="mt-1 text-[15px] text-ink-3">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function SectionTitle({ title, action, hint }: { title: string; hint?: string; action?: ReactNode }) {
  return (
    <div className="mb-4 flex items-center justify-between gap-3">
      <div className="min-w-0">
        <h2 className="text-[17px] font-semibold tracking-tight text-ink">{title}</h2>
        {hint && <p className="text-[13px] text-ink-3">{hint}</p>}
      </div>
      {action}
    </div>
  );
}

/* ───────────── Badge ───────────── */
export type Tone = "green" | "blue" | "orange" | "red" | "gray" | "purple";
export function Badge({ tone = "gray", children, dot }: { tone?: Tone; children: ReactNode; dot?: boolean }) {
  const t: Record<Tone, string> = {
    green: "bg-green-soft text-green",
    blue: "bg-accent-soft text-accent",
    orange: "bg-orange-soft text-orange",
    red: "bg-red-soft text-red",
    gray: "bg-fill text-ink-2",
    purple: "bg-purple-soft text-purple",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-[12px] font-semibold leading-none",
        t[tone],
      )}
    >
      {dot && <span className="h-1.5 w-1.5 rounded-full bg-current" />}
      {children}
    </span>
  );
}

export function statusTone(status: string | undefined): Tone {
  const s = (status || "").toLowerCase();
  if (["live", "active", "complete", "completed", "paid", "won", "y", "approved", "allowed", "open"].includes(s)) return "green";
  if (["pending", "inbound", "review", "draft", "hold"].includes(s)) return "orange";
  if (["pause", "paused", "inactive", "n", "closed"].includes(s)) return "gray";
  if (["terminate", "terminates", "terminated", "rejected", "lost", "blocked", "fraud", "security", "quality_terminate", "security terminate"].includes(s)) return "red";
  if (["overquota", "quotafull", "quota_full"].includes(s)) return "purple";
  return "blue";
}
export function StatusBadge({ status }: { status?: string }) {
  return (
    <Badge tone={statusTone(status)} dot>
      {status || "—"}
    </Badge>
  );
}

/* ───────────── Form controls ───────────── */
const fieldBase =
  "w-full rounded-xl border border-line-strong bg-surface px-3.5 text-[15px] text-ink placeholder:text-ink-3 outline-none transition-all duration-300 focus:border-accent focus:ring-4 focus:ring-accent-soft disabled:opacity-60";

export function Field({
  label,
  hint,
  children,
  className,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <label className={cn("block", className)}>
      <span className="mb-1.5 block text-[13px] font-medium text-ink-2">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-[12px] text-ink-3">{hint}</span>}
    </label>
  );
}

export function Input({ className, ...rest }: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...rest} className={cn(fieldBase, "h-11", className)} />;
}
export function Textarea({ className, ...rest }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...rest} className={cn(fieldBase, "min-h-[88px] py-2.5", className)} />;
}
export function Select({ className, children, ...rest }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <div className="relative">
      <select {...rest} className={cn(fieldBase, "h-11 cursor-pointer appearance-none pr-9", className)}>
        {children}
      </select>
      <ChevronDown size={16} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-ink-3" />
    </div>
  );
}

export function SearchInput({
  value,
  onChange,
  placeholder = "Search",
  className,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  className?: string;
}) {
  return (
    <div className={cn("relative", className)}>
      <Search size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-3" />
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="h-10 w-full rounded-xl border-0 bg-fill pl-10 pr-9 text-[15px] text-ink outline-none transition-all duration-300 placeholder:text-ink-3 focus:bg-surface focus:ring-4 focus:ring-accent-soft"
      />
      {value && (
        <button
          type="button"
          aria-label="Clear search"
          onClick={() => onChange("")}
          className="absolute right-2.5 top-1/2 flex h-5 w-5 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full bg-ink-3/40 text-surface"
        >
          <X size={12} />
        </button>
      )}
    </div>
  );
}

export function Toggle({
  checked,
  onChange,
  label,
  disabled,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label?: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        "relative h-[30px] w-[50px] shrink-0 cursor-pointer rounded-full transition-colors duration-300 disabled:opacity-50",
        checked ? "bg-green" : "bg-fill-2",
      )}
      style={{ transitionTimingFunction: "var(--ease)" }}
    >
      <span
        className="absolute left-[2px] top-[2px] h-[26px] w-[26px] rounded-full bg-white shadow-[0_2px_5px_rgba(0,0,0,0.25)] transition-transform duration-300"
        style={{ transform: checked ? "translateX(20px)" : "translateX(0)", transitionTimingFunction: "var(--ease)" }}
      />
    </button>
  );
}

export function Segmented<T extends string>({
  options,
  value,
  onChange,
  className,
}: {
  options: { value: T; label: string; count?: number }[];
  value: T;
  onChange: (v: T) => void;
  className?: string;
}) {
  const idx = Math.max(
    0,
    options.findIndex((o) => o.value === value),
  );
  return (
    <div className={cn("relative inline-grid max-w-full auto-cols-fr grid-flow-col overflow-x-auto rounded-xl bg-fill p-1", className)}>
      <div
        className="absolute bottom-1 top-1 rounded-[9px] bg-surface shadow-[0_1px_4px_rgba(0,0,0,0.14)] transition-all duration-400"
        style={{
          width: `calc((100% - 8px) / ${options.length})`,
          left: `calc(4px + ${idx} * (100% - 8px) / ${options.length})`,
          transitionTimingFunction: "var(--ease)",
        }}
      />
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={cn(
            "relative z-10 cursor-pointer whitespace-nowrap rounded-[9px] px-3.5 py-1.5 text-[13px] font-medium transition-colors duration-300",
            value === o.value ? "text-ink" : "text-ink-3 hover:text-ink-2",
          )}
        >
          {o.label}
          {o.count !== undefined && <span className="ml-1.5 text-ink-3">{o.count}</span>}
        </button>
      ))}
    </div>
  );
}

/* ───────────── Modal / sheet ───────────── */
export function Modal({
  open,
  onClose,
  title,
  subtitle,
  children,
  footer,
  size = "md",
  drawer,
  hideHeader,
}: {
  open: boolean;
  onClose: () => void;
  title?: string;
  subtitle?: string;
  children: ReactNode;
  footer?: ReactNode;
  size?: "sm" | "md" | "lg" | "xl";
  drawer?: boolean;
  hideHeader?: boolean;
}) {
  const [mounted, setMounted] = useState(open);
  const [closing, setClosing] = useState(false);

  useEffect(() => {
    if (open) {
      setMounted(true);
      setClosing(false);
    } else if (mounted) {
      setClosing(true);
      const t = setTimeout(() => {
        setMounted(false);
        setClosing(false);
      }, 220);
      return () => clearTimeout(t);
    }
  }, [open, mounted]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!mounted) return null;
  const widths = { sm: "sm:max-w-sm", md: "sm:max-w-lg", lg: "sm:max-w-2xl", xl: "sm:max-w-4xl" };

  return (
    <div
      className={cn(
        "fixed inset-0 z-50 flex",
        drawer ? "items-stretch justify-end" : "items-end justify-center sm:items-center sm:p-6",
      )}
    >
      <div
        onClick={onClose}
        className={cn("absolute inset-0 bg-black/40 backdrop-blur-[3px] transition-opacity duration-200", closing ? "opacity-0" : "anim-fade-in")}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={cn(
          "relative flex max-h-[92dvh] w-full flex-col bg-surface text-ink shadow-[var(--shadow-lg)] transition-all duration-200",
          drawer
            ? cn("h-full max-h-none rounded-none sm:max-w-xl sm:rounded-l-3xl", closing ? "translate-x-full" : "anim-slide-left")
            : cn(
                "rounded-t-[28px] sm:rounded-[28px]",
                widths[size],
                closing ? "translate-y-6 opacity-0" : "anim-sheet-up sm:anim-scale-in",
              ),
        )}
      >
        {!drawer && <div className="mx-auto mt-2.5 h-1 w-9 shrink-0 rounded-full bg-fill-2 sm:hidden" />}
        {!hideHeader && (
          <div className="flex items-start justify-between gap-4 px-6 pb-3 pt-5">
            <div className="min-w-0">
              <h2 className="truncate text-[20px] font-semibold tracking-tight">{title}</h2>
              {subtitle && <p className="mt-0.5 text-[13px] text-ink-3">{subtitle}</p>}
            </div>
            <IconButton label="Close" onClick={onClose} className="-mr-2 -mt-1 bg-fill">
              <X size={16} />
            </IconButton>
          </div>
        )}
        <div className={cn("min-h-0 flex-1 overflow-y-auto px-6", hideHeader ? "pt-6 pb-4" : "pb-5 pt-2")}>{children}</div>
        {footer && (
          <div className="flex items-center justify-end gap-2 border-t border-line px-6 py-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}

/* ───────────── States ───────────── */
export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("anim-pulse rounded-xl bg-fill", className)} />;
}

export function EmptyState({ title, message, action }: { title: string; message?: string; action?: ReactNode }) {
  return (
    <div className="anim-fade-up flex flex-col items-center justify-center px-6 py-14 text-center">
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-fill text-ink-3">
        <Inbox size={24} />
      </div>
      <p className="text-[16px] font-semibold text-ink">{title}</p>
      {message && <p className="mt-1 max-w-sm text-[14px] text-ink-3">{message}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <Card className="anim-fade-up flex flex-col items-center px-6 py-14 text-center">
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-red-soft text-red">
        <AlertCircle size={24} />
      </div>
      <p className="text-[16px] font-semibold">Couldn't load data</p>
      <p className="mt-1 max-w-md text-[14px] text-ink-3">{message}</p>
      {onRetry && (
        <Button className="mt-5" variant="secondary" onClick={onRetry}>
          Try again
        </Button>
      )}
    </Card>
  );
}

export function CopyButton({ text, label = "Copy", size = "sm" }: { text: string; label?: string; size?: "sm" | "md" }) {
  const [done, setDone] = useState(false);
  return (
    <Button
      variant="tinted"
      size={size}
      onClick={async (e) => {
        e.stopPropagation();
        try {
          await navigator.clipboard.writeText(text);
        } catch {
          const ta = document.createElement("textarea");
          ta.value = text;
          document.body.appendChild(ta);
          ta.select();
          document.execCommand("copy");
          ta.remove();
        }
        setDone(true);
        setTimeout(() => setDone(false), 1600);
      }}
      icon={done ? <Check size={14} /> : <Copy size={14} />}
    >
      {done ? "Copied" : label}
    </Button>
  );
}

/* ───────────── Count-up number ───────────── */
export function CountUp({
  value,
  decimals = 0,
  prefix = "",
  suffix = "",
}: {
  value: number;
  decimals?: number;
  prefix?: string;
  suffix?: string;
}) {
  const [v, setV] = useState(0);
  const from = useRef(0);
  useEffect(() => {
    const start = performance.now();
    const a = from.current;
    const dur = 1100;
    let raf = 0;
    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / dur);
      const eased = 1 - Math.pow(1 - p, 4);
      setV(a + (value - a) * eased);
      if (p < 1) raf = requestAnimationFrame(tick);
      else from.current = value;
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value]);
  return (
    <span className="tabular">
      {prefix}
      {v.toLocaleString("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}
      {suffix}
    </span>
  );
}

/* ───────────── Data table (cards on mobile) ───────────── */
export interface Column<T> {
  key: string;
  header: ReactNode;
  render?: (row: T) => ReactNode;
  sortValue?: (row: T) => string | number;
  align?: "left" | "right";
  /** Show as the card title on mobile */
  primary?: boolean;
  /** Hide in the mobile card */
  hideMobile?: boolean;
  className?: string;
}

export function DataTable<T>({
  columns,
  rows,
  rowKey,
  onRowClick,
  pageSize = 10,
  empty,
  loading,
  selectable,
  selected,
  onSelectedChange,
  toolbar,
}: {
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T) => string | number;
  onRowClick?: (row: T) => void;
  pageSize?: number;
  empty?: ReactNode;
  loading?: boolean;
  selectable?: boolean;
  selected?: Set<string | number>;
  onSelectedChange?: (s: Set<string | number>) => void;
  toolbar?: ReactNode;
}) {
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState<{ key: string; dir: 1 | -1 } | null>(null);

  const sorted = useMemo(() => {
    if (!sort) return rows;
    const col = columns.find((c) => c.key === sort.key);
    if (!col?.sortValue) return rows;
    const sv = col.sortValue;
    return [...rows].sort((a, b) => {
      const x = sv(a);
      const y = sv(b);
      return (x > y ? 1 : x < y ? -1 : 0) * sort.dir;
    });
  }, [rows, sort, columns]);

  const pages = Math.max(1, Math.ceil(sorted.length / pageSize));
  useEffect(() => {
    if (page > pages) setPage(pages);
  }, [pages, page]);
  useEffect(() => setPage(1), [rows.length]);

  const slice = sorted.slice((page - 1) * pageSize, page * pageSize);
  const primary = columns.find((c) => c.primary) || columns[0];
  const allOnPage = slice.length > 0 && slice.every((r) => selected?.has(rowKey(r)));

  const toggleRow = (k: string | number) => {
    const n = new Set(selected);
    n.has(k) ? n.delete(k) : n.add(k);
    onSelectedChange?.(n);
  };
  const toggleAll = () => {
    const n = new Set(selected);
    slice.forEach((r) => (allOnPage ? n.delete(rowKey(r)) : n.add(rowKey(r))));
    onSelectedChange?.(n);
  };

  const Box = ({ on, onClick }: { on: boolean; onClick: () => void }) => (
    <button
      type="button"
      role="checkbox"
      aria-checked={on}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className={cn(
        "flex h-5 w-5 cursor-pointer items-center justify-center rounded-md border transition-all duration-200",
        on ? "border-accent bg-accent text-white" : "border-line-strong bg-surface",
      )}
    >
      {on && <Check_ />}
    </button>
  );

  return (
    <Card className="overflow-hidden">
      {toolbar && <div className="border-b border-line px-4 py-3 sm:px-5">{toolbar}</div>}

      {/* Desktop table */}
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full border-collapse text-left">
          <thead>
            <tr className="border-b border-line">
              {selectable && (
                <th className="w-12 py-3 pl-5">
                  <Box on={allOnPage} onClick={toggleAll} />
                </th>
              )}
              {columns.map((c) => (
                <th
                  key={c.key}
                  className={cn(
                    "whitespace-nowrap px-4 py-3 text-[12px] font-semibold uppercase tracking-wide text-ink-3 first:pl-5 last:pr-5",
                    c.align === "right" && "text-right",
                  )}
                >
                  {c.sortValue ? (
                    <button
                      type="button"
                      onClick={() => setSort((s) => (s?.key === c.key ? (s.dir === 1 ? { key: c.key, dir: -1 } : null) : { key: c.key, dir: 1 }))}
                      className="inline-flex cursor-pointer items-center gap-1 uppercase tracking-wide hover:text-ink"
                    >
                      {c.header}
                      {sort?.key === c.key &&
                        (sort.dir === 1 ? <ChevronUp size={13} /> : <ChevronDown size={13} />)}
                    </button>
                  ) : (
                    c.header
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading
              ? Array.from({ length: 6 }).map((_, i) => (
                  <tr key={i} className="border-b border-line last:border-0">
                    {Array.from({ length: columns.length + (selectable ? 1 : 0) }).map((_, j) => (
                      <td key={j} className="px-4 py-4 first:pl-5">
                        <Skeleton className="h-4 w-full max-w-[140px]" />
                      </td>
                    ))}
                  </tr>
                ))
              : slice.map((row, i) => {
                  const k = rowKey(row);
                  return (
                    <tr
                      key={k}
                      onClick={onRowClick ? () => onRowClick(row) : undefined}
                      style={{ animationDelay: `${Math.min(i, 12) * 28}ms` }}
                      className={cn(
                        "anim-fade-up border-b border-line transition-colors duration-200 last:border-0",
                        onRowClick && "cursor-pointer",
                        selected?.has(k) ? "bg-accent-soft" : "hover:bg-fill/60",
                      )}
                    >
                      {selectable && (
                        <td className="w-12 py-3 pl-5">
                          <Box on={!!selected?.has(k)} onClick={() => toggleRow(k)} />
                        </td>
                      )}
                      {columns.map((c) => (
                        <td
                          key={c.key}
                          className={cn(
                            "px-4 py-3.5 text-[14px] text-ink first:pl-5 last:pr-5",
                            c.align === "right" && "text-right tabular",
                            c.className,
                          )}
                        >
                          {c.render ? c.render(row) : ((row as any)[c.key] ?? "—")}
                        </td>
                      ))}
                    </tr>
                  );
                })}
          </tbody>
        </table>
      </div>

      {/* Mobile cards */}
      <div className="divide-y divide-line md:hidden">
        {loading
          ? Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="space-y-2 p-4">
                <Skeleton className="h-4 w-2/3" />
                <Skeleton className="h-3 w-1/2" />
              </div>
            ))
          : slice.map((row, i) => {
              const k = rowKey(row);
              return (
                <div
                  key={k}
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                  style={{ animationDelay: `${Math.min(i, 8) * 35}ms` }}
                  className={cn(
                    "anim-fade-up p-4 transition-colors",
                    onRowClick && "cursor-pointer active:bg-fill",
                    selected?.has(k) && "bg-accent-soft",
                  )}
                >
                  <div className="mb-2.5 flex items-start gap-3">
                    {selectable && (
                      <div className="pt-0.5">
                        <Box on={!!selected?.has(k)} onClick={() => toggleRow(k)} />
                      </div>
                    )}
                    <div className="min-w-0 flex-1 text-[15px] font-semibold text-ink">
                      {primary.render ? primary.render(row) : String((row as any)[primary.key] ?? "—")}
                    </div>
                  </div>
                  <dl className="grid grid-cols-2 gap-x-4 gap-y-2.5">
                    {columns
                      .filter((c) => c !== primary && !c.hideMobile)
                      .map((c) => (
                        <div key={c.key} className="min-w-0">
                          <dt className="text-[11px] font-semibold uppercase tracking-wide text-ink-3">{c.header}</dt>
                          <dd className="mt-0.5 break-words text-[14px] text-ink">
                            {c.render ? c.render(row) : ((row as any)[c.key] ?? "—")}
                          </dd>
                        </div>
                      ))}
                  </dl>
                </div>
              );
            })}
      </div>

      {!loading && rows.length === 0 && (empty ?? <EmptyState title="Nothing here yet" />)}

      {rows.length > pageSize && (
        <div className="flex items-center justify-between gap-3 border-t border-line px-4 py-3 sm:px-5">
          <p className="text-[13px] text-ink-3 tabular">
            {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, rows.length)} of {rows.length.toLocaleString()}
          </p>
          <div className="flex items-center gap-1">
            <IconButton label="Previous page" disabled={page === 1} onClick={() => setPage((p) => p - 1)}>
              <ChevronLeft size={18} />
            </IconButton>
            <span className="min-w-[64px] text-center text-[13px] font-medium text-ink-2 tabular">
              {page} / {pages}
            </span>
            <IconButton label="Next page" disabled={page === pages} onClick={() => setPage((p) => p + 1)}>
              <ChevronRight size={18} />
            </IconButton>
          </div>
        </div>
      )}
    </Card>
  );
}

function Check_() {
  return <Check size={13} strokeWidth={3} />;
}
