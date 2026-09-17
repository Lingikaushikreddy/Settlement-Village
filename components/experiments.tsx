"use client";
import { useEffect, useRef, useState } from "react";
import {
  FlaskConical,
  Play,
  ArrowUpRight,
  Download,
  CheckCircle2,
  Upload,
  X,
} from "lucide-react";
import { policyInfo, runToEnd, scenarioInfo } from "@/lib/sim/engine";
import {
  createEvaluationManifest,
  evaluateSuite,
  verifyEvaluationReport,
} from "@/lib/sim/evaluation";
import type { EvaluationReport } from "@/lib/sim/evaluation";
import type { Run, Scenario } from "@/lib/sim/types";
import "./experiments.css";

function download(value: string, name: string, type: string) {
  const url = URL.createObjectURL(new Blob([value], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export function exportJson(value: unknown, name: string) {
  download(JSON.stringify(value, null, 2), name, "application/json");
}
function exportCsv(report: EvaluationReport) {
  const columns = [
    "scenario",
    "policy",
    "runCount",
    "attacks",
    "evaluable",
    "successes",
    "resisted",
    "unresolved",
    "pending",
    "harm",
    "detections",
    "benignOffers",
    "benignRefused",
    "inspectionCount",
    "attackSuccessRate",
    "benignRefusalRate",
  ] as const;
  const rows = [
    columns.join(","),
    ...report.rows.map((row) => columns.map((key) => row[key] ?? "").join(",")),
  ];
  download(
    rows.join("\r\n") + "\r\n",
    "settlement-evaluation.csv",
    "text/csv;charset=utf-8",
  );
}
const rate = (value: number | null) =>
  value === null ? "Not applicable" : `${(value * 100).toFixed(1)}%`;

export function Experiments({ onOpen }: { onOpen: (r: Run) => void }) {
  const [scenario, setScenario] = useState<Scenario | "all">("scarcity");
  const [seedStart, setSeedStart] = useState("1"),
    [seedCount, setSeedCount] = useState("10"),
    [ticks, setTicks] = useState("60");
  const [report, setReport] = useState<EvaluationReport | null>(null);
  const [busy, setBusy] = useState<"run" | "verify" | null>(null);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [message, setMessage] = useState("");
  const [pasted, setPasted] = useState("");
  const [error, setError] = useState("");
  const [inspectScenario, setInspectScenario] = useState<Scenario>("scarcity");
  const [inspectSeed, setInspectSeed] = useState(1);
  const controller = useRef<AbortController | null>(null);
  const importFile = useRef<HTMLInputElement>(null);
  useEffect(
    () => () => {
      controller.current?.abort();
      controller.current = null;
    },
    [],
  );

  async function evaluate(file?: File | string) {
    controller.current?.abort();
    const task = new AbortController();
    controller.current = task;
    setBusy(file ? "verify" : "run");
    setReport(null);
    setProgress({ done: 0, total: 0 });
    setError("");
    setMessage("");
    const options = {
      signal: task.signal,
      onProgress: (done: number, total: number) => {
        if (controller.current === task) setProgress({ done, total });
      },
    };
    try {
      let next: EvaluationReport;
      if (file) {
        if (
          (typeof file === "string"
            ? new TextEncoder().encode(file).length
            : file.size) > 2_000_000
        )
          throw Error(
            "Choose a compact evaluation report smaller than 2 MB. Full run exports belong to the run inspector.",
          );
        const raw = JSON.parse(
          typeof file === "string" ? file : await file.text(),
        );
        if (task.signal.aborted)
          throw new DOMException("Cancelled", "AbortError");
        const verified = await verifyEvaluationReport(raw, options);
        if (!verified.ok || !verified.report) throw Error(verified.reason);
        next = verified.report;
      } else {
        const manifest = createEvaluationManifest(
          scenario,
          Number(seedStart),
          Number(seedCount),
          Number(ticks),
        );
        next = await evaluateSuite(manifest, options);
      }
      if (controller.current !== task || task.signal.aborted) return;
      setReport(next);
      setInspectScenario(next.manifest.scenarios[0]);
      setInspectSeed(next.manifest.seeds[0]);
      setMessage(
        file
          ? "Imported report reproduced successfully. All recorded cases and totals match."
          : "Comparison complete. Every run passed conservation checks and exact replay.",
      );
    } catch (e) {
      if (controller.current !== task) return;
      if (task.signal.aborted) setMessage("Comparison cancelled.");
      else
        setError(
          e instanceof Error
            ? e.message
            : "This comparison could not be completed.",
        );
    } finally {
      if (controller.current === task) {
        setBusy(null);
        controller.current = null;
      }
    }
  }
  const selectedCases =
    report?.cases.filter(
      (c) =>
        c.config.scenario === inspectScenario && c.config.seed === inspectSeed,
    ) ?? [];
  const pending = report?.rows.reduce((n, row) => n + row.pending, 0) ?? 0;
  return (
    <section
      className="experiments evaluation-panel"
      aria-label="Reproducible policy evaluations"
    >
      <div className="section-heading">
        <div>
          <h2>Compare decisions across seeds.</h2>
          <p>Reproduce the outcomes. Inspect the evidence.</p>
        </div>
        <FlaskConical size={28} />
      </div>
      <form
        className="evaluation-form"
        onSubmit={(event) => {
          event.preventDefault();
          void evaluate();
        }}
      >
        <label className="evaluation-scenario">
          Scenario
          <select
            aria-label="Evaluation scenario"
            value={scenario}
            disabled={!!busy}
            onChange={(event) =>
              setScenario(event.target.value as Scenario | "all")
            }
          >
            <option value="all">All scenarios + honest controls</option>
            {Object.entries(scenarioInfo).map(([id, info]) => (
              <option key={id} value={id}>
                {info.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          First seed
          <input
            aria-label="First evaluation seed"
            type="number"
            min="0"
            max="999999"
            step="1"
            required
            value={seedStart}
            disabled={!!busy}
            onChange={(e) => setSeedStart(e.target.value)}
          />
        </label>
        <label>
          Seeds
          <input
            aria-label="Number of evaluation seeds"
            type="number"
            min="1"
            max="10"
            step="1"
            required
            value={seedCount}
            disabled={!!busy}
            onChange={(e) => setSeedCount(e.target.value)}
          />
        </label>
        <label>
          Ticks per run
          <input
            aria-label="Ticks per evaluation run"
            type="number"
            min="20"
            max="150"
            step="1"
            required
            value={ticks}
            disabled={!!busy}
            onChange={(e) => setTicks(e.target.value)}
          />
        </label>
        <div className="evaluation-actions">
          <button className="primary" type="submit" disabled={!!busy}>
            <Play size={15} />
            Run comparison
          </button>
          <button
            className="secondary"
            type="button"
            disabled={!!busy}
            onClick={() => importFile.current?.click()}
          >
            <Upload size={15} />
            Import & verify
          </button>
        </div>
      </form>
      <input
        ref={importFile}
        type="file"
        accept=".json,application/json"
        className="evaluation-file"
        aria-label="Import evaluation report"
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (file) void evaluate(file);
        }}
      />
      <details className="evaluation-method evaluation-paste">
        <summary>Verify a pasted report</summary>
        <label htmlFor="evaluation-paste">Paste compact evaluation JSON</label>
        <textarea
          id="evaluation-paste"
          value={pasted}
          maxLength={2_000_000}
          disabled={!!busy}
          onChange={(e) => setPasted(e.target.value)}
          spellCheck={false}
          placeholder="Paste an exported Settlement evaluation report"
        />
        <button
          className="secondary"
          disabled={!!busy || !pasted.trim()}
          onClick={() => void evaluate(pasted)}
        >
          <CheckCircle2 size={15} />
          Verify pasted report
        </button>
      </details>
      <p className="experiment-context">
        New comparisons use three deterministic policies, identical seeds and
        tick limits. Honest-offer controls are included once to measure the cost
        of refusing legitimate trades. No model calls or village spending.
      </p>
      {busy && (
        <div className="evaluation-progress" role="status" aria-live="polite">
          <div>
            <strong>
              {busy === "verify"
                ? "Reproducing imported evidence"
                : "Running and replaying each case"}
            </strong>
            <span>
              {progress.done} / {progress.total || "…"} runs
            </span>
          </div>
          <progress
            aria-label="Evaluation progress"
            value={progress.done}
            max={progress.total || 1}
          />
          <button
            type="button"
            className="text-button"
            onClick={() => controller.current?.abort()}
          >
            <X size={14} />
            Cancel comparison
          </button>
        </div>
      )}
      {error && (
        <p className="evaluation-error" role="alert">
          {error}
        </p>
      )}
      {message && (
        <p className="evaluation-message" role="status">
          {message}
        </p>
      )}
      {!report && !busy && !error && (
        <div className="experiment-empty">
          <div className="comparison-illustration">
            <span>Trust</span>
            <span>Question</span>
            <span>Verify</span>
          </div>
          <h3>Resistance is only half the story.</h3>
          <p>
            Compare attack outcomes and honest-offer refusals, then export a
            compact report that another person can independently reproduce.
          </p>
        </div>
      )}
      {report && (
        <>
          <div className="evaluation-report-heading">
            <div>
              <span className="evaluation-verified">
                <CheckCircle2 size={16} />
                Reproduced with engine {report.engineVersion}
              </span>
              <h3>{report.cases.length} runs. Every seed accounted for.</h3>
              <p>
                {report.manifest.seeds.length} seeds ·{" "}
                {report.manifest.maxTicks} ticks ·{" "}
                {report.manifest.scenarios.length} scenarios ·{" "}
                {report.manifest.policies.length} policies · 0 model calls
              </p>
            </div>
            <div className="evaluation-actions">
              <button
                className="secondary"
                onClick={() => exportJson(report, "settlement-evaluation.json")}
              >
                <Download size={15} />
                Export report
              </button>
              <button className="secondary" onClick={() => exportCsv(report)}>
                <Download size={15} />
                Export CSV
              </button>
            </div>
          </div>
          <div
            className="table-scroll evaluation-table"
            role="region"
            aria-label="Policy evaluation results"
            tabIndex={0}
          >
            <table>
              <thead>
                <tr>
                  <th>Scenario / policy</th>
                  <th>Successful attacks</th>
                  <th>Resisted</th>
                  <th>Unresolved</th>
                  <th>Pending</th>
                  <th>Harm</th>
                  <th>Detections</th>
                  <th>Honest refusals</th>
                  <th>Evidence checks</th>
                </tr>
              </thead>
              <tbody>
                {report.rows.map((row) => (
                  <tr key={`${row.scenario}-${row.policy}`}>
                    <td>
                      <strong>{scenarioInfo[row.scenario].name}</strong>
                      <span>
                        {policyInfo[row.policy].name} · {row.runCount} runs
                      </span>
                    </td>
                    <td>
                      {row.evaluable
                        ? `${row.successes} / ${row.evaluable}`
                        : "—"}
                      <small>{rate(row.attackSuccessRate)}</small>
                    </td>
                    <td>{row.resisted}</td>
                    <td>{row.unresolved}</td>
                    <td>{row.pending}</td>
                    <td>{row.harm}</td>
                    <td>{row.detections}</td>
                    <td>
                      {row.benignOffers
                        ? `${row.benignRefused} / ${row.benignOffers}`
                        : "—"}
                      <small>{rate(row.benignRefusalRate)}</small>
                    </td>
                    <td>{row.inspectionCount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="method-note">
            <CheckCircle2 size={16} />
            <span>
              Harm is the authored scenario’s coin-equivalent cost. Success
              rates use evaluable attacks; unresolved cases are shown separately
              from explicit resistance.{" "}
              {pending > 0
                ? `${pending} attacks are still pending at this tick limit. `
                : ""}
              Honest-refusal rates use delivered honest offers. Evidence checks
              show inspection effort. These outcomes describe these scenarios,
              not general AI safety.
            </span>
          </p>
          <div className="evaluation-inspect-heading">
            <div>
              <h3>Follow one of these runs.</h3>
              <p>
                Choose an included seed and inspect its full decision record.
              </p>
            </div>
            <div className="evaluation-case-controls">
              <label>
                Scenario
                <select
                  aria-label="Inspect evaluation scenario"
                  value={inspectScenario}
                  onChange={(e) =>
                    setInspectScenario(e.target.value as Scenario)
                  }
                >
                  {report.manifest.scenarios.map((s) => (
                    <option key={s} value={s}>
                      {scenarioInfo[s].name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Seed
                <select
                  aria-label="Inspect evaluation seed"
                  value={inspectSeed}
                  onChange={(e) => setInspectSeed(Number(e.target.value))}
                >
                  {report.manifest.seeds.map((seed) => (
                    <option key={seed} value={seed}>
                      {seed}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </div>
          <div className="policy-grid">
            {selectedCases.map((c) => (
              <article className="policy-card" key={c.config.policy}>
                <h3>{policyInfo[c.config.policy].name}</h3>
                <p>{policyInfo[c.config.policy].description}</p>
                <div className="comparison-number">
                  {c.metrics.harm}
                  <span>coin-equivalent harm · seed {c.config.seed}</span>
                </div>
                <dl>
                  <div>
                    <dt>Attacks succeeded</dt>
                    <dd>
                      {c.metrics.evaluable
                        ? `${c.metrics.successes} / ${c.metrics.evaluable}`
                        : "Not applicable"}
                    </dd>
                  </div>
                  <div>
                    <dt>Honest offers refused</dt>
                    <dd>
                      {c.metrics.benignOffers
                        ? `${c.metrics.benignRefused} / ${c.metrics.benignOffers}`
                        : "Not applicable"}
                    </dd>
                  </div>
                  <div>
                    <dt>Residents fed</dt>
                    <dd>{c.metrics.needsMet} / 6</dd>
                  </div>
                </dl>
                <button
                  className="text-button"
                  aria-label={`Inspect ${policyInfo[c.config.policy].name} run`}
                  onClick={() => onOpen(runToEnd(c.config))}
                >
                  Inspect this run
                  <ArrowUpRight size={15} />
                </button>
              </article>
            ))}
          </div>
          <details className="evaluation-method">
            <summary>Report format and reproducibility</summary>
            <p>
              The JSON report records the engine version, complete configuration
              matrix, every run’s metrics and checkpoints, evidence checksums,
              and aggregate totals. Importing it regenerates all declared runs
              and compares every record. The compact report stores recipes; the
              run inspector can export full evidence.
            </p>
            <p>
              Checksums are not signatures. Reproduction checks consistency with
              this engine, not authorship or general model robustness. CSV
              exports contain summary rows; use JSON to verify a report.
            </p>
            <p>
              Command line:{" "}
              <code>
                npm run evaluate -- --verify path/to/settlement-evaluation.json
              </code>
            </p>
          </details>
        </>
      )}
    </section>
  );
}
