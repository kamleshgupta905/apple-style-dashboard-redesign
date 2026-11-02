import { useCallback, useEffect, useState } from "react";
import { auth, type AuthUser } from "./lib/api";
import { FeedbackProvider } from "./components/feedback";
import { NAV, Shell } from "./components/Shell";
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

  const logout = useCallback(() => {
    auth.clear();
    setUser(null);
    window.location.hash = "/dashboard";
  }, []);

  const page = () => {
    if (!user) return null;
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
      {!user ? (
        <Login onSuccess={setUser} />
      ) : (
        <Shell route={route} user={user} dark={dark} onToggleTheme={() => setDark((d) => !d)} onLogout={logout}>
          {page()}
        </Shell>
      )}
    </FeedbackProvider>
  );
}
