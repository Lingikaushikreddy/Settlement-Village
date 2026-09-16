import { DatabaseSync } from "node:sqlite";
import { randomUUID } from "node:crypto";
import {
  advance,
  createRun,
  normalizeConfig,
  supportedEngine,
} from "../lib/sim/engine.ts";
import type { Config, Intervention, Run } from "../lib/sim/types.ts";
export type Command = {
  id: string;
  action: "step" | "resume" | "pause" | "intervene";
  expectedVersion: number;
  intervention?: Intervention;
};
export type StoredRun = {
  run: Run;
  version: number;
  running: boolean;
  queued?: Intervention;
};
type Row = {
  id: string;
  data: string;
  version: number;
  running: number;
  queued: string | null;
};
export class RunStore {
  private db: DatabaseSync;
  constructor(path: string) {
    this.db = new DatabaseSync(path);
    this.db
      .exec(`PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=3000;
 CREATE TABLE IF NOT EXISTS runs(id TEXT PRIMARY KEY,data TEXT NOT NULL,version INTEGER NOT NULL DEFAULT 0,running INTEGER NOT NULL DEFAULT 0,queued TEXT);
 CREATE TABLE IF NOT EXISTS commands(run_id TEXT NOT NULL REFERENCES runs(id),id TEXT NOT NULL,request TEXT NOT NULL,result TEXT NOT NULL,PRIMARY KEY(run_id,id));`);
    this.db.exec(
      `CREATE TABLE IF NOT EXISTS model_requests(run_id TEXT NOT NULL REFERENCES runs(id),id TEXT NOT NULL,expected_version INTEGER NOT NULL,status TEXT NOT NULL,reserved REAL NOT NULL,cost REAL,response TEXT,result TEXT,error TEXT,day TEXT NOT NULL,PRIMARY KEY(run_id,id));`,
    );
    // No automatic paid retry after an uncertain crash. Keep the cost reservation.
    this.db
      .prepare(
        "UPDATE model_requests SET status='failed',error='Interrupted model request. Provider usage may be unknown; no automatic retry.' WHERE status='pending'",
      )
      .run();
  }
  create(config: Partial<Config>): StoredRun {
    const count = this.db.prepare("SELECT COUNT(*) AS n FROM runs").get() as {
      n: number;
    };
    if (count.n >= 100)
      throw Error(
        "Local run limit reached (100). Export and archive the database before starting another.",
      );
    const run = createRun(normalizeConfig(config));
    run.id = randomUUID();
    this.db
      .prepare("INSERT INTO runs(id,data) VALUES (?,?)")
      .run(run.id, JSON.stringify(run));
    return { run, version: 0, running: false };
  }
  get(id: string): StoredRun {
    const row = this.db.prepare("SELECT * FROM runs WHERE id=?").get(id) as
      | Row
      | undefined;
    if (!row) throw Error("Run not found");
    const run = JSON.parse(row.data) as Run;
    if (!supportedEngine(run.engineVersion))
      throw Error(
        "Run uses an incompatible engine version. Export the database and start a new run.",
      );
    return {
      run,
      version: row.version,
      running: !!row.running,
      queued: (row.queued as Intervention) || undefined,
    };
  }
  list() {
    return (
      this.db
        .prepare(
          "SELECT id,data,version,running FROM runs ORDER BY rowid DESC LIMIT 100",
        )
        .all() as Row[]
    ).map((r) => {
      const data = JSON.parse(r.data) as Run;
      return {
        id: r.id,
        name: data.name,
        config: data.config,
        tick: data.snapshots.length - 1,
        status: data.status,
        version: r.version,
        running: !!r.running,
      };
    });
  }
  active() {
    return (
      this.db.prepare("SELECT id FROM runs WHERE running=1").all() as {
        id: string;
      }[]
    ).map((r) => r.id);
  }
  private write(id: string, value: StoredRun) {
    this.db
      .prepare("UPDATE runs SET data=?,version=?,running=?,queued=? WHERE id=?")
      .run(
        JSON.stringify(value.run),
        value.version,
        value.running ? 1 : 0,
        value.queued || null,
        id,
      );
  }
  command(id: string, command: Command): StoredRun {
    if (
      !command ||
      typeof command.id !== "string" ||
      !/^[a-zA-Z0-9-]{1,100}$/.test(command.id) ||
      !Number.isInteger(command.expectedVersion) ||
      !["step", "resume", "pause", "intervene"].includes(command.action)
    )
      throw Error("Invalid command");
    if (
      command.action === "intervene" &&
      !["add-grain", "publish-stock", "pause-chaos"].includes(
        command.intervention || "",
      )
    )
      throw Error("Invalid intervention");
    const request = JSON.stringify({
      action: command.action,
      expectedVersion: command.expectedVersion,
      intervention: command.intervention,
    });
    this.db.exec("BEGIN IMMEDIATE");
    try {
      const receipt = this.db
        .prepare("SELECT request,result FROM commands WHERE run_id=? AND id=?")
        .get(id, command.id) as
        | {
            request: string;
            result: string;
          }
        | undefined;
      if (receipt) {
        if (receipt.request !== request)
          throw Error("Command ID reused with different content");
        this.db.exec("COMMIT");
        return JSON.parse(receipt.result);
      }
      const current = this.get(id);
      if (this.modelPending(id))
        throw Error("A model request is in progress. Wait for it to finish.");
      if (
        current.version !== command.expectedVersion &&
        !["pause", "resume"].includes(command.action)
      )
        throw Error(`World version conflict: expected ${current.version}`);
      if (current.run.status === "completed" && command.action !== "pause")
        throw Error("Run is completed");
      if (
        command.action === "resume" &&
        !current.running &&
        this.active().length >= 3
      )
        throw Error("Three runs are already active");
      if (command.action === "intervene" && current.queued)
        throw Error("An intervention is already queued");
      const next = { ...current, version: current.version + 1 };
      if (command.action === "step") {
        if (current.running) throw Error("Pause before single-stepping");
        next.run = advance(current.run, current.queued);
        next.queued = undefined;
      }
      if (command.action === "resume") next.running = true;
      if (command.action === "pause") next.running = false;
      if (command.action === "intervene") next.queued = command.intervention;
      if (next.run.status === "completed") next.running = false;
      this.write(id, next);
      this.db
        .prepare("INSERT INTO commands VALUES (?,?,?,?)")
        .run(id, command.id, request, JSON.stringify(next));
      this.db.exec("COMMIT");
      return next;
    } catch (e) {
      this.db.exec("ROLLBACK");
      throw e;
    }
  }
  tick(id: string): StoredRun {
    this.db.exec("BEGIN IMMEDIATE");
    try {
      const current = this.get(id);
      if (!current.running || current.run.status === "completed") {
        this.db.exec("COMMIT");
        return current;
      }
      const run = advance(current.run, current.queued);
      const next: StoredRun = {
        run,
        version: current.version + 1,
        running: run.status === "active",
      };
      this.write(id, next);
      this.db.exec("COMMIT");
      return next;
    } catch (e) {
      this.db.exec("ROLLBACK");
      throw e;
    }
  }
  modelPending(id: string) {
    return !!this.db
      .prepare(
        "SELECT 1 FROM model_requests WHERE run_id=? AND status='pending'",
      )
      .get(id);
  }
  modelUsage() {
    const day = new Date().toISOString().slice(0, 10);
    const row = this.db
      .prepare(
        "SELECT COUNT(*) AS requests,COALESCE(SUM(MAX(reserved,COALESCE(cost,0))),0) AS reservedUSD FROM model_requests WHERE day=?",
      )
      .get(day) as { requests: number; reservedUSD: number };
    return row;
  }
  modelReceipt(
    id: string,
    command: { id: string; expectedVersion: number },
  ): StoredRun | null {
    if (
      !command ||
      typeof command.id !== "string" ||
      !/^[a-zA-Z0-9-]{1,100}$/.test(command.id) ||
      !Number.isInteger(command.expectedVersion)
    )
      throw Error("Invalid model request");
    const row = this.db
      .prepare(
        "SELECT expected_version,status,result,error FROM model_requests WHERE run_id=? AND id=?",
      )
      .get(id, command.id) as
      | {
          expected_version: number;
          status: string;
          result: string | null;
          error: string | null;
        }
      | undefined;
    if (!row) return null;
    if (row.expected_version !== command.expectedVersion)
      throw Error("Model request ID reused with a different version");
    if (row.status === "completed") return JSON.parse(row.result!) as StoredRun;
    throw Error(
      row.error || "This model request is in progress; do not submit it again.",
    );
  }
  reserveModel(
    id: string,
    command: { id: string; expectedVersion: number },
    reserve: number,
    budget: number,
  ) {
    this.db.exec("BEGIN IMMEDIATE");
    try {
      if (this.modelReceipt(id, command))
        throw Error("Model request already completed");
      const current = this.get(id);
      if (current.version !== command.expectedVersion)
        throw Error("World version conflict");
      if (current.running || current.queued || current.run.status !== "active")
        throw Error(
          "Pause the run and clear queued interventions before a model step.",
        );
      if (this.modelPending(id))
        throw Error("A model request is already in progress.");
      const count = this.db
        .prepare("SELECT COUNT(*) AS n FROM model_requests WHERE run_id=?")
        .get(id) as { n: number };
      const usage = this.modelUsage();
      if (count.n >= 6 || usage.requests >= 20)
        throw Error(
          "Model call limit reached. Continue with the declared free policy.",
        );
      if (
        !Number.isFinite(reserve) ||
        reserve <= 0 ||
        usage.reservedUSD + reserve > budget
      )
        throw Error("Daily model budget exhausted before dispatch.");
      this.db
        .prepare(
          "INSERT INTO model_requests(run_id,id,expected_version,status,reserved,day) VALUES (?,?,?,'pending',?,?)",
        )
        .run(
          id,
          command.id,
          command.expectedVersion,
          reserve,
          new Date().toISOString().slice(0, 10),
        );
      this.db.exec("COMMIT");
    } catch (e) {
      this.db.exec("ROLLBACK");
      throw e;
    }
  }
  recordModelResponse(id: string, requestId: string, response: unknown) {
    this.db
      .prepare(
        "UPDATE model_requests SET response=? WHERE run_id=? AND id=? AND status='pending'",
      )
      .run(JSON.stringify(response), id, requestId);
  }
  commitModel(
    id: string,
    command: { id: string; expectedVersion: number },
    run: Run,
    cost: number,
  ): StoredRun {
    this.db.exec("BEGIN IMMEDIATE");
    try {
      const current = this.get(id);
      const request = this.db
        .prepare(
          "SELECT response FROM model_requests WHERE run_id=? AND id=? AND status='pending'",
        )
        .get(id, command.id) as { response: string | null } | undefined;
      if (!request?.response || current.version !== command.expectedVersion)
        throw Error("Model commit version conflict");
      const next: StoredRun = {
        run,
        version: current.version + 1,
        running: false,
      };
      this.write(id, next);
      this.db
        .prepare(
          "UPDATE model_requests SET status='completed',result=?,cost=? WHERE run_id=? AND id=?",
        )
        .run(JSON.stringify(next), cost, id, command.id);
      this.db.exec("COMMIT");
      return next;
    } catch (e) {
      this.db.exec("ROLLBACK");
      throw e;
    }
  }
  failModel(id: string, requestId: string, error: string) {
    this.db
      .prepare(
        "UPDATE model_requests SET status='failed',error=? WHERE run_id=? AND id=? AND status='pending'",
      )
      .run(error, id, requestId);
  }
  close() {
    this.db.close();
  }
}
