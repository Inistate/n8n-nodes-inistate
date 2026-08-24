# P1 readiness record

Last updated: 2026-08-24 (Asia/Singapore)

Decision: **NOT READY**. Delete Entry and Duplicate Entry are implemented and requester-confirmed in
basic live App02 testing. State Changed is implemented and its automated selector and
webhook-registration contracts pass, but its live delivery and removal matrix remains pending.

## Contract alignment

The implementations follow the existing `zapierIntegration` behavior while using n8n-native node
properties and lifecycle methods:

| P1 feature    | Existing Inistate contract                                                                                       | Added n8n safeguard or validation                                    |
| ------------- | ---------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| Delete Entry  | `POST /api/activity/` with `activityId: delete`, `moduleId`, and entry document ID                               | Irreversible-action notice; non-2xx responses are rejected           |
| Duplicate     | `POST /api/activity/` with `activityId: duplicate`, `moduleId`, and entry document ID                            | Non-2xx responses are rejected; the App02 response is passed through |
| State Changed | `POST /api/automationHook` with `type: state`, selected state ID, `changeFrom` or `changeTo`, and `channel: n8n` | Separate State ID selector and shared registration/removal lifecycle |

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
| Existing P0 contracts remain intact                     | Confirmed | Full automated suite passes                                       |

## Mandatory live App02 matrix

Use only disposable records with the `N8N-TEST` prefix in workspace `2307`, module `19296`.

| Test                                                                       | Status                 |
| -------------------------------------------------------------------------- | ---------------------- |
| Duplicate a disposable entry and confirm a new copy is created             | Confirmed by requester |
| Confirm the duplicated field values and remove the copied entry            | Pending                |
| Delete a disposable entry successfully                                     | Confirmed by requester |
| Register State Changed for **To State**, deliver one matching transition   | Pending                |
| Deactivate the To State workflow and confirm its App02 hook is removed     | Pending                |
| Register State Changed for **From State**, deliver one matching transition | Pending                |
| Deactivate the From State workflow and confirm its App02 hook is removed   | Pending                |
| Confirm a non-matching state transition does not execute each workflow     | Pending                |

## Exit rule

P1 can be marked ready only after every live test above has direct evidence, the complete automated
suite passes from a clean build, and the P1 diff receives the same release/security review required
for the P0 package. npm publication and n8n Creator Portal verification remain package-level release
gates recorded in `P0_READINESS.md`.
