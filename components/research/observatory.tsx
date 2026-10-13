"use client";
import { useEffect, useState } from "react";
import { CheckCircle2 } from "lucide-react";
import { Experiments } from "../experiments";
import { createRun } from "@/lib/sim/engine";
import type { Run, Intervention } from "@/lib/sim/types";
import type { ResearchFrame } from "./types";
import { usePlayback } from "./use-playback";
import { useModelContextTools } from "./use-model-context";
import { useLocalWorker, type NewRunConfig } from "./use-local-worker";
import { NewExperimentDialog } from "./new-experiment-dialog";
import { EventDialog } from "./event-dialog";
import { FieldGuideDialog } from "./field-guide-dialog";
import { ResearchTabs } from "./research-tabs";
import { RunOverview } from "./run-overview";
import { PlaybackTimeline } from "./playback-timeline";
import { ModelReadiness } from "./model-readiness";
import { ActivityPanel } from "./activity-panel";
import { MetricsPanel } from "./metrics-panel";
import { RunLibrary, useSavedRuns } from "./run-library";

export function Observatory({
  currentRun,
  section,
  onSection,
  selectedResident,
  onSelected,
  onFrame,
  onExit,
}: {
  currentRun: Run;
  section: string;
  onSection: (section: string) => void;
  selectedResident: string;
  onSelected: (id: string) => void;
  onFrame: (frame: ResearchFrame) => void;
  onExit: () => void;
}) {
  const playback = usePlayback(currentRun);
  const { run, tick, playing, mode, queued } = playback;
  const [newOpen, setNewOpen] = useState(false),
    [helpOpen, setHelpOpen] = useState(false),
    [eventId, setEventId] = useState<string | null>(null),
    [notice, setNotice] = useState("");
  const selected = selectedResident,
    select = onSelected,
    view = section,
    setView = onSection;
  const saved = useSavedRuns(setNotice);
  const worker = useLocalWorker({
    listRuns: view === "library" || newOpen,
    listKey: `${view}:${newOpen}`,
    onRun: playback.receive,
    onNotice: setNotice,
  });
  useEffect(() => {
    onFrame({ run, tick, selected, mode });
  }, [run, tick, selected, mode, onFrame]);
  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(""), 6000);
    return () => clearTimeout(t);
  }, [notice]);

  const step =
    mode === "worker" ? () => void worker.command("step") : playback.step;
  function openRun(r: Run) {
    worker.detach();
    playback.openRecorded(r);
    setView("observatory");
    select("mira");
  }
  async function start(config: NewRunConfig, useWorker: boolean) {
    if (useWorker) {
      if (!(await worker.create(config))) return;
    } else {
      worker.detach();
      playback.startLocal({
        ...createRun(config),
        id: `local-${crypto.randomUUID()}`,
      });
    }
    playback.resetCursor();
    setView("observatory");
    setNewOpen(false);
    select("mira");
  }
  function jump(t: number) {
    if (playback.current().mode === "worker") {
      setNotice("Save this worker run, then open its replay to rewind.");
      return;
    }
    playback.seek(t);
  }
  function toggle() {
    if (mode === "worker") {
      void worker.command(playing ? "pause" : "resume");
    } else playback.setPlaying(!playing);
  }
  function intervene(action: Intervention) {
    if (mode === "worker") {
      void worker.command("intervene", action);
    } else {
      playback.queue(action);
      setNotice("Intervention queued for the next new tick.");
    }
  }
  useModelContextTools(playback.current, jump);
  return (
    <section className="settlement unified-research">
      <ResearchTabs
        view={view}
        mode={mode}
        busy={worker.modelBusy}
        onExit={onExit}
        onView={(id) => {
          if (mode !== "worker") playback.setPlaying(false);
          setView(id);
        }}
        onNew={() => setNewOpen(true)}
        onHelp={() => setHelpOpen(true)}
      />
      {view === "observatory" && (
        <>
          <RunOverview
            run={run}
            tick={tick}
            mode={mode}
            selected={selected}
            onSelect={select}
            onJump={jump}
            onEvidence={setEventId}
            onNotice={setNotice}
          />
          <PlaybackTimeline
            playback={playback}
            busy={worker.modelBusy}
            onJump={jump}
            onToggle={toggle}
            onStep={step}
            onIntervene={intervene}
            onSave={() => saved.save(run)}
            onNotice={setNotice}
          />
          <ModelReadiness
            run={run}
            tick={tick}
            mode={mode}
            playing={playing}
            queued={!!queued}
            provider={worker.provider}
            busy={worker.modelBusy}
            onAsk={() => void worker.modelStep()}
          />
          <div className="lower-grid">
            <ActivityPanel
              run={run}
              tick={tick}
              mode={mode}
              onJump={jump}
              onToggle={toggle}
              onNew={() => setNewOpen(true)}
              onSelect={select}
              onEvidence={setEventId}
            />
            <MetricsPanel
              run={run}
              tick={tick}
              onCompare={() => setView("experiments")}
            />
          </div>
        </>
      )}
      {view === "experiments" && <Experiments onOpen={openRun} />}
      {view === "library" && (
        <RunLibrary
          currentRun={currentRun}
          saved={saved.runs}
          workerRuns={worker.available ? worker.runs : []}
          onOpen={openRun}
          onOpenWorker={(id) =>
            void worker.open(id).then((ok) => ok && setView("observatory"))
          }
        />
      )}
      <footer className="site-footer">
        <span>
          Settlement <span className="footer-leaf">✳</span> A village of
          choices.
        </span>
        <span>Built to be observed. Designed to be questioned.</span>
      </footer>
      <NewExperimentDialog
        open={newOpen}
        onOpenChange={setNewOpen}
        workerAvailable={worker.available}
        onStart={start}
        onNotice={setNotice}
      />
      <EventDialog
        run={run}
        tick={tick}
        eventId={eventId}
        onClose={() => setEventId(null)}
        onJump={jump}
        onSelect={select}
      />
      <FieldGuideDialog open={helpOpen} onOpenChange={setHelpOpen} />
      {notice && (
        <div className="notice" role="status">
          <CheckCircle2 size={17} />
          {notice}
          <button
            aria-label="Dismiss notification"
            onClick={() => setNotice("")}
          >
            ×
          </button>
        </div>
      )}
    </section>
  );
}
