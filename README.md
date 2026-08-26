# n8n-nodes-inistate

Community nodes for using Inistate entries and business events in n8n workflows.

> **P0 status:** release candidate under sandbox verification. Version `0.1.0` is not yet
> published. Credentials default to `https://api.inistate.com`; Inistate staff can select the
> `https://app02.apps.inistate.com` test environment.
>
> **P1 status:** Delete and Duplicate passed live in all three Production sandbox modules. State
> Changed hook registration/removal passed for both directions, but matching and non-matching
> webhook delivery still requires verification before approval.

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

Reference fields retain their dropdown for fixed values. Values mapped from an earlier node may be
a unique dropdown name such as `PJ001`, an Inistate internal ID, or an Inistate reference object in
the `{ Text, Id }` webhook shape. The node resolves these against the field's loaded reference
options.

When the ID and display value are in separate trigger properties, an expression may combine them
into an explicit `{ id, name }` object:

```js
={{ ({ id: $json.header.id, name: $json.data['Project Code'] }) }}
```

User/profile references may also include `username`. A plain displayed value is accepted only when
it uniquely matches a loaded option, preventing duplicate names from selecting the wrong entry.

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
username ends with `@inistate.com` or `@gneysoftware.com`, the credential form also shows the
**App02** test environment at `https://app02.apps.inistate.com`. App02 is rejected at request time
for other usernames. This is a client-side product restriction; the selected API still performs the
authoritative API-key check.

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

The current dedicated sandbox is hosted in Inistate Production:

- Workspace: `N8N Production Sandbox`
- Modules: `Task Tracker`, `Projects`, and `Members`
- Automated record prefix: `N8N-TEST`

The live harness resolves current workspace and module IDs from these exact names. IDs are not
hard-coded because they can differ from the retired App02 sandbox.

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
tests. Run Delete only against disposable `N8N-TEST` entries. The JSON above is a Task Tracker
example; the live harness reads each module's current form and supplies its required fields.

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

For the destructive-but-self-cleaning production sandbox matrix, open the git-ignored
`.env.live.local` file and set `INISTATE_API_KEY` to a least-privilege key scoped to the sandbox.
`INISTATE_WEBHOOK_URL` is optional for registration/removal and can be set to a public n8n test
webhook when collecting delivery evidence. Then run:

```bash
npm run test:live:production
```

The live harness refuses ambiguous names and targets only `N8N Production Sandbox`. It resolves and
tests `Task Tracker`, `Projects`, and `Members`, prefixes records with `N8N-TEST`, exercises safe
available actions plus P1 Duplicate/Delete and hook registration/removal, and attempts to delete
every record and hook it creates. This is still the Production API: confirm the key is restricted to
the sandbox workspace before running it.

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
