import { useMemo, useState } from "react";
import type { Channel, RiskLevel } from "../engine";
import { toCsv } from "./csv";
import { useStore } from "./store";
import { actionLabels, Button, Card, ConfirmButton, formatTime, inputClass, ScoreBadge, selectClass } from "./ui";

const CHANNEL_LABEL: Record<Channel, string> = { sms: "SMS", email: "Email", call: "Call" };

export default function History() {
  const alerts = useStore((s) => s.alerts);
  const clearHistory = useStore((s) => s.clearHistory);
  const [channel, setChannel] = useState<Channel | "all">("all");
  const [level, setLevel] = useState<RiskLevel | "all">("all");
  const [range, setRange] = useState<"all" | "7" | "30">("all");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [showCsv, setShowCsv] = useState(false);

  const rows = useMemo(() => {
    const since = range === "all" ? 0 : Date.now() - Number(range) * 86_400_000;
    return alerts
      .filter((r) => (channel === "all" || r.channel === channel) && (level === "all" || r.level === level) && new Date(r.flaggedAt).getTime() >= since)
      .sort((a, b) => b.flaggedAt.localeCompare(a.flaggedAt));
  }, [alerts, channel, level, range]);

  return (
    <Card>
      <div className="mb-4 flex flex-wrap items-end gap-3">
        <div>
          <h2 className="text-lg font-semibold">Alert history</h2>
          <p className="text-xs text-slate-500">Stored encrypted on this device. Message content is never saved — only sender, subject/preview and the risk result.</p>
        </div>
        <div className="ml-auto flex flex-wrap gap-2">
          <select className={selectClass} value={channel} onChange={(e) => setChannel(e.target.value as Channel | "all")}>
            <option value="all">All channels</option>
            <option value="sms">SMS</option>
            <option value="email">Email</option>
            <option value="call">Calls</option>
          </select>
          <select className={selectClass} value={level} onChange={(e) => setLevel(e.target.value as RiskLevel | "all")}>
            <option value="all">All risk levels</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
          </select>
          <select className={selectClass} value={range} onChange={(e) => setRange(e.target.value as "all" | "7" | "30")}>
            <option value="all">All time</option>
            <option value="7">Last 7 days</option>
            <option value="30">Last 30 days</option>
          </select>
          <Button tone="primary" onClick={() => setShowCsv((v) => !v)} disabled={rows.length === 0}>
            {showCsv ? "Hide CSV" : "Export CSV"}
          </Button>
          <ConfirmButton label="Clear" question="Delete all alert history?" confirmLabel="Delete" onConfirm={clearHistory} disabled={alerts.length === 0} />
        </div>
      </div>

      {showCsv && rows.length > 0 && <CsvPanel csv={toCsv(rows)} />}

      {rows.length === 0 ? (
        <p className="py-10 text-center text-sm text-slate-500">No flagged items match these filters.</p>
      ) : (
        <ul className="divide-y divide-slate-100">
          {rows.map((r) => (
            <li key={r.id} className="py-3">
              <button className="flex w-full items-center gap-3 text-left" onClick={() => setExpanded(expanded === r.id ? null : r.id)}>
                <ScoreBadge score={r.score} level={r.level} size="sm" />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium">{r.label}</div>
                  <div className="truncate text-xs text-slate-500">
                    {CHANNEL_LABEL[r.channel]} · {r.sender} · {formatTime(r.flaggedAt)}
                  </div>
                </div>
                <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs ${r.action ? "bg-slate-100 text-slate-700" : "bg-blue-50 text-blue-700"}`}>
                  {r.action ? actionLabels[r.action] : "No action"}
                </span>
              </button>
              {expanded === r.id && (
                <ul className="ml-10 mt-2 list-disc space-y-0.5 pl-4 text-sm text-slate-600">
                  {r.reasons.map((x) => (
                    <li key={x}>{x}</li>
                  ))}
                </ul>
              )}
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function CsvPanel({ csv }: { csv: string }) {
  const [copied, setCopied] = useState<"idle" | "copied" | "failed">("idle");
  const canDownload = (() => {
    try {
      return window.self === window.top; // embedded viewers block downloads
    } catch {
      return false;
    }
  })();
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(csv);
      setCopied("copied");
    } catch {
      setCopied("failed");
    }
  };
  return (
    <div className="mb-4 rounded-xl bg-slate-50 p-3 ring-1 ring-slate-200">
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <span className="text-sm font-medium">CSV ({csv.split("\r\n").length - 1} rows)</span>
        <Button onClick={copy}>{copied === "copied" ? "Copied" : "Copy CSV"}</Button>
        {canDownload && <Button onClick={() => downloadCsv(csv)}>Download .csv</Button>}
        {copied === "failed" && <span className="text-xs text-slate-500">Copy was blocked. Select the text below and copy it manually.</span>}
      </div>
      <textarea id="csv-export" readOnly className={`${inputClass} h-32 font-mono text-xs`} value={csv} onFocus={(e) => e.currentTarget.select()} />
    </div>
  );
}

function downloadCsv(csv: string) {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `scamshield-alerts-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
