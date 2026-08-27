# P0 readiness record

Last updated: 2026-08-27 (Asia/Singapore)

Decision: **NOT READY**. The protected P0 implementation exists, automated checks pass, and live
Production action plus hook registration/removal testing passed in `N8N Production Sandbox` for
`Task Tracker`, `Projects`, and `Members`. The project owner has additionally confirmed public
webhook delivery and full State Changed behavior; those confirmations are self-reported and have
not been independently reproduced in this audit. Mandatory publishing controls remain incomplete.

Status meanings:

- **Confirmed**: direct current evidence proves the item.
- **Partial**: some, but not all, required evidence exists.
- **Blocked**: an external prerequisite or unresolved failure prevents confirmation.
- **Pending**: the work or evidence has not yet been completed.

## Protected P0 functionality

| Requirement                                               | Status                | Evidence                                                                                            |
| --------------------------------------------------------- | --------------------- | --------------------------------------------------------------------------------------------------- |
| Create Entry                                              | Confirmed             | Automated contract and live execution passed in all three Production modules                        |
| Update Entry                                              | Confirmed             | Automated contract and live execution passed in all three Production modules                        |
| Perform Activity, with and without a form                 | Confirmed             | Automated form/no-form contracts; one available activity passed live in each Production module      |
| Change State                                              | Confirmed             | Automated contract and live execution passed in all three Production modules                        |
| Assign                                                    | Confirmed             | Automated contract and live execution passed in all three Production modules                        |
| Entry Created                                             | Confirmed (self-reported) | Contract, hook lifecycle, and public webhook delivery confirmed by project owner                  |
| Entry Updated                                             | Confirmed (self-reported) | Contract, hook lifecycle, and public webhook delivery confirmed by project owner                  |
| Activity Performed with filtering                         | Confirmed (self-reported) | Selected-activity contract, hook lifecycle, and public delivery confirmed by project owner       |
| Workspace, Module, Activity, Field, State, User selectors | Confirmed (automated) | All six method-level selector tests; dependency scoping covered                                     |
| API-key credentials                                       | Confirmed             | Password field, generic `fsk` authentication, `/api/profile` test                                   |
| Dynamic forms                                             | Partial               | Create/edit form discovery and submission pass in all modules; full field-type matrix is incomplete |
| Multi-item and Continue On Fail behavior                  | Confirmed (automated) | Runtime execution tests preserve paired item indexes and errors                                     |
| Webhook register/check/delete/delivery lifecycle          | Confirmed (self-reported) | Registration/removal passed in all modules; project owner confirmed public callback delivery     |

Run evidence:

```text
node --test --test-force-exit test/**/*.test.cjs
48 tests, 48 passed, 0 failed

npx tsc --noEmit
exit code 0

npm run lint
exit code 0 with @n8n/node-cli 0.44.5

npm pack --dry-run --json
exit code 0; 87 files; both nodes, credentials, metadata, icons, action/event modules, shared
runtime, credential guide, and example workflow included
```

## Sandbox and API

| Requirement                                          | Status    | Evidence or blocker                                                                           |
| ---------------------------------------------------- | --------- | --------------------------------------------------------------------------------------------- |
| Production/App02 host selection                      | Confirmed | Automated routing passes; Production profile and live module requests succeeded               |
| `GET /api/profile` with intended key                 | Confirmed | Production returned success in live run `N8N-TEST-20260825090337`                             |
| Dedicated sandbox                                    | Confirmed | `N8N Production Sandbox`; modules `Task Tracker`, `Projects`, and `Members`                   |
| Workspace and module IDs                             | Confirmed | Workspace `12661`; modules `53677`, `53678`, and `53679`, resolved by exact name              |
| Representative basic field types                     | Partial   | Current create/edit forms submitted successfully; exhaustive type inventory not recorded      |
| States and transitions                               | Confirmed (self-reported) | Project owner confirmed full State Changed testing; prior Change State checks passed for Backlog, Planning, and Active |
| Activities with/without forms                        | Confirmed | Start Work, Assign Project Owner, and Terminate passed on disposable records                  |
| `medium: n8n` accepted by activity endpoint          | Confirmed | All exposed actions passed in all three Production sandbox modules                            |
| `medium: n8n` / `channel: n8n` registration accepted | Confirmed | Activity and State Changed hooks registered and removed in all three modules                  |
| Public webhook callback delivered                    | Confirmed (self-reported) | Project owner confirmed public webhook delivery; independent run evidence is not recorded here |
| Automation hook removed                              | Confirmed | Every temporary hook was removed during the successful live run                               |
| Seeded `N8N-TEST` entry                              | Confirmed | Created records TSK00006, PRJ00005, and MMB00003, then removed them and their duplicates      |
| Module and user-reference live fields                | Partial   | Dynamic options were loaded and forms submitted; exact reference-field inventory not recorded |
| Nested section/tab and unsupported live cases        | Pending   | Covered synthetically; production form coverage is not yet recorded                           |
| Two distinct assignable users                        | Pending   | Not yet evidenced                                                                             |

The retired App02 workspace/module IDs (`2307`, `19296`, and `19305`) must not be used for this
production sandbox. The live harness resolves current IDs from exact names.

## Tooling, package, and security

| Requirement                                         | Status    | Evidence or blocker                                                         |
| --------------------------------------------------- | --------- | --------------------------------------------------------------------------- |
| Node.js/npm recorded                                | Confirmed | Node `22.22.0`, npm `10.9.4`                                                |
| Official n8n CLI build/test/lint                    | Confirmed | `@n8n/node-cli` `0.44.5`, all exit 0                                        |
| Local development n8n starts                        | Confirmed | n8n `2.35.5` served at `http://localhost:5678`                              |
| No runtime dependency/filesystem/environment access | Confirmed | Package has no runtime dependencies; runtime source uses n8n helpers only   |
| Production dependency audit                         | Confirmed | `npm audit --omit=dev`: zero vulnerabilities                                |
| Full development dependency audit                   | Partial   | 13 upstream advisories remain inside latest `@n8n/node-cli` transitive tree |
| Package content                                     | Confirmed | `npm pack --dry-run --json` contains 87 intended files only                 |
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
| MIT licence internally approved                                                   | Confirmed (self-reported) | Inistate management confirmed approval for MIT licensing and public release      |
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
clean-installed and smoke-tested. Automated contract tests cannot substitute for the live
production-sandbox and publishing checks.
