"use client";
import { ArrowUpRight } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import type { Run } from "@/lib/sim/types";
import { snapshotAt } from "./research-view-model";

/** The recorded evidence behind an event, with a jump to its tick. */
export function EventDialog({
  run,
  tick,
  eventId,
  onClose,
  onJump,
  onSelect,
}: {
  run: Run;
  tick: number;
  eventId: string | null;
  onClose: () => void;
  onJump: (tick: number) => void;
  onSelect: (id: string) => void;
}) {
  const activeEvent = run.events.find((e) => e.id === eventId);
  const agents = snapshotAt(run, tick).agents;
  return (
    <Dialog open={!!activeEvent} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="evidence-dialog">
        <DialogHeader>
          <DialogTitle>{activeEvent?.title}</DialogTitle>
          <DialogDescription>
            Recorded evidence · tick {activeEvent?.tick} · {activeEvent?.id}
          </DialogDescription>
        </DialogHeader>
        <blockquote>{activeEvent?.detail}</blockquote>
        <dl className="evidence-details">
          <div>
            <dt>Source</dt>
            <dd>{activeEvent?.actor}</dd>
          </div>
          <div>
            <dt>Visibility</dt>
            <dd>
              {activeEvent?.visibility === "public"
                ? "Public message"
                : "Scoped observation"}
            </dd>
          </div>
          <div>
            <dt>Observed by</dt>
            <dd>{activeEvent?.audience.join(", ")}</dd>
          </div>
        </dl>
        <p className="muted-small">
          Statements are attributed to their source. A recorded claim is not
          proof that the statement is true.
        </p>
        <button
          className="primary"
          onClick={() => {
            if (activeEvent) {
              onJump(activeEvent.tick);
              if (agents.some((a) => a.id === activeEvent.actor))
                onSelect(activeEvent.actor);
            }
            onClose();
          }}
        >
          Go to this tick <ArrowUpRight size={15} />
        </button>
      </DialogContent>
    </Dialog>
  );
}
