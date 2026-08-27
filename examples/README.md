# Example workflows

## Create an Inistate entry

[`create-inistate-entry.workflow.json`](create-inistate-entry.workflow.json) contains a Manual
Trigger connected to **Inistate → Entry → Create**.

To use it:

1. Install or load `n8n-nodes-inistate` in your n8n instance.
2. Import the JSON file using n8n's **Import from File** command.
3. Open **Create an Inistate entry**.
4. Select an Inistate credential.
5. Select the target workspace and module.
6. Complete the fields loaded from the module's current create form.
7. Execute the workflow.

The example deliberately contains no credential, workspace ID, module ID, API key, or production
record data.
