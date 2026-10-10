# Contributing to Settlement

Thanks for helping build a village whose agents can be understood as well as watched.

## Local setup

Fork this repository and clone your fork. Use Node 24+ (or `nvm use`), then:

```bash
npm ci
npm run dev
```

The game runs at `http://localhost:5173`. `npm run dev:all` also starts the optional local research worker. Paid models are unnecessary for development and stay disabled by default.

## Useful contributions

- Reproducible bugs in job assignment, pathfinding, save continuity or resource accounting
- Accessibility, phone controls and readable resident decisions
- Original civilian artwork and animations with clear provenance and compatible licensing
- New authored research scenarios with honest-control cases and explicit metrics
- Focused objective improvements that preserve deterministic behavior and spending bounds

For a large feature, open an issue describing the player experience and scope before investing in an implementation. For a small fix, a focused pull request is welcome.

## Your first pull request

1. Pick an issue labelled [good first issue](https://github.com/Lingikaushikreddy/Settlement-Village/labels/good%20first%20issue) or [help wanted](https://github.com/Lingikaushikreddy/Settlement-Village/labels/help%20wanted). If none fits, ask in [Discussions](https://github.com/Lingikaushikreddy/Settlement-Village/discussions) before writing code.
2. Comment on the issue so it is not picked up twice.
3. Follow "Make and verify a change" below. The whole verification block must pass locally; CI runs the same commands on Node 22, 24 and 26.
4. Open the pull request with the template filled in. The maintainer reviews within a few days.

Settlement follows the [Contributor Covenant](CODE_OF_CONDUCT.md).

## Make and verify a change

1. Create a branch from `main`.
2. Keep game transitions in `lib/game` or `lib/sim` independent of UI state. Reuse validated commands for economy changes.
3. Add a regression test when changing consequential behavior such as resource transfers, saves, claims or replay. Avoid tests that merely repeat an implementation.
4. Run the checks below. For interface changes, also exercise the affected flow in desktop and phone layouts; include screenshots when helpful.
5. Open a pull request describing the problem, resulting behavior and actual verification. Mention any known limits.

```bash
npm test
npm run test:integration
npm run evaluate -- --verify docs/evaluation-results.json
npm run typecheck
npm run lint
npm run build
npm run test:e2e
```

The browser suite needs Chromium: run `npx playwright install chromium` once. The HTTP test uses port 8899 and a temporary SQLite database. Do not run competing instances on that port. Do not commit `.env` files, provider keys, local databases, generated build directories or personal saved runs. Paid model tests should use injected responses unless a maintainer explicitly arranges a live-provider check.

If an intentional engine change affects reference outcomes, review the new results and run `npm run evaluate` to regenerate the report. Explain changed metrics in the pull request; see [Evaluation reports](docs/evaluation-reports.md).

## Report a bug

Include the expected result, what happened, steps to reproduce, browser and operating system, and a relevant screenshot or console error. A minimal exported save can help reproduce simulation bugs; inspect it for personal content before attaching it publicly.

Use the [security policy](SECURITY.md) for vulnerabilities involving secrets or unauthorized access. Keep public discussions respectful and focused on the work.

Contributions are provided under the repository's MIT license. Preserve notices for any third-party material you add.
