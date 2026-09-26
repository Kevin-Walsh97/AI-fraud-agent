import { SAMPLE_CONTACTS } from "../data/samples";
import { ChannelToggles, NotificationPicker, SensitivityPicker, TrustedList } from "./SettingsControls";
import { useStore } from "./store";
import { Button, Card, Field, inputClass } from "./ui";

export default function Settings() {
  const settings = useStore((s) => s.settings);
  const outbox = useStore((s) => s.feedbackOutbox);
  const update = useStore((s) => s.updateSettings);
  const resetAll = useStore((s) => s.resetAll);

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <h3 className="mb-3 font-semibold">Monitored channels</h3>
        <ChannelToggles value={settings.channels} onChange={(channels) => update({ channels })} />
      </Card>
      <Card className="space-y-5">
        <div>
          <h3 className="mb-3 font-semibold">Sensitivity</h3>
          <SensitivityPicker value={settings.sensitivity} onChange={(sensitivity) => update({ sensitivity })} />
        </div>
        <div>
          <h3 className="mb-2 font-semibold">Notifications</h3>
          <NotificationPicker value={settings.notifications} onChange={(notifications) => update({ notifications })} />
        </div>
        <Field label="Your phone number" hint="Used locally to spot calls that fake your own area code (neighbor spoofing).">
          <input className={inputClass} value={settings.userPhone} onChange={(e) => update({ userPhone: e.target.value })} />
        </Field>
      </Card>
      <Card>
        <h3 className="mb-1 font-semibold">Trusted senders</h3>
        <p className="mb-3 text-sm text-slate-500">Trusted senders get a score reduction, unless there are signs they were spoofed.</p>
        <TrustedList value={settings.trustedSenders} onChange={(trustedSenders) => update({ trustedSenders })} />
        <h3 className="mb-1 mt-5 font-semibold">Contacts</h3>
        {settings.contacts.length === 0 ? (
          <Button onClick={() => update({ contacts: SAMPLE_CONTACTS })}>Import contacts (demo)</Button>
        ) : (
          <div>
            <ul className="mb-2 space-y-1 text-sm">
              {settings.contacts.map((c) => (
                <li key={c.name} className="flex justify-between">
                  <span>{c.name}</span>
                  <span className="text-slate-500">{c.phone ?? c.email}</span>
                </li>
              ))}
            </ul>
            <Button onClick={() => update({ contacts: [] })}>Remove imported contacts</Button>
          </div>
        )}
      </Card>
      <Card>
        <h3 className="mb-1 font-semibold">Privacy</h3>
        <ul className="mb-4 list-disc space-y-1 pl-5 text-sm text-slate-600">
          <li>All analysis runs on this device. Message content is never stored or sent anywhere.</li>
          <li>Alert history is encrypted (AES-256-GCM) in local storage with a non-exportable key.</li>
          <li>No backend exists in this MVP. Nothing leaves the device.</li>
        </ul>
        <label className="flex cursor-pointer items-start gap-3">
          <input type="checkbox" className="mt-1 h-4 w-4" checked={settings.feedbackOptIn} onChange={(e) => update({ feedbackOptIn: e.target.checked })} />
          <span className="text-sm">
            <span className="font-medium">Share anonymous feedback to improve detection</span>
            <span className="block text-slate-500">
              Only a SHA-256 hash of the sender, the risk score, which rules fired, and your action. Never message content.
            </span>
          </span>
        </label>
        {settings.feedbackOptIn && (
          <div className="mt-3">
            <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
              Queued feedback ({outbox.length}) — exactly what would be sent
            </div>
            <pre className="max-h-48 overflow-auto rounded-lg bg-slate-900 p-3 text-xs text-slate-100">
              {outbox.length ? JSON.stringify(outbox.slice(0, 3), null, 2) : "// Report or dismiss an alert to see a payload here"}
            </pre>
          </div>
        )}
        <div className="mt-5 border-t border-slate-100 pt-4">
          <Button
            tone="danger"
            onClick={() => {
              if (confirm("Erase all settings and history and restart onboarding?")) resetAll();
            }}
          >
            Erase all data
          </Button>
        </div>
      </Card>
    </div>
  );
}
