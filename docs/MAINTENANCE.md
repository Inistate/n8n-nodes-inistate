# Maintenance policy

## Ownership and issue intake

The `Inistate` GitHub organization maintains this repository. Functional defects and compatibility
reports use <https://github.com/Inistate/n8n-nodes-inistate/issues>. Security reports use the private
path in `SECURITY.md`.

The P0 plan intentionally does not name an individual reviewer or API decision-maker. That is a
recorded governance and response-time risk, not a completed control.

## Compatibility checks

For every dependency update and before every release:

1. test on the pinned development toolchain in the README;
2. run build, lint, all automated tests, production dependency audit, and package dry-run;
3. clean-install the tarball in a separate n8n instance;
4. test one form-based action, one no-form action, one state-changing action, and webhook
   registration/delivery/removal against the dedicated App02 sandbox; and
5. record any newly tested n8n/Node.js versions in the README and P0 evidence log.

## Dependency updates

Review npm advisories and new `@n8n/node-cli`, n8n, TypeScript, ESLint, Prettier, release-it, and
auto-changelog versions at least for each release. Runtime dependencies should remain empty unless a
dependency is essential, maintained, licence-compatible, and approved. Commit lockfile changes and
rerun the full compatibility checks.

Development-only advisories inherited through the official n8n CLI must be recorded with their
upstream package and version. They do not change the production package contents, but they still
remain an unresolved toolchain risk until a compatible upstream version fixes them.
