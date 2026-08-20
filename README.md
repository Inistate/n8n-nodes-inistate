# n8n-nodes-inistate

Community nodes for connecting n8n workflows to Inistate.

This repository is under active development. The first minimal feature is an **Entry Created**
webhook trigger for the App02 Inistate environment.

## Current feature

The `Inistate Trigger` node:

- tests an API key with `GET https://app02.apps.inistate.com/api/profile`;
- registers an Entry Created hook using `POST /api/automationHook`;
- sends `medium: n8n` as a request header and `channel: n8n` in the request body;
- returns the received callback body, headers, and query values to the n8n workflow; and
- removes its registration with `GET /api/automationHook/delete/{id}` when deactivated.

## Credentials

Create an `Inistate API` credential and enter an App02 API key. The key is stored by n8n and sent
as `Authorization: fsk <API key>`. The node does not place the key in workflow parameters.

## Entry Created trigger

Add `Inistate Trigger` to a workflow and provide:

- the numeric workspace ID; and
- the numeric module ID.

For the dedicated sandbox module, the current values are workspace `2306` and module `19295`.
Publish the workflow to register its production webhook. App02 must be able to reach the n8n
webhook URL.

## Development

```bash
npm install
npm test
npm run lint
npm run dev
```

`npm run dev` starts a development n8n instance with the local node loaded.

## P0 limitations

- The API host is fixed to `https://app02.apps.inistate.com`.
- Only the Entry Created business-event trigger is implemented.
- Workspace and module selectors use explicit IDs.
- The App02 acceptance and delivery behavior for `medium: n8n` and `channel: n8n` still requires a
  live sandbox test.
