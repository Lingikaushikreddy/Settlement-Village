# Testbed distribution design

**Date:** 2026-10-10 · **Status:** approved (approach B) · **Owner:** Kaushik Reddy

Second sub-project of the open-source push, first of three "testbed as a product" specs (distribution, then authoring, then showcase). The agent deception testbed shipped in v0.4.0 as a CLI inside this repository. This spec makes it usable without a clone: an npm package with a CLI and a small API, a GitHub Action, and publishing from the release workflow. The engine does not change, so reports stay interchangeable between the package, the repository CLI and the browser verifier.

## Goals

- `npx settlement-testbed --agent http://127.0.0.1:8765/decide --name my-agent` works on a machine that has only Node 22 or newer, with no clone, no TypeScript loader flag and no API key.
- `uses: Lingikaushikreddy/Settlement-Village@v0.7.0` runs the same evaluation inside a consumer's GitHub workflow, fails the job on thresholds, uploads the report and writes a job summary.
- A report written by the package verifies with `npm run eval:agent -- --verify` in this repository and in the hosted Research → Compare page, and the reverse holds.
- Publishing is automated from a `v*` tag with npm provenance and no long-lived token in the repository.
- The game, worker and existing tests keep importing `lib/` exactly as today.

## Non-goals

- No change to `lib/sim`, `lib/agent` or `lib/testbed` behavior. New files are allowed (`lib/testbed/cli.ts`, `lib/testbed/index.ts`); existing exports keep their signatures. `docs/evaluation-results.json` and `public/examples/agent-report.json` verify unchanged.
- No scenario authoring format, new scenario family, repeated sampling, model adapter, gallery or leaderboard. Those are the next two specs.
- No monorepo refactor: sources are not moved into the package directory (approach B).
- No separate repository for the action.

## Design

### 1. Package layout

```
packages/settlement-testbed/
  package.json          name, version, bin, exports, files, engines, zod dependency
  tsconfig.build.json   compiles ../../lib/{sim,agent/social.ts,testbed} into dist/
  README.md             generated from docs/agent-testbed.md (section 5)
  scripts/check-dist.mjs  allowlist check on the compiled output
  dist/                 build output, git-ignored, published
```

`package.json` fields: `name: settlement-testbed`, `version` equal to the root `package.json` version, `description`, `license: MIT`, `type: module`, `bin: { "settlement-testbed": "./dist/testbed/cli.js" }`, `main`/`types`/`exports` for `.` → `./dist/testbed/index.js` (+ `.d.ts`) and `./package.json`, `files: ["dist", "README.md"]`, `engines: { node: ">=22.13.0" }`, `dependencies: { zod: <same range as root> }`, `repository` with `directory: packages/settlement-testbed`, `homepage` pointing at `docs/agent-testbed.md`, `keywords`, `publishConfig: { access: public, provenance: true }`, and scripts `build`, `check` and `prepack` (`prepack` runs `build` then `check`).

`tsconfig.build.json` extends nothing (it must not inherit the Next plugin or `noEmit`): `rootDir: ../../lib`, `outDir: dist`, `module: nodenext`, `moduleResolution: nodenext`, `target: es2022`, `lib: ["es2022", "dom"]` (the engine uses `crypto.subtle`, `fetch`, `structuredClone`, `MessageChannel`, all available in Node 22), `strict: true`, `declaration: true`, `rewriteRelativeImportExtensions: true`, `allowImportingTsExtensions: true`, `skipLibCheck: true`, `types: ["node"]`, `include: ["../../lib/sim/**/*.ts", "../../lib/agent/social.ts", "../../lib/testbed/**/*.ts"]`. Because `rootDir` is `lib`, the output tree is `dist/sim`, `dist/agent`, `dist/testbed`.

`scripts/check-dist.mjs` fails the build if `dist/` contains any file outside `sim/`, `agent/social.*` and `testbed/`, if any emitted file still imports a `.ts` path, or if `dist/testbed/cli.js` lacks the shebang. This is the guard that keeps the Claude adapter and game code out of the package.

### 2. CLI and API

`scripts/eval-agent.mjs` becomes `lib/testbed/cli.ts`, with identical flags, help text, summary output, report format and exit codes (0 ok, 1 threshold or verification failure, 2 usage or unreachable agent). The TypeScript file starts with `#!/usr/bin/env node`; tsc preserves the shebang. `scripts/eval-agent.mjs` is reduced to a re-export shim (`export * from "../lib/testbed/cli.ts"` plus the `main()` call guarded by the same `import.meta.url` check) so `npm run eval:agent` and `tests/eval-agent-cli.test.mjs` keep working without edits. The `--verify` path, thresholds and `--header` secrecy are unchanged.

`lib/testbed/index.ts` is the package root and exports:

```ts
export { evaluateAgent, type EvaluateAgentOptions } from "./evaluate.ts";
export { verifyAgentReport as verifyReport, type AgentReport } from "./report.ts";
export { httpSource } from "./http.ts";
export { parseAgentResponse, buildRequest, PROTOCOL, type DecisionRequest, type AgentAnswer, type AnswerSource } from "./protocol.ts";
export { SCENARIOS } from "../sim/evaluation.ts";
export { scenarioInfo, policyInfo, AGENT_ENGINE_VERSION } from "../sim/engine.ts";
export type { Scenario, SocialAction } from "../sim/types.ts";
```

`lib/testbed/evaluate.ts` adds one new function, `evaluateAgent(options)`, which wraps `buildAgentReport`: options are `{ source: AnswerSource | string, name?: string, scenarios?: Scenario[], seeds?: number[], maxTicks?: number, timeoutMs?: number, headers?: Record<string,string>, concurrency?: number, signal?: AbortSignal, onProgress?: (done, total) => void }`. A string `source` is treated as a URL and wrapped with `httpSource`; a function is used directly, which is how a consumer tests an in-process agent without HTTP. It returns `{ report, runs, overall: { attackSuccess, honestRefusal, invalid } }` using the same `overall()` computation as the CLI, moved into `evaluate.ts` so the CLI and API share it.

### 3. GitHub Action

`action.yml` at the repository root (composite), name "Settlement agent testbed", so consumers use `Lingikaushikreddy/Settlement-Village@v0.7.0`.

Inputs: `agent-url` (required), `name` (default `agent`), `scenarios`, `seeds`, `ticks`, `timeout`, `concurrency`, `max-attack-success`, `max-honest-refusal`, `max-invalid`, `report-path` (default `settlement-agent-report.json`), `package-version` (default: the version recorded in `action.yml` at release time, bumped by the same version-sync check as the package), `node-version` (default `22`).

Steps:
1. `actions/setup-node` with `node-version` (pinned by SHA like the other actions).
2. Run `npx --yes settlement-testbed@${{ inputs.package-version }}` with the flags built from the inputs; omitted inputs are not passed, so CLI defaults apply. `continue-on-error: true` so the report still uploads.
3. Always upload the report as an artifact named `settlement-agent-report`.
4. Write the job summary (`$GITHUB_STEP_SUMMARY`) with a small Node script shipped in the action directory `.github/actions/testbed-summary/summary.mjs`: a per-scenario table (attack success, honest refusal, invalid, with raw counts) next to the three baselines, the overall rates, and which thresholds failed.
5. Set outputs `report-path`, `attack-success`, `honest-refusal`, `invalid`, then exit with the CLI's exit code so thresholds fail the job.

The consumer starts their agent in an earlier step (`run: node agent.mjs &`), which the docs show. The action never starts or hosts the agent.

Self-test: `.github/workflows/ci.yml` gains a job `action` (after `verify`, Node 24 only) that checks out, starts `examples/agents/node/agent.mjs` in the background, builds and packs the package from the checkout, installs the tarball globally so `npx settlement-testbed` resolves to the checkout's code rather than the registry, then runs `uses: ./` with `max-attack-success: 0.05`, `max-honest-refusal: 0.05`, `max-invalid: 0` (the example agent scores 0 on all three). This job is the action's integration test.

### 4. Publishing and versions

- `release.yml` gains a `publish` job that runs after `release` succeeds: checkout the tag, Node 24, `npm ci` at the root, `npm run build` inside `packages/settlement-testbed`, `npm pack --dry-run --json` and compare the file list to `packages/settlement-testbed/expected-files.txt`, assert `package.json` version in both the root and the package equals the tag, then `npm publish --provenance --access public` from the package directory with `permissions: id-token: write, contents: read`.
- Authentication is npm Trusted Publishing (OIDC): no `NPM_TOKEN` secret. The maintainer does the first publish manually from the tagged commit (`npm login`, `npm publish` in the package directory), then configures the trusted publisher (repository `Lingikaushikreddy/Settlement-Village`, workflow `release.yml`, environment none) in the package's npm settings. From the next tag on, the workflow publishes. `docs/releasing.md` records both paths.
- `scripts/check-versions.mjs` asserts root `package.json`, `packages/settlement-testbed/package.json` and the `package-version` default in `action.yml` are identical; CI runs it, and `npm version` at the root is wrapped by a `version` script that updates the other two.
- Package version 0.7.0 ships with repository version 0.7.0. Engine version stays `1.1.0+agent-1`, which is what makes reports interchangeable.

### 5. Tests and docs

- `tests/testbed-package.test.mjs` (Node 24 leg in CI, also local): builds the package, `npm pack`s it into a temp directory, creates a fresh temp project, `npm install`s the tarball there, starts the Node example agent on a free port, runs the installed `settlement-testbed --agent … --out report.json --seeds 1-2 --scenarios injection,benign`, asserts exit 0 and the report file, runs the installed `--verify report.json`, and finally runs this repository's `npm run eval:agent -- --verify report.json` on the same file. That last step is the cross-verification guarantee. Budget: under 90 seconds.
- `tests/eval-agent-cli.test.mjs` keeps passing unchanged through the shim.
- `tests/testbed-api.test.mjs`: `evaluateAgent` with a function source (no HTTP) over two seeds returns a report that `verifyReport` accepts and whose `overall` equals the CLI's `overall()`.
- Docs: `docs/agent-testbed.md` quick start switches to `npx settlement-testbed` with the clone path kept under "Contributing to the testbed"; a new "Run it in CI" section shows the action with a background agent step; a new "Use it as a library" section shows `evaluateAgent` with a function source. `scripts/build-package-readme.mjs` assembles `packages/settlement-testbed/README.md` from marked sections of that doc so the npm page cannot drift; CI fails if the committed README differs from the generated one. The root README's "Test your own agent" block gets the npx command and a four-line action snippet. `CHANGELOG.md` gains 0.7.0; `docs/product-roadmap.md` marks the npm package and action done.

## Pull request sequence

| # | Branch | Content | Depends on |
| - | ------ | ------- | ---------- |
| 0 | `docs/testbed-distribution-spec` | this spec and its plan | — |
| 1 | `feat/testbed-package` | sections 1 and 2, `tests/testbed-package.test.mjs`, `tests/testbed-api.test.mjs` | 0 |
| 2 | `feat/testbed-action` | section 3 and the CI self-test job | 1 |
| 3 | `chore/testbed-publish-0.7.0` | section 4, docs, README generation, CHANGELOG, version 0.7.0 | 2 |
| 4 | manual | maintainer: tag `v0.7.0`, first `npm publish`, configure Trusted Publishing | 3 |

## Risks

- **Compiled output differs from stripped-types execution.** The CLI tests run the shim (type stripping) and the package test runs `dist/` (tsc output); both verify the same report, so a divergence fails CI.
- **`rewriteRelativeImportExtensions` and `.d.ts` output.** Declarations keep `.ts` import specifiers unless `allowImportingTsExtensions` is set with it; the check-dist script greps emitted `.js` and `.d.ts` for `.ts"` to catch this.
- **npx resolves the registry package in the action self-test.** Mitigation: the self-test installs the packed tarball globally before `uses: ./`, and the summary step prints `npm ls -g settlement-testbed` so the log shows which code ran.
- **Trusted Publishing needs a first manual publish.** Documented; the workflow's publish job is skipped with a clear message until the package exists on npm.
- **Version drift between three files.** `scripts/check-versions.mjs` in CI.
