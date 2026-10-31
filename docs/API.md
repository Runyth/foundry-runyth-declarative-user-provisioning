# Public API 1.0.0

Access:

```javascript
const api = game.modules.get("declarative-user-provisioning")?.api;
await api.whenReady();
```

| Method | Result |
|---|---|
| `whenReady()` | Resolves with the API after the Foundry `ready` phase |
| `openDashboard()` | Opens or focuses the singleton GM dashboard |
| `loadManifest({ path })` | Loads a safe relative manifest path |
| `validateManifest({ path, text })` | Returns normalized validation, issues, digest, source, and text |
| `plan({ path, text, orphanPolicy })` | Returns validation, current snapshot, and pure plan |
| `reconcile({ path, text, orphanPolicy, dryRun })` | Plans and optionally applies supported User creates/updates |
| `exportSnapshot({ download })` | Returns and optionally downloads a secret-free user snapshot |
| `exportSchema({ download })` | Returns and optionally downloads JSON Schema |
| `serializeManifest(manifest, { format })` | Canonical YAML or JSON |
| `status()` | API version, readiness, operation, settings, and last summary |

All user-data reads and changes are GM-restricted at API level. Callers should inspect `validation.valid` and `plan.valid` rather than assuming a plan is applicable.

Ready hook:

```javascript
Hooks.once("declarative-user-provisioning.ready", (api) => {
  console.log(api.status());
});
```
