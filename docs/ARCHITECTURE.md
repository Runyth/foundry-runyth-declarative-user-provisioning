# Architecture

## Layers

| Layer | Responsibility |
|---|---|
| `scripts/core/yaml.mjs` | Dependency-free strict YAML parsing and canonical serialization |
| `scripts/core/manifest.mjs` | Parsing, normalization, schema validation, canonical output, digesting |
| `scripts/core/planner.mjs` | Pure snapshot-to-desired-state reconciliation planning and safety gates |
| `scripts/core/reconciler.mjs` | GM-authoritative Foundry User batch creates and updates |
| `scripts/core/source.mjs` | Safe same-origin relative manifest loading with byte limits |
| `scripts/api.mjs` | Stable public API boundary |
| `scripts/ui/dashboard.mjs` | ApplicationV2 interaction, preview, confirmation, exports, state |
| `scripts/settings.mjs` | World/client settings, submenu, keybinding |
| `tools/user-manifest.mjs` | Offline manifest workflows using the same parser and planner |

The planner is pure and accepts a normalized manifest, a user snapshot, a digest, a role map, and an orphan policy. It does not access Foundry globals. The runtime adapter converts Foundry User documents into snapshots, then submits only validated actions.

## Identity and ownership

A manifest entry's stable `key` is stored at `flags.runyth-declarative-user-provisioning.managed`. The flag contains schema version, manifest digest, desired role, and enabled state. Names are mutable display data and are not implicit identity.

An unmanaged existing user can enter module ownership only through an explicit exact `match`. Name collisions without a match fail closed.

## Reconciliation order

Creates are submitted before updates. This permits a new Gamemaster to exist before another managed Gamemaster is downgraded, while the planner independently verifies that the projected state retains at least one Gamemaster.

The module never calls a User deletion API.

## Concurrency

One reconciliation may run per client. Automatic startup reconciliation is restricted to the primary active Gamemaster client. Foundry remains authoritative for final document permissions and persistence.

## UI lifecycle

The dashboard uses `HandlebarsApplicationMixin(ApplicationV2)`, declarative actions, native DOM listeners, one `AbortController` per render, singleton reuse, and client-local geometry/state settings. CSS selectors are scoped under module-owned roots.
