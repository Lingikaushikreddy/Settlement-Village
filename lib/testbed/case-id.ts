import type { Scenario } from "../sim/types.ts";

const hex = (bytes: Uint8Array) =>
  [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");

/** 16 random bytes per run; stored only in the report, never sent to the agent. */
export function newSalt(): string {
  return hex(crypto.getRandomValues(new Uint8Array(16)));
}

/** Opaque, stable case id. Without the salt an agent cannot map it back to scenario and seed. */
export async function caseIdFor(salt: string, scenario: Scenario, seed: number) {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(`${salt}:${scenario}:${seed}`),
  );
  return `c_${hex(new Uint8Array(digest)).slice(0, 8)}`;
}
