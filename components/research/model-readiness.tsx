"use client";
import { useSyncExternalStore } from "react";
import { Sparkles } from "lucide-react";
import type { Run } from "@/lib/sim/types";
import { canAskModel, nameIn, snapshotAt } from "./research-view-model";
import { workerOrigin, type Provider } from "./use-local-worker";
import type { ResearchMode } from "./types";

const RUN_LOCALLY =
  "https://github.com/Lingikaushikreddy/Settlement-Village#run-locally";
const noSubscription = () => () => {};

/** Live model decisions: why they are or are not available, the ask button, and the decisions recorded so far. */
export function ModelReadiness({
  run,
  tick,
  mode,
  playing,
  queued,
  provider,
  busy,
  onAsk,
}: {
  run: Run;
  tick: number;
  mode: ResearchMode;
  playing: boolean;
  queued: boolean;
  provider: Provider;
  busy: boolean;
  onAsk: () => void;
}) {
  const hosted = useSyncExternalStore(
    noSubscription,
    () => !workerOrigin(),
    () => false,
  );
  const agents = snapshotAt(run, tick).agents;
  return (
    <section className="model-readiness">
      <div>
        <Sparkles size={20} />
        <span>
          <strong>Live model decisions</strong>
          <small>
            {provider?.reason ??
              (hosted ? (
                <>
                  You&apos;re playing the hosted demo. Free simulations,
                  comparisons and replays run here in your browser. Live-model
                  experiments need the optional local worker — see{" "}
                  <a href={RUN_LOCALLY} target="_blank" rel="noreferrer">
                    Run locally
                  </a>
                  .
                </>
              ) : (
                "Free policies are active. Start the optional local worker to configure model decisions."
              ))}
          </small>
        </span>
      </div>
      {provider?.ready && (
        <p>
          {provider.model} · daily budget ${provider.dailyBudgetUSD} · six
          requests per run maximum. Each model step sends this recipient’s
          visible evidence to Claude and may incur API cost.
        </p>
      )}
      <button
        className="secondary"
        disabled={
          !canAskModel({
            ready: !!provider?.ready,
            mode,
            playing,
            queued,
            busy: busy,
            run,
            tick,
          })
        }
        onClick={onAsk}
      >
        <Sparkles size={15} />
        {busy
          ? "Evaluating the next decision…"
          : "Ask Claude to decide next tick"}
      </button>
      {mode !== "worker" && (
        <small>
          Create an experiment on the local worker to use configured model
          decisions.
        </small>
      )}
      {run.socialDecisions
        ?.filter((d) => d.tick <= tick)
        .map((d) => (
          <details key={`${d.tick}-${d.actor}`}>
            <summary>
              Tick {d.tick} · {nameIn(agents, d.actor)} ·{" "}
              {d.action === "invalid"
                ? `no valid answer (${d.invalidReason?.replaceAll("_", " ") ?? "invalid"})`
                : d.action.replaceAll("_", " ")}{" "}
              ·{" "}
              {run.config.policy === "external"
                ? `${d.model} decision`
                : "model proposal"}
            </summary>
            {d.summary && <p>{d.summary}</p>}
            {d.evidenceIds.length > 0 && (
              <small>Cited evidence: {d.evidenceIds.join(", ")}</small>
            )}
            {run.config.policy !== "external" && (
              <small>
                {d.model} · {d.usage.inputTokens} input / {d.usage.outputTokens}{" "}
                output tokens · ${d.costUSD.toFixed(4)} estimated
              </small>
            )}
          </details>
        ))}
    </section>
  );
}
