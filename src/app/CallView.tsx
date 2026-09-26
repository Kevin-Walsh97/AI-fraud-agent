import { useMemo, useState } from "react";
import { analyze, type CallInput, type RiskAssessment } from "../engine";
import { SAMPLE_CALLS } from "../data/samples";
import { contextFrom, useStore } from "./store";
import { actionLabels, Button, Card, ChannelOff, Field, formatTime, inputClass, levelStyles, ScoreBadge } from "./ui";

export default function CallView() {
  const settings = useStore((s) => s.settings);
  const alerts = useStore((s) => s.alerts);
  const updateSettings = useStore((s) => s.updateSettings);
  const [ringing, setRinging] = useState<{ call: CallInput; a: RiskAssessment } | null>(null);

  const ctx = useMemo(() => contextFrom(settings), [settings]);

  if (!settings.channels.call)
    return <ChannelOff name="Call" onEnable={() => updateSettings({ channels: { ...settings.channels, call: true } })} />;

  const log = alerts.filter((r) => r.channel === "call");

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_22rem]">
      <div className="space-y-4">
        <Card>
          <div className="mb-1 text-sm font-semibold">Simulate an incoming call</div>
          <p className="mb-3 text-xs text-slate-500">
            Pre-call screening uses only caller ID, carrier attestation and number reputation. Call audio is never recorded or transcribed.
          </p>
          <div className="grid gap-2 sm:grid-cols-2">
            {SAMPLE_CALLS.map((c) => {
              const a = analyze(c, ctx);
              return (
                <button
                  key={c.id}
                  onClick={() => setRinging({ call: { ...c, id: `${c.id}-${Date.now()}` }, a })}
                  className="flex items-center gap-3 rounded-xl p-3 text-left ring-1 ring-slate-200 hover:bg-slate-50"
                >
                  <ScoreBadge score={a.score} level={a.level} size="sm" />
                  <span className="min-w-0">
                    <span className="block truncate font-medium">{c.callerName ?? "Unknown caller"}</span>
                    <span className="block text-xs text-slate-500">
                      {c.from} · {new Date(c.receivedAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        </Card>
        <CallComposer onRing={(call) => setRinging({ call, a: analyze(call, ctx) })} />
        <Card>
          <div className="mb-2 text-sm font-semibold">Flagged calls</div>
          {log.length === 0 ? (
            <p className="text-sm text-slate-500">No flagged calls yet.</p>
          ) : (
            <ul className="divide-y divide-slate-100 text-sm">
              {log.map((r) => (
                <li key={r.id} className="flex items-center gap-3 py-2">
                  <ScoreBadge score={r.score} level={r.level} size="sm" />
                  <span className="flex-1 truncate">{r.label.replace("Call — ", "")} · {r.sender}</span>
                  <span className="text-xs text-slate-500">{r.action ? actionLabels[r.action] : formatTime(r.flaggedAt)}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <div className="lg:sticky lg:top-4 lg:self-start">
        {ringing ? <CallScreen {...ringing} onEnd={() => setRinging(null)} /> : <IdlePhone />}
      </div>
    </div>
  );
}

function IdlePhone() {
  return (
    <div className="mx-auto flex h-[37rem] w-full max-w-[22rem] items-center justify-center rounded-[2.5rem] bg-slate-900 p-6 text-center text-sm text-slate-400 ring-8 ring-slate-800">
      Pick a sample call to see the pre-call warning screen.
    </div>
  );
}

function CallScreen({ call, a, onEnd }: { call: CallInput; a: RiskAssessment; onEnd: () => void }) {
  const recordAlert = useStore((s) => s.recordAlert);
  const setAction = useStore((s) => s.setAction);
  const flags = a.signals.filter((s) => s.points > 0);
  const st = levelStyles[a.level];

  const act = (action: "answered" | "declined" | "blocked") => {
    recordAlert(call, a);
    if (a.shouldAlert) void setAction(call.id, action);
    onEnd();
  };

  return (
    <div className="mx-auto flex h-[37rem] w-full max-w-[22rem] flex-col rounded-[2.5rem] bg-gradient-to-b from-slate-800 to-slate-950 p-5 text-white ring-8 ring-slate-800">
      <div className="mt-4 text-center">
        <div className="text-xs uppercase tracking-widest text-slate-400">Incoming call</div>
        <div className="mt-2 text-2xl font-semibold">{call.callerName ?? "Unknown"}</div>
        <div className="text-sm text-slate-300">{call.from}</div>
      </div>

      <div className="mt-5 flex-1 overflow-y-auto">
        {a.shouldAlert ? (
          <div className={`rounded-2xl border p-3 text-slate-900 ${st.panel}`} role="alert">
            <div className="flex items-center gap-3">
              <ScoreBadge score={a.score} level={a.level} />
              <div>
                <div className={`font-semibold ${st.text}`}>{a.headline}</div>
                <div className="text-xs text-slate-600">Risk {a.score}/100</div>
              </div>
            </div>
            <ul className="mt-2 list-disc space-y-0.5 pl-5 text-sm">
              {flags.map((f) => (
                <li key={f.id}>{f.reason}</li>
              ))}
            </ul>
            <p className="mt-2 text-xs text-slate-700">{a.recommendedAction}</p>
          </div>
        ) : (
          <div className="rounded-2xl bg-white/10 p-3 text-center text-sm text-emerald-300">
            ✓ {a.signals.find((s) => s.id === "trusted")?.reason ?? "No red flags detected"}
          </div>
        )}
      </div>

      <div className="mt-4 grid grid-cols-3 gap-3 text-center text-xs">
        <button onClick={() => act("declined")} className="flex flex-col items-center gap-1">
          <span className="flex h-14 w-14 items-center justify-center rounded-full bg-red-600 text-xl">✕</span>Decline
        </button>
        <button onClick={() => act("blocked")} className="flex flex-col items-center gap-1">
          <span className="flex h-14 w-14 items-center justify-center rounded-full bg-slate-600 text-xl">⦸</span>Block
        </button>
        <button onClick={() => act("answered")} className="flex flex-col items-center gap-1">
          <span className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-600 text-xl">✆</span>Answer
        </button>
      </div>
    </div>
  );
}

function CallComposer({ onRing }: { onRing: (c: CallInput) => void }) {
  const [from, setFrom] = useState("+1 (876) 555-0190");
  const [callerName, setCallerName] = useState("");
  const [lineType, setLineType] = useState<CallInput["lineType"]>("unknown");
  const [attestation, setAttestation] = useState<CallInput["attestation"]>("C");
  return (
    <Card>
      <div className="mb-3 text-sm font-semibold">Custom caller</div>
      <form
        className="grid gap-3 sm:grid-cols-2"
        onSubmit={(e) => {
          e.preventDefault();
          onRing({ channel: "call", id: `call-custom-${Date.now()}`, from, callerName: callerName || undefined, lineType, attestation, receivedAt: new Date().toISOString() });
        }}
      >
        <Field label="Number">
          <input className={inputClass} value={from} onChange={(e) => setFrom(e.target.value)} />
        </Field>
        <Field label="Caller ID name">
          <input className={inputClass} value={callerName} placeholder="optional" onChange={(e) => setCallerName(e.target.value)} />
        </Field>
        <Field label="Line type (carrier lookup)">
          <select className={inputClass} value={lineType} onChange={(e) => setLineType(e.target.value as CallInput["lineType"])}>
            {["unknown", "mobile", "landline", "voip"].map((o) => (
              <option key={o}>{o}</option>
            ))}
          </select>
        </Field>
        <Field label="STIR/SHAKEN attestation">
          <select className={inputClass} value={attestation} onChange={(e) => setAttestation(e.target.value as CallInput["attestation"])}>
            {["A", "B", "C", "none"].map((o) => (
              <option key={o}>{o}</option>
            ))}
          </select>
        </Field>
        <div className="sm:col-span-2">
          <Button tone="primary" type="submit">
            Ring
          </Button>
        </div>
      </form>
    </Card>
  );
}
