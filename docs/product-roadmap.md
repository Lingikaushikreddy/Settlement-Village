# Product direction and acceptance criteria

Settlement is a local single-player village strategy game and an inspectable multi-agent research lab. The player sets an objective; six residents coordinate real collection and recruitment through validated game commands. Research worlds support reproducible policy comparisons without spending campaign currency.

This document refines the September 17 product brief against the implemented code. It keeps the game's practical reliability and the credibility of its research results ahead of adding broader AI claims.

## Implemented foundation

- Two crew objectives, exclusive job claims, grid navigation, rest handoffs, bounded practice, memories and an action log.
- Building, production, recruitment and player-commanded raids, with the same resource validation for agents and manual actions.
- Four authored Council/research scenarios, including adversarial scarcity, reputation and instruction-injection attempts, plus honest offers.
- Optional Claude proposals only for explicit steps in configured local-worker research experiments. Free campaign and comparison policies remain deterministic.
- Versioned campaign saves and deterministic research replay. Crew continuation is deterministic, but its bounded gameplay log is not a complete replay archive. Crew memories and Council evidence are separate records.

The crew's bid combines role suitability and bounded experience, then subtracts walking distance; it does not multiply those factors. The social research planner and campaign job board are separate components with different scopes.

## Reliability and evaluation increment — v0.2.0

The adversarial-versus-honest comparison milestone already existed in v0.1.0. This increment makes its evidence easier to reproduce and fixes a practical save-loss path:

- Shared browser/CLI evaluator with manifest bounds, individual case records, exact reproduction, transparent denominators, JSON/CSV exports and inspected seeds drawn from the report.
- Checked-in 120-case report independently verified in CI.
- One campaign owner per browser origin, with synchronous stop/flush on close and guarded late callbacks.
- Damaged saves preserved for export and explicit recovery.

See [Evaluation reports](evaluation-reports.md) and [Release verification](readiness-verification.md) for methods and observed checks.

## Next priorities

| Priority | Increment                          | Acceptance criteria                                                                                                                                                                                                                   |
| -------- | ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1        | Richer objectives and recovery     | Add one objective with explicit dependencies and a visible explanation when blocked. Demonstrate completion, missing-resource recovery, manual interference and save/reload continuity without bypassing game commands.               |
| 2        | Independent evaluation scenarios   | Add an attack family and a matched honest control with predeclared success/failure rules. Include unresolved cases, inspection cost and results across multiple seeds; reproduce the report in CI.                                    |
| 3        | Bounded model-assisted planning    | First produce reviewable job proposals from actor-visible state. Validate every proposal, cap requests/spend, preserve responses for replay and provide a deterministic fallback. Keep actual execution behind existing game actions. |
| 4        | Distinct resident art and feedback | Give residents distinguishable appearances and clear activity states, while preserving readable labels, reduced-motion behavior and phone usability.                                                                                  |
| 5        | Hosted demonstration               | Choose a supported deployment runtime and verify the free flow on HTTPS. Define persistence and operating costs before offering shared accounts or durable hosted research.                                                           |

These rows are future work, not shipped capabilities. Multiplayer, a server-authoritative economy, autonomous construction, agent-led combat and open-ended language-model societies remain outside the current release.

## Practical success criteria

- A new contributor can install and run the free game with the documented Node version and no credentials.
- Two tabs cannot overwrite each other's campaign state; failed saves and recovery are visible.
- Every published reference result can be regenerated from its manifest and matching engine, with failed reproduction blocking CI.
- A player can explain an agent's current job and blockage from the inspector, and a reviewer can distinguish rules, authored scenarios and optional model output.
- Public descriptions continue to match the code. Stars and interview outcomes are not engineering guarantees.
