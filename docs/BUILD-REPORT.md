# Build and Validation Report — 1.0.0

Build date: 2026-08-04

## Release identity

- Display name: Runyth Declarative User Provisioning
- Module ID: `runyth-declarative-user-provisioning`
- Version: 1.0.0
- Public API: 1.0.0
- Manifest schema: 1
- Foundry target: v13, manifest verified 13.351
- Game-system dependency: none

## Implemented release scope

- Dependency-free JSON and strict safe-subset YAML manifest pipeline.
- Stable-key managed-user ownership and explicit exact-match adoption.
- Idempotent create, adopt, update, disable, preserve, and no-op planning.
- Supported Foundry User batch create/update adapter with no deletion path.
- Preserve-by-default orphan handling and reversible role-`NONE` disablement.
- Current-user and final-Gamemaster lockout prevention.
- Same-origin relative manifest loading, size limits, closed schemas, and secret-field rejection.
- ApplicationV2 dashboard, searchable plan, confirmation, exports, persisted geometry, launcher, submenu, and keybinding.
- English/German localization and accessible scoped UI.
- Versioned public API and dependency-free manifest CLI.
- Deterministic install, source, and documentation archive generation.

## Automated results

- Node tests: 37 passed, 0 failed.
- Quality gates: 10 passed.
- JavaScript syntax: passed.
- JSON syntax: passed.
- English/German localization parity: 93/93 keys.
- ApplicationV2 and prohibited legacy-pattern audit: passed.
- Template localization resolution: passed.
- CSS isolation: passed.
- CLI JSON/YAML validation: passed.
- Supported User batch API integration under mocks: passed.
- No User deletion API in production code: passed.

Full output is in `AUTOMATED-TEST-RESULTS.txt`.

## Runtime qualification boundary

No licensed live Foundry VTT server and browser world was available in the build environment. This release has static, pure-unit, mocked-integration, CLI, archive, and reproducibility qualification. The included manual test plan is required in the target world before automatic startup reconciliation is enabled.
