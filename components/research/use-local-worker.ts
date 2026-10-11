"use client";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import type {
  BuiltInPolicy,
  Intervention,
  Run,
  Scenario,
} from "@/lib/sim/types";
import type { WorkerRun } from "./types";

export const WORKER_URL = "http://127.0.0.1:8787";
// The optional research worker is reachable only from a local checkout.
export const workerOrigin = () =>
  ["http://localhost:5173", "http://127.0.0.1:5173"].includes(location.origin);

export type Provider = {
  ready: boolean;
  reason: string;
  model: string | null;
  dailyBudgetUSD: number | null;
  reservedUSD?: number;
} | null;
export type WorkerRunSummary = {
  id: string;
  name: string;
  tick: number;
  running: boolean;
};
export type NewRunConfig = {
  seed: number;
  scenario: Scenario;
  policy: BuiltInPolicy;
  maxTicks: number;
};
type Attached = {
  run: Run;
  version: number;
  running?: boolean;
  queued?: Intervention;
};

/**
 * Every request to the local worker. Runs reach the screen only through onRun.
 * `session` invalidates everything in flight when the player leaves a worker run;
 * `load` lets only the latest open or create win; `revision` drops replies older
 * than the newest run the stream or a command has delivered.
 */
export function useLocalWorker({
  listRuns,
  onRun,
  onNotice,
}: {
  listRuns: boolean;
  onRun: (update: WorkerRun) => void;
  onNotice: (text: string) => void;
}) {
  const [available, setAvailable] = useState(false);
  const [provider, setProvider] = useState<Provider>(null);
  const [runs, setRuns] = useState<WorkerRunSummary[]>([]);
  const [modelBusy, setModelBusy] = useState(false);
  const session = useRef(0);
  const load = useRef(0);
  const revision = useRef(0);
  const attachedId = useRef<string | null>(null);
  const stream = useRef<EventSource | null>(null);
  const handlers = useRef({ onRun, onNotice });
  useLayoutEffect(() => {
    handlers.current = { onRun, onNotice };
  });

  useEffect(() => {
    if (workerOrigin())
      fetch(`${WORKER_URL}/health`)
        .then((r) => r.ok && setAvailable(true))
        .catch(() => {});
    if (workerOrigin())
      fetch(`${WORKER_URL}/model/status`)
        .then((r) =>
          r.ok
            ? r.json()
            : r.status === 404
              ? {
                  ready: false,
                  reason:
                    "Restart your local worker to load the model-decision controls.",
                  model: null,
                  dailyBudgetUSD: null,
                }
              : null,
        )
        .then((data) => setProvider(data as Provider))
        .catch(() => setProvider(null));
    return () => {
      // Invalidate asynchronous requests using the current session, not the mount's value.
      // eslint-disable-next-line react-hooks/exhaustive-deps
      session.current++;
      // eslint-disable-next-line react-hooks/exhaustive-deps
      load.current++;
      stream.current?.close();
    };
  }, []);

  useEffect(() => {
    if (!workerOrigin()) return;
    if (listRuns)
      fetch(`${WORKER_URL}/runs`)
        .then(async (r) => {
          if (r.ok) {
            setAvailable(true);
            const data = (await r.json()) as { runs: WorkerRunSummary[] };
            setRuns(data.runs);
          }
        })
        .catch(() => setAvailable(false));
  }, [listRuns]);

  const attach = useCallback((data: Attached) => {
    const current = ++session.current;
    stream.current?.close();
    revision.current = data.version;
    attachedId.current = data.run.id;
    handlers.current.onRun({
      run: data.run,
      running: !!data.running,
      queued: data.queued,
    });
    const es = new EventSource(`${WORKER_URL}/runs/${data.run.id}/stream`);
    stream.current = es;
    es.onmessage = (e) => {
      const update = JSON.parse(e.data);
      if (
        current === session.current &&
        update.run &&
        update.run.id === data.run.id &&
        update.version >= revision.current
      ) {
        revision.current = update.version;
        handlers.current.onRun({
          run: update.run,
          running: update.running,
          queued: update.queued,
        });
      }
    };
    es.onerror = () => {
      if (current === session.current)
        handlers.current.onNotice(
          "Worker stream disconnected. Reconnecting automatically.",
        );
    };
  }, []);

  /** Leave the worker run: pending opens, creates and commands are ignored and the stream closes. */
  const detach = useCallback(() => {
    session.current++;
    stream.current?.close();
  }, []);

  // Shared by open and create: only the latest request of the current session may attach.
  const connect = useCallback(
    async (request: () => Promise<Attached>) => {
      const current = session.current,
        ticket = ++load.current;
      try {
        const data = await request();
        if (current !== session.current || ticket !== load.current)
          return false;
        attach(data);
        return true;
      } catch (e) {
        if (current === session.current && ticket === load.current)
          handlers.current.onNotice(
            e instanceof Error ? e.message : "Worker unavailable",
          );
        return false;
      }
    },
    [attach],
  );

  const open = useCallback(
    (id: string) =>
      connect(async () => {
        const res = await fetch(`${WORKER_URL}/runs/${id}`);
        if (!res.ok) throw Error("Cannot load worker run");
        return (await res.json()) as Attached;
      }),
    [connect],
  );

  const create = useCallback(
    (config: NewRunConfig) =>
      connect(async () => {
        const res = await fetch(`${WORKER_URL}/runs`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(config),
        });
        const data = (await res.json()) as Attached & { error?: string };
        if (!res.ok) throw Error(data.error || "Cannot create worker run");
        return data;
      }),
    [connect],
  );

  const command = useCallback(
    async (action: string, intervention?: Intervention) => {
      const current = session.current;
      const runId = attachedId.current;
      try {
        const r = await fetch(`${WORKER_URL}/runs/${runId}/commands`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: crypto.randomUUID(),
            expectedVersion: revision.current,
            action,
            intervention,
          }),
        });
        const data = (await r.json()) as Attached & {
          running: boolean;
          error?: string;
        };
        if (!r.ok) throw Error(data.error || "Worker command failed");
        if (current !== session.current) return;
        if (data.version >= revision.current) {
          revision.current = data.version;
          handlers.current.onRun({
            run: data.run,
            running: data.running,
            queued: data.queued,
          });
        }
      } catch (e) {
        if (current !== session.current) return;
        handlers.current.onNotice(
          e instanceof Error ? e.message : "Worker unavailable",
        );
      }
    },
    [],
  );

  const modelStep = useCallback(async () => {
    const current = session.current;
    const id = attachedId.current;
    setModelBusy(true);
    try {
      const response = await fetch(`${WORKER_URL}/runs/${id}/model-step`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: crypto.randomUUID(),
          expectedVersion: revision.current,
        }),
      });
      const data = (await response.json()) as Attached & { error?: string };
      if (current !== session.current) return;
      if (!response.ok) throw Error(data.error || "Model step failed.");
      attach(data);
      handlers.current.onNotice(
        "Model decision recorded and applied. Replay will reuse this response.",
      );
    } catch (error) {
      if (current === session.current)
        handlers.current.onNotice(
          error instanceof Error ? error.message : "Model step failed.",
        );
    } finally {
      setModelBusy(false);
    }
  }, [attach]);

  return {
    available,
    provider,
    runs,
    modelBusy,
    open,
    create,
    command,
    modelStep,
    detach,
  };
}

export type LocalWorker = ReturnType<typeof useLocalWorker>;
