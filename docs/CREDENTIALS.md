# Configure Inistate credentials

The Inistate nodes expose API-key and OAuth2 authentication. Store credentials only in n8n's
encrypted credential store. Never place them in a workflow parameter, source file, example, or
ordinary log.

## Connect with OAuth2

1. In the Inistate node, set **Authentication** to **OAuth2**.
2. Create an **Inistate OAuth2 API** credential.
3. Select **Connect my account** and complete the Inistate consent flow.
4. Save the credential and test the node against a workspace you can access.

The first connection attempt registers an OAuth client. If authorization must be retried, turn off
**Register New OAuth Client** before selecting **Connect** again. n8n will reuse the client ID and
OAuth URLs saved by the first registration instead of consuming another registration request.

n8n discovers the authorization server from `https://mcp.inistate.com/mcp` and registers the OAuth
client dynamically. When OAuth2 is selected, the action node translates supported requests to the
scoped `https://api.inistate.com/v1/...` API. API-key credentials continue to use the existing
`/api/...` routes.

OAuth2 workspace, module, activity, state, user, form, list, and activity requests use the `/v1`
API. Trigger registration/removal still uses `/api/automationHook`, because no equivalent `/v1`
webhook endpoint is currently defined in the supplied backend endpoint list. Reference-field option
loading also still depends on `/api/activity/formselection`. Those two flows require either bearer
token support on the legacy routes or corresponding scoped `/v1` backend endpoints.

## OAuth callback URL

n8n Cloud manages its public HTTPS URL automatically. No deployment setting is required.

For self-hosted production, the n8n administrator should configure the instance's public HTTPS
address once at deployment level:

```text
N8N_EDITOR_BASE_URL=https://n8n.example.com
N8N_WEBHOOK_URL=https://n8n.example.com
```

n8n then generates the OAuth callback URL from that address:

```text
https://n8n.example.com/rest/oauth2-credential/callback
```

For local OAuth testing, use a controlled HTTPS tunnel. Set both variables to the tunnel URL and
open n8n through that same URL before creating or connecting the credential. Do not copy a
temporary tunnel hostname into source control. Inistate OAuth registration currently rejects
loopback redirect addresses such as `localhost`, `127.0.0.1`, and `[::1]`; setting a loopback URL
manually does not bypass that restriction. Local API-key development does not require a tunnel.

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
