# Configure Inistate credentials

The Inistate action and trigger nodes use an **Inistate API** credential. Store the API key only in
n8n's encrypted credential store; never place it in a workflow parameter, source file, example, or
ordinary log.

## Prerequisites

- An Inistate account.
- Access to the workspaces and modules used by the workflow.
- Permission to generate or receive an API key.

## Create an API key

1. Sign in to Inistate.
2. Open **Account**.
3. Select **Integration**.
4. Generate a new API key or copy an existing dedicated key.

The public [Inistate API guide](https://community.inistate.com/t/how-to-use-inistate-api/437)
includes screenshots of this process. API endpoints are documented in the
[Inistate API reference](https://app.swaggerhub.com/apis/Inistate/InistateAPI/1.0.0).

## Add the credential to n8n

1. In n8n, open **Credentials** and select **Create Credential**.
2. Search for **Inistate API**.
3. Enter the Inistate username associated with the account.
4. Paste the API key into **API Key**.
5. Leave **Base URL** at its default, `https://api.inistate.com`. The field appears only for
   internal `@inistate.com` and `@gneysoftware.com` usernames, and is used only when Inistate
   has given you another host.
6. Select **Save**. n8n tests the key with `GET /api/profile`.

At request time, the node sends:

```text
Authorization: fsk <API key>
```

## Required access

Inistate remains the authority for API-key permissions. The key must be able to:

- read the profile used by the credential test;
- discover the selected workspace and module;
- read module forms, activities, states, reference options, and eligible users;
- perform every entry operation configured in the workflow; and
- create, inspect, and remove automation hooks when using Inistate Trigger.

Use a dedicated key with access only to the required workspaces and modules. Test destructive
operations, especially Delete, against disposable records before enabling a production workflow.

## Troubleshooting

### Credential test returns 401 or 403

- Confirm that the entire API key was copied without leading or trailing whitespace.
- Confirm that the key is active and belongs to the host set in **Base URL**.
- Generate a new key if the current key was revoked or rotated.

### A workspace, module, activity, state, or user is missing

- Confirm that the API key can access that object in Inistate.
- Select the workspace before loading modules.
- Select the module before loading activities, states, form fields, or users.
- Use **By ID** only when the object isn't available in the list and you know its current ID.

### The Base URL field isn't shown

The field is restricted to internal `@inistate.com` and `@gneysoftware.com` usernames. Every other
account uses `https://api.inistate.com`, which needs no configuration.

### A trigger activates but receives no event

- Confirm that the n8n production webhook URL is publicly reachable from Inistate.
- Confirm that the workflow is active, not only running in manual test mode.
- Confirm that the selected module, activity, state, and change direction match the event.
- Deactivate and reactivate the workflow after changing trigger configuration.
