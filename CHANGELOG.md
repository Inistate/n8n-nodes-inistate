# Changelog

All notable changes are recorded here. This project follows Semantic Versioning.

## [Unreleased]

### Added

- Read operations on the Inistate action node, backed by the Inistate MCP API surface:
  - **Get** (`POST /api/mcp/entry`) returns one entry with its field values, current state, and
    `availableActivities` (`standard`, `custom`, and `stateFlow.currentState`/`transitions`).
  - **Get Many** (`POST /api/mcp/list`) queries a module or a named listing with Return All /
    Limit paging and options for state, assignee, creator, document ID, created and updated date
    ranges, wildcard search, sorting, a field projection, and a nested `and`/`or` filter object.
  - **Get History** (`POST /api/mcp/history`) returns the audit trail of an entry, including
    comments and the actor behind each row, with Return All / Limit paging.
  - **Get Form** (`POST /api/mcp/form`) describes an activity's fields, types, options, defaults,
    and `confidence_threshold`, optionally against an existing entry.
- Listing and State selectors for Get Many, and a Get Form activity selector that offers the
  standard activity forms alongside the module's custom activities.
- Read operations accept the document ID or the numeric entry ID that trigger payloads carry, so a
  workflow can resume straight from `header.documentId` or `header.id`.

### Changed

- The action node can now emit any number of output items per input item; collection reads produce
  one item per record, while every write operation still produces exactly one. Output items remain
  paired with their input item.
- Read requests are sent without the `medium: n8n` write marker.

### Known limitations

- Read responses are keyed by field display name, whereas the write operations submit internal
  field names. Map between the two rather than piping a read result straight into a write.
- Get Many does not report per-entry `availableActivities`; the list endpoint does not return
  them.

## [0.1.0] - 2026-08-27

### Added

- App02 API-key credentials with `/api/profile` credential testing.
- Inistate action node with Create, Update, Perform Activity, Change State, and Assign.
- Dynamic form mapping with recursive nested-section/tab traversal and supported field types.
- Workspace, Module, Activity, Field, State, and User selectors.
- Inistate Trigger with Entry Created, Entry Updated, and filtered Activity Performed events.
- Shared webhook registration, delivery, and removal lifecycle using `medium: n8n` and
  `channel: n8n`.
- GitHub Actions npm publishing workflow with OIDC/provenance permissions.
- Contract, multi-item, selector, error, form-mapping, and webhook-lifecycle tests.

### Fixed

- Accept App02 automation-hook registration IDs returned as a direct string as well as an object
  `id` value.

### Known limitations

- P0 is fixed to the App02 host.
- Full production coverage for every possible App02 field type is not yet recorded.
