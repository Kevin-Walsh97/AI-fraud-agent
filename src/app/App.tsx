import { useEffect, useState } from "react";
import CallView from "./CallView";
import EmailView from "./EmailView";
import History from "./History";
import Insights from "./Insights";
import Onboarding from "./Onboarding";
import Settings from "./Settings";
import SmsView from "./SmsView";
import { useStore } from "./store";
import { levelStyles, ShieldIcon } from "./ui";

const TABS = [
  { id: "sms", label: "Messages", el: <SmsView /> },
  { id: "email", label: "Mail", el: <EmailView /> },
  { id: "call", label: "Calls", el: <CallView /> },
  { id: "history", label: "History", el: <History /> },
  { id: "insights", label: "Insights", el: <Insights /> },
  { id: "settings", label: "Settings", el: <Settings /> },
] as const;

type TabId = (typeof TABS)[number]["id"];

export default function App() {
  const [hydrated, setHydrated] = useState(useStore.persist.hasHydrated());
  const onboarded = useStore((s) => s.settings.onboarded);
  const alerts = useStore((s) => s.alerts);
  const sensitivity = useStore((s) => s.settings.sensitivity);
  const [tab, setTab] = useState<TabId>("sms");

  useEffect(() => useStore.persist.onFinishHydration(() => setHydrated(true)), []);

  if (!hydrated) return null;
  if (!onboarded) return <Onboarding />;

  const unreviewed = alerts.filter((a) => !a.action).length;

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-10 border-b border-slate-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3">
          <ShieldIcon className="h-7 w-7 text-slate-900" />
          <div className="min-w-0">
            <div className="font-semibold leading-tight">ScamShield</div>
            <div className="text-xs text-slate-500">
              Protection on · <span className="capitalize">{sensitivity}</span> · on-device
            </div>
          </div>
        </div>
        <nav className="mx-auto flex max-w-6xl gap-1 overflow-x-auto px-4">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`relative whitespace-nowrap border-b-2 px-3 py-2 text-sm font-medium ${tab === t.id ? "border-slate-900 text-slate-900" : "border-transparent text-slate-500 hover:text-slate-800"}`}
            >
              {t.label}
              {t.id === "history" && unreviewed > 0 && (
                <span className="ml-1.5 rounded-full bg-red-600 px-1.5 py-0.5 text-[10px] font-semibold text-white">{unreviewed}</span>
              )}
            </button>
          ))}
        </nav>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-5">{TABS.find((t) => t.id === tab)!.el}</main>
      <Toasts />
    </div>
  );
}

function Toasts() {
  const toasts = useStore((s) => s.toasts);
  const dismiss = useStore((s) => s.dismissToast);
  return (
    <div className="pointer-events-none fixed inset-x-0 top-3 z-50 flex flex-col items-center gap-2 px-4">
      {toasts.map((t) => (
        <button
          key={t.id}
          onClick={() => dismiss(t.id)}
          className={`pointer-events-auto w-full max-w-sm rounded-xl border p-3 text-left shadow-lg ${levelStyles[t.level].panel}`}
        >
          <div className={`text-sm font-semibold ${levelStyles[t.level].text}`}>{t.title}</div>
          <div className="truncate text-xs text-slate-600">{t.body}</div>
        </button>
      ))}
    </div>
  );
}
