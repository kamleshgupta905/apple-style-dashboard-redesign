import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  BadgeDollarSign,
  BarChart3,
  Building2,
  Command,
  Database,
  FileBarChart2,
  Gavel,
  LayoutDashboard,
  ListChecks,
  LogOut,
  Menu,
  Moon,
  Radio,
  Search,
  Settings,
  ShieldCheck,
  Sun,
  UserCog,
  Users,
  Truck,
  X,
} from "lucide-react";
import { cn } from "../utils/cn";
import { initials } from "../lib/utils";
import type { AuthUser } from "../lib/api";
import { IconButton, Modal } from "./ui";

export interface NavItem {
  id: string;
  label: string;
  icon: ReactNode;
  group: string;
  hint: string;
}

const s = 18;
export const NAV: NavItem[] = [
  { id: "dashboard", label: "Dashboard", icon: <LayoutDashboard size={s} />, group: "Overview", hint: "KPIs, live traffic & performance" },
  { id: "surveys", label: "Surveys", icon: <ListChecks size={s} />, group: "Marketplace", hint: "Live inventory, allocation & links" },
  { id: "clients", label: "Clients", icon: <Building2 size={s} />, group: "Marketplace", hint: "Demand partners & S2S redirects" },
  { id: "vendors", label: "Vendors", icon: <Truck size={s} />, group: "Marketplace", hint: "Supply partners & allotments" },
  { id: "bids", label: "Bids", icon: <Gavel size={s} />, group: "Marketplace", hint: "Pipeline of proposals" },
  { id: "leads", label: "Traffic Stream", icon: <Radio size={s} />, group: "Traffic", hint: "Live respondent routing log" },
  { id: "security", label: "Security & Fraud", icon: <ShieldCheck size={s} />, group: "Traffic", hint: "Policies, blocks & simulator" },
  { id: "payments", label: "Payments", icon: <BadgeDollarSign size={s} />, group: "Finance", hint: "Vendor payouts & vouchers" },
  { id: "reports", label: "Reports", icon: <FileBarChart2 size={s} />, group: "Finance", hint: "Clients, vendors & projects" },
  { id: "users", label: "Users & Access", icon: <UserCog size={s} />, group: "Admin", hint: "Accounts, roles, permissions" },
  { id: "team", label: "Team", icon: <Users size={s} />, group: "Admin", hint: "Directory & login activity" },
  { id: "reference", label: "Reference Data", icon: <Database size={s} />, group: "Admin", hint: "Countries & master data" },
  { id: "settings", label: "Settings", icon: <Settings size={s} />, group: "Admin", hint: "Password & appearance" },
];

function Logo() {
  return (
    <div className="flex items-center gap-3">
      <div className="flex h-9 w-9 items-center justify-center rounded-[11px] bg-ink text-bg">
        <BarChart3 size={18} strokeWidth={2.4} />
      </div>
      <div className="leading-tight">
        <p className="text-[15px] font-semibold tracking-tight text-ink">VMH SMR</p>
        <p className="text-[11px] font-medium text-ink-3">Traffic Console</p>
      </div>
    </div>
  );
}

function NavList({ route, onNavigate }: { route: string; onNavigate: (id: string) => void }) {
  const groups = useMemo(() => {
    const m = new Map<string, NavItem[]>();
    NAV.forEach((n) => m.set(n.group, [...(m.get(n.group) || []), n]));
    return [...m.entries()];
  }, []);
  return (
    <nav className="space-y-5">
      {groups.map(([g, items]) => (
        <div key={g}>
          <p className="mb-1.5 px-3 text-[11px] font-semibold uppercase tracking-wider text-ink-3">{g}</p>
          <ul className="space-y-0.5">
            {items.map((n) => {
              const active = route === n.id;
              return (
                <li key={n.id}>
                  <a
                    href={`#/${n.id}`}
                    onClick={() => onNavigate(n.id)}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "press flex items-center gap-3 rounded-xl px-3 py-2 text-[14px] font-medium",
                      active ? "bg-accent text-white shadow-[var(--shadow-sm)]" : "text-ink-2 hover:bg-fill",
                    )}
                  >
                    {n.icon}
                    {n.label}
                  </a>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}

function CommandPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [q, setQ] = useState("");
  const [cursor, setCursor] = useState(0);
  const list = NAV.filter((n) => (n.label + n.hint + n.group).toLowerCase().includes(q.toLowerCase()));
  useEffect(() => {
    if (open) {
      setQ("");
      setCursor(0);
    }
  }, [open]);
  const go = (id: string) => {
    window.location.hash = `/${id}`;
    onClose();
  };
  return (
    <Modal open={open} onClose={onClose} hideHeader size="md">
      <div className="-mx-1">
        <div className="mb-3 flex items-center gap-3 rounded-xl bg-fill px-3.5">
          <Search size={18} className="text-ink-3" />
          <input
            autoFocus
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setCursor(0);
            }}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") {
                e.preventDefault();
                setCursor((c) => Math.min(list.length - 1, c + 1));
              } else if (e.key === "ArrowUp") {
                e.preventDefault();
                setCursor((c) => Math.max(0, c - 1));
              } else if (e.key === "Enter" && list[cursor]) go(list[cursor].id);
            }}
            placeholder="Jump to…"
            className="h-12 w-full bg-transparent text-[16px] text-ink outline-none placeholder:text-ink-3"
          />
        </div>
        <ul className="max-h-[50dvh] space-y-0.5 overflow-y-auto">
          {list.map((n, i) => (
            <li key={n.id}>
              <button
                onClick={() => go(n.id)}
                onMouseEnter={() => setCursor(i)}
                className={cn(
                  "flex w-full cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors",
                  i === cursor ? "bg-accent text-white" : "text-ink",
                )}
              >
                <span className={i === cursor ? "text-white" : "text-ink-3"}>{n.icon}</span>
                <span className="min-w-0">
                  <span className="block text-[14px] font-medium">{n.label}</span>
                  <span className={cn("block truncate text-[12px]", i === cursor ? "text-white/75" : "text-ink-3")}>{n.hint}</span>
                </span>
              </button>
            </li>
          ))}
          {list.length === 0 && <li className="px-3 py-8 text-center text-[14px] text-ink-3">No matching pages</li>}
        </ul>
      </div>
    </Modal>
  );
}

export function Shell({
  route,
  user,
  dark,
  onToggleTheme,
  onLogout,
  children,
}: {
  route: string;
  user: AuthUser;
  dark: boolean;
  onToggleTheme: () => void;
  onLogout: () => void;
  children: ReactNode;
}) {
  const [drawer, setDrawer] = useState(false);
  const [palette, setPalette] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const current = NAV.find((n) => n.id === route);

  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPalette((p) => !p);
      }
    };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, []);

  useEffect(() => {
    const on = () => setScrolled(window.scrollY > 6);
    window.addEventListener("scroll", on, { passive: true });
    return () => window.removeEventListener("scroll", on);
  }, []);

  useEffect(() => {
    setDrawer(false);
    window.scrollTo({ top: 0 });
  }, [route]);

  const tabs = ["dashboard", "surveys", "leads", "payments"];

  return (
    <div className="min-h-dvh">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-[264px] flex-col border-r border-line bg-surface-2/80 px-3 pb-4 pt-5 lg:flex">
        <div className="px-3 pb-5">
          <Logo />
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto pr-1">
          <NavList route={route} onNavigate={() => {}} />
        </div>
        <div className="mt-3 flex items-center gap-3 rounded-2xl bg-fill p-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-accent text-[13px] font-semibold text-white">
            {initials(user.name)}
          </div>
          <div className="min-w-0 flex-1 leading-tight">
            <p className="truncate text-[13px] font-semibold text-ink">{user.name}</p>
            <p className="truncate text-[11px] text-ink-3">{user.role_name || "Admin"}</p>
          </div>
          <IconButton label="Sign out" onClick={onLogout}>
            <LogOut size={16} />
          </IconButton>
        </div>
      </aside>

      {/* Top bar */}
      <header
        className={cn(
          "glass sticky top-0 z-20 flex h-14 items-center gap-2 border-b px-3 transition-colors duration-300 sm:px-6 lg:ml-[264px]",
          scrolled ? "border-line" : "border-transparent",
        )}
      >
        <IconButton label="Open menu" onClick={() => setDrawer(true)} className="lg:hidden">
          <Menu size={20} />
        </IconButton>
        <div className="lg:hidden">
          <p className="text-[15px] font-semibold">{current?.label}</p>
        </div>
        <button
          onClick={() => setPalette(true)}
          className="press ml-0 hidden h-9 w-full max-w-sm cursor-pointer items-center gap-2 rounded-xl bg-fill px-3 text-[14px] text-ink-3 hover:bg-fill-2 lg:flex"
        >
          <Search size={15} />
          <span className="flex-1 text-left">Search pages…</span>
          <kbd className="flex items-center gap-0.5 rounded-md bg-surface px-1.5 py-0.5 text-[11px] font-medium text-ink-3">
            <Command size={10} />K
          </kbd>
        </button>
        <div className="ml-auto flex items-center gap-1">
          <span className="mr-2 hidden items-center gap-2 rounded-full bg-green-soft px-3 py-1.5 text-[12px] font-semibold text-green sm:flex">
            <span className="relative flex h-2 w-2">
              <span className="anim-ping absolute inline-flex h-full w-full rounded-full bg-green" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-green" />
            </span>
            Gateway online
          </span>
          <IconButton label="Search" onClick={() => setPalette(true)} className="lg:hidden">
            <Search size={19} />
          </IconButton>
          <IconButton label={dark ? "Switch to light mode" : "Switch to dark mode"} onClick={onToggleTheme}>
            {dark ? <Sun size={18} /> : <Moon size={18} />}
          </IconButton>
        </div>
      </header>

      {/* Content */}
      <main className="px-4 pb-28 pt-6 sm:px-6 lg:ml-[264px] lg:pb-12 lg:pt-8">
        <div key={route} className="mx-auto max-w-[1280px]">
          {children}
        </div>
      </main>

      {/* Mobile bottom tab bar */}
      <nav className="glass fixed inset-x-0 bottom-0 z-30 flex border-t border-line pb-[env(safe-area-inset-bottom)] lg:hidden">
        {tabs.map((id) => {
          const n = NAV.find((x) => x.id === id)!;
          const active = route === id;
          return (
            <a
              key={id}
              href={`#/${id}`}
              className={cn(
                "press flex flex-1 flex-col items-center gap-0.5 py-2 text-[10.5px] font-medium",
                active ? "text-accent" : "text-ink-3",
              )}
            >
              <span className={cn("transition-transform duration-300", active && "-translate-y-0.5 scale-110")}>{n.icon}</span>
              {n.label.split(" ")[0]}
            </a>
          );
        })}
        <button
          onClick={() => setDrawer(true)}
          className="press flex flex-1 cursor-pointer flex-col items-center gap-0.5 py-2 text-[10.5px] font-medium text-ink-3"
        >
          <Menu size={s} />
          More
        </button>
      </nav>

      {/* Mobile drawer */}
      {drawer && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="anim-fade-in absolute inset-0 bg-black/40 backdrop-blur-[3px]" onClick={() => setDrawer(false)} />
          <div className="anim-slide-right absolute inset-y-0 left-0 flex w-[84%] max-w-[320px] flex-col bg-surface px-3 pb-4 pt-5 shadow-[var(--shadow-lg)]">
            <div className="flex items-center justify-between px-3 pb-5">
              <Logo />
              <IconButton label="Close menu" onClick={() => setDrawer(false)} className="bg-fill">
                <X size={16} />
              </IconButton>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto">
              <NavList route={route} onNavigate={() => setDrawer(false)} />
            </div>
            <div className="mt-3 flex items-center gap-3 rounded-2xl bg-fill p-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-accent text-[13px] font-semibold text-white">
                {initials(user.name)}
              </div>
              <div className="min-w-0 flex-1 leading-tight">
                <p className="truncate text-[13px] font-semibold">{user.name}</p>
                <p className="truncate text-[11px] text-ink-3">{user.role_name || "Admin"}</p>
              </div>
              <IconButton label="Sign out" onClick={onLogout}>
                <LogOut size={16} />
              </IconButton>
            </div>
          </div>
        </div>
      )}

      <CommandPalette open={palette} onClose={() => setPalette(false)} />
    </div>
  );
}
