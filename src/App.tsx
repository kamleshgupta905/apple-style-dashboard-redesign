import { Component, type ReactNode, useCallback, useEffect, useState } from "react";
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
import { Prescreener } from "./pages/Prescreener";
import { SurveyCallback } from "./pages/SurveyCallback";
import { VendorRouter } from "./pages/VendorRouter";
import { VendorFeed } from "./pages/VendorFeed";
import { ApiDocs } from "./pages/ApiDocs";

const THEME_KEY = "smr_theme";

const ROUTE_PERM: Record<string, number | number[]> = {
  dashboard: PERMS.OVERVIEW,
  surveys: PERMS.SURVEYS,
  clients: PERMS.CLIENTS,
  vendors: PERMS.VENDORS,
  bids: [PERMS.SURVEYS, PERMS.CLIENTS],
  leads: PERMS.LEADS,
  security: PERMS.SECURITY,
  payments: PERMS.PAYMENTS,
  reports: [PERMS.OVERVIEW, PERMS.SURVEYS, PERMS.PAYMENTS, PERMS.CLIENTS, PERMS.VENDORS],
  users: PERMS.USERS,
  team: PERMS.TEAM,
  reference: PERMS.REFERENCE,
};

function useRoute() {
  const read = () => {
    const raw = window.location.hash.replace(/^#\/?/, "");
    const h = raw.split(/[/?]/)[0];
    const PUBLIC_SURVEY_ROUTES = [
      "prescreener",
      "callback",
      "survey",
      "complete",
      "terminate",
      "overquota",
      "security",
      "router",
      "feed",
      "api-docs",
    ];
    if (PUBLIC_SURVEY_ROUTES.includes(h)) return h;
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

class PageErrorBoundary extends Component<{ children: ReactNode; route: string }, { hasError: boolean; error: Error | null }> {
  constructor(props: { children: ReactNode; route: string }) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }
  componentDidCatch(error: Error, info: any) {
    console.error("Page error caught by boundary:", error, info);
  }
  componentDidUpdate(prevProps: { route: string }) {
    if (prevProps.route !== this.props.route && this.state.hasError) {
      this.setState({ hasError: false, error: null });
    }
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-[50vh] flex-col items-center justify-center p-6 text-center">
          <div className="max-w-md rounded-3xl border border-line bg-surface p-6 shadow-sm">
            <h3 className="text-[17px] font-semibold text-ink">Something went wrong on this page</h3>
            <p className="mt-2 text-[13px] text-ink-3">
              {this.state.error?.message || "An unexpected error occurred while rendering this module."}
            </p>
            <Button
              className="mt-4"
              onClick={() => {
                this.setState({ hasError: false, error: null });
                window.location.reload();
              }}
            >
              Reload page
            </Button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function App() {
  const [user, setUser] = useState<AuthUser | null>(() => (auth.token() ? auth.user() : null));
  const route = useRoute();
  const [dark, setDark] = useTheme();

  // Public respondent flows (no login or dashboard chrome required)
  if (route === "api-docs") {
    return <ApiDocs />;
  }
  if (route === "router") {
    return <VendorRouter />;
  }
  if (route === "feed") {
    return <VendorFeed />;
  }
  if (route === "prescreener") {
    return <Prescreener />;
  }
  if (
    route === "callback" ||
    route === "survey" ||
    route === "complete" ||
    route === "terminate" ||
    route === "overquota" ||
    route === "security"
  ) {
    return <SurveyCallback />;
  }

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
    const allowed =
      !reqPerm ||
      (Array.isArray(reqPerm)
        ? reqPerm.some((p) => hasModuleAccess(user, p))
        : hasModuleAccess(user, reqPerm));
    if (!allowed) {
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
            <PageErrorBoundary route={route}>{page()}</PageErrorBoundary>
          </Shell>
        )}
      </PermissionsProvider>
    </FeedbackProvider>
  );
}
