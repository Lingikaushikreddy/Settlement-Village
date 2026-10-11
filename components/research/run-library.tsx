"use client";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Download, Library, Play, Sprout, Users } from "lucide-react";
import { policyName, runToEnd } from "@/lib/sim/engine";
import type { Run } from "@/lib/sim/types";
import { exportJson } from "../experiments";
import { addToLibrary, parseSavedLibrary } from "./research-view-model";
import type { WorkerRunSummary } from "./use-local-worker";

const STORAGE = "settlement-library-v1";
const defaultRun = () =>
  runToEnd({
    seed: 42,
    scenario: "scarcity",
    policy: "baseline",
    maxTicks: 60,
  });

/** Saved runs in this browser: loaded once (only runs that replay exactly) and saved newest first. */
export function useSavedRuns(onNotice: (text: string) => void) {
  const [runs, setRuns] = useState<Run[]>([]);
  const notify = useRef(onNotice);
  useLayoutEffect(() => {
    notify.current = onNotice;
  });
  useEffect(() => {
    const hydrate = setTimeout(() => {
      let stored: { runs: Run[]; error: boolean };
      try {
        stored = parseSavedLibrary(localStorage.getItem(STORAGE));
      } catch {
        stored = { runs: [], error: true };
      }
      if (stored.error)
        notify.current(
          "Saved runs could not be read. You can still start a new simulation.",
        );
      else setRuns(stored.runs);
    }, 0);
    return () => clearTimeout(hydrate);
  }, []);
  function save(run: Run) {
    try {
      const next = addToLibrary(runs, run);
      localStorage.setItem(STORAGE, JSON.stringify(next));
      setRuns(next);
      notify.current(
        "Run saved to this browser. Export a copy to keep it elsewhere.",
      );
    } catch {
      notify.current("Browser storage is full. Use Export run to save a file.");
    }
  }
  return { runs, save };
}

/** The archive: the campaign's record, the reference run, local-worker runs and saved runs, with open and export. */
export function RunLibrary({
  currentRun,
  saved,
  workerRuns,
  onOpen,
  onOpenWorker,
}: {
  currentRun: Run;
  saved: Run[];
  workerRuns: WorkerRunSummary[];
  onOpen: (run: Run) => void;
  onOpenWorker: (id: string) => void;
}) {
  return (
    <section className="library-panel">
      <div className="section-heading">
        <div>
          <h2>Your run library</h2>
          <p>Saved in this browser. Export a file for a durable copy.</p>
        </div>
        <Library size={26} />
      </div>
      <article className="library-feature">
        <span className="feature-icon">
          <Users size={28} />
        </span>
        <div>
          <span className="muted-small">From your playable village</span>
          <h3>{currentRun.name}</h3>
          <p>
            Chapter record · {currentRun.snapshots.length - 1} ticks · village
            progress preserved
          </p>
        </div>
        <button className="primary" onClick={() => onOpen(currentRun)}>
          Inspect village record
        </button>
      </article>
      <article className="library-feature">
        <span className="feature-icon">
          <Sprout size={32} />
        </span>
        <div>
          <span className="muted-small">Included reference run</span>
          <h3>The Missing Grain</h3>
          <p>Seed 42 · Trust first · 60 ticks</p>
        </div>
        <button className="primary" onClick={() => onOpen(defaultRun())}>
          <Play size={14} />
          Open replay
        </button>
      </article>
      {workerRuns.length > 0 && (
        <div className="worker-library">
          <h3>On your local worker</h3>
          <p className="muted-small">
            Stored in SQLite. Resume across page reloads and worker restarts.
          </p>
          {workerRuns.map((r) => (
            <article className="library-row" key={r.id}>
              <div>
                <h3>{r.name}</h3>
                <p>
                  Tick {r.tick} · {r.running ? "Running" : "Paused"}
                </p>
              </div>
              <button className="secondary" onClick={() => onOpenWorker(r.id)}>
                Connect to run
              </button>
            </article>
          ))}
        </div>
      )}
      {saved.length === 0 ? (
        <div className="quiet-state">
          <Library size={24} />
          <h3>A place for your discoveries.</h3>
          <p>Choose “Save run” in the observatory to keep a simulation here.</p>
        </div>
      ) : (
        saved.map((r) => (
          <article className="library-row" key={r.id}>
            <div>
              <h3>{r.name}</h3>
              <p>
                Seed {r.config.seed} · {policyName(r.config.policy)} ·{" "}
                {r.snapshots.length - 1} ticks
              </p>
            </div>
            <button className="secondary" onClick={() => onOpen(r)}>
              Open replay
            </button>
            <button
              className="icon-button"
              aria-label={`Export ${r.name}`}
              onClick={() => exportJson(r, `${r.id}.json`)}
            >
              <Download size={16} />
            </button>
          </article>
        ))
      )}
    </section>
  );
}
