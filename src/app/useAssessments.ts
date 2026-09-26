import { useEffect, useMemo } from "react";
import { analyze, type MessageInput, type RiskAssessment } from "../engine";
import { contextFrom, useStore } from "./store";

/**
 * Scores a list of messages on-device and records any that cross the alert
 * threshold into history. Re-runs when settings (sensitivity, contacts,
 * trusted list) change.
 */
export function useAssessments<T extends MessageInput>(messages: T[]): Map<string, RiskAssessment> {
  const settings = useStore((s) => s.settings);
  const recordAlert = useStore((s) => s.recordAlert);

  const results = useMemo(() => {
    const ctx = contextFrom(settings);
    // Earlier messages from the same sender feed the frequency check.
    const sorted = [...messages].sort((a, b) => a.receivedAt.localeCompare(b.receivedAt));
    const map = new Map<string, RiskAssessment>();
    const seen: { from: string; at: string }[] = [];
    for (const m of sorted) {
      map.set(m.id, analyze(m, { ...ctx, recentEvents: seen.slice() }));
      seen.push({ from: m.channel === "email" ? m.from.address : m.from, at: m.receivedAt });
    }
    return map;
  }, [messages, settings]);

  useEffect(() => {
    for (const m of messages) {
      if (!settings.channels[m.channel]) continue;
      const a = results.get(m.id);
      if (a) recordAlert(m, a);
    }
  }, [messages, results, recordAlert, settings.channels]);

  return results;
}
