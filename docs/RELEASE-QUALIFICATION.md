# Release Qualification — 1.0.0

## Decision

Qualified for controlled installation and target-world manual acceptance testing.

## Passed release gates

- Closed manifest schema and safe YAML parser
- Deterministic pure reconciliation planner
- Explicit ownership/adoption model
- No destructive User deletion path
- GM enforcement and startup-primary election
- Current-user and final-Gamemaster protection
- ApplicationV2-only module UI
- English/German localization parity
- Strict manifest/runtime path and archive validation
- Reproducible source and release archives

## Remaining runtime gate

The exact Foundry server, browser, world database, reverse proxy, and enabled-module stack must complete `MANUAL-TEST-PLAN.md`. Automatic startup reconciliation should remain disabled until a manual application followed by a zero-change preview succeeds.
