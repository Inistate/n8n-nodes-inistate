# P1 readiness record

Last updated: 2026-08-25 (Asia/Singapore)

Decision: **NOT READY**. Delete Entry and Duplicate Entry passed live in all three Production
sandbox modules, and both State Changed hook directions registered and removed successfully. Actual
matching and non-matching webhook delivery remains pending.

## Contract alignment

The implementations follow the existing `zapierIntegration` behavior while using n8n-native node
properties and lifecycle methods:

| P1 feature    | Existing Inistate contract                                                                                       | Added n8n safeguard or validation                                          |
| ------------- | ---------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| Delete Entry  | `POST /api/activity/` with `activityId: delete`, `moduleId`, and entry document ID                               | Irreversible warning; non-2xx rejection; stable `{ deleted: true }` output |
| Duplicate     | `POST /api/activity/` with `activityId: duplicate`, `moduleId`, and entry document ID                            | Non-2xx responses are rejected; the service response is passed through     |
| State Changed | `POST /api/automationHook` with `type: state`, selected state ID, `changeFrom` or `changeTo`, and `channel: n8n` | Separate State ID selector and shared registration/removal lifecycle       |

## Automated evidence

| Requirement                                             | Status    | Evidence                                                          |
| ------------------------------------------------------- | --------- | ----------------------------------------------------------------- |
| Delete request body matches the existing integration    | Confirmed | Exact contract and action-router runtime tests                    |
| Delete shows an irreversible-action warning             | Confirmed | Structure test verifies the operation-scoped notice               |
| Delete rejects an unsuccessful HTTP response            | Confirmed | Authenticated n8n request helper throws for non-2xx responses     |
| Duplicate request body matches the existing integration | Confirmed | Exact contract and action-router runtime tests                    |
| Duplicate accepts the existing API response contract    | Confirmed | Runtime test accepts a successful response without a document ID  |
| State selector sends an ID rather than a display name   | Confirmed | Dedicated `searchStateIds` selector test                          |
| State Changed registers the correct state hook          | Confirmed | Exact `type`, `item`, `trigger`, `channel`, and callback URL test |
| State Changed removes both direction-specific hooks     | Confirmed | Full create/check/delete lifecycle test for both directions       |
| Failed State Changed removal preserves its hook ID      | Confirmed | API-failure lifecycle regression test                             |
| P1 API failures use `NodeApiError` with recovery text   | Confirmed | Error class, status, and recovery-description test                |
| Mutation output/AI UX decision is explicit              | Confirmed | Stable Delete output and structure/documentation tests            |
| Existing P0 contracts remain intact                     | Confirmed | Full automated suite passes                                       |

The v1 action node intentionally has no Simplify Output toggle. Each operation is a bounded
single-entry mutation rather than a list/read operation. Delete has a stable minimal output, while
the remaining operations preserve the service response. `usableAsTool` remains enabled; the Delete
description states that it cannot be undone and AI workflows should add human approval.

## Mandatory live Production sandbox matrix

Use only disposable records with the `N8N-TEST` prefix in `N8N Production Sandbox`. Repeat the
matrix for `Task Tracker`, `Projects`, and `Members`; resolve their current IDs by exact name.

| Test                                                                          | Status         |
| ----------------------------------------------------------------------------- | -------------- |
| Duplicate a disposable entry and confirm a new copy is created                | Confirmed live |
| Confirm the duplicate retains the run marker and remove the copied entry      | Confirmed live |
| Compare every duplicated field value with the source                          | Pending        |
| Delete a disposable entry successfully                                        | Confirmed live |
| Register State Changed for **To State**                                       | Confirmed live |
| Deliver one matching **To State** transition                                  | Pending        |
| Deactivate the To State workflow and confirm its production hook is removed   | Confirmed live |
| Register State Changed for **From State**                                     | Confirmed live |
| Deliver one matching **From State** transition                                | Pending        |
| Deactivate the From State workflow and confirm its production hook is removed | Confirmed live |
| Confirm a non-matching state transition does not execute each workflow        | Pending        |

## Exit rule

P1 can be marked ready only after every live test above has direct evidence, the complete automated
suite passes from a clean build, and the P1 diff receives the same release/security review required
for the P0 package. npm publication and n8n Creator Portal verification remain package-level release
gates recorded in `P0_READINESS.md`.
