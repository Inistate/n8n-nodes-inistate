# Changelog

All notable changes are recorded here. This project follows Semantic Versioning.

## [Unreleased]

## [0.2.0] - 2026-09-01

### Changed

- **Breaking:** the credential's **Environment** dropdown is replaced by a free-form **Base URL**
  field, still shown only for `@inistate.com` and `@gneysoftware.com` usernames. Non-internal
  hosts are rejected for other usernames, and a custom URL must use `https://`.
- Credentials saved with the old `environment` value now resolve to `https://api.inistate.com`;
  internal users must re-enter their host in **Base URL**.

## [0.1.0] - 2026-08-27

### Added

- API-key credentials with `/api/profile` credential testing.
- Inistate action node with Create, Update, Perform Activity, Change State, and Assign.
- Dynamic form mapping with recursive nested-section/tab traversal and supported field types.
- Workspace, Module, Activity, Field, State, and User selectors.
- Inistate Trigger with Entry Created, Entry Updated, and filtered Activity Performed events.
- Shared webhook registration, delivery, and removal lifecycle using `medium: n8n` and
  `channel: n8n`.
- GitHub Actions npm publishing workflow with OIDC/provenance permissions.
- Contract, multi-item, selector, error, form-mapping, and webhook-lifecycle tests.

### Fixed

- Accept automation-hook registration IDs returned as a direct string as well as an object
  `id` value.

### Known limitations

- P0 is fixed to a single internal API host.
- Full production coverage for every possible API field type is not yet recorded.
