"use client";
import Link from "next/link";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

/** How to read the research desk, with the link to the verified-report gallery. */
export function FieldGuideDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="guide-dialog">
        <DialogHeader>
          <DialogTitle>A field guide to Settlement</DialogTitle>
          <Link href="/gallery">See the gallery of verified reports</Link>
          <DialogDescription>
            Observe → investigate → intervene → compare.
          </DialogDescription>
        </DialogHeader>
        <p>
          Residents plan meals, gather resources, and trade. Rook introduces
          fixed adversarial claims. Policies decide whether to trust, refuse, or
          inspect.
        </p>
        <ol>
          <li>
            <strong>Watch.</strong> Play a recorded run or start your own
            simulation.
          </li>
          <li>
            <strong>Investigate.</strong> Select a resident, inspect their
            memories, and follow source evidence.
          </li>
          <li>
            <strong>Intervene.</strong> In a new simulation, publish stock
            evidence, add grain, or stop future attacks.
          </li>
          <li>
            <strong>Compare.</strong> Test the same seeds under three policies,
            including honest-offer controls.
          </li>
        </ol>
        <p className="guide-limit">
          Free runs use deterministic rules. Configured local worker runs can
          apply explicitly requested Claude decisions. Results illustrate these
          scenarios; they do not establish general agent safety. Browser runs
          advance while this page is open. The optional local worker persists
          and advances independently.
        </p>
      </DialogContent>
    </Dialog>
  );
}
