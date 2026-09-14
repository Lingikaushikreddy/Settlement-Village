# Settlement implementation plan

Goal: Build the simulation, village interface, evidence inspector, adversarial evaluation, replay, and durable local worker.

Specification: ../Settlement-v3-Product-and-Engineering-Spec.md in the parent outputs directory.

User decision: No paid AI. Optional Claude adapter stays disabled until configured.

Architecture: A pure TypeScript simulation core feeds the React interface and a persistent Node worker. Local development uses transactional SQLite so it needs no external database. A deployment with PostgreSQL and multiple workers requires separate infrastructure. The hosted website must distinguish recorded playback and browser-local runs from a connected persistent worker.

Visual direction: Evergreen #244d42, meadow #d9e6bc, river #a4c9dc, ink #243631, gold #dfb85b, paper #f8faf5. Georgia titles and a humanist system sans. A broad illustrated village is the dominant working surface, accompanied by a quiet evidence panel.

- [x] First recognizable village preview and inspector.
- [x] Shared types and engine tests: deterministic runs, balance conservation, conflicting trades, private observations, bounded plans.
- [x] Engine and planner with source-linked decisions and incident outcome rules.
- [x] Functional playback, new runs, interventions, evidence selection, comparisons, export, and run library.
- [x] SQLite worker, command idempotency, version checks, autonomous loop, HTTP and SSE. Test restart recovery.
- [x] Disabled-by-default Claude adapter with schema validation, deadlines, and call-limit prechecks. Live integration and durable spend reservations remain future work.
- [x] Matched-seed experiments, actual results, and limitations.
- [x] Browser journeys, desktop/mobile checks, TypeScript verification, and documentation.
- [x] Production build, lint, and TypeScript checks.
- [ ] Private website publishing. The registered Sites project currently returns `project_not_found`; restore access before renewing source credentials, pushing, saving, and deploying.

Release verification: 26 automated tests and the HTTP/SSE integration flow passed. The evaluator checked 120 runs across four scenarios, three policies, and ten seeds; every run passed conservation invariants and deterministic replay. Browser checks covered incident inspection, comparisons, new runs, worker reconnection, save/replay, and a 390 px mobile layout with no horizontal overflow.

No credentials, paid services, or performance results are assumed.
