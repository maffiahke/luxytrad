import { useState } from "react";
import { BottomNav } from "./components/BottomNav";
import { BotBanner } from "./components/BotBanner";
import { BotConfigModal } from "./components/BotConfigModal";
import { ChartCard } from "./components/ChartCard";
import { Header } from "./components/Header";
import { MarketsScreen } from "./components/MarketsScreen";
import { TradingPanel } from "./components/TradingPanel";
import { PortfolioScreen } from "./components/PortfolioScreen";
import { ProfileScreen } from "./components/ProfileScreen";
import { initialProfileState, type ProfileState } from "./components/ProfileSheets";
import { TradeHistory } from "./components/TradeHistory";
import { AuthScreen, type AuthMode } from "./components/AuthScreen";
import { MessagesScreen } from "./components/MessagesScreen";
import { ToastProvider } from "./components/Toast";
import { AppProvider } from "./state/AppStore";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { getToken } from "./api/trader";

function Shell() {
  const [tab, setTab] = useState("home");
  const [botOpen, setBotOpen] = useState(false);
  const [profile, setProfile] = useState<ProfileState>(initialProfileState);
  const patchProfile = (p: Partial<ProfileState>) => setProfile((s) => ({ ...s, ...p }));

  return (
    <div className="mx-auto flex h-dvh w-full max-w-[430px] flex-col overflow-hidden bg-[#eef1f6] shadow-xl">
      <Header />
      {tab === "home" ? (
        <main className="min-h-0 flex-1 overflow-y-auto">
          <ChartCard />
          <TradingPanel />
          <BotBanner onActivate={() => setBotOpen(true)} />
          <TradeHistory />
        </main>
      ) : (
        <main className="min-h-0 flex-1 overflow-y-auto">
          {tab === "markets" && <MarketsScreen onTrade={() => setTab("home")} />}
          {tab === "portfolio" && <PortfolioScreen />}
          {tab === "profile" && <ProfileScreen state={profile} patch={patchProfile} />}
        </main>
      )}
      <BottomNav active={tab} onChange={setTab} />
      <BotConfigModal open={botOpen} onClose={() => setBotOpen(false)} />
    </div>
  );
}

function Root() {
  const [authed, setAuthed] = useState(() => Boolean(getToken()));
  const [mode, setMode] = useState<AuthMode>("login");
  // Deep-link support: the Android "Messages" app opens /messages directly, so
  // that path renders the inbox instead of the trading shell. AppProvider stays
  // mounted either way — it publishes the Android bridge identity the
  // background alert poller needs.
  const messagesMode = window.location.pathname.startsWith("/messages");

  if (!authed) {
    return <AuthScreen mode={mode} onModeChange={setMode} onSuccess={() => setAuthed(true)} />;
  }
  return (
    <ErrorBoundary resetKey={authed}>
      <AppProvider onSignedOut={() => setAuthed(false)}>
        {messagesMode ? <MessagesScreen /> : <Shell />}
      </AppProvider>
    </ErrorBoundary>
  );
}

export default function App() {
  return (
    <ToastProvider>
      <Root />
    </ToastProvider>
  );
}
