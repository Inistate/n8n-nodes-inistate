# n8n-nodes-inistate

Community nodes for using Inistate entries and business events in n8n workflows.

> **P0 status:** release candidate under sandbox verification. Version `0.1.0` is not yet
> published. P0 connects only to `https://app02.apps.inistate.com`; other Inistate hosts are
> intentionally deferred.

## Nodes

### Inistate actions

The action node provides the five protected P0 operations:

| Operation        | Inistate activity contract | Required inputs                                                        |
| ---------------- | -------------------------- | ---------------------------------------------------------------------- |
| Create           | `create`                   | Workspace, module, dynamic form fields                                 |
| Update           | `edit`                     | Workspace, module, document ID, dynamic form fields                    |
| Perform Activity | Selected activity ID       | Workspace, module, document ID, activity, optional dynamic form fields |
| Change State     | `changeStatus`             | Workspace, module, document ID, destination state name                 |
| Assign           | `assign`                   | Workspace, module, document ID, username; due date is optional         |

Create, Update, and Perform Activity load the selected Inistate form at design time. Supported
field types are text, long text, yes/no, integer and decimal numbers, date, date-time, selection,
module reference, and user/profile reference. Nested sections and tabs are traversed recursively.
Read-only and unsupported fields are not sent to the activity endpoint.

Every input item is processed independently and output items retain their n8n item pairing. Enable
**Continue On Fail** in the node settings to return an error item instead of stopping the workflow.

### Inistate Trigger

The trigger provides the three protected P0 business events:

- Entry Created
- Entry Updated
- Activity Performed, filtered by a selected activity

Activation registers a hook with Inistate. Deactivation removes that hook. A delivered webhook JSON
body is emitted directly as the n8n output item.

For delivery testing, App02 must be able to reach the webhook URL shown by n8n. A URL containing
`localhost`, `127.0.0.1`, or a private-only hostname is not reachable from App02; expose the local
instance through a controlled HTTPS tunnel or use a publicly reachable test n8n instance.

## Supporting selectors

The nodes provide Name-or-ID selectors for Workspace, Module, Activity, Field, State, and User.
Dependent selectors require the preceding selection: Module depends on Workspace, while Activity,
Field, and State depend on Module. The Assign operation sends the selected user's username, and
Change State sends the selected state's name, matching the existing Inistate API contracts.

## Credentials

Create an **Inistate API** credential and enter an App02 API key. n8n stores the key in its encrypted
credential store and sends it as `Authorization: fsk <API key>`. The key is never a workflow
parameter. The credential test calls:

```text
GET https://app02.apps.inistate.com/api/profile
```

Use a dedicated non-production API key with only the permissions needed for the test workspace. Do
not commit the key, paste it into source code, or place it in ordinary logs.

## Sandbox example

The current dedicated sandbox is:

- Workspace: `N8N Node Testing` (`2307`)
- Module: `P0 Task Tracker` (`19296`)
- Automated record prefix: `N8N-TEST`

Example Create values:

```json
{
	"Task Title": "N8N-TEST create from n8n",
	"Description": "P0 action smoke test",
	"Priority": "Medium",
	"Estimated Hours": 1.5,
	"Due Date": "2026-08-21",
	"Reminder At": "2026-08-21T09:30:00+08:00",
	"Is Blocked": false,
	"Test Run ID": "N8N-TEST-20260820"
}
```

Use the created document ID for Update, Assign, Change State, and Perform Activity tests. The module
contains `Start Work` without a form and `Complete Task` with required form fields.

## Local development

Validated development toolchain:

- Node.js `22.22.0`
- npm `10.9.4`
- `@n8n/node-cli` `0.44.4`
- local n8n `2.35.5`

Install and verify:

```bash
npm ci
npm test
npm run lint
npm pack --dry-run --json
```

Start the linked development instance:

```bash
npm run dev
```

Open `http://localhost:5678`, create or open a local n8n owner account, add the Inistate credential,
and add either node to a workflow. This local n8n instance is the expected development method; no
desktop n8n application is required.

For the destructive-but-self-cleaning App02 sandbox matrix, supply `INISTATE_API_KEY` through your
shell or CI secret mechanism, then run:

```bash
npm run test:live:app02
```

The live harness is restricted by default to workspace `2307` and module `19296`, prefixes created
records with `N8N-TEST`, exercises the five P0 actions plus hook registration/removal, and attempts
to delete every record and hook it creates. Do not run it against a production workspace.

## Installation after publication

In self-hosted n8n, open **Settings → Community Nodes**, install `n8n-nodes-inistate`, and restart
n8n if requested. Community-node installation availability depends on the n8n deployment policy.

## P0 limitations

- The API host is fixed to App02. Production, internal, customer-managed on-premise, and arbitrary
  custom hosts are not supported in P0.
- Webhook authenticity cannot be cryptographically verified because the current Inistate hook
  contract does not expose a signing secret or signature header.
- Workspace discovery uses the legacy page-based endpoint; all other selectors are scoped to the
  selected workspace or module.
- Only the five actions and three triggers listed above are P0. Delete, Duplicate, Comment,
  Information Due, Field Changed, and State Changed are deferred.
- The package is not production-ready until the live sandbox matrix, public webhook delivery,
  trusted npm publishing, and Creator Portal prerequisites are completed.

## Support and security

Open functional defects and compatibility reports in the
[GitHub issue tracker](https://github.com/Inistate/n8n-nodes-inistate/issues). For security reports,
follow [SECURITY.md](SECURITY.md) and do not disclose credentials or exploitable details publicly.

Release and maintenance procedures are documented in [docs/RELEASE.md](docs/RELEASE.md) and
[docs/MAINTENANCE.md](docs/MAINTENANCE.md). Current P0 evidence and blockers are recorded in
[docs/P0_READINESS.md](docs/P0_READINESS.md).
