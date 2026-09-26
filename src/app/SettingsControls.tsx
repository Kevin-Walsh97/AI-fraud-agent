import { useState } from "react";
import { ALERT_THRESHOLDS, type Channel, type Sensitivity } from "../engine";
import type { NotificationMode } from "./store";
import { Button, inputClass } from "./ui";

export const CHANNEL_INFO: Record<Channel, { title: string; why: string; platform: string }> = {
  sms: {
    title: "SMS messages",
    why: "Scan incoming texts on-device for phishing links and pressure tactics.",
    platform: "Android: SMS permission. iOS: Message Filter extension (unknown senders only).",
  },
  email: {
    title: "Emails",
    why: "Check sender authentication, look-alike domains, links and attachments.",
    platform: "Gmail/Outlook OAuth with read-only scope. Analysis runs in the browser plugin.",
  },
  call: {
    title: "Incoming calls",
    why: "Warn you before you answer using caller ID and number reputation — no audio is recorded.",
    platform: "Android: CallScreeningService. iOS: CallKit Call Directory extension.",
  },
};

export function ChannelToggles({ value, onChange }: { value: Record<Channel, boolean>; onChange: (v: Record<Channel, boolean>) => void }) {
  return (
    <div className="space-y-2">
      {(Object.keys(CHANNEL_INFO) as Channel[]).map((c) => (
        <label key={c} className="flex cursor-pointer gap-3 rounded-xl p-3 ring-1 ring-slate-200 hover:bg-slate-50">
          <input type="checkbox" className="mt-1 h-4 w-4" checked={value[c]} onChange={(e) => onChange({ ...value, [c]: e.target.checked })} />
          <span>
            <span className="block font-medium">{CHANNEL_INFO[c].title}</span>
            <span className="block text-sm text-slate-600">{CHANNEL_INFO[c].why}</span>
            <span className="block text-xs text-slate-400">{CHANNEL_INFO[c].platform}</span>
          </span>
        </label>
      ))}
    </div>
  );
}

const SENSITIVITY_INFO: Record<Sensitivity, string> = {
  strict: "Flag more aggressively. More alerts, more false positives.",
  balanced: "Recommended. Alerts on clearly suspicious messages.",
  lenient: "Only flag extreme cases.",
};

export function SensitivityPicker({ value, onChange }: { value: Sensitivity; onChange: (v: Sensitivity) => void }) {
  return (
    <div className="grid gap-2 sm:grid-cols-3">
      {(Object.keys(SENSITIVITY_INFO) as Sensitivity[]).map((s) => (
        <button
          key={s}
          type="button"
          onClick={() => onChange(s)}
          className={`rounded-xl p-3 text-left ring-1 ${value === s ? "bg-slate-900 text-white ring-slate-900" : "ring-slate-200 hover:bg-slate-50"}`}
        >
          <span className="block font-medium capitalize">{s}</span>
          <span className={`block text-xs ${value === s ? "text-slate-300" : "text-slate-500"}`}>{SENSITIVITY_INFO[s]}</span>
          <span className={`mt-1 block text-xs ${value === s ? "text-slate-400" : "text-slate-400"}`}>Alert when score &gt; {ALERT_THRESHOLDS[s]}</span>
        </button>
      ))}
    </div>
  );
}

const NOTIFY: { v: NotificationMode; label: string }[] = [
  { v: "silent", label: "Silent" },
  { v: "banner", label: "Banner" },
  { v: "sound", label: "Sound + banner" },
];

export function NotificationPicker({ value, onChange }: { value: NotificationMode; onChange: (v: NotificationMode) => void }) {
  return (
    <div className="inline-flex rounded-xl p-1 ring-1 ring-slate-200">
      {NOTIFY.map((n) => (
        <button
          key={n.v}
          type="button"
          onClick={() => onChange(n.v)}
          className={`rounded-lg px-3 py-1.5 text-sm ${value === n.v ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-100"}`}
        >
          {n.label}
        </button>
      ))}
    </div>
  );
}

export function TrustedList({ value, onChange }: { value: string[]; onChange: (v: string[]) => void }) {
  const [draft, setDraft] = useState("");
  const add = () => {
    const v = draft.trim();
    if (v && !value.includes(v)) onChange([...value, v]);
    setDraft("");
  };
  return (
    <div>
      <div className="flex gap-2">
        <input
          className={inputClass}
          placeholder="Phone number, email, or @domain.com"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              add();
            }
          }}
        />
        <Button type="button" onClick={add}>
          Add
        </Button>
      </div>
      {value.length > 0 && (
        <ul className="mt-2 flex flex-wrap gap-2">
          {value.map((t) => (
            <li key={t} className="flex items-center gap-1 rounded-full bg-slate-100 py-1 pl-3 pr-1 text-sm">
              {t}
              <button type="button" aria-label={`Remove ${t}`} className="rounded-full px-1.5 text-slate-500 hover:bg-slate-200" onClick={() => onChange(value.filter((x) => x !== t))}>
                ×
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
