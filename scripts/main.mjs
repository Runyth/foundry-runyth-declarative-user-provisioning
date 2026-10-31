// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Runyth. See the LICENSE file for rights and obligations.
import { DeclarativeUserProvisioningApi } from "./api.mjs";
import { MODULE_ID, MODULE_TITLE, MODULE_VERSION, SETTINGS } from "./core/constants.mjs";
import { logger } from "./core/logger.mjs";
import { registerSettings } from "./settings.mjs";
import { ProvisioningDashboard } from "./ui/dashboard.mjs";
import { registerLaunchers } from "./ui/launchers.mjs";

let api = null;

function exposeApi() {
  const module = game.modules.get(MODULE_ID);
  if (!module) throw new Error(`Module package '${MODULE_ID}' is unavailable.`);
  module.api = api;
}

function isPrimaryGamemaster() {
  if (!game.user?.isGM) return false;
  if (typeof game.user.isActiveGM === "boolean") return game.user.isActiveGM;
  const activeGamemasters = [...game.users].filter((user) => user.isGM && user.active).sort((left, right) => left.id.localeCompare(right.id));
  return activeGamemasters[0]?.id === game.user.id;
}

async function autoReconcile() {
  if (!game.settings.get(MODULE_ID, SETTINGS.ENABLED)) return;
  if (!game.settings.get(MODULE_ID, SETTINGS.AUTO_RECONCILE)) return;
  if (!isPrimaryGamemaster()) {
    logger.debug("Skipped automatic reconciliation because this client is not the primary active Gamemaster.");
    return;
  }
  const result = await api.reconcile();
  if (!result.validation.valid || !result.plan?.valid) {
    const errorCount = (result.validation.errors?.length ?? 0) + (result.plan?.errors?.length ?? 0);
    ui.notifications?.error?.(game.i18n.format("DUP.Notifications.AutoReconcileInvalid", { errors: errorCount }), { permanent: true });
    return;
  }
  ui.notifications?.info?.(game.i18n.format("DUP.Notifications.AutoReconcileComplete", { changes: result.plan.summary.changes }));
}

Hooks.once("init", () => {
  try {
    api = new DeclarativeUserProvisioningApi({ dashboardClass: ProvisioningDashboard });
    ProvisioningDashboard.configure(api);
    registerSettings(ProvisioningDashboard);
    registerLaunchers(() => api.openDashboard());
    exposeApi();
    logger.info(`Initialized v${MODULE_VERSION}; API ${DeclarativeUserProvisioningApi.apiVersion} is available.`);
  } catch (error) {
    logger.error("Initialization failed.", error);
  }
});

Hooks.once("ready", () => {
  void (async () => {
    if (!api) throw new Error("The public API was not initialized.");
    api.markReady();
    Hooks.callAll(`${MODULE_ID}.ready`, api);
    await autoReconcile();
    logger.info(`${MODULE_TITLE} is ready.`);
  })().catch((error) => {
    logger.error("Ready workflow failed.", error);
    ui.notifications?.error?.(game.i18n.format("DUP.Notifications.OperationFailed", { message: error.message }), { permanent: true });
  });
});
