import { useEffect, useState } from "react";
import { AdminProvider, useAdmin } from "./AdminStore";
import { AdminShell, type RouteId } from "./layout";
import { Login } from "./pages/Login";
import { Dashboard } from "./pages/Dashboard";
import { KycQueue, Users } from "./pages/Users";
import { Deposits, Ledger, Withdrawals } from "./pages/Money";
import { Markets, Positions, Runs, Bots } from "./pages/Trading";
import { Callbacks, Gateways, Reconciliation } from "./pages/Payments";
import { Emails } from "./pages/Emails";
import { Audit, Reports, Roles, Settings, Staff, Support } from "./pages/Misc";

const VALID: RouteId[] = [
  "dashboard", "users", "kyc", "deposits", "withdrawals", "ledger",
  "positions", "runs", "bots", "markets", "gateways", "callbacks", "reconciliation",
  "support", "emails", "reports", "settings", "staff", "roles", "audit",
];

function routeFromHash(): RouteId {
  const m = window.location.hash.match(/#\/admin\/([a-z]+)/i);
  const id = m?.[1] as RouteId | undefined;
  return id && VALID.includes(id) ? id : "dashboard";
}

function Console() {
  const { session } = useAdmin();
  const [route, setRoute] = useState<RouteId>(() => routeFromHash());

  useEffect(() => {
    const onHash = () => setRoute(routeFromHash());
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  const go = (id: RouteId) => {
    setRoute(id);
    window.location.hash = `#/admin/${id}`;
  };

  if (!session) return <Login />;

  const page = (() => {
    switch (route) {
      case "dashboard": return <Dashboard onGo={go} />;
      case "users": return <Users />;
      case "kyc": return <KycQueue />;
      case "deposits": return <Deposits />;
      case "withdrawals": return <Withdrawals />;
      case "ledger": return <Ledger />;
      case "positions": return <Positions />;
      case "runs": return <Runs />;
      case "bots": return <Bots />;
      case "markets": return <Markets />;
      case "gateways": return <Gateways />;
      case "callbacks": return <Callbacks />;
      case "reconciliation": return <Reconciliation />;
      case "support": return <Support />;
      case "emails": return <Emails />;
      case "reports": return <Reports />;
      case "settings": return <Settings />;
      case "staff": return <Staff />;
      case "roles": return <Roles />;
      case "audit": return <Audit />;
      default: return <Dashboard onGo={go} />;
    }
  })();

  return (
    <AdminShell route={route} onGo={go}>
      {page}
    </AdminShell>
  );
}

export default function AdminApp() {
  return (
    <AdminProvider>
      <Console />
    </AdminProvider>
  );
}
