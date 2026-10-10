# Releasing

Settlement's repository, the `settlement-testbed` npm package and the GitHub Action share one version. `npm run check:versions` fails CI when `package.json`, `packages/settlement-testbed/package.json` and the `package-version` default in `action.yml` disagree.

## Cut a release

1. Add the version's section to `CHANGELOG.md` (heading `## X.Y.Z — YYYY-MM-DD`).
2. `npm version X.Y.Z --no-git-tag-version` at the root. The `version` script syncs the package and the action.
3. Open a pull request with those changes; merge it when CI is green.
4. Tag the merge commit: `git tag -a vX.Y.Z -m "Settlement vX.Y.Z" && git push origin vX.Y.Z`.

The Release workflow then re-runs the full verification, creates the GitHub Release from the changelog section, and publishes `settlement-testbed@X.Y.Z` to npm with provenance.

## npm authentication

Publishing uses npm Trusted Publishing (OpenID Connect from GitHub Actions). There is no token in the repository.

- **First publish of a new package** must be manual: from the tagged commit, `cd packages/settlement-testbed && npm login && npm publish --provenance=false --access public`. The `--provenance=false` flag is required: `package.json` asks for provenance, and npm refuses to generate it outside GitHub Actions, so the first version carries no attestation while every later one does. Then open the package's Settings → Publishing access on npmjs.com and add a trusted publisher: repository `Lingikaushikreddy/Settlement-Village`, workflow `release.yml`, environment left empty. Trusted Publishing needs npm 11.5.1 or newer; Node 24's bundled npm qualifies.
- **Every later tag** publishes automatically. The `publish` job is skipped with a notice while the package does not yet exist on npm.

## Verify a published version

```bash
npx settlement-testbed@X.Y.Z --help
npx settlement-testbed@X.Y.Z --verify public/examples/agent-report.json
```

The second command must print `Verified 40 cases`, which proves the published engine matches the repository's.
