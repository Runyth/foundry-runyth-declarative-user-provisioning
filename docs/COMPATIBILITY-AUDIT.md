# Foundry v13 Compatibility and Interference Audit

## Target

- Foundry VTT minimum 13
- Manifest verified target 13.351
- Maximum 13
- System-independent

## Supported interfaces

- `foundry.documents.User` / `CONFIG.User.documentClass`
- static `createDocuments` and `updateDocuments`
- `foundry.applications.api.ApplicationV2`
- `HandlebarsApplicationMixin`
- `DialogV2.confirm`
- `game.settings.register` and `registerMenu`
- `game.keybindings.register`
- `foundry.utils.getRoute` and `saveDataToFile`
- normal Foundry hooks and module API attachment

## Interference review

The module does not patch prototypes, replace core methods, modify user sheets, inject into Actor/Item/Scene applications, use sockets, add canvas overlays, intercept chat, depend on a game system, use global CSS selectors, or call deletion APIs. The Settings launcher is inserted only into the positive `#settings-game` target and is deduplicated.

## Application lifecycle

The module-owned window is an ApplicationV2 with a Handlebars mixin, declarative actions, remembered and clamped geometry, native DOM events, render-scoped listener cleanup, and singleton reuse. No module-owned ApplicationV1 class is present.

## Runtime qualification boundary

A licensed Foundry browser world was not available in the build environment. Static analysis, pure planning tests, mocked User batch integration, manifest validation, localization parity, package integrity, and deterministic rebuild tests are included. Execute the manual plan in the target Foundry stack before enabling automatic reconciliation.
