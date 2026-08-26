# Release process

## Versioning

This package follows Semantic Versioning:

- patch: backward-compatible bug or documentation fix;
- minor: backward-compatible operation, trigger, field, or selector addition; and
- major: breaking credential, parameter, output, API-host, or runtime-support change.

Version `0.1.0` is the first P0 release candidate. Do not publish it while any mandatory item in
`P0_READINESS.md` is marked blocked or unverified.

## One-time trusted-publishing setup

The package must first exist under the intended Inistate-controlled npm account or organization.
In the package settings on npmjs.com, add a GitHub Actions trusted publisher with:

- owner: `Inistate`
- repository: `n8n-nodes-inistate`
- workflow: `publish.yml`
- environment: blank

Do not configure `NPM_TOKEN` when OIDC trusted publishing is used. The workflow grants only
`contents: read` and `id-token: write`; it pins npm `11.15.0`, which supports trusted publishing,
and `@n8n/node-cli` sets npm provenance in CI. When creating the trusted publisher after May 20,
2026, explicitly allow the `npm publish` action.

## Release candidate verification

From a clean clone on Node.js 22:

```bash
npm ci
npm test
npm run lint
npm audit --omit=dev
npm pack --dry-run --json
```

Then complete the Production sandbox matrix in `P0_READINESS.md` for `Task Tracker`, `Projects`, and
`Members`, install the generated package tarball into a separate clean n8n instance, and repeat one
action plus one webhook smoke test.

The development-only audit currently contains upstream advisories inherited through the latest
`@n8n/node-cli`; production dependencies audit clean. Recheck those advisories on every release and
upgrade the CLI when n8n publishes a compatible fix. Do not downgrade to an obsolete CLI merely to
satisfy npm's automated suggested-fix output.

## Publish

1. Ensure `main` is clean, reviewed, and pushed.
2. Run `npm run release` locally. The command lints/builds, updates release metadata, commits, tags,
   and pushes without publishing from the workstation.
3. The tag starts `.github/workflows/publish.yml`.
4. Confirm that GitHub Actions succeeds and the npm version displays provenance.
5. Clean-install the exact published version in a separate n8n instance and smoke-test it.
6. If verification is intended, submit the proven package through the n8n Creator Portal.

## Rollback

npm versions are immutable. If a release is unsafe:

1. deprecate the affected npm version with a reason;
2. restore the last known-good code on a new branch;
3. publish a new patch version through the same provenance workflow; and
4. document the affected and replacement versions in the changelog and GitHub release.

Never delete a published version as the normal rollback mechanism.
