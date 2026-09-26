import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import {
  analyze,
  createThreatIntel,
  type AnalysisContext,
  type Channel,
  type Contact,
  type MessageInput,
  type RecentEvent,
  type RiskAssessment,
  type Sensitivity,
} from "../engine";
import { USER_PHONE } from "../data/samples";
import { hashSender, type FeedbackPayload, type UserAction } from "./feedback";
import { secureStorage } from "./secureStorage";

export type NotificationMode = "silent" | "banner" | "sound";

export interface Settings {
  onboarded: boolean;
  channels: Record<Channel, boolean>;
  sensitivity: Sensitivity;
  trustedSenders: string[];
  contacts: Contact[];
  notifications: NotificationMode;
  feedbackOptIn: boolean;
  userPhone: string;
}

/**
 * A flagged item in history. Deliberately holds no message body — only the
 * sender, a short label, and the assessment.
 */
export interface AlertRecord {
  id: string;
  channel: Channel;
  sender: string;
  label: string;
  score: number;
  level: RiskAssessment["level"];
  confidence: RiskAssessment["confidence"];
  reasons: string[];
  signalIds: string[];
  flaggedAt: string;
  action?: UserAction;
  actionAt?: string;
}

export interface Toast {
  id: number;
  title: string;
  body: string;
  level: RiskAssessment["level"];
}

interface State {
  settings: Settings;
  alerts: AlertRecord[];
  /** Queued anonymous feedback. MVP has no backend, so this is shown to the user instead of sent. */
  feedbackOutbox: FeedbackPayload[];
  /** Session-only: user-simulated messages and recent-sender log (never persisted). */
  customMessages: MessageInput[];
  recentEvents: RecentEvent[];
  toasts: Toast[];

  updateSettings(patch: Partial<Settings>): void;
  recordAlert(input: MessageInput, a: RiskAssessment): void;
  setAction(id: string, action: UserAction): Promise<void>;
  receive(input: MessageInput): RiskAssessment;
  dismissToast(id: number): void;
  clearHistory(): void;
  resetAll(): void;
}

export const DEFAULT_SETTINGS: Settings = {
  onboarded: false,
  channels: { sms: true, email: true, call: true },
  sensitivity: "balanced",
  trustedSenders: [],
  contacts: [],
  notifications: "banner",
  feedbackOptIn: false,
  userPhone: USER_PHONE,
};

const threatIntel = createThreatIntel();

export function contextFrom(settings: Settings, recentEvents: RecentEvent[] = []): AnalysisContext {
  return {
    sensitivity: settings.sensitivity,
    contacts: settings.contacts,
    trustedSenders: settings.trustedSenders,
    recentEvents,
    userPhone: settings.userPhone,
    threatIntel,
  };
}

export function senderOf(m: MessageInput): string {
  return m.channel === "email" ? m.from.address : m.from;
}

export function labelOf(m: MessageInput): string {
  if (m.channel === "email") return m.subject;
  if (m.channel === "sms") return m.body.length > 60 ? `${m.body.slice(0, 57)}…` : m.body;
  return m.callerName ? `Call — ${m.callerName}` : "Incoming call";
}

let toastId = 0;

export const useStore = create<State>()(
  persist(
    (setState, getState) => ({
      settings: DEFAULT_SETTINGS,
      alerts: [],
      feedbackOutbox: [],
      customMessages: [],
      recentEvents: [],
      toasts: [],

      updateSettings: (patch) => setState((s) => ({ settings: { ...s.settings, ...patch } })),

      recordAlert: (input, a) => {
        if (!a.shouldAlert) return;
        setState((s) => {
          const existing = s.alerts.find((r) => r.id === input.id);
          const record: AlertRecord = {
            id: input.id,
            channel: input.channel,
            sender: senderOf(input),
            label: labelOf(input),
            score: a.score,
            level: a.level,
            confidence: a.confidence,
            reasons: a.signals.filter((x) => x.points > 0).map((x) => x.reason),
            signalIds: a.signals.map((x) => x.id),
            flaggedAt: existing?.flaggedAt ?? input.receivedAt,
            action: existing?.action,
            actionAt: existing?.actionAt,
          };
          if (existing && existing.score === record.score && existing.reasons.join() === record.reasons.join()) return s;
          return { alerts: [record, ...s.alerts.filter((r) => r.id !== input.id)] };
        });
      },

      setAction: async (id, action) => {
        const now = new Date().toISOString();
        setState((s) => ({ alerts: s.alerts.map((r) => (r.id === id ? { ...r, action, actionAt: now } : r)) }));
        const { settings, alerts } = getState();
        const rec = alerts.find((r) => r.id === id);
        if (!rec || !settings.feedbackOptIn) return;
        const payload: FeedbackPayload = {
          senderHash: await hashSender(rec.sender),
          channel: rec.channel,
          score: rec.score,
          level: rec.level,
          signalIds: rec.signalIds,
          action,
          appVersion: "0.1.0",
          sentAt: now,
        };
        setState((s) => ({ feedbackOutbox: [payload, ...s.feedbackOutbox].slice(0, 50) }));
      },

      receive: (input) => {
        const { settings, recentEvents } = getState();
        const a = analyze(input, contextFrom(settings, recentEvents));
        setState((s) => ({
          customMessages: [input, ...s.customMessages],
          recentEvents: [...s.recentEvents, { from: senderOf(input), at: input.receivedAt }].slice(-100),
        }));
        if (settings.channels[input.channel]) {
          getState().recordAlert(input, a);
          if (a.shouldAlert && settings.notifications !== "silent") {
            const id = ++toastId;
            setState((s) => ({ toasts: [...s.toasts, { id, title: `${a.score} · ${a.headline}`, body: `${senderOf(input)} — ${labelOf(input)}`, level: a.level }] }));
            if (settings.notifications === "sound") beep(a.level === "high");
            setTimeout(() => getState().dismissToast(id), 6000);
          }
        }
        return a;
      },

      dismissToast: (id) => setState((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
      clearHistory: () => setState({ alerts: [], feedbackOutbox: [] }),
      resetAll: () => setState({ settings: DEFAULT_SETTINGS, alerts: [], feedbackOutbox: [], customMessages: [], recentEvents: [] }),
    }),
    {
      name: "scamshield-state",
      version: 1,
      storage: createJSONStorage(() => secureStorage),
      partialize: (s) => ({ settings: s.settings, alerts: s.alerts, feedbackOutbox: s.feedbackOutbox }),
    },
  ),
);

function beep(urgent: boolean) {
  try {
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.frequency.value = urgent ? 880 : 660;
    gain.gain.setValueAtTime(0.08, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.35);
    osc.connect(gain).connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.35);
  } catch {
    /* audio unavailable */
  }
}
