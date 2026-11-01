# Runyth Declarative User Provisioning

Runyth Declarative User Provisioning 1.0.0 reconciles known Foundry VTT v13 world users from a version-controlled JSON or YAML manifest. It is system-independent, GM-authoritative, idempotent, non-destructive, and disabled by default.

## Safety model

- Missing managed users are created through Foundry User document batch APIs.
- Existing unmanaged users are adopted only through an explicit exact `match.id`, `match.name`, or both.
- Managed users are updated only when managed values drift.
- `enabled: false` assigns role `NONE`; it never deletes a User document.
- Unmanaged users are always preserved.
- Managed users omitted from a manifest are preserved by default; an explicit orphan policy may disable them.
- A plan that would remove every Gamemaster or downgrade the current user below Assistant is blocked.
- Passwords, password hashes, salts, secrets, tokens, external avatar URLs, traversal paths, and unknown fields are rejected.

## Installation

Extract `runyth-declarative-user-provisioning-v1.0.0.zip` into `FoundryVTT/Data/modules/`, restart Foundry, enable the module in a world, and open **Configure Settings → Module Settings → Runyth Declarative User Provisioning**. The dashboard is also available in the Settings sidebar and through `Ctrl+Alt+U`.

The install ZIP contains a non-versioned `runyth-declarative-user-provisioning/` root folder.

## Quick start

1. Copy `manifests/users.example.yaml` to a version-controlled location served by Foundry.
2. Edit stable keys, names, roles, and explicit adoption matches.
3. Set the relative manifest path in the dashboard.
4. Validate, preview, and inspect every action.
5. Enable provisioning, save settings, and apply the confirmed plan.
6. Enable startup reconciliation only after manual validation in the target world.

## Manifest example

```yaml
schemaVersion: 1
orphanPolicy: preserve
defaults:
  enabled: true
  role: PLAYER
users:
  - key: game-master
    name: Game Master
    role: GAMEMASTER
    match:
      name: Gamemaster
  - key: player-one
    name: Player One
    role: PLAYER
    color: "#4f46e5"
  - key: player-two
    name: Player Two
    enabled: false
    role: PLAYER
```

The stable `key` is module-owned identity. Renaming a managed user does not change that identity. A `match` is used only for explicit initial adoption.

## Public API

```javascript
const api = game.modules.get("runyth-declarative-user-provisioning")?.api;
await api.whenReady();
await api.validateManifest();
await api.plan();
await api.reconcile({ dryRun: true });
api.openDashboard();
```

State-changing methods enforce GM permissions internally.

## CLI

The complete source package includes the dependency-free CLI.

```text
node tools/user-manifest.mjs init users.yaml
node tools/user-manifest.mjs validate users.yaml
node tools/user-manifest.mjs format users.yaml --output users.json --format json
node tools/user-manifest.mjs digest users.yaml
node tools/user-manifest.mjs plan users.yaml --snapshot foundry-users-world.json
node tools/user-manifest.mjs schema --output manifest.schema.json
```

## Development and validation

```text
npm test
npm run check
npm run package
```

The repository uses dependency-free Node.js tooling and deterministic ZIP creation. See `docs/` for the architecture, manifest contract, security model, CLI, API, operations, compatibility audit, traceability, release qualification, and manual Foundry test plan.

## Compatibility

- Foundry VTT: minimum 13, verified manifest target 13.351, maximum 13
- Game systems: system-independent
- Required modules: none
- Runtime network dependencies: none

Official development references:

- https://foundryvtt.com/api/v13/
- https://foundryvtt.com/article/module-development/

## Licence
Copyright © 2026  [Daniel Braniewski](https://brani.dev/)

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program.  If not, see <https://www.gnu.org/licenses/>.
