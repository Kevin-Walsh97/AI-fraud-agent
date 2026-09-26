import { useMemo, useState } from "react";
import type { AuthResult, EmailInput } from "../engine";
import { SAMPLE_EMAILS } from "../data/samples";
import { actionFor } from "./SmsView";
import { useStore } from "./store";
import { useScrollTo } from "./useScrollTo";
import { useAssessments } from "./useAssessments";
import { Button, Card, ChannelOff, Field, formatTime, inputClass, RiskAlert, RiskDot } from "./ui";

export default function EmailView() {
  const custom = useStore((s) => s.customMessages);
  const settings = useStore((s) => s.settings);
  const alerts = useStore((s) => s.alerts);
  const setAction = useStore((s) => s.setAction);
  const updateSettings = useStore((s) => s.updateSettings);

  const emails = useMemo(
    () => [...custom.filter((m): m is EmailInput => m.channel === "email"), ...SAMPLE_EMAILS].sort((a, b) => b.receivedAt.localeCompare(a.receivedAt)),
    [custom],
  );
  const results = useAssessments(emails);
  const [selected, setSelected] = useState<string | null>(null);
  const detailRef = useScrollTo<HTMLDivElement>(selected);

  if (!settings.channels.email)
    return <ChannelOff name="Email" onEnable={() => updateSettings({ channels: { ...settings.channels, email: true } })} />;

  const current = emails.find((m) => m.id === selected) ?? null;
  const spam = new Set(alerts.filter((r) => r.action === "spam").map((r) => r.id));

  return (
    <div className="space-y-4">
      <Card className="p-0">
        <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
          <span className="text-sm font-semibold">Inbox</span>
          <span className="text-xs text-slate-500">Gmail web plugin preview</span>
        </div>
        <ul className="divide-y divide-slate-100">
          {emails.map((m) => {
            const a = results.get(m.id)!;
            return (
              <li key={m.id}>
                <button
                  onClick={() => setSelected(m.id)}
                  className={`grid w-full grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 px-4 py-2.5 text-left text-sm hover:bg-slate-50 ${selected === m.id ? "bg-slate-100" : ""} ${spam.has(m.id) ? "opacity-50" : ""}`}
                >
                  <span className="w-4">
                    <RiskDot a={a} />
                  </span>
                  <span className="min-w-0 truncate">
                    <span className="font-medium">{m.from.name ?? m.from.address}</span>
                    <span className="text-slate-500"> — {m.subject}</span>
                    {spam.has(m.id) && <span className="ml-2 rounded bg-slate-200 px-1.5 text-xs">Spam</span>}
                  </span>
                  <span className="text-xs text-slate-500">{formatTime(m.receivedAt)}</span>
                </button>
              </li>
            );
          })}
        </ul>
      </Card>

      {current && (
        <div ref={detailRef} className="scroll-mt-28">
        <Card>
          <div className="mb-3">
            <RiskAlert
              a={results.get(current.id)!}
              actionTaken={actionFor(alerts, current.id)}
              actions={[
                { label: "Report phishing", tone: "danger", onClick: () => setAction(current.id, "reported") },
                { label: "Move to spam", tone: "primary", onClick: () => setAction(current.id, "spam") },
                { label: "Dismiss", onClick: () => setAction(current.id, "dismissed") },
              ]}
            />
          </div>
          <h2 className="text-lg font-semibold">{current.subject}</h2>
          <div className="mt-1 text-sm">
            <span className="font-medium">{current.from.name}</span>{" "}
            <span className="text-slate-500">&lt;{current.from.address}&gt;</span>
          </div>
          {current.replyTo && <div className="text-xs text-slate-500">Reply-To: {current.replyTo}</div>}
          <div className="mt-1 flex flex-wrap gap-1.5 text-xs">
            {(["spf", "dkim", "dmarc"] as const).map((k) => {
              const v = current.auth?.[k] ?? "none";
              return (
                <span
                  key={k}
                  className={`rounded px-1.5 py-0.5 font-mono ${v === "pass" ? "bg-emerald-100 text-emerald-800" : v === "none" ? "bg-slate-100 text-slate-600" : "bg-red-100 text-red-800"}`}
                >
                  {k.toUpperCase()}={v}
                </span>
              );
            })}
          </div>
          <div className="mt-4 whitespace-pre-wrap break-words text-sm leading-relaxed">{current.body}</div>
          {current.attachments && current.attachments.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-2">
              {current.attachments.map((f) => (
                <span key={f.filename} className="rounded-lg bg-slate-100 px-3 py-1.5 text-xs ring-1 ring-slate-200">
                  📎 {f.filename}
                </span>
              ))}
            </div>
          )}
        </Card>
        </div>
      )}

      <EmailComposer onSent={setSelected} />
    </div>
  );
}

const AUTH_OPTIONS: AuthResult[] = ["pass", "fail", "softfail", "none"];

function EmailComposer({ onSent }: { onSent: (id: string) => void }) {
  const receive = useStore((s) => s.receive);
  const [name, setName] = useState("Microsoft 365");
  const [address, setAddress] = useState("no-reply@rnicrosoft-support.com");
  const [subject, setSubject] = useState("Your mailbox storage is full");
  const [body, setBody] = useState("Your password expires today. Sign in immediately to keep your account: https://rnicrosoft-support.com/login");
  const [attachments, setAttachments] = useState("");
  const [auth, setAuth] = useState<Record<"spf" | "dkim" | "dmarc", AuthResult>>({ spf: "softfail", dkim: "none", dmarc: "fail" });

  return (
    <Card>
      <div className="mb-3 text-sm font-semibold">Simulate an incoming email</div>
      <form
        className="grid gap-3 sm:grid-cols-2"
        onSubmit={(e) => {
          e.preventDefault();
          const id = `email-custom-${Date.now()}`;
          receive({
            channel: "email",
            id,
            from: { name: name || undefined, address },
            subject,
            body,
            receivedAt: new Date().toISOString(),
            auth,
            attachments: attachments
              .split(",")
              .map((s) => s.trim())
              .filter(Boolean)
              .map((filename) => ({ filename })),
          });
          onSent(id);
        }}
      >
        <Field label="Display name">
          <input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        <Field label="From address">
          <input className={inputClass} value={address} onChange={(e) => setAddress(e.target.value)} />
        </Field>
        <div className="sm:col-span-2">
          <Field label="Subject">
            <input className={inputClass} value={subject} onChange={(e) => setSubject(e.target.value)} />
          </Field>
        </div>
        <div className="sm:col-span-2">
          <Field label="Body">
            <textarea className={inputClass} rows={3} value={body} onChange={(e) => setBody(e.target.value)} />
          </Field>
        </div>
        <Field label="Attachments" hint="Comma-separated file names">
          <input className={inputClass} value={attachments} placeholder="invoice.pdf, macro.docm" onChange={(e) => setAttachments(e.target.value)} />
        </Field>
        <div className="grid grid-cols-3 gap-2">
          {(["spf", "dkim", "dmarc"] as const).map((k) => (
            <Field key={k} label={k.toUpperCase()}>
              <select className={inputClass} value={auth[k]} onChange={(e) => setAuth({ ...auth, [k]: e.target.value as AuthResult })}>
                {AUTH_OPTIONS.map((o) => (
                  <option key={o}>{o}</option>
                ))}
              </select>
            </Field>
          ))}
        </div>
        <div className="sm:col-span-2">
          <Button tone="primary" type="submit" disabled={!address.includes("@")}>
            Receive email
          </Button>
        </div>
      </form>
    </Card>
  );
}
