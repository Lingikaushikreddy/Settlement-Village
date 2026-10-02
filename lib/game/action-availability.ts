import { command } from "./commands.ts";
import type { BuildingKind, Command, Game } from "./model.ts";

/** Validate against the same pure command boundary used at execution time. */
export function actionProblem(game: Game, action: Command): string | null {
  try {
    command(game, action);
    return null;
  } catch (error) {
    return error instanceof Error
      ? error.message
      : "This action is unavailable.";
  }
}

/** Shop preview only: placement still validates the player's actual tile. */
export function buildProblem(game: Game, kind: BuildingKind): string | null {
  for (let y = 0; y < 9; y++)
    for (let x = 0; x < 9; x++) {
      if (!game.buildings.some((b) => b.x === x && b.y === y)) {
        return actionProblem(game, { type: "build", kind, x, y });
      }
    }
  return "There are no empty village tiles.";
}
