"use client";
import {
  Activity,
  CheckCircle2,
  Download,
  Pause,
  Play,
  RotateCcw,
  StepForward,
} from "lucide-react";
import { Slider } from "@/components/ui/slider";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { verifyReplay } from "@/lib/sim/engine";
import type { Intervention } from "@/lib/sim/types";
import { exportJson } from "../experiments";
import { incidentEvents, playbackStatus } from "./research-view-model";
import type { Playback } from "./use-playback";

/** Transport, track with incident markers, speed and save; then the run toolbar with interventions, export and replay verification. */
export function PlaybackTimeline({
  playback,
  busy,
  onJump,
  onToggle,
  onStep,
  onIntervene,
  onSave,
  onNotice,
}: {
  playback: Playback;
  busy: boolean;
  onJump: (tick: number) => void;
  onToggle: () => void;
  onStep: () => void;
  onIntervene: (action: Intervention) => void;
  onSave: () => void;
  onNotice: (text: string) => void;
}) {
  const { run, tick, last, playing, mode, speed, queued } = playback;
  return (
    <>
      <section className="timeline" aria-label="Simulation playback">
        <div className="transport">
          <button
            className="icon-button"
            aria-label="Rewind to beginning"
            disabled={mode === "worker"}
            onClick={() => onJump(0)}
          >
            <RotateCcw size={16} />
          </button>
          <button
            className="play-button"
            aria-label={playing ? "Pause" : "Play"}
            onClick={onToggle}
            disabled={
              busy ||
              (mode === "recorded" && last === 0) ||
              (tick === last &&
                run.status === "completed" &&
                mode !== "recorded")
            }
          >
            {playing ? (
              <Pause size={16} fill="currentColor" />
            ) : (
              <Play size={16} fill="currentColor" />
            )}
          </button>
          <button
            className="icon-button"
            aria-label="Advance one tick"
            onClick={onStep}
            disabled={
              (tick === last &&
                (run.status === "completed" || mode === "recorded")) ||
              (mode === "worker" && playing) ||
              busy
            }
          >
            <StepForward size={18} />
          </button>
        </div>
        <div className="timeline-track">
          <div className="tick-label">
            <strong>Tick {tick.toString().padStart(2, "0")}</strong>
            <span>
              {run.config.maxTicks} ticks · {playbackStatus(run, tick, playing)}
            </span>
          </div>
          <Slider
            aria-label="Playback tick"
            min={0}
            max={Math.max(last, 1)}
            value={[tick]}
            onValueChange={(v) => onJump(v[0])}
            disabled={last === 0 || mode === "worker" || busy}
          />
          <div className="incident-markers">
            {incidentEvents(run).map((e) => (
              <button
                key={e.id}
                aria-label={`Go to incident at tick ${e.tick}`}
                title={`Incident at tick ${e.tick}`}
                onClick={() => onJump(e.tick)}
                style={{ left: `${(e.tick / Math.max(last, 1)) * 100}%` }}
              />
            ))}
          </div>
        </div>
        <Select value={speed} onValueChange={playback.setSpeed}>
          <SelectTrigger
            aria-label="Playback speed"
            disabled={mode === "worker"}
            className="speed-select"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {["1", "2", "4"].map((v) => (
              <SelectItem key={v} value={v}>
                {v}× speed
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <button className="secondary save-run" onClick={onSave}>
          Save run
        </button>
      </section>
      <div className="run-toolbar">
        <span>
          <Activity size={14} />
          {run.modelCalls
            ? "Model-assisted decisions"
            : "Rule-based decisions"}{" "}
          · {run.modelCalls} model calls · ${run.estimatedCost.toFixed(4)}{" "}
          estimated API cost
        </span>
        <div>
          {mode !== "recorded" && run.status === "active" && (
            <Select
              value=""
              disabled={busy}
              onValueChange={(v) => onIntervene(v as Intervention)}
            >
              <SelectTrigger aria-label="Intervene in simulation">
                <SelectValue
                  placeholder={queued ? "Intervention queued" : "Intervene"}
                />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="add-grain">Add 12 grain</SelectItem>
                <SelectItem value="publish-stock">
                  Publish verified stock
                </SelectItem>
                <SelectItem value="pause-chaos">
                  Stop future Chaos attempts
                </SelectItem>
              </SelectContent>
            </Select>
          )}
          <button
            className="text-button"
            onClick={() => exportJson(run, `${run.id}.json`)}
          >
            <Download size={14} />
            Export run
          </button>
          <button
            className="text-button"
            onClick={() => {
              const result = verifyReplay(run);
              onNotice(
                result.ok
                  ? "Replay verified: every checkpoint matches."
                  : result.reason,
              );
            }}
          >
            <CheckCircle2 size={14} />
            Verify replay
          </button>
        </div>
      </div>
    </>
  );
}
