import { useState } from "react";
import type { Channel } from "../engine";
import { SAMPLE_CONTACTS } from "../data/samples";
import { CHANNEL_INFO, ChannelToggles, NotificationPicker, SensitivityPicker, TrustedList } from "./SettingsControls";
import { DEFAULT_SETTINGS, useStore, type Settings } from "./store";
import { Button, Card, CheckIcon, ShieldIcon } from "./ui";

const STEPS = ["Welcome", "Permissions", "Channels", "Sensitivity", "Trusted", "Alerts", "Review"] as const;

export default function Onboarding() {
  const update = useStore((s) => s.updateSettings);
  const [step, setStep] = useState(0);
  const [draft, setDraft] = useState<Settings>({ ...DEFAULT_SETTINGS, channels: { sms: false, email: false, call: false } });
  const [granted, setGranted] = useState<Record<Channel, boolean | null>>({ sms: null, email: null, call: null });
  const patch = (p: Partial<Settings>) => setDraft((d) => ({ ...d, ...p }));

  const next = () => setStep((s) => Math.min(s + 1, STEPS.length - 1));
  const back = () => setStep((s) => Math.max(s - 1, 0));
  const anyChannel = Object.values(draft.channels).some(Boolean);

  return (
    <div className="mx-auto max-w-xl px-4 py-10">
      <div className="mb-6 flex items-center gap-2">
        {STEPS.map((s, i) => (
          <div key={s} className={`h-1.5 flex-1 rounded-full ${i <= step ? "bg-slate-900" : "bg-slate-200"}`} title={s} />
        ))}
      </div>
      <Card className="p-6">
        {step === 0 && (
          <div className="text-center">
            <ShieldIcon className="mx-auto h-14 w-14 text-slate-900" />
            <h1 className="mt-4 text-2xl font-bold">Welcome to ScamShield</h1>
            <p className="mt-2 text-slate-600">
              We check your texts, emails and incoming calls for signs of fraud and show you a risk score with the reasons behind it.
            </p>
            <ul className="mt-5 space-y-2 text-left text-sm">
              {[
                "Everything is analyzed on your device. Nothing is uploaded.",
                "We never block messages or calls. You stay in control.",
                "Every alert explains exactly why it was flagged.",
              ].map((t) => (
                <li key={t} className="flex gap-2">
                  <CheckIcon className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                  {t}
                </li>
              ))}
            </ul>
            <p className="mt-4 text-xs text-slate-400">Takes about 2 minutes.</p>
          </div>
        )}

        {step === 1 && (
          <div>
            <h2 className="text-xl font-semibold">Permissions</h2>
            <p className="mb-4 text-sm text-slate-600">We only ask for what each feature needs. You can change these any time.</p>
            <ul className="space-y-3">
              {(Object.keys(CHANNEL_INFO) as Channel[]).map((c) => (
                <li key={c} className="rounded-xl p-3 ring-1 ring-slate-200">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="font-medium">{CHANNEL_INFO[c].title}</div>
                      <div className="text-sm text-slate-600">{CHANNEL_INFO[c].why}</div>
                      <div className="text-xs text-slate-400">{CHANNEL_INFO[c].platform}</div>
                    </div>
                    {granted[c] === null ? (
                      <div className="flex shrink-0 flex-col gap-1">
                        <Button
                          tone="primary"
                          onClick={() => {
                            setGranted({ ...granted, [c]: true });
                            patch({ channels: { ...draft.channels, [c]: true } });
                          }}
                        >
                          Allow
                        </Button>
                        <Button onClick={() => setGranted({ ...granted, [c]: false })}>Not now</Button>
                      </div>
                    ) : (
                      <span className={`shrink-0 text-sm ${granted[c] ? "text-emerald-700" : "text-slate-500"}`}>{granted[c] ? "Allowed" : "Skipped"}</span>
                    )}
                  </div>
                </li>
              ))}
            </ul>
            <p className="mt-3 text-xs text-slate-400">Prototype: permissions are simulated in the browser.</p>
          </div>
        )}

        {step === 2 && (
          <div>
            <h2 className="text-xl font-semibold">Which would you like to monitor?</h2>
            <p className="mb-4 text-sm text-slate-600">Turn each channel on or off independently.</p>
            <ChannelToggles value={draft.channels} onChange={(channels) => patch({ channels })} />
          </div>
        )}

        {step === 3 && (
          <div>
            <h2 className="text-xl font-semibold">How cautious should we be?</h2>
            <p className="mb-4 text-sm text-slate-600">Scores stay the same; this sets when an alert appears.</p>
            <SensitivityPicker value={draft.sensitivity} onChange={(sensitivity) => patch({ sensitivity })} />
          </div>
        )}

        {step === 4 && (
          <div>
            <h2 className="text-xl font-semibold">Trusted senders (optional)</h2>
            <p className="mb-4 text-sm text-slate-600">Messages from people you know are less likely to be flagged.</p>
            <div className="mb-4 flex items-center justify-between rounded-xl p-3 ring-1 ring-slate-200">
              <div>
                <div className="font-medium">Import contacts</div>
                <div className="text-xs text-slate-500">Stays on your device. Demo imports {SAMPLE_CONTACTS.length} sample contacts.</div>
              </div>
              {draft.contacts.length ? (
                <span className="text-sm text-emerald-700">{draft.contacts.length} imported</span>
              ) : (
                <Button onClick={() => patch({ contacts: SAMPLE_CONTACTS })}>Import</Button>
              )}
            </div>
            <TrustedList value={draft.trustedSenders} onChange={(trustedSenders) => patch({ trustedSenders })} />
          </div>
        )}

        {step === 5 && (
          <div>
            <h2 className="text-xl font-semibold">How should we alert you?</h2>
            <p className="mb-4 text-sm text-slate-600">Alerts always appear on the message itself. This controls pop-up notifications.</p>
            <NotificationPicker value={draft.notifications} onChange={(notifications) => patch({ notifications })} />
          </div>
        )}

        {step === 6 && (
          <div>
            <h2 className="text-xl font-semibold">Review and enable</h2>
            <dl className="mt-4 divide-y divide-slate-100 text-sm">
              <Row k="Monitoring" v={(Object.keys(draft.channels) as Channel[]).filter((c) => draft.channels[c]).map((c) => CHANNEL_INFO[c].title).join(", ") || "Nothing selected"} />
              <Row k="Sensitivity" v={draft.sensitivity} />
              <Row k="Contacts" v={draft.contacts.length ? `${draft.contacts.length} imported` : "Not imported"} />
              <Row k="Trusted senders" v={draft.trustedSenders.length ? draft.trustedSenders.join(", ") : "None"} />
              <Row k="Notifications" v={draft.notifications} />
            </dl>
            {!anyChannel && <p className="mt-3 text-sm text-amber-700">Select at least one channel to monitor.</p>}
          </div>
        )}

        <div className="mt-6 flex justify-between">
          {step > 0 ? <Button onClick={back}>Back</Button> : <span />}
          {step < STEPS.length - 1 ? (
            <Button tone="primary" onClick={next}>
              {step === 0 ? "Get started" : step === 4 && !draft.contacts.length && !draft.trustedSenders.length ? "Skip" : "Continue"}
            </Button>
          ) : (
            <Button tone="primary" disabled={!anyChannel} onClick={() => update({ ...draft, onboarded: true })}>
              Enable protection
            </Button>
          )}
        </div>
      </Card>
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between gap-4 py-2">
      <dt className="text-slate-500">{k}</dt>
      <dd className="text-right font-medium capitalize">{v}</dd>
    </div>
  );
}
