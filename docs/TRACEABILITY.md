# Requirements Traceability

| Requirement | Implementation | Verification |
|---|---|---|
| JSON/YAML declarative users | `manifest.mjs`, `yaml.mjs`, examples | manifest and YAML tests |
| Idempotent reconciliation | stable flag keys and pure planner | converged no-op test |
| Supported Foundry APIs | `reconciler.mjs` batch create/update | mocked integration and static audit |
| Safe creation | validated create payloads | reconciler test |
| Explicit adoption | exact match resolver | planner adoption/collision tests |
| Managed updates | field diff plus managed metadata | drift test |
| Preserve unmanaged users | planner ignores unmatched unflagged users | collision and no-delete tests |
| Disable without deletion | role `NONE` | disable and no-delete tests |
| No secrets | strict field rejection | prohibited-field tests |
| Lockout prevention | projected GM and current-user gates | planner safety tests |
| Validation/logging/errors | structured issues, logger, UI findings | manifest tests and manual plan |
| CLI workflows | `tools/user-manifest.mjs` | CLI checks |
| ApplicationV2/UX | dashboard, launchers, settings, geometry | static audit and manual plan |
| Localization | EN/DE JSON | exact parity test |
| Public API | `scripts/api.mjs` | static API test |
| Reproducibility | deterministic ZIP writer | repeated SHA-256 comparison |
