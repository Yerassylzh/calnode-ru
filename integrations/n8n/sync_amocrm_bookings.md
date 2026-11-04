# Sync today’s amoCRM bookings into CalNode

Import `sync_amocrm_bookings.workflow.json` into n8n. The export starts inactive with `dryRun: true`.

1. In **Fetch KVIK leads**, select an n8n **Header Auth** credential with header name `Authorization` and value `Bearer <INTEGRATION_SERVICE_SECRET>`. Use the secret configured on the KVIK backend. The CalNode questions and booking endpoints used here are public.
2. In **Configuration**, fill in the numeric `doctorFieldId`, `serviceFieldId`, `patientNameFieldId`, and `patientPhoneFieldId`, and the three `doctorEnums`. The service field ID identifies the custom field, while its selected `enum_id` identifies the catalog service. Verify both URLs and the pipeline, stage, and appointment field IDs. Set `sourceWorkspaceId` to match the workspace in the KVIK URL if you change workspaces.
3. Confirm that KVIK returns the patient name and phone as lead custom fields. The sample response omits these. If those details live only on linked contacts, KVIK needs to include them before those leads can sync.
4. Run **Run manually** and inspect **Sync summary and failure log**. Dry run checks mapping, patient contact, and the CalNode event’s booking questions. If a procedure dropdown uses different wording, set the exact label in `procedureOverrides` keyed by the service enum ID.
5. Set `dryRun: false` and publish to run every 10 minutes. To call it from another n8n workflow, select it in an **Execute Sub-workflow** or **Call n8n Workflow Tool** node. No input fields are needed. The final node returns one item with `bookings`, `failures`, and counts.

## What gets synced

The workflow follows KVIK’s `nextPage` from page 1 until it reaches `null`. The appointment query defaults to 91 inclusive calendar dates beginning today in Asia/Almaty and supports up to 365. It separately filters leads to those created since local midnight with one of the three configured doctor enum IDs and whose appointment time is still in the future when the run starts. Leads that first become eligible after their creation day fall outside this rule.

The embedded catalog contains all 71 services. The workflow selects the event slug that matches both the service enum and the doctor's surname. Leads for doctors outside the allowlist are skipped. A missing doctor ID or a missing or ambiguous event slug becomes a lead-level failure. `УЗИ сердца` (service enum `549687`) has no event option in the supplied catalog.

CalNode uses its normal availability and booking checks. A confirmed response returns the booking ID. Payment-required responses, unavailable slots, and transport failures are logged per lead and processing continues. A failed or incomplete KVIK page is logged as a fetch failure for the run. Only new bookings are created by this workflow. Edits and cancellations in amoCRM require separate handling.

Repeated submissions use the same workspace-and-lead CalNode idempotency key. CalNode’s replay record lasts approximately 24 hours. An altered payload with a previously used key can conflict. Review any uncertain write before replaying it after that window.

n8n saves the summary in execution history, subject to your instance’s retention settings. The summary omits patient names, phone numbers, and private links. Saved intermediate node data can contain them, so restrict access to the workflow’s execution history.
