# Example workflows

Import any of these with n8n's **Import from File** command. None of them contains a credential,
workspace ID, module ID, API key, or production record data: after importing, pick your
credential, workspace, and module in each Inistate node, then work through the yellow **Setup**
note on the canvas.

Each approval template starts with a **Settings** node. It holds the values you're expected to
change, such as email addresses, activity and state names, and wait times, so you don't have to
hunt through the other nodes.

## Create an Inistate entry

[`create-inistate-entry.workflow.json`](create-inistate-entry.workflow.json): a Manual Trigger
connected to **Inistate → Entry → Create**. The fields load from the module's current create form.

## Approve Inistate entries by email

[`approve-by-email.workflow.json`](approve-by-email.workflow.json): when an entry enters your
approval state, the approver gets an email with **Approve** and **Reject** buttons. Their answer
is performed in Inistate as the matching activity.

```
Trigger (State Changed → Pending Approval) → Get entry → can it be approved?
  → email with Approve / Reject (waits up to N days)
  → Get entry again → is the answer still possible? → Perform Approve | Perform Reject
```

- The entry is **re-read after the answer arrives**. If someone already approved, rejected, or
  moved it in Inistate while the email was waiting, nothing is performed.
- Whether an activity is possible comes from Inistate's own `availableActivities`, so the state
  machine and the credential's permissions decide, not the workflow.
- Entry values are HTML-escaped before they go into the email, because n8n inserts the message
  into the email body as raw HTML.
- Requires an SMTP credential. To send the email from Gmail, Outlook, or Slack instead, swap the
  email node for that app's **Send and Wait for Response** operation. The rest of the workflow
  only reads `data.approved`.

## Wait for an approval in Inistate

[`wait-for-inistate-approval.workflow.json`](wait-for-inistate-approval.workflow.json): a
sub-workflow for the opposite direction. n8n files a request in Inistate, **pauses**, and resumes
once a person approves or rejects it there. It returns `{ approved, state, documentId }` to the
workflow that called it through **Execute Workflow**.

```
Called by another workflow → Create request → Wait → Get request → decided?
  ├ yes → return the decision
  └ no  → checks left? → Wait again | stop with an error
```

The default is to check every 15 minutes for 24 hours. A waiting execution holds no resources
between checks.

## Daily digest of stale approvals

[`stale-approvals-digest.workflow.json`](stale-approvals-digest.workflow.json): every morning,
emails a table of entries that have sat in the approval state for more than N days. It uses
**Get Many** with a state filter, an `Updated Before` date, and a narrow field projection. No email
is sent when nothing is stale.

The **Everything** listing works only for workspace admins. For any other account, pick a listing
that account can open, otherwise Inistate refuses the query.
