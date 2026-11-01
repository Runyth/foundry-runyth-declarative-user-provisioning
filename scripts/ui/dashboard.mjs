// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Daniel Braniewski. See the LICENSE file for rights and obligations.
import { ACTIONS, MODULE_ID, MODULE_TITLE, ORPHAN_POLICIES, SETTINGS } from "../core/constants.mjs";
import { logger } from "../core/logger.mjs";
import { getSettings } from "../settings.mjs";
import { DEFAULT_GEOMETRY, clampGeometry, loadGeometry, saveGeometry } from "./geometry.mjs";

const { ApplicationV2, HandlebarsApplicationMixin, DialogV2 } = foundry.applications.api;

function localize(key) {
  return game.i18n.localize(key);
}

function notify(level, key, data = {}) {
  const message = Object.keys(data).length > 0 ? game.i18n.format(key, data) : localize(key);
  ui.notifications?.[level]?.(message);
}

function actionLabel(type) {
  const suffix = {
    [ACTIONS.CREATE]: "Create",
    [ACTIONS.ADOPT]: "Adopt",
    [ACTIONS.UPDATE]: "Update",
    [ACTIONS.DISABLE_ORPHAN]: "DisableOrphan",
    [ACTIONS.NOOP]: "Noop",
    [ACTIONS.PRESERVE]: "Preserve",
    [ACTIONS.ERROR]: "Error",
  }[type] ?? "Unknown";
  return localize(`DUP.Action.${suffix}`);
}

function asRoot(element) {
  if (element instanceof HTMLElement) return element;
  if (element?.[0] instanceof HTMLElement) return element[0];
  return null;
}

function readForm(root) {
  const path = root.querySelector('[name="manifestPath"]')?.value?.trim() ?? "";
  const orphanPolicy = root.querySelector('[name="orphanPolicy"]')?.value ?? ORPHAN_POLICIES.PRESERVE;
  const enabled = Boolean(root.querySelector('[name="enabled"]')?.checked);
  const autoReconcile = Boolean(root.querySelector('[name="autoReconcile"]')?.checked);
  return { path, orphanPolicy, enabled, autoReconcile };
}

function issueRows(validation, plan) {
  return [...(validation?.errors ?? []), ...(validation?.warnings ?? []), ...(plan?.errors ?? []), ...(plan?.warnings ?? [])];
}

export class ProvisioningDashboard extends HandlebarsApplicationMixin(ApplicationV2) {
  static api = null;
  static fallbackInstance = null;

  static DEFAULT_OPTIONS = {
    id: `${MODULE_ID}-dashboard`,
    classes: ["dup-dashboard"],
    tag: "form",
    window: {
      title: "DUP.App.Title",
      icon: "fa-solid fa-users-gear",
      resizable: true,
    },
    position: {
      width: DEFAULT_GEOMETRY.width,
      height: DEFAULT_GEOMETRY.height,
    },
    form: {
      closeOnSubmit: false,
      handler: async () => {},
    },
    actions: {
      validate: function () { return this.#validateManifest(); },
      preview: function () { return this.#previewPlan(); },
      apply: function () { return this.#applyPlan(); },
      saveSettings: function () { return this.#saveSettings(); },
      exportSnapshot: function () { return this.#exportSnapshot(); },
      exportSchema: function () { return this.#exportSchema(); },
      resetGeometry: function () { return this.#resetGeometry(); },
    },
  };

  static PARTS = {
    main: { template: `modules/${MODULE_ID}/templates/dashboard.hbs` },
  };

  static configure(api) {
    this.api = api;
  }

  static open() {
    if (!game.user?.isGM) {
      notify("error", "DUP.Errors.GMOnly");
      return null;
    }
    const applicationId = this.DEFAULT_OPTIONS.id;
    const instances = foundry.applications.instances;
    let application = instances?.get?.(applicationId) ?? this.fallbackInstance;
    if (application && !(application instanceof this)) {
      void application.close?.().catch?.(() => undefined);
      application = null;
    }
    if (!application) {
      application = new this({ position: loadGeometry() });
      this.fallbackInstance = application;
    }
    void application.render({ force: true }).then(() => application.bringToFront?.()).catch((error) => {
      logger.error("Could not open dashboard.", error);
      notify("error", "DUP.Notifications.OperationFailed", { message: error.message });
    });
    return application;
  }

  #busy = false;
  #validation = null;
  #plan = null;
  #snapshot = null;
  #report = null;
  #listeners = null;
  #geometryTimer = null;
  #stateTimer = null;

  async _prepareContext(options) {
    const settings = getSettings();
    let state = { filter: "", actionFilter: "all" };
    try {
      state = { ...state, ...(game.settings.get(MODULE_ID, SETTINGS.DASHBOARD_STATE) ?? {}) };
    } catch {
      // Client state is optional.
    }
    const actions = (this.#plan?.actions ?? []).map((action) => ({
      ...action,
      label: actionLabel(action.type),
      current: action.currentName ?? "—",
      desired: action.name ?? "—",
      reason: action.reasons?.join(", ") ?? "—",
      changes: Object.keys(action.data ?? {}).filter((key) => !key.startsWith("flags.")).join(", ") || "—",
    }));
    const issues = issueRows(this.#validation, this.#plan).map((entry) => ({
      ...entry,
      severityLabel: localize(entry.severity === "warning" ? "DUP.Severity.Warning" : "DUP.Severity.Error"),
    }));
    return {
      ...await super._prepareContext(options),
      moduleTitle: MODULE_TITLE,
      busy: this.#busy,
      settings,
      state,
      validation: this.#validation,
      plan: this.#plan,
      report: this.#report,
      actions,
      issues,
      hasActions: actions.length > 0,
      hasIssues: issues.length > 0,
      actionableCount: this.#plan?.summary?.changes ?? 0,
      orphanPolicies: [
        { value: ORPHAN_POLICIES.PRESERVE, label: localize("DUP.OrphanPolicy.Preserve"), selected: settings.orphanPolicy === ORPHAN_POLICIES.PRESERVE },
        { value: ORPHAN_POLICIES.DISABLE, label: localize("DUP.OrphanPolicy.Disable"), selected: settings.orphanPolicy === ORPHAN_POLICIES.DISABLE },
      ],
      actionFilters: [
        { value: "all", label: localize("DUP.Filter.All"), selected: state.actionFilter === "all" },
        ...Object.values(ACTIONS).filter((value) => value !== ACTIONS.ERROR).map((value) => ({
          value,
          label: actionLabel(value),
          selected: state.actionFilter === value,
        })),
      ],
    };
  }

  _onRender(context, options) {
    super._onRender(context, options);
    this.#listeners?.abort();
    this.#listeners = new AbortController();
    const signal = this.#listeners.signal;
    const root = asRoot(this.element);
    if (!root) return;

    const filter = root.querySelector('[name="filter"]');
    const actionFilter = root.querySelector('[name="actionFilter"]');
    filter?.addEventListener("input", () => {
      this.#filterRows(root);
      this.#scheduleStateSave(root);
    }, { signal });
    actionFilter?.addEventListener("change", () => {
      this.#filterRows(root);
      this.#scheduleStateSave(root);
    }, { signal });
    this.#filterRows(root);
  }

  _onPosition(position) {
    super._onPosition(position);
    clearTimeout(this.#geometryTimer);
    this.#geometryTimer = setTimeout(() => {
      void saveGeometry(position).catch((error) => logger.warn("Could not persist dashboard geometry.", error));
    }, 200);
  }

  async _preClose(options) {
    clearTimeout(this.#geometryTimer);
    clearTimeout(this.#stateTimer);
    this.#listeners?.abort();
    try {
      await saveGeometry(this.position);
      const root = asRoot(this.element);
      if (root) await this.#persistState(root);
    } catch (error) {
      logger.warn("Could not flush dashboard state while closing.", error);
    }
    return super._preClose(options);
  }

  _onClose(options) {
    this.#listeners?.abort();
    this.constructor.fallbackInstance = null;
    return super._onClose(options);
  }

  #api() {
    const api = this.constructor.api ?? game.modules.get(MODULE_ID)?.api;
    if (!api) throw new Error(localize("DUP.Errors.ApiUnavailable"));
    return api;
  }

  #root() {
    const root = asRoot(this.element);
    if (!root) throw new Error(localize("DUP.Errors.DashboardUnavailable"));
    return root;
  }

  async #run(operation) {
    if (this.#busy) return;
    this.#busy = true;
    await this.render({ force: true });
    try {
      await operation();
    } catch (error) {
      logger.error("Dashboard operation failed.", error);
      notify("error", "DUP.Notifications.OperationFailed", { message: error.message });
    } finally {
      this.#busy = false;
      await this.render({ force: true });
    }
  }

  async #validateManifest() {
    const form = readForm(this.#root());
    await this.#run(async () => {
      this.#validation = await this.#api().validateManifest({ path: form.path });
      this.#plan = null;
      this.#snapshot = null;
      this.#report = null;
      notify(this.#validation.valid ? "info" : "error", this.#validation.valid ? "DUP.Notifications.ValidationPassed" : "DUP.Notifications.ValidationFailed", {
        errors: this.#validation.errors.length,
      });
    });
  }

  async #previewPlan() {
    const form = readForm(this.#root());
    await this.#run(async () => {
      const result = await this.#api().plan({ path: form.path, orphanPolicy: form.orphanPolicy });
      this.#validation = result.validation;
      this.#plan = result.plan;
      this.#snapshot = result.snapshot;
      this.#report = null;
      if (result.plan?.valid) notify("info", "DUP.Notifications.PreviewReady", { changes: result.plan.summary.changes });
      else notify("error", "DUP.Notifications.PreviewInvalid");
    });
  }

  async #applyPlan() {
    const form = readForm(this.#root());
    if (!form.enabled) {
      notify("warn", "DUP.Notifications.ModuleDisabled");
      return;
    }
    let preview;
    try {
      preview = await this.#api().plan({ path: form.path, orphanPolicy: form.orphanPolicy });
    } catch (error) {
      logger.error("Could not build the reconciliation plan.", error);
      notify("error", "DUP.Notifications.OperationFailed", { message: error.message });
      return;
    }
    this.#validation = preview.validation;
    this.#plan = preview.plan;
    this.#snapshot = preview.snapshot;
    if (!preview.plan?.valid) {
      notify("error", "DUP.Notifications.PreviewInvalid");
      await this.render({ force: true });
      return;
    }
    const confirmed = await DialogV2.confirm({
      window: { title: localize("DUP.Confirm.Title") },
      content: `<p>${game.i18n.format("DUP.Confirm.Content", { changes: preview.plan.summary.changes })}</p>`,
      modal: true,
      rejectClose: false,
      yes: { label: localize("DUP.Confirm.Apply"), icon: "fa-solid fa-check" },
      no: { label: localize("DUP.Confirm.Cancel"), icon: "fa-solid fa-xmark" },
    });
    if (!confirmed) return;
    await this.#run(async () => {
      const result = await this.#api().reconcile({ path: form.path, orphanPolicy: form.orphanPolicy });
      this.#validation = result.validation;
      this.#plan = result.plan;
      this.#snapshot = result.snapshot;
      this.#report = result.report;
      notify("info", "DUP.Notifications.ReconciliationComplete", { changes: result.plan.summary.changes });
    });
  }

  async #saveSettings() {
    const form = readForm(this.#root());
    await this.#run(async () => {
      if (!form.path) throw new Error(localize("DUP.Errors.ManifestPathRequired"));
      await Promise.all([
        game.settings.set(MODULE_ID, SETTINGS.ENABLED, form.enabled),
        game.settings.set(MODULE_ID, SETTINGS.AUTO_RECONCILE, form.autoReconcile),
        game.settings.set(MODULE_ID, SETTINGS.MANIFEST_PATH, form.path),
        game.settings.set(MODULE_ID, SETTINGS.ORPHAN_POLICY, form.orphanPolicy),
      ]);
      notify("info", "DUP.Notifications.SettingsSaved");
    });
  }

  #exportSnapshot() {
    this.#api().exportSnapshot({ download: true });
    notify("info", "DUP.Notifications.SnapshotExported");
  }

  #exportSchema() {
    this.#api().exportSchema({ download: true });
    notify("info", "DUP.Notifications.SchemaExported");
  }

  async #resetGeometry() {
    await game.settings.set(MODULE_ID, SETTINGS.DASHBOARD_GEOMETRY, {});
    this.setPosition(clampGeometry(DEFAULT_GEOMETRY));
    notify("info", "DUP.Notifications.GeometryReset");
  }

  #filterRows(root) {
    const query = root.querySelector('[name="filter"]')?.value?.trim().toLocaleLowerCase() ?? "";
    const kind = root.querySelector('[name="actionFilter"]')?.value ?? "all";
    let visible = 0;
    for (const row of root.querySelectorAll("[data-dup-action-row]")) {
      const matchesQuery = !query || row.dataset.search?.toLocaleLowerCase().includes(query);
      const matchesKind = kind === "all" || row.dataset.actionKind === kind;
      row.hidden = !(matchesQuery && matchesKind);
      if (!row.hidden) visible += 1;
    }
    const empty = root.querySelector("[data-dup-filter-empty]");
    if (empty) empty.hidden = visible > 0 || !this.#plan;
  }

  #scheduleStateSave(root) {
    clearTimeout(this.#stateTimer);
    this.#stateTimer = setTimeout(() => void this.#persistState(root), 200);
  }

  async #persistState(root) {
    const state = {
      filter: root.querySelector('[name="filter"]')?.value ?? "",
      actionFilter: root.querySelector('[name="actionFilter"]')?.value ?? "all",
    };
    await game.settings.set(MODULE_ID, SETTINGS.DASHBOARD_STATE, state);
  }
}
