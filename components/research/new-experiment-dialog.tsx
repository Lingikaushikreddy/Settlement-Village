"use client";
import { useState } from "react";
import { CheckCircle2, Play, Server } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { policyInfo, scenarioInfo } from "@/lib/sim/engine";
import { scenarioDescription } from "@/lib/sim/scenario-label";
import type { BuiltInPolicy, Scenario } from "@/lib/sim/types";
import { parseSeed } from "./research-view-model";
import type { NewRunConfig } from "./use-local-worker";

/** Scenario, policy and seed for a new simulation, run in the browser or on the local worker. */
export function NewExperimentDialog({
  open,
  onOpenChange,
  workerAvailable,
  onStart,
  onNotice,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workerAvailable: boolean;
  onStart: (config: NewRunConfig, useWorker: boolean) => Promise<void>;
  onNotice: (text: string) => void;
}) {
  const [draftScenario, setDraftScenario] = useState<Scenario>("scarcity");
  const [draftPolicy, setDraftPolicy] = useState<BuiltInPolicy>("baseline");
  const [draftSeed, setDraftSeed] = useState("42");
  const [starting, setStarting] = useState(false);
  async function start(useWorker = false) {
    const seed = parseSeed(draftSeed);
    if (seed === null) {
      onNotice("Choose a whole-number seed from 0 to 999999.");
      return;
    }
    setStarting(true);
    try {
      await onStart(
        { seed, scenario: draftScenario, policy: draftPolicy, maxTicks: 60 },
        useWorker,
      );
    } finally {
      setStarting(false);
    }
  }
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="new-run-dialog">
        <DialogHeader>
          <DialogTitle>Start a new simulation</DialogTitle>
          <DialogDescription>
            Seven agents. One village. A new set of choices.
          </DialogDescription>
        </DialogHeader>
        <div className="form-field">
          <label>Scenario</label>
          <Select
            value={draftScenario}
            onValueChange={(v) => setDraftScenario(v as Scenario)}
          >
            <SelectTrigger aria-label="New run scenario">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(scenarioInfo).map(([id, s]) => (
                <SelectItem key={id} value={id}>
                  {s.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p>{scenarioDescription(draftScenario)}</p>
        </div>
        <div className="form-field">
          <label>Resident policy</label>
          <Select
            value={draftPolicy}
            onValueChange={(v) => setDraftPolicy(v as BuiltInPolicy)}
          >
            <SelectTrigger aria-label="New run policy">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(policyInfo).map(([id, p]) => (
                <SelectItem key={id} value={id}>
                  {p.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p>{policyInfo[draftPolicy].description}</p>
        </div>
        <div className="form-field">
          <label htmlFor="seed">World seed</label>
          <input
            id="seed"
            type="number"
            min="0"
            max="999999"
            value={draftSeed}
            onChange={(e) => setDraftSeed(e.target.value)}
          />
          <p>Matching seeds reproduce the same starting conditions.</p>
        </div>
        <div className="simulation-note">
          <CheckCircle2 size={17} />
          <span>No paid AI calls. Runs for 60 ticks in this browser.</span>
        </div>
        <button
          className="primary"
          disabled={starting}
          onClick={() => void start()}
        >
          <Play size={16} />
          Create simulation
        </button>
        {workerAvailable && (
          <button
            className="secondary"
            disabled={starting}
            onClick={() => void start(true)}
          >
            <Server size={16} />
            Create on local worker
          </button>
        )}
      </DialogContent>
    </Dialog>
  );
}
