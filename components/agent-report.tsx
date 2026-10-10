"use client";
import { ArrowUpRight, ShieldCheck } from "lucide-react";
import { policyInfo } from "@/lib/sim/engine";
import { scenarioLabel } from "@/lib/sim/scenario-label";
import type { ScenarioDefinition } from "@/lib/sim/scenario-schema";
import type { Run } from "@/lib/sim/types";
import type { AgentReport } from "@/lib/testbed/report";

const ratio = (n: number, d: number) => (d ? `${n} / ${d}` : "Not applicable");

export function AgentReportView({
  report,
  runs,
  onOpen,
}: {
  report: AgentReport;
  runs: Run[];
  onOpen: (run: Run) => void;
}) {
  const definitions =
    (report.manifest as { definitions?: ScenarioDefinition[] }).definitions ?? [];
  const definitionOf = (id: string) => definitions.find((d) => d.id === id);
  return (
    <div className="agent-report">
      <p className="evaluation-message" role="status">
        <ShieldCheck size={16} />
        <span>
          Verified: every case was rebuilt from the recorded answers of{" "}
          <strong>{report.agent.name}</strong>.
        </span>
      </p>
      <p className="muted-small">
        {report.totals.decisions} decisions · {report.totals.invalid} invalid ·
        mean latency {report.totals.meanLatencyMs} ms (self-reported)
      </p>
      <div
        className="table-scroll evaluation-table"
        role="region"
        aria-label="Agent results against the built-in policies"
        tabIndex={0}
      >
        <table>
          <thead>
            <tr>
              <th scope="col">Scenario</th>
              <th scope="col">Decider</th>
              <th scope="col">Attacks succeeded</th>
              <th scope="col">Honest offers refused or unanswered</th>
              <th scope="col">Invalid answers</th>
            </tr>
          </thead>
          <tbody>
            {report.rows.flatMap((row) => [
              <tr key={`${row.scenario}-agent`} className="agent-row">
                <td>{scenarioLabel(row.scenario, definitionOf(row.scenario))}</td>
                <td>{report.agent.name}</td>
                <td>{ratio(row.successes, row.evaluable)}</td>
                <td>{ratio(row.benignRefused + row.honestUnanswered, row.benignOffers)}</td>
                <td>{ratio(row.invalidDecisions, row.decisions)}</td>
              </tr>,
              ...report.baselines
                .filter((b) => b.scenario === row.scenario)
                .map((b) => (
                  <tr key={`${row.scenario}-${b.policy}`}>
                    <td>
                      <span className="sr-only">{scenarioLabel(row.scenario, definitionOf(row.scenario))}</span>
                    </td>
                    <td>{policyInfo[b.policy].name}</td>
                    <td>{ratio(b.successes, b.evaluable)}</td>
                    <td>{ratio(b.benignRefused, b.benignOffers)}</td>
                    <td>—</td>
                  </tr>
                )),
            ])}
          </tbody>
        </table>
      </div>
      <ul className="agent-report-notes">
        {report.notes.map((note) => (
          <li key={note}>{note}</li>
        ))}
      </ul>
      <div className="policy-grid">
        {report.cases.map((c, i) => {
          const invalid = c.transcript.filter((t) => t.answer.status === "invalid").length;
          const name = `${scenarioLabel(c.config.scenario, definitionOf(c.config.scenario))} · seed ${c.config.seed}`;
          return (
            <article className="policy-card" key={c.caseId}>
              <h3>{name}</h3>
              <dl>
                <div>
                  <dt>Attacks succeeded</dt>
                  <dd>{ratio(c.metrics.successes, c.metrics.evaluable)}</dd>
                </div>
                <div>
                  <dt>Honest offers refused or unanswered</dt>
                  <dd>{ratio(c.honest.refused + c.honest.unanswered, c.honest.offers)}</dd>
                </div>
                <div>
                  <dt>Invalid answers</dt>
                  <dd>{ratio(invalid, c.transcript.length)}</dd>
                </div>
              </dl>
              <button
                className="text-button"
                aria-label={`Inspect ${name}`}
                onClick={() => onOpen(runs[i])}
              >
                Inspect case
                <ArrowUpRight size={15} />
              </button>
            </article>
          );
        })}
      </div>
    </div>
  );
}
