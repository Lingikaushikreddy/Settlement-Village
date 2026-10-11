"use client";
import { useEffect, useLayoutEffect, useRef } from "react";
import { metrics } from "@/lib/sim/engine";
import type { Run } from "@/lib/sim/types";
import type { ResearchMode } from "./types";

type ModelContext = {
  registerTool: (
    tool: unknown,
    options: { signal: AbortSignal },
  ) => Promise<void> | void;
};

/**
 * Registers two tools with an in-page model context (document.modelContext) when the browser
 * provides one: read the visible run's status and metrics, and seek recorded playback to a tick.
 */
export function useModelContextTools(
  state: () => { run: Run; tick: number; mode: ResearchMode },
  jump: (tick: number) => void,
) {
  const latest = useRef({ state, jump });
  useLayoutEffect(() => {
    latest.current = { state, jump };
  });
  useEffect(() => {
    const mc = (document as unknown as { modelContext?: ModelContext })
      .modelContext;
    if (!mc?.registerTool) return;
    const lifecycle = new AbortController();
    Promise.resolve(
      mc.registerTool(
        {
          name: "settlement_inspect_run",
          description: "Read the visible run status and incident metrics.",
          inputSchema: {
            type: "object",
            properties: {},
            additionalProperties: false,
          },
          annotations: { readOnlyHint: true },
          execute: () => {
            const s = latest.current.state();
            return {
              tick: s.tick,
              mode: s.mode,
              metrics: metrics(s.run, s.tick),
              config: s.run.config,
            };
          },
        },
        { signal: lifecycle.signal },
      ),
    ).catch(() => {});
    Promise.resolve(
      mc.registerTool(
        {
          name: "settlement_seek_tick",
          description:
            "Move recorded playback to an existing tick and pause playback.",
          inputSchema: {
            type: "object",
            properties: { tick: { type: "integer", minimum: 0, maximum: 150 } },
            required: ["tick"],
            additionalProperties: false,
          },
          annotations: { readOnlyHint: false },
          execute: (input: unknown) => {
            const n = (input as { tick: number })?.tick;
            if (
              !Number.isInteger(n) ||
              n < 0 ||
              n >= latest.current.state().run.snapshots.length
            )
              throw Error("Tick is outside the recorded run");
            latest.current.jump(n);
            return { tick: n };
          },
        },
        { signal: lifecycle.signal },
      ),
    ).catch(() => {});
    return () => lifecycle.abort();
  }, []);
}
