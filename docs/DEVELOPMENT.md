# Development guide

This guide is for contributors and release maintainers. End-user installation and usage belong in
the root [README](../README.md).

## Requirements

- Node.js 22 or later
- npm
- Git

The currently validated toolchain is Node.js `22.22.0`, npm `10.9.4`, `@n8n/node-cli` `0.44.5`,
and local n8n `2.35.5`.

## Install and verify

```bash
npm ci
npm test
npm run lint
npm audit --omit=dev
npm pack --dry-run --json
```

Start the linked local n8n development instance with:

```bash
npm run dev
```

Then open `http://localhost:5678`. The CLI builds the package, loads both Inistate nodes, and
rebuilds them when source files change.

## Source organization

```text
credentials/                         Inistate API credential
nodes/Inistate/                      Action-node metadata and router
nodes/Inistate/actions/entry/        Entry operation definitions
nodes/InistateTrigger/               Trigger metadata and webhook receiver
nodes/InistateTrigger/events/        Trigger event definitions
nodes/InistateTrigger/webhook/       Hook registration and removal lifecycle
nodes/shared/                        Shared API helpers and request contracts
test/                                Automated contract and runtime tests
scripts/live-production-smoke.cjs    Controlled live sandbox harness
```

`package.json` registers only the compiled action and trigger entry points. Internal operation and
event modules are imported by those routers.

## Production sandbox verification

Live tests target only the dedicated `N8N Production Sandbox` workspace and resolve these modules
by exact name:

- `Task Tracker`
- `Projects`
- `Members`

The harness prefixes disposable records with `N8N-TEST` and attempts to remove every record and
automation hook it creates. It still calls the Production API, so use a least-privilege key that is
restricted to the sandbox.

Create a git-ignored `.env.live.local` file containing:

```text
INISTATE_API_KEY=<sandbox API key>
INISTATE_WEBHOOK_URL=<optional public n8n test webhook URL>
```

Run:

```bash
npm run test:live:production
```

Do not run the live harness with a broad production key. Inspect its cleanup report and remove any
leftover `N8N-TEST` records or hooks before accepting the result.

## Release evidence

- [P0 readiness](P0_READINESS.md)
- [P1 readiness](P1_READINESS.md)
- [Release process](RELEASE.md)
- [Maintenance policy](MAINTENANCE.md)
- [Changelog](../CHANGELOG.md)
- [Security policy](../SECURITY.md)

Update command outputs and test counts in the readiness records from the exact release commit.
