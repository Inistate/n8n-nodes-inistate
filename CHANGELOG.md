# Changelog

All notable changes are recorded here. This project follows Semantic Versioning.

## [Unreleased]

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
