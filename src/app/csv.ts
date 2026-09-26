import type { AlertRecord } from "./store";

export function toCsv(rows: AlertRecord[]): string {
  const header = ["flagged_at", "channel", "sender", "subject_or_preview", "score", "level", "confidence", "reasons", "user_action", "action_at"];
  const esc = (v: string | number | undefined) => {
    const s = String(v ?? "");
    // Neutralize spreadsheet formula injection, then quote.
    const isPhone = /^\+[\d\s().-]+$/.test(s);
    const safe = !isPhone && /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
    return `"${safe.replace(/"/g, '""')}"`;
  };
  const lines = rows.map((r) =>
    [r.flaggedAt, r.channel, r.sender, r.label, r.score, r.level, r.confidence, r.reasons.join("; "), r.action, r.actionAt].map(esc).join(","),
  );
  return [header.join(","), ...lines].join("\r\n");
}
