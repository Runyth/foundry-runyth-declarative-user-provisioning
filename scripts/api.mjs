// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Daniel Braniewski. See the LICENSE file for rights and obligations.
import { API_VERSION, MODULE_ID, SETTINGS } from "./core/constants.mjs";
import { logger } from "./core/logger.mjs";
import {
  canonicalManifestJson,
  canonicalManifestYaml,
  digestManifest,
  exportManifestSchema,
  parseAndValidateManifest,
} from "./core/manifest.mjs";
import { buildReconciliationPlan, createSnapshotFromFoundry } from "./core/planner.mjs";
import { applyReconciliationPlan, reconciliationInProgress } from "./core/reconciler.mjs";
import { getPermissionKeys, getRoleMap } from "./core/roles.mjs";
import { loadManifestText } from "./core/source.mjs";

function ensureGamemaster() {
  if (!game.user?.isGM) throw new Error(game.i18n.localize("DUP.Errors.GMOnly"));
}

function safeReport(report) {
  return {
    at: report.completedAt ?? report.generatedAt ?? new Date().toISOString(),
    dryRun: Boolean(report.dryRun),
    counts: report.counts ?? {},
    errors: report.errors?.length ?? 0,
    warnings: report.warnings?.length ?? 0,
  };
}

export class DeclarativeUserProvisioningApi {
  static apiVersion = API_VERSION;

  #dashboardClass;
  #readyPromise;
  #resolveReady;

  constructor({ dashboardClass }) {
    this.#dashboardClass = dashboardClass;
    this.#readyPromise = new Promise((resolve) => {
      this.#resolveReady = resolve;
    });
  }

  markReady() {
    this.#resolveReady?.(this);
    this.#resolveReady = null;
  }

  whenReady() {
    return this.#readyPromise;
  }

  openDashboard() {
    ensureGamemaster();
    return this.#dashboardClass.open();
  }

  async loadManifest({ path = game.settings.get(MODULE_ID, SETTINGS.MANIFEST_PATH) } = {}) {
    ensureGamemaster();
    return loadManifestText(path);
  }

  async validateManifest({ path, text } = {}) {
    ensureGamemaster();
    const loaded = text === undefined ? await this.loadManifest({ path }) : { path: path ?? "inline", text };
    const validation = parseAndValidateManifest(loaded.text, {
      source: loaded.path,
      permissionKeys: getPermissionKeys(),
    });
    const digest = validation.valid ? await digestManifest(validation.manifest) : null;
    return { ...validation, digest, source: loaded.path, text: loaded.text };
  }

  async plan({ path, text, orphanPolicy } = {}) {
    const validation = await this.validateManifest({ path, text });
    if (!validation.valid) return { validation, plan: null };
    const snapshot = createSnapshotFromFoundry();
    const plan = buildReconciliationPlan({
      manifest: validation.manifest,
      snapshot,
      manifestDigest: validation.digest,
      roleMap: getRoleMap(),
      orphanPolicy: orphanPolicy ?? game.settings.get(MODULE_ID, SETTINGS.ORPHAN_POLICY),
    });
    return { validation, snapshot, plan };
  }

  async reconcile({ path, text, orphanPolicy, dryRun = false } = {}) {
    ensureGamemaster();
    const result = await this.plan({ path, text, orphanPolicy });
    if (!result.validation.valid || !result.plan?.valid) return { ...result, report: null };
    const report = await applyReconciliationPlan(result.plan, { dryRun, logger });
    await game.settings.set(MODULE_ID, SETTINGS.LAST_REPORT, safeReport(report));
    return { ...result, report };
  }

  exportSnapshot({ download = false } = {}) {
    ensureGamemaster();
    const snapshot = createSnapshotFromFoundry();
    const text = `${JSON.stringify(snapshot, null, 2)}\n`;
    if (download) {
      foundry.utils.saveDataToFile(text, "application/json", `foundry-users-${game.world?.id ?? "world"}.json`);
    }
    return snapshot;
  }

  exportSchema({ download = false } = {}) {
    const schema = exportManifestSchema();
    const text = `${JSON.stringify(schema, null, 2)}\n`;
    if (download) foundry.utils.saveDataToFile(text, "application/schema+json", "runyth-declarative-user-provisioning.schema.json");
    return schema;
  }

  serializeManifest(manifest, { format = "yaml" } = {}) {
    return format === "json" ? canonicalManifestJson(manifest) : canonicalManifestYaml(manifest);
  }

  status() {
    return {
      apiVersion: API_VERSION,
      ready: Boolean(game.ready),
      running: reconciliationInProgress(),
      enabled: game.settings.get(MODULE_ID, SETTINGS.ENABLED),
      autoReconcile: game.settings.get(MODULE_ID, SETTINGS.AUTO_RECONCILE),
      manifestPath: game.settings.get(MODULE_ID, SETTINGS.MANIFEST_PATH),
      orphanPolicy: game.settings.get(MODULE_ID, SETTINGS.ORPHAN_POLICY),
      lastReport: game.settings.get(MODULE_ID, SETTINGS.LAST_REPORT),
    };
  }
}
