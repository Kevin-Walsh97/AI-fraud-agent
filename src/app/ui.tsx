import { useState, type ReactNode } from "react";
import type { RiskAssessment, RiskLevel } from "../engine";

export const levelStyles: Record<RiskLevel, { badge: string; panel: string; dot: string; text: string; label: string }> = {
  high: { badge: "bg-red-600 text-white", panel: "border-red-300 bg-red-50", dot: "bg-red-500", text: "text-red-800", label: "High risk" },
  medium: { badge: "bg-amber-500 text-white", panel: "border-amber-300 bg-amber-50", dot: "bg-amber-500", text: "text-amber-900", label: "Medium risk" },
  low: { badge: "bg-emerald-600 text-white", panel: "border-emerald-200 bg-emerald-50", dot: "bg-emerald-500", text: "text-emerald-800", label: "Low risk" },
};

export function ScoreBadge({ score, level, size = "md" }: { score: number; level: RiskLevel; size?: "sm" | "md" | "lg" }) {
  const dims = size === "lg" ? "h-14 w-14 text-xl" : size === "sm" ? "h-7 w-7 text-xs" : "h-10 w-10 text-sm";
  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center rounded-full font-bold tabular-nums ${dims} ${levelStyles[level].badge}`}
      title={`Risk score ${score}/100`}
    >
      {score}
    </span>
  );
}

export function RiskDot({ a }: { a: RiskAssessment }) {
  if (!a.shouldAlert) return a.level === "low" ? <CheckIcon className="h-4 w-4 text-emerald-500" /> : null;
  return <span className={`inline-block h-2.5 w-2.5 rounded-full ${levelStyles[a.level].dot}`} title={`${a.score}/100`} />;
}

export function CheckIcon({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className={className} aria-hidden>
      <path fillRule="evenodd" d="M16.7 5.3a1 1 0 0 1 0 1.4l-8 8a1 1 0 0 1-1.4 0l-4-4a1 1 0 1 1 1.4-1.4L8 12.6l7.3-7.3a1 1 0 0 1 1.4 0Z" clipRule="evenodd" />
    </svg>
  );
}

export function ShieldIcon({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className={className} aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 3 4.5 6v5.5c0 4.6 3.2 8.4 7.5 9.5 4.3-1.1 7.5-4.9 7.5-9.5V6L12 3Z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="m9 12 2 2 4-4" />
    </svg>
  );
}

export interface AlertAction {
  label: string;
  onClick: () => void;
  tone?: "primary" | "danger" | "neutral";
}

const toneClass = {
  primary: "bg-slate-900 text-white hover:bg-slate-700",
  danger: "bg-red-600 text-white hover:bg-red-700",
  neutral: "bg-white text-slate-700 ring-1 ring-slate-300 hover:bg-slate-100",
};

export function Button({ tone = "neutral", className = "", ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { tone?: keyof typeof toneClass }) {
  return (
    <button
      {...props}
      className={`rounded-lg px-3 py-1.5 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-50 ${toneClass[tone]} ${className}`}
    />
  );
}

/**
 * The alert shown in-line on a message, above an email, or on the call screen.
 * High/medium alerts show "why flagged"; clean items get a subtle checkmark.
 */
export function RiskAlert({
  a,
  actions = [],
  actionTaken,
  compact = false,
}: {
  a: RiskAssessment;
  actions?: AlertAction[];
  actionTaken?: string;
  compact?: boolean;
}) {
  const [open, setOpen] = useState(!compact);
  const [showEvidence, setShowEvidence] = useState(false);
  const positive = a.signals.filter((s) => s.points > 0);
  const mitigating = a.signals.filter((s) => s.points <= 0);

  if (!a.shouldAlert) {
    return (
      <div className="flex items-center gap-2 text-xs text-slate-500">
        {a.level === "low" ? <CheckIcon className="h-4 w-4 text-emerald-500" /> : <span className="h-2 w-2 rounded-full bg-slate-400" />}
        <span>
          {a.level === "low" ? "No issues detected" : `Minor signals (score ${a.score}) — below your alert threshold of ${a.alertThreshold}`}
        </span>
      </div>
    );
  }

  const st = levelStyles[a.level];
  return (
    <div className={`rounded-xl border p-3 ${st.panel}`} role="alert">
      <div className="flex items-start gap-3">
        <ScoreBadge score={a.score} level={a.level} />
        <div className="min-w-0 flex-1">
          <div className={`font-semibold ${st.text}`}>{a.headline}</div>
          <div className="text-xs text-slate-600">
            Risk {a.score}/100 · {a.confidence} confidence · {positive.length} red flag{positive.length === 1 ? "" : "s"}
          </div>
        </div>
        {compact && (
          <button className="text-xs font-medium text-slate-600 underline" onClick={() => setOpen((o) => !o)}>
            {open ? "Hide" : "Why?"}
          </button>
        )}
      </div>

      {open && (
        <>
          <div className="mt-3">
            <div className="mb-1 flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Why flagged</span>
              <button className="text-xs text-slate-500 underline" onClick={() => setShowEvidence((v) => !v)}>
                {showEvidence ? "Hide details" : "Show details"}
              </button>
            </div>
            <ul className="space-y-1 text-sm">
              {positive.map((s) => (
                <li key={s.id} className="flex gap-2">
                  <span className="mt-0.5 shrink-0 rounded bg-white/70 px-1.5 text-xs font-semibold tabular-nums text-slate-600 ring-1 ring-slate-200">
                    +{s.points}
                  </span>
                  <div className="min-w-0">
                    <div>{s.reason}</div>
                    {showEvidence && s.evidence && (
                      <div className="break-words text-xs text-slate-500">{s.evidence.join(" · ")}</div>
                    )}
                  </div>
                </li>
              ))}
              {mitigating.map((s) => (
                <li key={s.id} className="flex gap-2 text-slate-500">
                  <span className="mt-0.5 shrink-0 rounded bg-white/70 px-1.5 text-xs font-semibold tabular-nums ring-1 ring-slate-200">
                    {s.points}
                  </span>
                  <span>{s.reason}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="mt-3 rounded-lg bg-white/70 p-2 text-sm ring-1 ring-slate-200">
            <span className="font-semibold">Recommended: </span>
            {a.recommendedAction}
          </div>
          {(actions.length > 0 || actionTaken) && (
            <div className="mt-3 flex flex-wrap items-center gap-2">
              {actionTaken ? (
                <span className="text-sm text-slate-600">
                  <CheckIcon className="mr-1 inline h-4 w-4" />
                  {actionTaken}
                </span>
              ) : (
                actions.map((x) => (
                  <Button key={x.label} tone={x.tone} onClick={x.onClick}>
                    {x.label}
                  </Button>
                ))
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200 ${className}`}>{children}</div>;
}

export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <label className="block text-sm">
      <span className="mb-1 block font-medium text-slate-700">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-slate-500">{hint}</span>}
    </label>
  );
}

export const selectClass =
  "rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-200";

export const inputClass =
  "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-200";

export function formatTime(iso: string): string {
  const d = new Date(iso);
  const today = new Date();
  const sameDay = d.toDateString() === today.toDateString();
  return sameDay
    ? d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })
    : d.toLocaleDateString([], { month: "short", day: "numeric" }) + " " + d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

export const actionLabels: Record<string, string> = {
  reported: "Reported as scam",
  dismissed: "Marked as safe",
  spam: "Moved to spam",
  blocked: "Caller blocked",
  answered: "Answered",
  declined: "Declined",
};

export function ChannelOff({ name, onEnable }: { name: string; onEnable: () => void }) {
  return (
    <Card className="text-center">
      <p className="text-slate-600">{name} monitoring is turned off.</p>
      <Button tone="primary" className="mt-3" onClick={onEnable}>
        Turn on {name.toLowerCase()} monitoring
      </Button>
    </Card>
  );
}
