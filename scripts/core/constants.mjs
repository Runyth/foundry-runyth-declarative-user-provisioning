// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Runyth. See the LICENSE file for rights and obligations.
export const MODULE_ID = "declarative-user-provisioning";
export const MODULE_TITLE = "Declarative User Provisioning";
export const MODULE_VERSION = "1.0.1";
export const API_VERSION = "1.0.0";
export const MANIFEST_SCHEMA_VERSION = 1;
export const MANAGED_FLAG = "managed";
export const DEFAULT_MANIFEST_PATH = `modules/${MODULE_ID}/manifests/users.example.yaml`;
export const MAX_MANIFEST_BYTES = 1_048_576;
export const MAX_USERS = 1_000;

export const SETTINGS = Object.freeze({
  ENABLED: "enabled",
  AUTO_RECONCILE: "autoReconcile",
  MANIFEST_PATH: "manifestPath",
  ORPHAN_POLICY: "orphanPolicy",
  LOG_LEVEL: "logLevel",
  DASHBOARD_GEOMETRY: "dashboardGeometry",
  DASHBOARD_STATE: "dashboardState",
  LAST_REPORT: "lastReport",
});

export const ORPHAN_POLICIES = Object.freeze({
  PRESERVE: "preserve",
  DISABLE: "disable",
});

export const LOG_LEVELS = Object.freeze({
  ERROR: "error",
  WARN: "warn",
  INFO: "info",
  DEBUG: "debug",
});

export const ROLE_NAMES = Object.freeze([
  "NONE",
  "PLAYER",
  "TRUSTED",
  "ASSISTANT",
  "GAMEMASTER",
]);

export const ACTIONS = Object.freeze({
  CREATE: "create",
  ADOPT: "adopt",
  UPDATE: "update",
  DISABLE_ORPHAN: "disable-orphan",
  NOOP: "noop",
  PRESERVE: "preserve",
  ERROR: "error",
});

export const PROHIBITED_USER_KEYS = Object.freeze([
  "password",
  "passwordhash",
  "passwordsalt",
  "secret",
  "token",
  "apikey",
  "api_key",
  "cobaltcookie",
  "cobalt_cookie",
  "pronouns",
]);
