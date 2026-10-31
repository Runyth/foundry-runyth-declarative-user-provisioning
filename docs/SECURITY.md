# Security and Safety Model

## Trust boundary

The manifest is treated as untrusted configuration until parsed and validated. Loading accepts only same-origin relative Foundry paths ending in JSON, YAML, or YML. External protocols, path traversal, oversized content, unknown fields, and unsupported YAML features fail closed.

## Authentication separation

The module neither accepts nor persists passwords, hashes, salts, API keys, cookies, tokens, or other authentication material. Created users have no password configured by this module. Foundry's normal administrator workflow remains responsible for account authentication.

## Authorization

Every dashboard and public API operation that reads or changes world users requires a GM. Applying a plan is also checked inside the reconciler. Automatic startup work runs only from one primary active GM client.

## Destructive-action policy

No user deletion exists. Disabling means setting role `NONE`. Unmanaged users are never modified. Managed orphans are preserved unless the explicit disable policy is selected.

## Lockout prevention

The planner blocks:

- a projected world state with zero Gamemasters;
- disabling or downgrading the current user below Assistant;
- ambiguous or conflicting adoption;
- duplicate stable managed keys;
- duplicate desired names;
- implicit adoption through a name collision.

## Logging

Console logs contain action metadata and error details but no authentication material. The persisted last report is a count summary rather than a full user snapshot.
