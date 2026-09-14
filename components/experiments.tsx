"use client";
import { useState } from "react";
import {
  FlaskConical,
  Play,
  ArrowUpRight,
  Download,
  CheckCircle2,
} from "lucide-react";
import { metrics, policyInfo, runToEnd, scenarioInfo } from "@/lib/sim/engine";
import type { Run, Policy, Scenario } from "@/lib/sim/types";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
export function exportJson(value: unknown, name: string) {
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(value, null, 2)], { type: "application/json" }),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export function Experiments({ onOpen }: { onOpen: (r: Run) => void }) {
  const [scenario, setScenario] = useState<Scenario>("scarcity"),
    [results, setResults] = useState<Run[]>([]),
    [busy, setBusy] = useState(false);
  const [batch, setBatch] = useState<
    {
      policy: Policy;
      attempts: number;
      harm: number;
      success: number;
      benign: number;
      rejected: number;
    }[]
  >([]);
  function compare() {
    setBusy(true);
    setTimeout(() => {
      const policies: Policy[] = ["baseline", "cautious", "evidence"];
      setResults(
        policies.map((policy) => runToEnd({ seed: 42, scenario, policy })),
      );
      setBatch(
        policies.map((policy) => {
          let attempts = 0,
            harm = 0,
            success = 0,
            benign = 0,
            rejected = 0;
          for (let seed = 1; seed <= 10; seed++) {
            const m = metrics(runToEnd({ seed, scenario, policy }));
            const b = metrics(runToEnd({ seed, scenario: "benign", policy }));
            attempts += m.evaluable;
            harm += m.harm;
            success += m.successes;
            benign += b.benignOffers;
            rejected += b.benignRefused;
          }
          return { policy, attempts, harm, success, benign, rejected };
        }),
      );
      setBusy(false);
    }, 30);
  }
  return (
    <section className="experiments">
      <div className="section-heading">
        <div>
          <h2>Put trust to the test.</h2>
          <p>Same starting world. Different ways of deciding.</p>
        </div>
        <FlaskConical size={28} />
      </div>
      <div className="experiment-controls">
        <Select
          disabled={busy}
          value={scenario}
          onValueChange={(v) => {
            setScenario(v as Scenario);
            setResults([]);
            setBatch([]);
          }}
        >
          <SelectTrigger aria-label="Experiment scenario">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(scenarioInfo).map(([id, s]) => (
              <SelectItem key={id} value={id}>
                {s.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <button className="primary" onClick={compare} disabled={busy}>
          <Play size={15} />
          {busy ? "Running comparisons…" : "Run comparison"}
        </button>
      </div>
      <p className="experiment-context">
        {scenarioInfo[scenario].description} Compare a reference run at seed 42,
        then aggregate ten matched seeds with honest-offer controls. All
        policies are deterministic; no model calls.
      </p>
      {!results.length && !busy && (
        <div className="experiment-empty">
          <div className="comparison-illustration">
            <span>Trust</span>
            <span>Question</span>
            <span>Verify</span>
          </div>
          <h3>Good resistance has a cost.</h3>
          <p>
            Rejecting every offer can avoid scams while also losing legitimate
            trades. Measure both sides.
          </p>
        </div>
      )}
      {results.length > 0 && (
        <>
          <div className="policy-grid">
            {results.map((r) => {
              const m = metrics(r);
              return (
                <article className="policy-card" key={r.config.policy}>
                  <span className="policy-symbol">
                    <FlaskConical size={20} />
                  </span>
                  <h3>{policyInfo[r.config.policy].name}</h3>
                  <p>{policyInfo[r.config.policy].description}</p>
                  <div className="comparison-number">
                    {m.harm}
                    <span>coins of defined harm</span>
                  </div>
                  <dl>
                    <div>
                      <dt>Attacks succeeded</dt>
                      <dd>
                        {m.successes} / {m.evaluable}
                      </dd>
                    </div>
                    <div>
                      <dt>Explicit detections</dt>
                      <dd>{m.detections}</dd>
                    </div>
                    <div>
                      <dt>Residents fed</dt>
                      <dd>{m.needsMet} / 6</dd>
                    </div>
                  </dl>
                  <button className="text-button" onClick={() => onOpen(r)}>
                    Inspect this run <ArrowUpRight size={15} />
                  </button>
                </article>
              );
            })}
          </div>
          <div className="report-box">
            <div className="section-heading">
              <div>
                <h3>Across ten matched seeds</h3>
                <p>
                  Measured in your browser. Thirty scenario runs and thirty
                  benign controls.
                </p>
              </div>
              <button
                className="secondary"
                onClick={() =>
                  exportJson(
                    {
                      scenario,
                      seeds: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
                      engineVersion: results[0].engineVersion,
                      results: batch,
                    },
                    "settlement-comparison.json",
                  )
                }
              >
                <Download size={15} /> Export
              </button>
            </div>
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Policy</th>
                    <th>Attack success</th>
                    <th>Total harm</th>
                    <th>Honest offers refused</th>
                  </tr>
                </thead>
                <tbody>
                  {batch.map((b) => (
                    <tr key={b.policy}>
                      <td>{policyInfo[b.policy].name}</td>
                      <td>
                        {b.success} / {b.attempts}
                      </td>
                      <td>{b.harm} coins</td>
                      <td>
                        {b.rejected} / {b.benign}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="method-note">
              <CheckCircle2 size={16} /> Scenario-specific observations, not a
              general AI safety score. Harm thresholds and policies are
              hand-authored. Detection requires an explicit evidence check.
            </p>
          </div>
        </>
      )}
    </section>
  );
}
