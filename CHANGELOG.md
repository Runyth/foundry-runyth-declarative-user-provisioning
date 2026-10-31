# Changelog

## 1.0.3 — 2026-11-01

### Fixed

- Pointed the manifest `download` URL at the release's own `-mod` archive instead of the previous version's release path.

## 1.0.2 — 2026-10-31

### Fixed

- Replaced the placeholder schema identifier with the public repository URL.

## 1.0.1 — 2026-10-31

### Changed

- Licensed the program under AGPL-3.0-or-later.
- Published install, source, and documentation archives as `-mod`, `-src`, and `-doc`.

## 1.0.0 — 2026-08-04

### Added

- Declarative JSON and strict safe-subset YAML user manifests.
- Stable managed-user keys stored in module flags.
- Idempotent create, explicit adopt, update, disable, preserve, and no-op planning.
- Foundry User document batch reconciliation through supported create and update APIs.
- Preservation of all unmanaged users and complete absence of destructive deletion workflows.
- Non-destructive `enabled: false` behavior through role `NONE`.
- Preserve-by-default and optional disable-orphan policies.
- Name-collision blocking and exact ID/name adoption controls.
- Current-user and last-Gamemaster lockout protection.
- Password, secret, token, unknown-field, unsafe avatar, and path-traversal rejection.
- ApplicationV2 dashboard with validation, searchable plan preview, confirmation, execution report, exports, safe defaults, persisted geometry, Settings launcher, module settings menu, and keybinding.
- English and German modular localization.
- Public API 1.0.0 for readiness, dashboard, loading, validation, planning, reconciliation, serialization, schema export, snapshots, and status.
- Dependency-free CLI for initialization, validation, canonical formatting, conversion, digesting, offline planning, and schema export.
- Deterministic install, source, and documentation packaging with SHA-256 evidence.
- Automated unit, integration, static-quality, manifest, localization, archive, and reproducibility validation.
