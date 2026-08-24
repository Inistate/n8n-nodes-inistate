# N8N Round 1 Testing Notes

Recorded: 2026-08-24 (Asia/Singapore)

These findings were recorded after the first local and App02 testing round. They are observations
and follow-up decisions, not confirmation that release readiness is complete.

## 1. Entry identifier input

The action node currently accepts only an Inistate document ID for Update, Perform Activity, Change
State, Assign, Delete, and Duplicate. The activity request contract sends the value as `entry` and
rejects a numeric-only internal entry ID.

Potential improvement:

- Provide an Entry resource locator with **From List** and **By Document ID** modes.
- Display the entry title and document ID in list results while returning the document ID.
- Add **By Internal Entry ID** only after App02 confirms that `/api/activity/` accepts an internal
  numeric ID, or after a reliable internal-ID-to-document-ID lookup is implemented.

The existing Zapier integration also requests the document ID rather than the internal entry ID.

## 2. Error-message coverage

Useful local messages currently exist for:

- Missing document ID.
- A numeric internal ID supplied where a document ID is expected.
- Update with no selected fields.
- Missing activity, state, or assignment user.
- An inaccessible listing or unknown document ID.
- Missing editable values.
- A missing n8n webhook URL.
- A missing or invalid webhook registration ID.
- A missing activity filter for the Activity Performed trigger.

Gaps:

- App02 messages are largely passed through, so vague server messages remain vague.
- Continue On Fail currently retains only `error.message`.
- Not every validation branch has a direct automated test.
- Required dynamic-field errors still depend partly on n8n and App02 validation.

Recommended follow-up: add operation-specific error context without exposing credentials or sensitive
payload data.

## 3. Dynamic-field reload behavior

The resource-mapped form fields currently reload when the operation, workspace, module, or activity
changes.

- Create reloads for operation/workspace/module changes.
- Update reloads the module Edit form for operation/workspace/module changes.
- Perform Activity reloads for operation/workspace/module/activity changes.
- Changing the document ID does not reload the form schema.
- Update fetches current entry values only during execution, then merges selected changes.

The workspace reload dependency was added after Round 1. Include document ID only if the form or its
reference choices are intentionally entry-dependent.

## 4. Chaining multiple action nodes

Adding a second correctly configured action node after a working action node should not fail merely
because the nodes are connected. Each node is configured independently and does not automatically
inherit the previous node's workspace, module, or document ID.

For example, an Update node following Create may obtain its document ID from an expression such as:

```text
{{$json.header.documentId}}
```

If chaining fails, capture the exact error and both selected operations. Possible causes include a
missing second-node parameter, an incorrect output expression, a state transition caused by the
first action, stale dynamic fields, or a different API response shape.

## 5. Trigger scope

Entry Updated and Activity Performed triggers are currently module-wide:

- Entry Updated registers the module with `item: edit`.
- Activity Performed registers the module and selected activity ID.
- Neither registration contains an entry ID or document ID.

This matches the existing Zapier integration. An n8n IF node can filter the delivered payload by
`header.documentId`. An optional Document ID filter could be added to the trigger, but App02 would
still deliver all matching module events unless its hook API supports server-side entry filtering.

## 6. Self-trigger loop risk

An Entry Updated trigger followed by an action that updates the same entry can repeatedly create new
workflow executions. n8n treats each webhook delivery as a separate execution. The existing Zapier
integration contains no loop-prevention logic either.

Safe workflow patterns include:

- Update only if the current value differs from the target value.
- Set and check a `Processed By n8n` marker.
- Filter by document ID before updating.
- Use event-source or updater filtering only if live callback evidence proves those fields are stable.
- Reject recently processed event IDs if App02 provides a stable unique event identifier.

Recommended product follow-up:

- Add an optional Document ID filter to Entry Updated and Activity Performed.
- Add a visible self-trigger-loop warning to Entry Updated.
- Add an automatic “ignore n8n-generated events” option only if App02 reliably delivers an origin
  identifier such as the activity medium or another source field.
