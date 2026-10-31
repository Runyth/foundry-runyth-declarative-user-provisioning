# Operations Guide

## Recommended rollout

1. Install and enable the module with provisioning still disabled.
2. Export a user snapshot.
3. Create the manifest and explicitly match existing accounts intended for management.
4. Validate and preview until no errors remain.
5. Commit the manifest and review the diff.
6. Enable provisioning and apply once manually.
7. Re-preview to confirm every managed user is `Unchanged`.
8. Enable automatic startup reconciliation only after the idempotence check.

## Updating users

Change managed values in version control, deploy the manifest into a Foundry-served relative path, preview, and apply. Renaming retains identity through the stable key.

## Disabling access

Set `enabled: false`. The user remains in the world with role `NONE`, preserving document references and permitting later re-enablement.

## Removing management

There is intentionally no automatic unmanage operation. To stop managing a user, first use preserve orphan policy, remove the entry, verify preservation, then remove the module-managed flag manually through a controlled administrative migration or API extension. This prevents accidental ownership loss.

## Recovery

Because no users are deleted, recovery generally consists of restoring a role or correcting a manifest and rerunning reconciliation. Keep at least one separate tested Gamemaster account outside initial automation until the workflow is proven in the target environment.
