"use client";
import { useEffect, useState } from "react";
import { Lock } from "lucide-react";
import {
  CampaignSession,
  type CampaignSessionState,
} from "@/lib/game/campaign-session";

export type SessionView = {
  session: CampaignSession;
  state: CampaignSessionState;
  attempt: number;
};

/**
 * Opens the campaign session (Web Lock + saved game) and re-opens it on retry or
 * when the page returns from the back-forward cache.
 */
export function useCampaignSession(): {
  view: SessionView | null;
  retry: () => void;
} {
  const [attempt, setAttempt] = useState(0);
  const [view, setView] = useState<SessionView | null>(null);
  useEffect(() => {
    let disposed = false;
    const session = new CampaignSession({
      locks: navigator.locks,
      storage: {
        getItem: (key) => window.localStorage.getItem(key),
        setItem: (key, value) => window.localStorage.setItem(key, value),
      },
      onChange: (current) => {
        if (!disposed)
          setView({ session: current, state: current.state, attempt });
      },
    });
    session.start();
    const leave = () => session.close();
    const returnToPage = () => {
      // A page restored from the back-forward cache must obtain a fresh lock
      // and read the latest save before mounting its campaign again.
      if (session.state === "closed") setAttempt((value) => value + 1);
    };
    window.addEventListener("pagehide", leave);
    window.addEventListener("pageshow", returnToPage);
    return () => {
      disposed = true;
      window.removeEventListener("pagehide", leave);
      window.removeEventListener("pageshow", returnToPage);
      session.close();
    };
  }, [attempt]);
  return { view, retry: () => setAttempt((value) => value + 1) };
}

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
