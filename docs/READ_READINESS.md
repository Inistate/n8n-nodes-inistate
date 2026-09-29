# Read-operations readiness record

Last updated: 2026-08-28 (Asia/Singapore)

Covers gap **G1** of the release plan: the action node can now read. Get, Get Many, Get History,
and Get Form are implemented against the Inistate MCP API surface.

Decision: **NOT READY**. Every automated check passes and each request body is pinned against the
Inistate API contract read from the server source, but no read operation has yet been executed
against a live Inistate instance. The live matrix below is the remaining gate.

Status meanings match `P0_READINESS.md`: **Confirmed**, **Partial**, **Blocked**, **Pending**.

## Contract alignment

Each operation maps to one MCP endpoint. Request field names are the endpoint's own; response
fields are passed through unrenamed so a read result round-trips with trigger payloads.

| Operation   | Endpoint                | Request                                                                                                                    | Response used                                                       |
| ----------- | ----------------------- | -------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| Get         | `POST /api/mcp/entry`   | `module`, `entryId`                                                                                                        | Whole object, including `availableActivities` and `stateFlow`        |
| Get Many    | `POST /api/mcp/list`    | `module`, `currentPage`, `pageSize`, plus any of `listing`, `state`, `documentId`, `createdBy`, `assignee`, `createdAfter`, `createdBefore`, `updatedAfter`, `updatedBefore`, `search`, `sortBy`, `sortDirection`, `fields`, `filters` | `list[]` unwrapped to one item per entry; `hasMore` drives paging    |
| Get History | `POST /api/mcp/history` | `module`, `entryId`, `page`                                                                                                | `histories[]` unwrapped to one item per record; `hasMore` for paging |
| Get Form    | `POST /api/mcp/form`    | `module`, `activity`, optional `entryId`                                                                                   | Whole object, including `form`, `defaults`, `confidence_threshold`   |

Deliberate differences from the write operations:

| Decision                                                             | Reason                                                                                                                 |
| -------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| Read entry parameter is `entryId`, not `documentId`                  | The MCP endpoints accept the document ID or the numeric entry ID, so a workflow can resume from either trigger field    |
| Reads send `wsId` without `medium: n8n`                              | `medium` marks a write channel; the existing read helpers in the node already omit it                                   |
| `module` is sent as the numeric module ID from the existing selector | `resolveModule` accepts a numeric ID or a name, and the ID is what the node's Module selector already produces          |
| Get Many and Get History emit one item per record                    | n8n convention for a collection read; the alternative buries records inside one item                                    |
| Listing is matched by name                                           | `POST /api/mcp/list` resolves a named listing against the caller's authorised listings; there is no listing-ID lookup   |

## Automated evidence

| Requirement                                                             | Status    | Evidence                                                                   |
| ------------------------------------------------------------------------ | --------- | -------------------------------------------------------------------------- |
| Each read operation posts to the correct MCP endpoint with an exact body | Confirmed | `test/Inistate.read.test.cjs` asserts full request objects per operation    |
| Get preserves `availableActivities` and `stateFlow` unrenamed           | Confirmed | Output asserted deep-equal to the mocked API response                       |
| Get Many stops at the limit and requests no more than it needs          | Confirmed | One request with `pageSize` equal to the limit                              |
| Get Many follows `hasMore` across pages when Return All is set          | Confirmed | Two-page paging test asserting `currentPage` 0 then 1                       |
| Get Many terminates on an empty page even if `hasMore` stays true       | Confirmed | Dedicated regression test                                                   |
| Get Many forwards every supplied option, filter, and projection         | Confirmed | Full-option request-body test                                               |
| Get History pages the audit trail and honours the limit                 | Confirmed | Two paging tests                                                            |
| Get Form omits a blank entry ID and sends a supplied one                | Confirmed | Two-item request-body test                                                  |
| Reads omit the `medium: n8n` write marker                               | Confirmed | Header assertion                                                            |
| Invalid filter JSON and a blank entry ID fail before any request         | Confirmed | Two rejection tests asserting zero requests were made                       |
| Read failures respect Continue On Fail                                  | Confirmed | Item-level error output test                                                |
| Request builders, filter parsing, and page unwrapping                   | Confirmed | `test/InistateRead.contract.test.cjs`                                       |
| Listing, State, and Get Form activity selectors                         | Confirmed | Selector tests over mocked workspace and module responses                   |
| Existing write operations and trigger contracts remain intact           | Confirmed | Full suite passes: 70 tests, 0 failures                                     |
| `eslint-plugin-n8n-nodes-base` passes with no disables                  | Confirmed | `npm run lint` clean                                                        |
| Live execution against a real Inistate instance                         | Pending   | No live run performed; see the matrix below                                 |

## Mandatory live Production sandbox matrix

Use only disposable records with the `N8N-TEST` prefix in `N8N Production Sandbox`. Repeat for
`Task Tracker`, `Projects`, and `Members`; resolve their current IDs by exact name.

| Test                                                                                | Status  |
| ------------------------------------------------------------------------------------ | ------- |
| Get by document ID returns the entry and its `availableActivities`                  | Pending |
| Get by numeric entry ID returns the same entry                                       | Pending |
| Get on an entry outside the caller's listings is refused                              | Pending |
| Get Many with Return All spans more than one page                                    | Pending |
| Get Many with a Limit below one page returns exactly that many items                  | Pending |
| Get Many scoped to a named listing returns only that listing's entries                | Pending |
| Get Many with a Fields projection returns only the requested columns                  | Pending |
| Get Many with a nested `and`/`or` Filters object returns the expected subset           | Pending |
| Get Many with each date-range option returns the expected subset                       | Pending |
| Get History returns activities, state changes, and comments for a used entry           | Pending |
| Get History Return All spans more than one page on an entry with over 50 records        | Pending |
| Get Form for `create` returns fields and defaults                                       | Pending |
| Get Form for a custom activity against an existing entry returns that entry's values     | Pending |
| Get Form reports `confidence_threshold` when the activity defines one                    | Pending |
| Trigger to Get to Perform Activity runs end to end with no HTTP Request node              | Pending |
| The Listing and State selectors populate from a live module                                | Pending |

## Known gaps carried forward

- Get Many does not report per-entry `availableActivities`; `POST /api/mcp/list` does not return
  them. A workflow that needs the legal activities of a listed entry must call Get on it. Raising
  this with the platform API team is the cheapest way to close the list half of gap **G2**.
- Read responses are keyed by field display name, while Create, Update, and Perform Activity submit
  internal field names. The two halves of a read-then-write workflow therefore do not share key
  names, which users must map by hand.
- The MCP surface carries a seat gate (`McpSeatAuthorize`) that the `/api/activity/` write route
  does not. It is fail-open and unset by default today, but a deployment that enables the
  Connections member-type gate would refuse reads for a credential whose writes still succeed.
  Worth a line in the credential guide before 0.2.0 ships.

## Exit rule

The read operations can be marked ready only after every live test above has direct evidence, the
complete automated suite passes from a clean build, and the diff receives the same release and
security review required for the P0 package.
