# Troubleshooting

| Symptom | Resolution |
|---|---|
| Manifest request returns 404 | Verify the configured relative path exists under Foundry's served data/module paths and matches case exactly. |
| Existing user causes a name collision | Add an explicit exact `match.id` or `match.name` when that user should be adopted; otherwise choose another desired name. |
| Match not found | Export a fresh snapshot and use the exact current ID/name. |
| Plan blocked by last-Gamemaster safety | Keep or create at least one desired `GAMEMASTER` before downgrading another. |
| Current user downgrade blocked | Apply the role transition from another Gamemaster client. |
| Permission key rejected | Export/validate inside the target Foundry runtime and use a key present in `CONST.USER_PERMISSIONS`. |
| Apply button disabled | Enable provisioning and save settings. Validation and preview intentionally remain usable while disabled. |
| Startup did not reconcile | Confirm enablement, startup reconciliation, valid path, and that the client is the primary active Gamemaster. |
| Window opens off-screen | Use Reset window; saved geometry is also clamped to the current viewport. |
