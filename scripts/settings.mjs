// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Runyth. See the LICENSE file for rights and obligations.
import {
  DEFAULT_MANIFEST_PATH,
  LOG_LEVELS,
  MODULE_ID,
  ORPHAN_POLICIES,
  SETTINGS,
} from "./core/constants.mjs";

export function registerSettings(DashboardClass) {
  const fields = foundry.data.fields;

  game.settings.register(MODULE_ID, SETTINGS.ENABLED, {
    name: "DUP.Settings.Enabled.Name",
    hint: "DUP.Settings.Enabled.Hint",
    scope: "world",
    config: true,
    type: new fields.BooleanField(),
    default: false,
  });

  game.settings.register(MODULE_ID, SETTINGS.AUTO_RECONCILE, {
    name: "DUP.Settings.AutoReconcile.Name",
    hint: "DUP.Settings.AutoReconcile.Hint",
    scope: "world",
    config: true,
    type: new fields.BooleanField(),
    default: false,
  });

  game.settings.register(MODULE_ID, SETTINGS.MANIFEST_PATH, {
    name: "DUP.Settings.ManifestPath.Name",
    hint: "DUP.Settings.ManifestPath.Hint",
    scope: "world",
    config: true,
    type: new fields.StringField({ nullable: false }),
    default: DEFAULT_MANIFEST_PATH,
  });

  game.settings.register(MODULE_ID, SETTINGS.ORPHAN_POLICY, {
    name: "DUP.Settings.OrphanPolicy.Name",
    hint: "DUP.Settings.OrphanPolicy.Hint",
    scope: "world",
    config: true,
    type: new fields.StringField({ nullable: false }),
    choices: {
      [ORPHAN_POLICIES.PRESERVE]: "DUP.OrphanPolicy.Preserve",
      [ORPHAN_POLICIES.DISABLE]: "DUP.OrphanPolicy.Disable",
    },
    default: ORPHAN_POLICIES.PRESERVE,
  });

  game.settings.register(MODULE_ID, SETTINGS.LOG_LEVEL, {
    name: "DUP.Settings.LogLevel.Name",
    hint: "DUP.Settings.LogLevel.Hint",
    scope: "client",
    config: true,
    type: new fields.StringField({ nullable: false }),
    choices: {
      [LOG_LEVELS.ERROR]: "DUP.LogLevel.Error",
      [LOG_LEVELS.WARN]: "DUP.LogLevel.Warn",
      [LOG_LEVELS.INFO]: "DUP.LogLevel.Info",
      [LOG_LEVELS.DEBUG]: "DUP.LogLevel.Debug",
    },
    default: LOG_LEVELS.INFO,
  });

  game.settings.register(MODULE_ID, SETTINGS.DASHBOARD_GEOMETRY, {
    scope: "client",
    config: false,
    type: new fields.ObjectField(),
    default: {},
  });

  game.settings.register(MODULE_ID, SETTINGS.DASHBOARD_STATE, {
    scope: "client",
    config: false,
    type: new fields.ObjectField(),
    default: { filter: "", actionFilter: "all" },
  });

  game.settings.register(MODULE_ID, SETTINGS.LAST_REPORT, {
    scope: "world",
    config: false,
    type: new fields.ObjectField(),
    default: {},
  });

  game.settings.registerMenu(MODULE_ID, "dashboard", {
    name: "DUP.Settings.Menu.Name",
    label: "DUP.Settings.Menu.Label",
    hint: "DUP.Settings.Menu.Hint",
    icon: "fa-solid fa-users-gear",
    type: DashboardClass,
    restricted: true,
  });

  game.keybindings.register(MODULE_ID, "openDashboard", {
    name: "DUP.Keybinding.Open.Name",
    hint: "DUP.Keybinding.Open.Hint",
    editable: [{ key: "KeyU", modifiers: ["Control", "Alt"] }],
    restricted: true,
    onDown: () => {
      DashboardClass.open();
      return true;
    },
  });
}

export function getSettings() {
  return {
    enabled: game.settings.get(MODULE_ID, SETTINGS.ENABLED),
    autoReconcile: game.settings.get(MODULE_ID, SETTINGS.AUTO_RECONCILE),
    manifestPath: game.settings.get(MODULE_ID, SETTINGS.MANIFEST_PATH),
    orphanPolicy: game.settings.get(MODULE_ID, SETTINGS.ORPHAN_POLICY),
    logLevel: game.settings.get(MODULE_ID, SETTINGS.LOG_LEVEL),
  };
}
