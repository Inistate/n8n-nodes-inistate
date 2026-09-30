# n8n-nodes-inistate

This is an n8n community node package for connecting workflows to
[Inistate](https://www.inistate.com/). It can read, create, and manage Inistate entries and start
n8n workflows when supported Inistate events occur.

> **Availability:** The package is available on npm for self-hosted n8n installations. Installation
> through n8n Cloud requires n8n verification.

## Installation

### After npm publication

On a self-hosted n8n instance, an owner or administrator can:

1. Open **Settings → Community Nodes**.
2. Select **Install**.
3. Enter `n8n-nodes-inistate`.
4. Accept the community-node warning and complete the installation.
5. Restart n8n if requested.

For queue-mode or private deployments, follow n8n's
[manual community-node installation guide](https://docs.n8n.io/integrations/community-nodes/installation-and-management/manual-installation/).

### Evaluate from source

Developers can run the node in the local n8n instance provided by the official node CLI:

```bash
git clone https://github.com/Inistate/n8n-nodes-inistate.git
cd n8n-nodes-inistate
npm ci
npm run dev
```

Open `http://localhost:5678`, create a local n8n owner account, and configure an Inistate
credential. This development command starts a separate local n8n instance; it does not install the
node into an existing n8n deployment.

## Operations

The package adds an **Inistate** action node and an **Inistate Trigger** node.

### Inistate actions

All actions operate on an entry in the selected workspace and module.

| Operation | What it does | Additional input |
| --- | --- | --- |
| Get | Reads one entry with its current state and the activities that are legal from it | Entry ID |
| Get Many | Queries entries in a module or listing | Listing, limit, and optional filters |
| Get History | Reads the audit trail of an entry: activities, state changes, and comments | Entry ID and limit |
| Get Form | Describes the fields, types, options, and defaults an activity expects | Activity and optional entry ID |
| Create | Creates an entry using the module's current create form | Dynamic form fields |
| Update | Updates an existing entry | Document ID and dynamic form fields |
| Perform Activity | Runs a selected Inistate activity | Document ID, activity, and any activity form fields |
| Change State | Moves an entry to a selected state | Document ID and destination state |
| Assign | Assigns an entry to a user | Document ID, username, and optional due date |
| Duplicate | Creates a copy of an entry | Document ID |
| Delete | Permanently deletes an entry | Document ID |

Delete cannot be undone and always returns `{ "deleted": true }`. The other actions return the
corresponding Inistate API response with its field names unchanged. Each incoming n8n item is
processed independently and output items remain paired with their input items. **Continue On Fail**
is supported.

### Reading entries

Read operations accept either identifier: the document ID (`N8N-TEST00001`) or the numeric entry
ID that trigger payloads carry as `header.id`. Write operations still require the document ID.

**Get** and **Get Form** each return one item. Their `availableActivities` object reports what the
entry currently permits:

```json
{
  "standard": ["edit", "changeState"],
  "custom": ["approve", "reject"],
  "stateFlow": {
    "currentState": "Pending Approval",
    "transitions": { "approve": ["Approved"], "reject": ["Rejected"] }
  }
}
```

**Get Many** and **Get History** return one output item per record and follow the API's `hasMore`
paging until **Return All** is satisfied or **Limit** is reached. Get Many's options cover state,
assignee, creator, document ID, created and updated date ranges, wildcard search, sorting, a
comma-separated **Fields** projection, and a **Filters** JSON object for module-specific field
filters with nested `and`/`or` support:

```json
{ "or": [{ "Status": "Active" }, { "Priority": "High" }] }
```

Narrowing **Fields** is the largest payload saving on wide modules. Listings are matched by name;
leave the selector empty for Everything.

### Resuming a workflow after a human decision

The read operations close the loop between the trigger and the next write, so a resume workflow
needs no HTTP Request node:

1. **Inistate Trigger** on State Changed or Activity Performed.
2. **Inistate → Get**, with Entry ID set to `{{ $json.header.documentId }}`.
3. A **Switch** on `{{ $json.availableActivities.stateFlow.currentState }}`.
4. **Inistate → Get Form** for the activity you intend to run, then **Perform Activity**.

An AI agent using this node as a tool should follow the same order: Get, read
`availableActivities`, Get Form, then Perform Activity.

### Inistate Trigger

| Event | When the workflow starts |
| --- | --- |
| Entry Created | A new entry is created in the selected module |
| Entry Updated | An entry in the selected module is updated |
| Activity Performed | The selected activity is performed on an entry |
| State Changed | An entry enters or leaves the selected state |

Activating a workflow registers an Inistate automation hook. Deactivating it removes the hook. The
received webhook body is returned directly as the trigger output.

The webhook URL generated by n8n must be reachable from Inistate. `localhost`, `127.0.0.1`, and
private-only hostnames aren't reachable from the hosted Inistate API. Use a publicly reachable test
instance or a controlled HTTPS tunnel when evaluating triggers locally.

## Credentials

The action and trigger nodes support an Inistate API key or Inistate OAuth2 connection.

### OAuth2

1. In the Inistate node, set **Authentication** to **OAuth2**.
2. Create an **Inistate OAuth2 API** credential.
3. Select **Connect my account** and complete the Inistate consent flow.
4. Save the credential and test it against a workspace you can access.

OAuth2 uses Inistate's dynamically registered MCP authorization connection and sends the resulting
bearer token to supported scoped `https://api.inistate.com/v1/...` endpoints. Self-hosted n8n must
have a public HTTPS editor URL for production OAuth callbacks. Local OAuth testing requires a
controlled HTTPS tunnel because Inistate currently rejects loopback callback addresses.

### API key

To use an API key:

1. In Inistate, open **Account → Integration**.
2. Generate or copy an API key.
3. In n8n, create an **Inistate API** credential.
4. Enter your Inistate username and API key.
5. Leave **Base URL** at its default for the production API, then test and save the credential.

The credential sends the key as `Authorization: fsk <API key>` and tests it with
`GET /api/profile`. The key must have access to every workspace, module, entry action, user, and
automation-hook operation used by the workflow. Use a dedicated least-privilege key when possible.

The **Base URL** field is visible only for `@inistate.com` and `@gneysoftware.com` usernames and is
intended for internal testing. Every other account uses the production API at
`https://api.inistate.com`.

See the [complete credential guide](docs/CREDENTIALS.md) for security and troubleshooting details.

## Quick start

To create an entry:

1. Create a workflow and add a **Manual Trigger**.
2. Add the **Inistate** node and select your Inistate credential.
3. Select **Entry → Create**.
4. Select a workspace and module.
5. Fill the fields loaded from the module's current create form.
6. Execute the workflow and inspect the returned entry.

You can also import the
[Create an Inistate entry example](examples/create-inistate-entry.workflow.json). After importing,
select your credential, workspace, and module, then complete the dynamically loaded fields.

## Dynamic fields and reference values

Create, Update, and Perform Activity load the selected Inistate form at design time. Supported
field types include text, long text, yes/no, integer and decimal numbers, date, date-time,
selection, module reference, and user/profile reference. Nested sections and tabs are traversed;
read-only and unsupported fields are not submitted.

Reference fields accept:

- an option selected from the loaded list;
- an Inistate internal ID;
- a unique displayed value, such as `PJ001`; or
- a reference object from an earlier webhook, such as `{ "Text": "PJ001", "Id": "123" }`.

If the ID and display value come from separate properties, combine them explicitly:

```js
={{ ({ id: $json.header.id, name: $json.data['Project Code'] }) }}
```

A plain displayed value is accepted only when it uniquely matches a loaded option. This prevents
duplicate names from selecting the wrong entry.

## Compatibility

- Minimum supported n8n version: `2.35.5`
- Version tested by the maintainers: `2.35.5`
- Node.js required for development: `22` or later
- Community-node installation must be enabled by the n8n deployment administrator

Earlier n8n versions have not been validated and are not currently supported.

## Known limitations

- The supported API host is Inistate Production. Customer-managed on-premise hosts are not
  supported in `0.1.0`.
- Inistate's current automation-hook contract doesn't expose a signing secret or signature header,
  so this node can't cryptographically verify webhook authenticity.
- Duplicate, Delete, and State Changed remain release-candidate functionality until the complete
  live delivery matrix is approved.
- Read operations call the Inistate MCP API surface, which serves display-name keyed data. Field
  keys in a read response are therefore display names, while Create, Update, and Perform Activity
  submit internal field names. Map between them rather than feeding a read result straight into a
  write.
- Get Many does not report per-entry `availableActivities`; the list endpoint doesn't return them.
  Call Get on an entry when a workflow needs to know which activities it permits.
- The action node is available as an AI tool. Require human approval before allowing an AI agent to
  run Delete or another irreversible business operation.

## Resources

- [Inistate website](https://www.inistate.com/)
- [Inistate API guide](https://community.inistate.com/t/how-to-use-inistate-api/437)
- [Inistate API reference](https://app.swaggerhub.com/apis/Inistate/InistateAPI/1.0.0)
- [n8n community-node documentation](https://docs.n8n.io/integrations/community-nodes/)
- [Credential guide](docs/CREDENTIALS.md)
- [Example workflows](examples/README.md)
- [Read-operations readiness record](docs/READ_READINESS.md)
- [Development guide](docs/DEVELOPMENT.md)
- [Release process](docs/RELEASE.md)

## Version history

`0.1.0` is the first release candidate. See [CHANGELOG.md](CHANGELOG.md) for implementation changes
and compatibility notes.

## Support and security

Report functional defects and compatibility problems through
[GitHub Issues](https://github.com/Inistate/n8n-nodes-inistate/issues). Follow
[SECURITY.md](SECURITY.md) for security reports; don't disclose credentials or exploitable details
in a public issue.

This project is available under the [MIT License](LICENSE).
