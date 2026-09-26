import { useMemo, useState } from "react";
import type { SmsInput } from "../engine";
import { SAMPLE_SMS } from "../data/samples";
import { useStore } from "./store";
import { useScrollTo } from "./useScrollTo";
import { useAssessments } from "./useAssessments";
import { actionLabels, Button, Card, ChannelOff, Field, formatTime, inputClass, RiskAlert, RiskDot } from "./ui";

export default function SmsView() {
  const custom = useStore((s) => s.customMessages);
  const settings = useStore((s) => s.settings);
  const alerts = useStore((s) => s.alerts);
  const setAction = useStore((s) => s.setAction);
  const updateSettings = useStore((s) => s.updateSettings);

  const messages = useMemo(
    () => [...custom.filter((m): m is SmsInput => m.channel === "sms"), ...SAMPLE_SMS].sort((a, b) => b.receivedAt.localeCompare(a.receivedAt)),
    [custom],
  );
  const results = useAssessments(messages);
  const [selected, setSelected] = useState<string | null>(null);
  const [replies, setReplies] = useState<Record<string, string[]>>({});
  const [draft, setDraft] = useState("");
  const detailRef = useScrollTo<HTMLDivElement>(selected);

  if (!settings.channels.sms) return <ChannelOff name="SMS" onEnable={() => updateSettings({ channels: { ...settings.channels, sms: true } })} />;

  const current = messages.find((m) => m.id === selected) ?? null;
  const nameFor = (from: string) => settings.contacts.find((c) => c.phone && c.phone.replace(/\D/g, "").endsWith(from.replace(/\D/g, "").slice(-10)))?.name ?? from;

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)]">
      <div className="space-y-4">
        <Card className="p-0">
          <div className="border-b border-slate-100 px-4 py-3 text-sm font-semibold">Messages</div>
          <ul className="divide-y divide-slate-100">
            {messages.map((m) => {
              const a = results.get(m.id)!;
              return (
                <li key={m.id}>
                  <button
                    onClick={() => setSelected(m.id)}
                    className={`flex w-full items-start gap-3 px-4 py-3 text-left hover:bg-slate-50 ${selected === m.id ? "bg-slate-100" : ""}`}
                  >
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-200 text-sm font-semibold text-slate-600">
                      {/^[A-Za-z]/.test(nameFor(m.from)) ? nameFor(m.from)[0] : "#"}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="truncate font-medium">{nameFor(m.from)}</span>
                        <span className="flex shrink-0 items-center gap-2 text-xs text-slate-500">
                          {formatTime(m.receivedAt)} <RiskDot a={a} />
                        </span>
                      </div>
                      <p className="line-clamp-2 text-sm text-slate-600">{m.body}</p>
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        </Card>
        <SmsComposer onSent={setSelected} />
      </div>

      <div ref={detailRef} className="scroll-mt-28">
      <Card className="min-h-80">
        {!current ? (
          <p className="py-16 text-center text-slate-500">Select a conversation to see its analysis.</p>
        ) : (
          <div className="flex h-full flex-col">
            <div className="mb-4 border-b border-slate-100 pb-3">
              <div className="font-semibold">{nameFor(current.from)}</div>
              <div className="text-xs text-slate-500">{current.from}</div>
            </div>
            <div className="flex-1 space-y-3">
              <div className="max-w-[85%] rounded-2xl rounded-bl-sm bg-slate-100 px-4 py-2 text-sm whitespace-pre-wrap break-words">{current.body}</div>
              <div className="text-xs text-slate-500">{formatTime(current.receivedAt)}</div>
              <RiskAlert
                a={results.get(current.id)!}
                actionTaken={actionFor(alerts, current.id)}
                actions={[
                  { label: "Report scam", tone: "danger", onClick: () => setAction(current.id, "reported") },
                  { label: "It's safe", onClick: () => setAction(current.id, "dismissed") },
                ]}
              />
              {(replies[current.id] ?? []).map((r, i) => (
                <div key={i} className="ml-auto max-w-[85%] rounded-2xl rounded-br-sm bg-blue-600 px-4 py-2 text-sm text-white">
                  {r}
                </div>
              ))}
            </div>
            <form
              className="mt-4 flex gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                if (!draft.trim()) return;
                setReplies((r) => ({ ...r, [current.id]: [...(r[current.id] ?? []), draft.trim()] }));
                setDraft("");
              }}
            >
              <input className={inputClass} placeholder="Reply (messages are never blocked)" value={draft} onChange={(e) => setDraft(e.target.value)} />
              <Button tone="primary" type="submit">
                Send
              </Button>
            </form>
          </div>
        )}
      </Card>
      </div>
    </div>
  );
}

export function actionFor(alerts: { id: string; action?: string }[], id: string): string | undefined {
  const act = alerts.find((r) => r.id === id)?.action;
  return act ? actionLabels[act] : undefined;
}

function SmsComposer({ onSent }: { onSent: (id: string) => void }) {
  const receive = useStore((s) => s.receive);
  const [from, setFrom] = useState("+1 (213) 555-0162");
  const [body, setBody] = useState("Your Apple ID has been locked. Verify your account now at http://apple-id-support.xyz or it will be deleted.");
  return (
    <Card>
      <div className="mb-3 text-sm font-semibold">Simulate an incoming SMS</div>
      <form
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          const id = `sms-custom-${Date.now()}`;
          receive({ channel: "sms", id, from, body, receivedAt: new Date().toISOString() });
          onSent(id);
        }}
      >
        <Field label="From">
          <input className={inputClass} value={from} onChange={(e) => setFrom(e.target.value)} />
        </Field>
        <Field label="Message">
          <textarea className={inputClass} rows={3} value={body} onChange={(e) => setBody(e.target.value)} />
        </Field>
        <Button tone="primary" type="submit" disabled={!from.trim() || !body.trim()}>
          Receive message
        </Button>
      </form>
    </Card>
  );
}
