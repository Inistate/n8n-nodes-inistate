# Security policy

## Reporting a vulnerability

Do not open a public issue for a suspected vulnerability. Email `sales@gneysoftware.com` with the
subject `Security: n8n-nodes-inistate` and include:

- the affected package version and n8n version;
- a concise reproduction that contains no live API key or customer data;
- the expected security impact; and
- a safe way to contact the reporter.

An Inistate repository maintainer should acknowledge the report, restrict disclosure to the people
needed to investigate it, and coordinate a fix and disclosure timeline with the reporter. No fixed
response-time SLA is promised for P0.

## Credential handling

The node uses n8n credential storage. Never put an Inistate API key in workflow parameters, source
files, screenshots, issue bodies, test fixtures, or ordinary logs. Revoke a key immediately if it is
exposed.

## Supported versions

Security fixes are applied to the latest published minor release. Older unreleased and pre-release
builds may be asked to upgrade before investigation continues.
