# n8n-nodes-inistate

Community nodes for using Inistate entries and business events in n8n workflows.

> **P0 status:** release candidate under sandbox verification. Version `0.1.0` is not yet
> published. Credentials default to `https://api.inistate.com`; Inistate staff can select the
> `https://app02.apps.inistate.com` test environment.
>
> **P1 status:** Delete, Duplicate, and State Changed are implemented as release candidates. Their
> automated contracts pass, but they are not approved until the destructive action and complete
> webhook lifecycle are verified in App02.

## Nodes

### Inistate actions

The action node provides five protected P0 operations and two P1 release-candidate operations:

| Priority | Operation        | Inistate activity contract | Required inputs                                                        |
| -------- | ---------------- | -------------------------- | ---------------------------------------------------------------------- |
| P0       | Create           | `create`                   | Workspace, module, dynamic form fields                                 |
| P0       | Update           | `edit`                     | Workspace, module, document ID, dynamic form fields                    |
| P0       | Perform Activity | Selected activity ID       | Workspace, module, document ID, activity, optional dynamic form fields |
| P0       | Change State     | `changeStatus`             | Workspace, module, document ID, destination state name                 |
| P0       | Assign           | `assign`                   | Workspace, module, document ID, username; due date is optional         |
| P1       | Delete           | `delete`                   | Workspace, module, document ID                                         |
| P1       | Duplicate        | `duplicate`                | Workspace, module, document ID                                         |

Create, Update, and Perform Activity load the selected Inistate form at design time. Supported
field types are text, long text, yes/no, integer and decimal numbers, date, date-time, selection,
module reference, and user/profile reference. Nested sections and tabs are traversed recursively.
Read-only and unsupported fields are not sent to the activity endpoint.

Every input item is processed independently and output items retain their n8n item pairing. Enable
**Continue On Fail** in the node settings to return an error item instead of stopping the workflow.

### Inistate Trigger

The trigger provides three protected P0 events and one P1 release-candidate event:

- Entry Created
- Entry Updated
- Activity Performed, filtered by a selected activity
- State Changed, filtered by a selected state and whether the entry enters or leaves it (P1)

Activation registers a hook with Inistate. Deactivation removes that hook. A delivered webhook JSON
body is emitted directly as the n8n output item.

For delivery testing, the selected Inistate environment must be able to reach the webhook URL shown
by n8n. A URL containing `localhost`, `127.0.0.1`, or a private-only hostname is not reachable from
the hosted APIs; expose the local instance through a controlled HTTPS tunnel or use a publicly
reachable test n8n instance.

## Source organization

n8n registers two package entry points: the action node and the trigger node. Their implementations
are split by operation and event so contributors can locate each feature without searching through
one large source file:

```text
nodes/
├── Inistate/
│   ├── Inistate.node.ts                 # Action-node metadata and router
│   └── actions/entry/
│       ├── assign.operation.ts
│       ├── changeState.operation.ts
│       ├── create.operation.ts
│       ├── delete.operation.ts
│       ├── duplicate.operation.ts
│       ├── performActivity.operation.ts
│       └── update.operation.ts
├── InistateTrigger/
│   ├── InistateTrigger.node.ts          # Trigger metadata and webhook receiver
│   ├── events/
│   │   ├── activityPerformed.event.ts
│   │   ├── entryCreated.event.ts
│   │   ├── entryUpdated.event.ts
│   │   └── stateChanged.event.ts
│   └── webhook/lifecycle.ts             # Registration, existence check, and removal
└── shared/                              # API helpers and Inistate request contracts
```

This layout is a project convention rather than an n8n restriction. `package.json` continues to
register only `Inistate.node.js` and `InistateTrigger.node.js`; the routers import the internal
operation and event modules.

## Supporting selectors

The nodes provide Name-or-ID selectors for Workspace, Module, Activity, Field, State, and User.
Dependent selectors require the preceding selection: Module depends on Workspace, while Activity,
Field, and State depend on Module. The Assign operation sends the selected user's username, and
Change State sends the selected state's name. State Changed sends the selected state's ID, matching
their distinct existing Inistate API contracts.

## Credentials

Create an **Inistate API** credential and enter your Inistate username (normally your email address)
and API key. The default environment is **Inistate**, which uses `https://api.inistate.com`. When the
username ends with `@inistate.com`, the credential form also shows the **App02** test environment at
`https://app02.apps.inistate.com`. App02 is rejected at request time for other usernames. This is a
client-side product restriction; the selected API still performs the authoritative API-key check.

n8n stores the key in its encrypted credential store and sends it as
`Authorization: fsk <API key>`. The key is never a workflow parameter. The credential test calls
`GET /api/profile` on the selected environment:

```text
GET https://api.inistate.com/api/profile
GET https://app02.apps.inistate.com/api/profile (App02 selection)
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

Use the created document ID for Update, Assign, Change State, Perform Activity, Duplicate, and Delete
tests. Run Delete only against a disposable `N8N-TEST` entry. The module contains `Start Work`
without a form and `Complete Task` with required form fields.

## Local development

Validated development toolchain:

- Node.js `22.22.0`
- npm `10.9.4`
- `@n8n/node-cli` `0.44.5`
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

- The supported API hosts are Inistate Production and App02. Customer-managed on-premise and
  arbitrary custom hosts are not supported in P0.
- Webhook authenticity cannot be cryptographically verified because the current Inistate hook
  contract does not expose a signing secret or signature header.
- Workspace discovery uses the legacy page-based endpoint; all other selectors are scoped to the
  selected workspace or module.
- The protected P0 baseline remains the five P0 actions and three P0 triggers above. Delete,
  Duplicate, and State Changed are implemented P1 release candidates, but are not live-approved.
  Comment, Information Due, and Field Changed remain deferred P2 scope.
- The action node remains available as an AI tool. Its operations return one bounded mutation
  response, so v1 does not add a Simplify Output toggle. Delete always returns `{ "deleted": true }`;
  other operations preserve the Inistate response. Delete is irreversible, so AI workflows should
  require human approval before allowing an agent to run it.
- The package is not production-ready until the live sandbox matrix, public webhook delivery,
  trusted npm publishing, and Creator Portal prerequisites are completed.

## Support and security

Open functional defects and compatibility reports in the
[GitHub issue tracker](https://github.com/Inistate/n8n-nodes-inistate/issues). For security reports,
follow [SECURITY.md](SECURITY.md) and do not disclose credentials or exploitable details publicly.

Release and maintenance procedures are documented in [docs/RELEASE.md](docs/RELEASE.md) and
[docs/MAINTENANCE.md](docs/MAINTENANCE.md). Current P0 evidence and blockers are recorded in
[docs/P0_READINESS.md](docs/P0_READINESS.md). P1 implementation and live-test gates are recorded in
[docs/P1_READINESS.md](docs/P1_READINESS.md).
