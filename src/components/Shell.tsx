import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  BadgeDollarSign,
  BarChart3,
  Building2,
  ChevronDown,
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
import { PERMS, usePermissions } from "../lib/permissions";

export const NAV_PERMISSION_MAP: Record<string, number> = {
  dashboard: PERMS.OVERVIEW,
  surveys: PERMS.SURVEYS,
  clients: PERMS.CLIENTS,
  vendors: PERMS.VENDORS,
  bids: PERMS.SURVEYS,
  leads: PERMS.LEADS,
  security: PERMS.SECURITY,
  payments: PERMS.PAYMENTS,
  reports: PERMS.PAYMENTS,
  users: PERMS.USERS,
  team: PERMS.TEAM,
  reference: PERMS.REFERENCE,
};

export interface NavItem {
  id: string;
  label: string;
  icon: ReactNode;
  group: string;
  hint: string;
}

const s = 18;
export const NAV: NavItem[] = [
  { id: "dashboard", label: "Dashboard", icon: <LayoutDashboard size={s} />, group: "Main", hint: "KPIs, live traffic & performance" },
  { id: "surveys", label: "Surveys", icon: <ListChecks size={s} />, group: "Main", hint: "Live inventory, allocation & links" },
  { id: "clients", label: "Clients", icon: <Building2 size={s} />, group: "Partners", hint: "Demand partners & S2S redirects" },
  { id: "vendors", label: "Vendors", icon: <Truck size={s} />, group: "Partners", hint: "Supply partners & allotments" },
  { id: "payments", label: "Vendor Payments", icon: <BadgeDollarSign size={s} />, group: "Operations", hint: "Vendor payouts & vouchers" },
  { id: "leads", label: "Traffic Leads Stream", icon: <Radio size={s} />, group: "Operations", hint: "Live respondent routing log" },
  { id: "security", label: "Security & Fraud Gate", icon: <ShieldCheck size={s} />, group: "Operations", hint: "Policies, blocks & simulator" },
  { id: "users", label: "User Management", icon: <UserCog size={s} />, group: "Management", hint: "Accounts, roles, permissions" },
  { id: "team", label: "Team Directory", icon: <Users size={s} />, group: "Management", hint: "Directory & login activity" },
  { id: "reference", label: "Reference Data", icon: <Database size={s} />, group: "Management", hint: "Countries & master data" },
  { id: "settings", label: "Settings", icon: <Settings size={s} />, group: "Management", hint: "Password & appearance" },
];

function Logo() {
  return (
    <div className="flex items-center gap-3">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-white p-1.5 shadow-sm ring-1 ring-line">
        <img src="/vmh-logo.png" alt="VMH Group" className="h-full w-full object-contain" />
      </div>
      <div className="leading-tight">
        <p className="text-[14px] font-bold tracking-tight text-ink">VMH GROUP'S</p>
        <p className="text-[9.5px] font-semibold tracking-wider text-ink-3">API TOOL</p>
      </div>
    </div>
  );
}

function NavList({ route, onNavigate }: { route: string; onNavigate: (id: string) => void }) {
  const { canModule } = usePermissions();

  const visibleNav = useMemo(() => {
    return NAV.filter((n) => {
      if (n.id === "settings") return true;
      const permId = NAV_PERMISSION_MAP[n.id];
      return permId ? canModule(permId) : true;
    });
  }, [canModule]);

  const groups = useMemo(() => {
    const m = new Map<string, NavItem[]>();
    visibleNav.forEach((n) => m.set(n.group, [...(m.get(n.group) || []), n]));
    return [...m.entries()];
  }, [visibleNav]);

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
  const { canModule } = usePermissions();
  const visibleNav = useMemo(() => {
    return NAV.filter((n) => {
      if (n.id === "settings") return true;
      if (n.id === "reports") return canModule(PERMS.OVERVIEW) || canModule(PERMS.SURVEYS) || canModule(PERMS.PAYMENTS) || canModule(PERMS.CLIENTS) || canModule(PERMS.VENDORS);
      if (n.id === "bids") return canModule(PERMS.SURVEYS) || canModule(PERMS.CLIENTS);
      const permId = NAV_PERMISSION_MAP[n.id];
      return permId ? canModule(permId) : true;
    });
  }, [canModule]);

  const [q, setQ] = useState("");
  const [cursor, setCursor] = useState(0);
  const list = visibleNav.filter((n) => (n.label + n.hint + n.group).toLowerCase().includes(q.toLowerCase()));
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
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);
  const current = NAV.find((n) => n.id === route);

  useEffect(() => {
    const closeOnOutside = (e: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setUserMenuOpen(false);
      }
    };
    if (userMenuOpen) {
      document.addEventListener("mousedown", closeOnOutside);
    }
    return () => document.removeEventListener("mousedown", closeOnOutside);
  }, [userMenuOpen]);

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

  const { canModule } = usePermissions();
  const tabs = useMemo(() => {
    const list = ["dashboard", "surveys", "leads", "payments"].filter((id) => {
      const p = NAV_PERMISSION_MAP[id];
      return p ? canModule(p) : true;
    });
    if (list.length === 0) {
      return NAV.filter((n) => {
        if (n.id === "settings") return true;
        const p = NAV_PERMISSION_MAP[n.id];
        return p ? canModule(p) : true;
      })
        .slice(0, 4)
        .map((n) => n.id);
    }
    return list;
  }, [canModule]);

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
          <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full border border-line bg-white p-1 shadow-sm">
            <img src="/vmh-logo.png" alt="VMH Group" className="h-full w-full object-contain" />
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
          {/* Sign out shortcut button in top bar header */}
          <IconButton
            label="Sign out"
            onClick={onLogout}
            className="text-ink-3 hover:text-red hover:bg-red-soft transition-colors"
          >
            <LogOut size={17} />
          </IconButton>

          {/* User profile dropdown in top bar */}
          <div ref={userMenuRef} className="relative ml-1">
            <button
              type="button"
              onClick={() => setUserMenuOpen((v) => !v)}
              className="press flex items-center gap-2 rounded-full border border-line bg-surface/80 py-1 pl-2.5 pr-1.5 shadow-sm hover:border-line-strong hover:bg-surface transition-all cursor-pointer"
              title="User profile & options"
            >
              <div className="hidden text-right leading-tight sm:block pr-1">
                <p className="text-[13px] font-semibold text-ink leading-none">{user.name}</p>
                <p className="text-[11px] font-medium text-ink-3 mt-0.5">{user.role_name || "Admin"}</p>
              </div>
              <div className="flex h-7 w-7 items-center justify-center overflow-hidden rounded-full border border-line bg-white p-0.5 shadow-sm">
                <img src="/vmh-logo.png" alt="VMH User" className="h-full w-full object-contain" />
              </div>
              <ChevronDown size={14} className={cn("text-ink-3 transition-transform duration-200", userMenuOpen && "rotate-180")} />
            </button>

            {userMenuOpen && (
              <div className="anim-fade-up absolute right-0 top-full mt-2 w-64 rounded-2xl border border-line bg-surface p-2 shadow-2xl z-50 backdrop-blur-xl">
                <div className="flex items-center gap-3 p-2.5 rounded-xl bg-fill/50">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full border border-line bg-white p-1 shadow-sm">
                    <img src="/vmh-logo.png" alt="VMH User" className="h-full w-full object-contain" />
                  </div>
                  <div className="min-w-0 flex-1 leading-tight">
                    <p className="truncate text-[13.5px] font-semibold text-ink">{user.name}</p>
                    <p className="truncate text-[11px] text-ink-3">@{user.username || "user"}</p>
                    <span className="mt-1 inline-block rounded-md bg-accent-soft px-1.5 py-0.5 text-[10px] font-semibold text-accent">
                      {user.role_name || "Admin"}
                    </span>
                  </div>
                </div>

                <div className="my-1.5 border-t border-line" />

                <button
                  type="button"
                  onClick={() => {
                    setUserMenuOpen(false);
                    window.location.hash = "/settings";
                  }}
                  className="press flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-[13px] font-medium text-ink hover:bg-fill transition-colors cursor-pointer text-left"
                >
                  <Settings size={16} className="text-ink-3" />
                  <span>Account Settings</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setUserMenuOpen(false);
                    onToggleTheme();
                  }}
                  className="press flex w-full items-center justify-between rounded-xl px-3 py-2 text-[13px] font-medium text-ink hover:bg-fill transition-colors cursor-pointer text-left"
                >
                  <span className="flex items-center gap-2.5">
                    {dark ? <Sun size={16} className="text-orange" /> : <Moon size={16} className="text-ink-3" />}
                    <span>{dark ? "Light Mode" : "Dark Mode"}</span>
                  </span>
                  <span className="text-[11px] text-ink-3 capitalize">{dark ? "Dark" : "Light"}</span>
                </button>

                <div className="my-1.5 border-t border-line" />

                <button
                  type="button"
                  onClick={() => {
                    setUserMenuOpen(false);
                    onLogout();
                  }}
                  className="press flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-[13px] font-semibold text-red hover:bg-red-soft transition-colors cursor-pointer text-left"
                >
                  <LogOut size={16} />
                  <span>Sign out</span>
                </button>
              </div>
            )}
          </div>
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
