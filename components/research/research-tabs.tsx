"use client";
import { BookOpen, Plus, ShieldAlert } from "lucide-react";
import { modeLabel, researchHeading } from "./research-view-model";
import type { ResearchMode } from "./types";

/** The desk's heading and close button, the tools nav, new-experiment and field-guide buttons, and the evidence boundary. */
export function ResearchTabs({
  view,
  mode,
  busy,
  onExit,
  onView,
  onNew,
  onHelp,
}: {
  view: string;
  mode: ResearchMode;
  busy: boolean;
  onExit: () => void;
  onView: (view: string) => void;
  onNew: () => void;
  onHelp: () => void;
}) {
  return (
    <>
      <header className="research-heading">
        <div>
          <span>Settlement / research desk</span>
          <h2>{researchHeading(view)}</h2>
        </div>
        <button
          className="research-close"
          onClick={onExit}
          aria-label="Close research and return to village"
        >
          ×
        </button>
      </header>
      <div className="research-tabs">
        <nav aria-label="Research tools">
          {[
            ["observatory", "Inspect"],
            ["experiments", "Compare"],
            ["library", "Archive"],
          ].map(([id, label]) => (
            <button
              key={id}
              aria-pressed={view === id}
              disabled={busy}
              onClick={() => onView(id)}
            >
              {label}
            </button>
          ))}
        </nav>
        <button className="primary" disabled={busy} onClick={onNew}>
          <Plus size={15} /> New experiment
        </button>
      </div>
      <button className="text-button research-help" onClick={onHelp}>
        <BookOpen size={14} /> Research field guide
      </button>
      <div className="research-boundary">
        <ShieldAlert size={16} />
        <span>{modeLabel(mode)} · village resources stay unchanged</span>
      </div>
    </>
  );
}
