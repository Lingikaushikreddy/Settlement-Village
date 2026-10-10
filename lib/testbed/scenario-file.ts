import { readFileSync } from "node:fs";
import { parseScenarioDefinition, type ScenarioDefinition } from "../sim/scenarios/index.ts";

/** Reads and validates one scenario definition file. Errors name the file and the zod path. */
export function loadScenarioFile(path: string): ScenarioDefinition {
  let json: unknown;
  try {
    json = JSON.parse(readFileSync(path, "utf8"));
  } catch (error) {
    throw new Error(`${path}: ${error instanceof Error ? error.message : String(error)}`);
  }
  try {
    return parseScenarioDefinition(json);
  } catch (error) {
    const issue = (error as { issues?: { path: (string | number)[]; message: string }[] }).issues?.[0];
    throw new Error(
      `${path}: ${issue ? `${issue.path.join(".") || "root"}: ${issue.message}` : (error as Error).message}`,
    );
  }
}
