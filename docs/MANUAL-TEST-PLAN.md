# Manual Foundry v13 Test Plan

1. Install the ZIP and confirm every manifest script, style, template, and localization path loads without 404 or MIME errors.
2. Enable the module as a GM and confirm it is disabled by default.
3. Open the dashboard from Module Settings, Settings sidebar, and `Ctrl+Alt+U`.
4. Move, resize, close, reload, and reopen; confirm geometry persistence and viewport clamping.
5. Validate both bundled example formats and confirm equal plans.
6. Create a test unmanaged player and confirm a same-name desired entry is blocked without `match`.
7. Add exact `match.name`, preview adoption, apply, and confirm the managed flag is stored.
8. Re-preview and confirm the adopted user is unchanged.
9. Change name, role, color, avatar, and a supported permission; apply and verify only those fields and the module flag change.
10. Add a missing user and confirm creation without a password.
11. Set `enabled: false`; confirm role `NONE` and continued User document existence.
12. Remove a managed entry under preserve policy; confirm no change.
13. Switch to disable policy; confirm the orphan receives role `NONE` but is not deleted.
14. Attempt to disable the active current GM below Assistant; confirm blocking.
15. Attempt to remove the final Gamemaster; confirm blocking.
16. Add another Gamemaster, then repeat the role transition and confirm the valid plan applies.
17. Test two simultaneous GM clients; confirm only the primary active GM performs startup reconciliation.
18. Export a snapshot and schema; inspect that no authentication material is present.
19. Switch Foundry language between English and German; verify complete localized UI and notifications.
20. Test narrow viewport, keyboard navigation, visible focus, table scrolling, filters, and screen-reader labels.
21. Enable startup reconciliation after convergence and confirm a reload produces zero managed changes.
22. Disable the module and confirm no further startup changes occur.
