"use client";
import { useState } from "react";
import { Lock } from "lucide-react";
import type {
  CampaignSession,
  CampaignSessionState,
} from "@/lib/game/campaign-session";

const copy: Record<string, { title: string; description: string }> = {
  blocked: {
    title: "Your village is open in another tab",
    description:
      "Close the other Settlement tab, then retry here. Your progress will load from its latest save.",
  },
  unsupported: {
    title: "This browser cannot safely save your village",
    description:
      "Use a current browser with Web Locks support, and open Settlement through localhost or HTTPS. Your saved village has not been changed.",
  },
  recovery: {
    title: "Your saved village needs attention",
    description:
      "The saved village could not be loaded. Its original data is preserved. Export a backup before choosing to replace it.",
  },
  unavailable: {
    title: "Your village save is unavailable",
    description:
      "Browser access to campaign storage or its save lock failed. Allow site storage, then retry. Your saved village has not been changed.",
  },
  checking: {
    title: "Opening your village",
    description: "Checking that your campaign can save safely on this device.",
  },
};

/** The screen shown while the campaign cannot run: lock held elsewhere, no Web Locks, damaged or unreadable save. */
export function SessionGate({
  state,
  session,
  onRetry,
}: {
  state: CampaignSessionState | "checking";
  session: CampaignSession | null;
  onRetry: () => void;
}) {
  const [confirmReplacement, setConfirmReplacement] = useState(false);
  const [recoveryError, setRecoveryError] = useState("");
  const { title, description } = copy[state] ?? copy.checking;
  function exportOriginal() {
    if (session?.rawSave == null) return;
    const url = URL.createObjectURL(
      new Blob([session.rawSave], { type: "application/json" }),
    );
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "Settlement-original-save.json";
    anchor.click();
    URL.revokeObjectURL(url);
  }
  return (
    <main className="campaign-session">
      <section
        className="campaign-session-card"
        aria-labelledby="session-title"
      >
        <p className="campaign-session-brand">SETTLEMENT · YOUR CAMPAIGN</p>
        <Lock size={30} aria-hidden="true" />
        <h1 id="session-title">{title}</h1>
        <p role="status">{description}</p>
        <div className="campaign-session-actions">
          {(state === "blocked" || state === "unavailable") && (
            <button onClick={onRetry}>
              {state === "blocked" ? "Retry after closing other tab" : "Retry"}
            </button>
          )}
          {session?.rawSave != null && state !== "blocked" && (
            <button onClick={exportOriginal}>Export original save</button>
          )}
          {state === "recovery" && !confirmReplacement && (
            <button onClick={() => setConfirmReplacement(true)}>
              Start a new village
            </button>
          )}
        </div>
        {state === "recovery" && confirmReplacement && (
          <div className="campaign-session-confirm" role="alert">
            <p>
              Replace this device’s saved village? Keep the exported backup if
              you want to recover it later.
            </p>
            <div className="campaign-session-actions">
              <button
                onClick={() => {
                  try {
                    session?.replaceDamagedSave();
                  } catch {
                    setRecoveryError(
                      "The new village could not be saved. Your original save is still preserved.",
                    );
                  }
                }}
              >
                Replace saved village
              </button>
              <button onClick={() => setConfirmReplacement(false)}>
                Keep original save
              </button>
            </div>
          </div>
        )}
        {recoveryError && <p role="alert">{recoveryError}</p>}
      </section>
    </main>
  );
}
