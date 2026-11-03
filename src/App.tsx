import { useCallback, useEffect, useState } from "react";
import { Lock } from "lucide-react";
import { auth, refreshCurrentUser, type AuthUser } from "./lib/api";
import { FeedbackProvider } from "./components/feedback";
import { NAV, Shell } from "./components/Shell";
import { Button } from "./components/ui";
import { PERMS, PermissionsProvider, hasModuleAccess } from "./lib/permissions";
import { Login } from "./pages/Login";
import { Dashboard } from "./pages/Dashboard";
import { Surveys } from "./pages/Surveys";
import { Clients } from "./pages/Clients";
import { Vendors } from "./pages/Vendors";
import { Bids } from "./pages/Bids";
import { Leads } from "./pages/Leads";
import { Security } from "./pages/Security";
import { Payments } from "./pages/Payments";
import { Reports } from "./pages/Reports";
import { Users } from "./pages/Users";
import { Team } from "./pages/Team";
import { Reference } from "./pages/Reference";
import { Settings } from "./pages/Settings";

const THEME_KEY = "smr_theme";

const ROUTE_PERM: Record<string, number> = {
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

function useRoute() {
  const read = () => {
    const h = window.location.hash.replace(/^#\/?/, "").split(/[/?]/)[0];
    return NAV.some((n) => n.id === h) ? h : "dashboard";
  };
  const [route, setRoute] = useState(read);
  useEffect(() => {
    const on = () => setRoute(read());
    window.addEventListener("hashchange", on);
    return () => window.removeEventListener("hashchange", on);
  }, []);
  return route;
}

function useTheme() {
  const [dark, setDark] = useState(() => {
    const saved = localStorage.getItem(THEME_KEY);
    return saved ? saved === "dark" : window.matchMedia?.("(prefers-color-scheme: dark)").matches;
  });
  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
    localStorage.setItem(THEME_KEY, dark ? "dark" : "light");
    document.querySelector('meta[name="theme-color"]')?.setAttribute("content", dark ? "#000000" : "#f5f5f7");
  }, [dark]);
  return [dark, setDark] as const;
}

export default function App() {
  const [user, setUser] = useState<AuthUser | null>(() => (auth.token() ? auth.user() : null));
  const route = useRoute();
  const [dark, setDark] = useTheme();

  // Refresh latest permissions from MySQL / server on mount
  useEffect(() => {
    if (user) {
      refreshCurrentUser().then((fresh) => {
        if (fresh) setUser(fresh);
      });
    }
  }, []);

  const logout = useCallback(() => {
    auth.clear();
    setUser(null);
    window.location.hash = "/dashboard";
  }, []);

  const page = () => {
    if (!user) return null;

    // Check module permission for the route
    const reqPerm = ROUTE_PERM[route];
    if (reqPerm && !hasModuleAccess(user, reqPerm)) {
      return (
        <div className="flex min-h-[55vh] flex-col items-center justify-center text-center px-4">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-orange-soft text-orange">
            <Lock size={24} />
          </div>
          <h2 className="text-[20px] font-bold text-ink">Access Restricted</h2>
          <p className="mt-1 max-w-md text-[14px] text-ink-3">
            You do not have permission to view the <span className="font-semibold text-ink">{route}</span> module.
            Please contact your administrator if you need access.
          </p>
          <Button className="mt-5" onClick={() => (window.location.hash = "/dashboard")}>
            Back to dashboard
          </Button>
        </div>
      );
    }

    switch (route) {
      case "surveys":
        return <Surveys />;
      case "clients":
        return <Clients />;
      case "vendors":
        return <Vendors />;
      case "bids":
        return <Bids />;
      case "leads":
        return <Leads />;
      case "security":
        return <Security />;
      case "payments":
        return <Payments />;
      case "reports":
        return <Reports />;
      case "users":
        return <Users />;
      case "team":
        return <Team />;
      case "reference":
        return <Reference />;
      case "settings":
        return <Settings user={user} dark={dark} onSetDark={setDark} onLogout={logout} />;
      default:
        return <Dashboard userName={user.name} />;
    }
  };

  return (
    <FeedbackProvider>
      <PermissionsProvider user={user}>
        {!user ? (
          <Login onSuccess={setUser} />
        ) : (
          <Shell route={route} user={user} dark={dark} onToggleTheme={() => setDark((d) => !d)} onLogout={logout}>
            {page()}
          </Shell>
        )}
      </PermissionsProvider>
    </FeedbackProvider>
  );
}
