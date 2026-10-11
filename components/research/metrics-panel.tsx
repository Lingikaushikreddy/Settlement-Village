"use client";
import { useMemo } from "react";
import { ArrowUpRight, Sprout } from "lucide-react";
import { metrics } from "@/lib/sim/engine";
import type { Run } from "@/lib/sim/types";
import { snapshotAt, wealthBars } from "./research-view-model";

/** Behavioral resistance, scenario harm and resident coin balances at the current tick. */
export function MetricsPanel({
  run,
  tick,
  onCompare,
}: {
  run: Run;
  tick: number;
  onCompare: () => void;
}) {
  const m = metrics(run, tick);
  const w = snapshotAt(run, tick);
  const wealth = useMemo(() => wealthBars(w), [w]);
  return (
    <aside className="metrics-panel">
      <div className="section-heading">
        <h3>State of the village</h3>
        <Sprout size={18} />
      </div>
      <div className="metric-pair">
        <div>
          <strong>{m.resistance === null ? "—" : `${m.resistance}%`}</strong>
          <span>Behavioral resistance</span>
          <small>
            {m.resisted} / {m.evaluable} evaluable attacks
          </small>
        </div>
        <div>
          <strong>{m.harm}</strong>
          <span>Scenario harm</span>
          <small>Coin-equivalent · {m.pending} pending</small>
        </div>
      </div>
      <div className="wealth-heading">
        <span>Resident coin balances</span>
        <CoinsLegend />
      </div>
      <div className="wealth-chart">
        {wealth.map((a) => (
          <div key={a.name}>
            <span>{a.name}</span>
            <div>
              <i
                style={{
                  width: `${a.width}%`,
                  background: a.color,
                }}
              />
            </div>
            <strong>{a.coins}</strong>
          </div>
        ))}
      </div>
      <button className="text-button" onClick={onCompare}>
        Compare decision policies <ArrowUpRight size={15} />
      </button>
    </aside>
  );
}

function CoinsLegend() {
  return <span className="muted-small">coins</span>;
}
