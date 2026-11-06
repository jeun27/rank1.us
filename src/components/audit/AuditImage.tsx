import { formatPercent } from "@/components/ui/StatNumber";
import { colors } from "@/styles/tokens";
import type { Metric } from "@/types/metrics";
import { ENGINES, ENGINE_LABEL, type Metrics, type RunResults } from "./contract";
import { auditCopy as c } from "./copy";

const named = (m: Metric) => `named in ${m.numerator} of ${m.denominator} answers`;
const row = { display: "flex", justifyContent: "space-between", fontSize: 24, padding: "8px 0" } as const;

// The PNG export (next/og, 1200×630): hero %, n, per-engine, top 5 leaderboard. Credit on free only.
export function AuditImage({ results, metrics, free }: { results: RunResults; metrics: Metrics; free: boolean }) {
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        background: colors.paper,
        color: colors.ink,
        padding: 56,
        fontFamily: "Inter",
      }}
    >
      <div style={{ display: "flex", fontSize: 28, color: colors.inkMuted }}>{results.label}</div>
      <div style={{ display: "flex", gap: 64, marginTop: 24, flex: 1 }}>
        <div style={{ display: "flex", flexDirection: "column", width: 380 }}>
          <div style={{ display: "flex", fontSize: 120, fontWeight: 600, lineHeight: 1 }}>
            {formatPercent(metrics.visibility)}
          </div>
          <div style={{ display: "flex", fontSize: 26, marginTop: 12 }}>{named(metrics.visibility)}</div>
          <div style={{ display: "flex", fontSize: 22, marginTop: 8, color: colors.inkMuted }}>
            API-measured, directional
          </div>
          <div style={{ display: "flex", flexDirection: "column", marginTop: 32 }}>
            {ENGINES.map((e) => (
              <div key={e} style={row}>
                <span>{ENGINE_LABEL[e]}</span>
                <span>{formatPercent(metrics.visibility.byEngine[e])}</span>
              </div>
            ))}
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
          <div style={{ display: "flex", fontSize: 26, fontWeight: 600, marginBottom: 8 }}>{c.competitors}</div>
          {metrics.leaderboard.slice(0, 5).map((b) => (
            <div key={b.name} style={{ ...row, borderBottom: `1px solid ${colors.border}` }}>
              <span>{b.kind === "business" ? `${b.name} (${c.you})` : b.name}</span>
              <span>{b.tooFew ? c.tooFew : formatPercent(b.metric)}</span>
            </div>
          ))}
        </div>
      </div>
      {free && <div style={{ display: "flex", fontSize: 18, color: colors.inkMuted }}>{c.credit}</div>}
    </div>
  );
}
