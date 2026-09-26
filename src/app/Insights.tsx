import { useMemo } from "react";
import { confirmsScam } from "./feedback";
import { useStore } from "./store";
import { Card } from "./ui";

export default function Insights() {
  const alerts = useStore((s) => s.alerts);

  const stats = useMemo(() => {
    const byChannel = { sms: 0, email: 0, call: 0 };
    const byLevel = { high: 0, medium: 0, low: 0 };
    const reasons = new Map<string, number>();
    let confirmed = 0;
    let falsePositive = 0;
    for (const r of alerts) {
      byChannel[r.channel]++;
      byLevel[r.level]++;
      for (const x of r.reasons) reasons.set(x, (reasons.get(x) ?? 0) + 1);
      if (r.action && confirmsScam(r.action)) confirmed++;
      if (r.action === "dismissed" || r.action === "answered") falsePositive++;
    }
    const reviewed = confirmed + falsePositive;
    return {
      total: alerts.length,
      byChannel,
      byLevel,
      confirmed,
      falsePositive,
      reviewed,
      precision: reviewed ? Math.round((confirmed / reviewed) * 100) : null,
      topReasons: [...reasons.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6),
    };
  }, [alerts]);

  const maxReason = stats.topReasons[0]?.[1] ?? 1;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Alerts raised" value={stats.total} />
        <Stat label="Confirmed scams" value={stats.confirmed} sub="reported, spam, blocked or declined" />
        <Stat label="Marked safe" value={stats.falsePositive} sub="dismissed or answered" />
        <Stat
          label="Rule accuracy"
          value={stats.precision === null ? "—" : `${stats.precision}%`}
          sub={stats.reviewed ? `precision across ${stats.reviewed} reviewed alerts` : "review alerts to measure"}
        />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <h3 className="mb-3 text-sm font-semibold">By channel</h3>
          <Bars
            rows={[
              ["SMS", stats.byChannel.sms],
              ["Email", stats.byChannel.email],
              ["Calls", stats.byChannel.call],
            ]}
            max={Math.max(1, ...Object.values(stats.byChannel))}
            color="bg-slate-700"
          />
          <h3 className="mb-3 mt-5 text-sm font-semibold">By risk level</h3>
          <Bars
            rows={[
              ["High", stats.byLevel.high],
              ["Medium", stats.byLevel.medium],
            ]}
            max={Math.max(1, stats.byLevel.high, stats.byLevel.medium)}
            colors={["bg-red-500", "bg-amber-500"]}
          />
        </Card>
        <Card>
          <h3 className="mb-3 text-sm font-semibold">Most common red flags</h3>
          {stats.topReasons.length === 0 ? (
            <p className="text-sm text-slate-500">No alerts yet — open the Messages, Mail or Calls tabs.</p>
          ) : (
            <Bars rows={stats.topReasons} max={maxReason} color="bg-slate-500" wide />
          )}
        </Card>
      </div>
      <p className="text-xs text-slate-500">
        Accuracy is estimated from your own feedback on this device. The MVP uses transparent rules only; these numbers are what a future ML
        model would be benchmarked against.
      </p>
    </div>
  );
}

function Stat({ label, value, sub }: { label: string; value: number | string; sub?: string }) {
  return (
    <Card>
      <div className="text-xs text-slate-500">{label}</div>
      <div className="text-2xl font-semibold tabular-nums">{value}</div>
      {sub && <div className="text-xs text-slate-400">{sub}</div>}
    </Card>
  );
}

function Bars({ rows, max, color, colors, wide }: { rows: [string, number][]; max: number; color?: string; colors?: string[]; wide?: boolean }) {
  return (
    <ul className="space-y-2">
      {rows.map(([label, n], i) => (
        <li key={label} className={`grid items-center gap-2 text-sm ${wide ? "grid-cols-1" : "grid-cols-[4rem_minmax(0,1fr)_2rem]"}`}>
          <span className={wide ? "text-slate-700" : "text-slate-600"}>{label}</span>
          <div className={`flex items-center gap-2 ${wide ? "" : "contents"}`}>
            <div className="h-2.5 flex-1 rounded-full bg-slate-100">
              <div className={`h-2.5 rounded-full ${colors?.[i] ?? color}`} style={{ width: `${(n / max) * 100}%` }} />
            </div>
            <span className="w-8 text-right tabular-nums text-slate-600">{n}</span>
          </div>
        </li>
      ))}
    </ul>
  );
}
