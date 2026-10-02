"use client";

import {
  Check,
  ChevronRight,
  Coins,
  Hammer,
  LockKeyhole,
  MapPin,
  Sprout,
  TreePine,
  Wheat,
  X,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { crewPreview } from "@/lib/game/crew";
import { developmentSteps } from "@/lib/game/development";
import type { DevelopmentPlan } from "@/lib/game/development";
import type { Game, Resources } from "@/lib/game/model";
import "./development-panel.css";

const resources = [
  { key: "gold", label: "Gold", Icon: Coins },
  { key: "wood", label: "Timber", Icon: TreePine },
  { key: "food", label: "Food", Icon: Wheat },
] as const;

const stateLabels = {
  pending: "Prerequisite first",
  ready: "Ready for a resident",
  blocked: "Waiting",
  building: "Under construction",
  complete: "Complete",
};

export function ResourceAmounts({ value }: { value: Resources }) {
  const amounts = resources.filter(({ key }) => value[key] > 0);
  if (!amounts.length) return <span className="crew-no-cost">No spending</span>;
  return (
    <span className="crew-amounts">
      {amounts.map(({ key, label, Icon }) => (
        <span key={key}>
          <Icon size={13} aria-hidden="true" />
          {Math.ceil(value[key]).toLocaleString()}{" "}
          <span>{label.toLowerCase()}</span>
        </span>
      ))}
    </span>
  );
}

export function DevelopmentSteps({
  game,
  plan,
}: {
  game: Game;
  plan: DevelopmentPlan;
}) {
  const steps = developmentSteps(game, plan);
  return (
    <ol className="development-steps" aria-label="Village development steps">
      {steps.map((step, index) => (
        <li key={step.id} className={`development-step ${step.status}`}>
          <span className="development-step-number" aria-hidden="true">
            {step.status === "complete" ? <Check size={17} /> : index + 1}
          </span>
          <div>
            <div className="development-step-heading">
              <h4>{step.label}</h4>
              <span className="development-step-state">
                {stateLabels[step.status]}
              </span>
            </div>
            <ResourceAmounts value={step.cost} />
            {step.dependsOn.length > 0 && (
              <p className="development-dependency">
                <LockKeyhole size={12} aria-hidden="true" />
                After{" "}
                {step.dependsOn
                  .map(
                    (id) =>
                      plan.steps.find((item) => item.id === id)?.label ?? id,
                  )
                  .join(" and ")}
              </p>
            )}
            {step.reason && <p className="development-reason">{step.reason}</p>}
            {step.x !== undefined && step.y !== undefined && (
              <span className="development-location">
                <MapPin size={12} aria-hidden="true" /> Tile {step.x}, {step.y}
              </span>
            )}
          </div>
        </li>
      ))}
    </ol>
  );
}

export function DevelopmentBudget({
  budget,
  spent,
  reserves,
}: {
  budget: Resources;
  spent?: Resources;
  reserves: Resources;
}) {
  return (
    <div className="development-budget">
      <div className="development-budget-heading">
        <h3>{spent ? "The village purse" : "Your spending ceiling"}</h3>
        <span>{spent ? "Spent / approved" : "For the whole plan"}</span>
      </div>
      <div className="development-budget-grid">
        {resources.map(({ key, label, Icon }) => (
          <div key={key}>
            <Icon size={18} aria-hidden="true" />
            <span>{label}</span>
            <strong>
              {spent && (
                <>
                  {Math.ceil(spent[key]).toLocaleString()} <small>/</small>{" "}
                </>
              )}
              {Math.ceil(budget[key]).toLocaleString()}
            </strong>
          </div>
        ))}
      </div>
      <p>
        <LockKeyhole size={13} aria-hidden="true" /> Kept in reserve{" "}
        <ResourceAmounts value={reserves} />
      </p>
    </div>
  );
}

export function DevelopmentDialog({
  game,
  onStart,
  onClose,
  onReturnFocus,
}: {
  game: Game;
  onStart: () => void;
  onClose: () => void;
  onReturnFocus?: () => void;
}) {
  const preview = crewPreview(game, "develop");
  const plan = preview.development;
  if (!plan) return null;
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        className="development-dialog"
        showCloseButton={false}
        onCloseAutoFocus={(event) => {
          if (onReturnFocus) {
            event.preventDefault();
            onReturnFocus();
          }
        }}
      >
        <header className="development-heading">
          <div>
            <span>
              <Sprout size={16} aria-hidden="true" /> Village development
            </span>
            <DialogTitle>Grow the village</DialogTitle>
            <DialogDescription>
              Give your residents a plan worth building together.
            </DialogDescription>
          </div>
          <button onClick={onClose} aria-label="Close development plan">
            <X size={20} />
          </button>
        </header>
        <div className="development-content">
          <div className="development-outcome">
            <span className="development-farm-art" aria-hidden="true" />
            <div>
              <h3>A new farm. A stronger village.</h3>
              <p>
                Build one additional farm and raise it to level 3. Your
                residents collect supplies, choose a reachable site, and arrange
                the Town hall upgrade it needs.
              </p>
            </div>
          </div>
          <DevelopmentBudget
            budget={preview.budget}
            reserves={plan.reserveFloor}
          />
          <section
            className="development-plan-section"
            aria-label="Planned construction"
          >
            <div className="development-section-heading">
              <Hammer size={18} aria-hidden="true" />
              <h3>The building plan</h3>
            </div>
            <DevelopmentSteps game={game} plan={plan} />
          </section>
          <p className="development-note">
            Costs update until you start, then the plan and budget are fixed.
            The crew waits for supplies or a free builder when needed. You can
            pause or cancel; work already built stays in your village.
          </p>
        </div>
        <footer className="development-footer">
          <button className="development-back" onClick={onClose}>
            Back to village
          </button>
          <button className="development-confirm" onClick={onStart}>
            <Sprout size={17} aria-hidden="true" /> Start village development{" "}
            <ChevronRight size={17} aria-hidden="true" />
          </button>
        </footer>
      </DialogContent>
    </Dialog>
  );
}
