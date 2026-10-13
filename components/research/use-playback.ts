"use client";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { advance, runToEnd } from "@/lib/sim/engine";
import type { Intervention, Policy, Run, Scenario } from "@/lib/sim/types";
import type { ResearchMode, WorkerRun } from "./types";

type PlaybackState = {
  run: Run;
  tick: number;
  mode: ResearchMode;
  queued: Intervention | undefined;
};
export type Playback = PlaybackState & {
  last: number;
  playing: boolean;
  speed: string;
  setSpeed: (speed: string) => void;
  setPlaying: (playing: boolean) => void;
  seek: (tick: number) => void;
  step: () => void;
  queue: (action: Intervention) => void;
  openRecorded: (run: Run) => void;
  startLocal: (run: Run) => void;
  receive: (update: WorkerRun) => void;
  resetCursor: () => void;
  current: () => PlaybackState;
};

/** The only writer of the displayed run, tick, play state, mode and queued intervention. */
export function usePlayback(initial: Run): Playback {
  const [run, setRun] = useState<Run>(() => initial);
  const [tick, setTick] = useState(initial.snapshots.length - 1);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState("1");
  const [mode, setMode] = useState<ResearchMode>("recorded");
  const [queued, setQueued] = useState<Intervention>();
  const ref = useRef<PlaybackState>({ run, tick, mode, queued });
  useLayoutEffect(() => {
    ref.current = { run, tick, mode, queued };
  }, [run, tick, mode, queued]);

  // A shared ?seed= link opens that recorded run from its first tick.
  useEffect(() => {
    const timer = setTimeout(() => {
      const q = new URLSearchParams(location.search);
      if (!q.has("seed")) return;
      setRun(
        runToEnd({
          seed: Number(q.get("seed")),
          scenario: q.get("scenario") as Scenario,
          policy: q.get("policy") as Policy,
        }),
      );
      setTick(0);
    }, 0);
    return () => clearTimeout(timer);
  }, []);

  const step = useCallback(() => {
    const s = ref.current;
    const end = s.run.snapshots.length - 1;
    if (s.tick < end) {
      setTick((t) => Math.min(t + 1, end));
      return;
    }
    if (s.mode === "local" && s.run.status === "active") {
      const next = advance(s.run, s.queued);
      setRun(next);
      setTick(next.snapshots.length - 1);
      setQueued(undefined);
    } else setPlaying(false);
  }, []);

  useEffect(() => {
    if (!playing || mode === "worker") return;
    const t = setInterval(step, 1000 / Number(speed));
    return () => clearInterval(t);
  }, [playing, speed, step, mode]);

  const seek = useCallback((t: number) => {
    setPlaying(false);
    setTick(Math.max(0, Math.min(t, ref.current.run.snapshots.length - 1)));
  }, []);
  const queue = useCallback((action: Intervention) => setQueued(action), []);
  const openRecorded = useCallback((r: Run) => {
    setRun(r);
    setTick(0);
    setMode("recorded");
    setPlaying(false);
    setQueued(undefined);
  }, []);
  const startLocal = useCallback((r: Run) => {
    setPlaying(false);
    setRun(r);
    setMode("local");
  }, []);
  const receive = useCallback((u: WorkerRun) => {
    setQueued(u.queued);
    setRun(u.run);
    setMode("worker");
    setTick(u.run.snapshots.length - 1);
    setPlaying(!!u.running);
  }, []);
  const resetCursor = useCallback(() => {
    setTick(0);
    setQueued(undefined);
  }, []);
  const current = useCallback(() => ref.current, []);

  return {
    run,
    tick,
    last: run.snapshots.length - 1,
    playing,
    speed,
    mode,
    queued,
    setSpeed,
    setPlaying,
    seek,
    step,
    queue,
    openRecorded,
    startLocal,
    receive,
    resetCursor,
    current,
  };
}
