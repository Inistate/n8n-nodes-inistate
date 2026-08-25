# P0 readiness record

Last updated: 2026-08-24 (Asia/Singapore)

Decision: **NOT READY**. The protected P0 implementation exists, automated checks pass, and the
requester reports that all five exposed action operations and all three triggers passed basic live
App02 testing through a public tunnel. The full live field matrix and mandatory publishing controls
remain incomplete.

Status meanings:

- **Confirmed**: direct current evidence proves the item.
- **Partial**: some, but not all, required evidence exists.
- **Blocked**: an external prerequisite or unresolved failure prevents confirmation.
- **Pending**: the work or evidence has not yet been completed.

## Protected P0 functionality

| Requirement                                               | Status                | Evidence                                                                                            |
| --------------------------------------------------------- | --------------------- | --------------------------------------------------------------------------------------------------- |
| Create Entry                                              | Confirmed             | Exact automated contract plus requester-confirmed basic live execution                              |
| Update Entry                                              | Confirmed             | Exact automated contract plus requester-confirmed basic live execution                              |
| Perform Activity, with and without a form                 | Confirmed             | Automated form/no-form contracts plus requester-confirmed basic live execution                      |
| Change State                                              | Confirmed             | Exact automated contract plus requester-confirmed basic live execution                              |
| Assign                                                    | Confirmed             | Exact automated contract plus requester-confirmed basic live execution                              |
| Entry Created                                             | Confirmed             | Automated `item: create` contract plus requester-confirmed live delivery                            |
| Entry Updated                                             | Confirmed             | Automated `item: edit` contract plus requester-confirmed live delivery                              |
| Activity Performed with filtering                         | Confirmed             | Automated selected-activity contract plus requester-confirmed live delivery                         |
| Workspace, Module, Activity, Field, State, User selectors | Confirmed (automated) | All six method-level selector tests; dependency scoping covered                                     |
| API-key credentials                                       | Confirmed             | Password field, generic `fsk` authentication, `/api/profile` test                                   |
| Dynamic forms                                             | Partial               | Recursive/type/read-only/unsupported automated tests pass; full live form matrix is incomplete      |
| Multi-item and Continue On Fail behavior                  | Confirmed (automated) | Runtime execution tests preserve paired item indexes and errors                                     |
| Webhook register/check/delete/delivery lifecycle          | Partial               | Automated lifecycle passes and live delivery is requester-confirmed; live removal is not yet proven |

Run evidence:

```text
node --test --test-force-exit test/**/*.test.cjs
40 tests, 40 passed, 0 failed

npx tsc --noEmit
exit code 0

npm run lint
exit code 0 with @n8n/node-cli 0.44.5

npm pack --dry-run --json
exit code 0; 84 files; both nodes, credentials, metadata, icons, action/event modules, and shared
runtime included
```

## Sandbox and API

| Requirement                                          | Status                 | Evidence or blocker                                                                                                          |
| ---------------------------------------------------- | ---------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| Production/App02 host selection                     | Partial                | Automated routing passes; App02 is live-tested, but Production has not yet had the same live smoke test                      |
| `GET /api/profile` with intended key                 | Confirmed by requester | Credential test previously succeeded                                                                                         |
| Dedicated sandbox                                    | Confirmed              | `N8N Node Testing` workspace `2307`; `P0 Task Tracker` module `19296`                                                        |
| Representative basic field types                     | Confirmed              | Text, MultiText, Selection, Number, Date, DateTime, YesNo present                                                            |
| Three states and two transitions                     | Confirmed              | Backlog → In Progress → Completed                                                                                            |
| Activities with/without forms                        | Confirmed              | Start Work (none), Complete Task (required fields)                                                                           |
| `medium: n8n` accepted by activity endpoint          | Confirmed by requester | All five exposed action paths passed basic live testing                                                                      |
| `medium: n8n` / `channel: n8n` registration accepted | Confirmed              | App02 returned registration ID `AwVSpu5SvM`                                                                                  |
| Public webhook callback delivered                    | Confirmed by requester | All three trigger events delivered through a temporary Cloudflare HTTPS tunnel                                               |
| Automation hook removed                              | Pending                | Remove current/known registrations and verify cleanup                                                                        |
| Seeded `N8N-TEST` entry                              | Pending                | Existing entries are not sufficient evidence for the defined automated prefix                                                |
| Module and user-reference live fields                | Partial                | Module `19305` contains both cases; dropdown and flat payload contracts pass, but live create/update verification is pending |
| Nested section/tab and unsupported live cases        | Pending                | Covered synthetically only; sandbox cases are absent                                                                         |
| Two distinct assignable users                        | Pending                | Not yet evidenced                                                                                                            |

The previous workspace/module values `2306`/`19295` were stale and must not be used for this P0
sandbox.

## Tooling, package, and security

| Requirement                                         | Status    | Evidence or blocker                                                         |
| --------------------------------------------------- | --------- | --------------------------------------------------------------------------- |
| Node.js/npm recorded                                | Confirmed | Node `22.22.0`, npm `10.9.4`                                                |
| Official n8n CLI build/test/lint                    | Confirmed | `@n8n/node-cli` `0.44.5`, all exit 0                                        |
| Local development n8n starts                        | Confirmed | n8n `2.35.5` served at `http://localhost:5678`                              |
| No runtime dependency/filesystem/environment access | Confirmed | Package has no runtime dependencies; runtime source uses n8n helpers only   |
| Production dependency audit                         | Confirmed | `npm audit --omit=dev`: zero vulnerabilities                                |
| Full development dependency audit                   | Partial   | 13 upstream advisories remain inside latest `@n8n/node-cli` transitive tree |
| Package content                                     | Confirmed | `npm pack --dry-run --json` contains 84 intended files only                 |
| Separate clean-install smoke                        | Confirmed | Tarball loaded action and trigger v1 in a clean n8n 2.35.5 node catalog     |
| Secrets excluded from repository                    | Confirmed | No API key is stored in source or tests; credential is password-typed       |
| Diff inspection                                     | Confirmed | `git diff` and `git diff --check` available before acceptance               |

## Documentation and release controls

| Requirement                                                                       | Status                 | Evidence or blocker                                                             |
| --------------------------------------------------------------------------------- | ---------------------- | ------------------------------------------------------------------------------- |
| README covers install, credentials, actions, triggers, examples, limits, versions | Confirmed              | Root README                                                                     |
| Release notes and SemVer policy                                                   | Confirmed              | `CHANGELOG.md`, `docs/RELEASE.md`                                               |
| Maintenance, compatibility, rollback, dependency update process                   | Confirmed              | `docs/MAINTENANCE.md`, `docs/RELEASE.md`                                        |
| Issue and security contact paths                                                  | Confirmed              | GitHub Issues and `SECURITY.md`                                                 |
| GitHub Actions provenance workflow                                                | Confirmed (repository) | OIDC workflow pins npm 11.15.0 and uses `id-token: write`                       |
| npm trusted publisher configured                                                  | Pending                | Must be configured on npmjs.com after the package exists under Inistate control |
| MIT licence internally approved                                                   | Pending                | Requires an Inistate organizational decision                                    |
| n8n Creator Portal access                                                         | Pending                | Requires an external account/login                                              |
| Published package provenance                                                      | Pending                | No P0 version has been published                                                |
| Published package clean-install smoke                                             | Pending                | Depends on publication                                                          |

## Accepted non-blocking risks

- No named individual API decision-maker or repository reviewer for P0; response time may be slow.
- Webhook signature verification is unavailable in the observed hook contract.
- The official current n8n development CLI brings dev-only transitive advisories. Production package
  dependencies are unaffected, but the toolchain risk remains open for an upstream update.

## Exit rule

Change the decision to **READY** only after every mandatory Pending/Blocked item above has direct
evidence, the exact release commit is reviewed and pushed, and the published package is
clean-installed and smoke-tested. Automated contract tests cannot substitute for the live App02 and
publishing checks.
