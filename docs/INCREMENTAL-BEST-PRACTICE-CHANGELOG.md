# Incremental Best-Practice Changelog

## 1.0.0 baseline

| Area | Best-practice decision |
|---|---|
| Identity | Stable manifest key in a namespaced User flag; mutable names are never implicit identity |
| Adoption | Explicit exact match only; ambiguous or missing matches fail closed |
| Lifecycle | ApplicationV2, declarative actions, native DOM, listener abort, singleton reuse |
| Safety | Disabled-by-default, preview-first, confirmation, no deletion, lockout gates |
| Parsing | Dependency-free strict YAML subset and closed schemas |
| Secrets | Authentication material is unsupported and rejected |
| Performance | Single snapshot, indexed O(n) matching, batched creates/updates, in-place filtering |
| Startup | One primary active GM, one client operation lock, no player-side writes |
| Accessibility | Semantic labels, fieldsets, table caption, live status, visible focus, keyboard controls |
| CSS | Complete module-root scoping; no broad Foundry selector modification |
| Localization | English/German parity and no hardcoded dashboard labels |
| API | Public versioned facade; internal classes remain replaceable |
| Packaging | Exact runtime/source separation, fixed ZIP timestamps/order, SHA-256 validation |
| Testing | Pure planner, parser, validation, mocked Foundry integration, static and package gates |
