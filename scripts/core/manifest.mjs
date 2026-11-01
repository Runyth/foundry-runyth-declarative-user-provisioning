// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Daniel Braniewski. See the LICENSE file for rights and obligations.
import {
  MANIFEST_SCHEMA_VERSION,
  MAX_MANIFEST_BYTES,
  MAX_USERS,
  MODULE_ID,
  ORPHAN_POLICIES,
  PROHIBITED_USER_KEYS,
  ROLE_NAMES,
} from "./constants.mjs";
import { parseYaml, stringifyYaml } from "./yaml.mjs";

const ROOT_KEYS = new Set(["schemaVersion", "defaults", "orphanPolicy", "users"]);
const DEFAULT_KEYS = new Set(["role", "enabled", "permissions"]);
const USER_KEYS = new Set(["key", "name", "enabled", "role", "color", "avatar", "permissions", "match"]);
const MATCH_KEYS = new Set(["id", "name"]);
const KEY_PATTERN = /^[a-z0-9](?:[a-z0-9._-]{0,62}[a-z0-9])?$/;
const PERMISSION_PATTERN = /^[A-Z][A-Z0-9_]*$/;
const COLOR_PATTERN = /^#[0-9a-fA-F]{6}$/;
const USER_ID_PATTERN = /^[A-Za-z0-9_-]{1,64}$/;

function byteLength(text) {
  return new TextEncoder().encode(text).byteLength;
}

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function addError(errors, path, message, code = "invalid") {
  errors.push({ path, message, code, severity: "error" });
}

function addWarning(warnings, path, message, code = "warning") {
  warnings.push({ path, message, code, severity: "warning" });
}

function rejectUnknownKeys(value, allowed, path, errors) {
  for (const key of Object.keys(value)) {
    const normalized = key.toLowerCase().replaceAll("-", "");
    if (PROHIBITED_USER_KEYS.includes(normalized)) {
      addError(errors, `${path}.${key}`, `Field '${key}' is prohibited. Manifests must not contain passwords, secrets, tokens, or pronouns.`, "prohibited-field");
    } else if (!allowed.has(key)) {
      addError(errors, `${path}.${key}`, `Unknown field '${key}'.`, "unknown-field");
    }
  }
}

function validateRole(value, path, errors) {
  if (typeof value !== "string" || !ROLE_NAMES.includes(value)) {
    addError(errors, path, `Role must be one of: ${ROLE_NAMES.join(", ")}.`, "invalid-role");
  }
}

function validatePermissions(value, path, errors, permissionKeys) {
  if (!isPlainObject(value)) {
    addError(errors, path, "Permissions must be an object whose values are booleans.", "invalid-permissions");
    return;
  }
  for (const [key, allowed] of Object.entries(value)) {
    if (!PERMISSION_PATTERN.test(key)) {
      addError(errors, `${path}.${key}`, "Permission keys must be uppercase Foundry permission identifiers.", "invalid-permission-key");
    } else if (permissionKeys && !permissionKeys.has(key)) {
      addError(errors, `${path}.${key}`, `Unknown Foundry permission '${key}' for this runtime.`, "unknown-permission");
    }
    if (typeof allowed !== "boolean") {
      addError(errors, `${path}.${key}`, "Permission values must be booleans.", "invalid-permission-value");
    }
  }
}

function validateMatch(value, path, errors) {
  if (!isPlainObject(value)) {
    addError(errors, path, "match must be an object containing an exact id and/or exact name.", "invalid-match");
    return;
  }
  rejectUnknownKeys(value, MATCH_KEYS, path, errors);
  if (!value.id && !value.name) {
    addError(errors, path, "match must contain id, name, or both.", "empty-match");
  }
  if (value.id !== undefined && (typeof value.id !== "string" || !USER_ID_PATTERN.test(value.id))) {
    addError(errors, `${path}.id`, "match.id must be a non-empty Foundry user identifier.", "invalid-match-id");
  }
  if (value.name !== undefined && (typeof value.name !== "string" || !value.name.trim())) {
    addError(errors, `${path}.name`, "match.name must be a non-empty exact user name.", "invalid-match-name");
  }
}

function normalizePermissions(value) {
  if (!isPlainObject(value)) return undefined;
  return Object.fromEntries(Object.entries(value).sort(([left], [right]) => left.localeCompare(right)));
}

function normalizeUser(user, defaults) {
  const normalized = {
    key: user.key,
    name: user.name.trim(),
    enabled: user.enabled ?? defaults.enabled ?? true,
    role: user.role ?? defaults.role ?? "PLAYER",
  };
  if (user.color !== undefined) normalized.color = user.color;
  if (user.avatar !== undefined) normalized.avatar = user.avatar;
  const permissions = user.permissions ?? defaults.permissions;
  if (permissions !== undefined) normalized.permissions = normalizePermissions(permissions);
  if (user.match !== undefined) {
    normalized.match = {};
    if (user.match.id !== undefined) normalized.match.id = user.match.id;
    if (user.match.name !== undefined) normalized.match.name = user.match.name.trim();
  }
  return normalized;
}

export function parseManifestText(text, { source = "manifest" } = {}) {
  if (typeof text !== "string") throw new TypeError("Manifest text must be a string.");
  if (byteLength(text) > MAX_MANIFEST_BYTES) {
    throw new Error(`Manifest exceeds the ${MAX_MANIFEST_BYTES}-byte safety limit.`);
  }
  const trimmed = text.trim();
  if (!trimmed) throw new Error("Manifest is empty.");
  try {
    if (trimmed.startsWith("{") || trimmed.startsWith("[")) return JSON.parse(trimmed);
    return parseYaml(trimmed);
  } catch (error) {
    throw new Error(`${source}: ${error.message}`, { cause: error });
  }
}

export function validateManifest(document, { permissionKeys = null } = {}) {
  const errors = [];
  const warnings = [];
  const permissionSet = permissionKeys ? new Set(permissionKeys) : null;

  if (!isPlainObject(document)) {
    addError(errors, "$", "Manifest root must be an object.", "invalid-root");
    return { valid: false, errors, warnings, manifest: null };
  }
  rejectUnknownKeys(document, ROOT_KEYS, "$", errors);

  if (document.schemaVersion !== MANIFEST_SCHEMA_VERSION) {
    addError(errors, "$.schemaVersion", `schemaVersion must equal ${MANIFEST_SCHEMA_VERSION}.`, "unsupported-schema");
  }

  const defaults = document.defaults ?? {};
  if (!isPlainObject(defaults)) {
    addError(errors, "$.defaults", "defaults must be an object.", "invalid-defaults");
  } else {
    rejectUnknownKeys(defaults, DEFAULT_KEYS, "$.defaults", errors);
    if (defaults.role !== undefined) validateRole(defaults.role, "$.defaults.role", errors);
    if (defaults.enabled !== undefined && typeof defaults.enabled !== "boolean") {
      addError(errors, "$.defaults.enabled", "defaults.enabled must be boolean.", "invalid-enabled");
    }
    if (defaults.permissions !== undefined) {
      validatePermissions(defaults.permissions, "$.defaults.permissions", errors, permissionSet);
    }
  }

  const orphanPolicy = document.orphanPolicy ?? ORPHAN_POLICIES.PRESERVE;
  if (!Object.values(ORPHAN_POLICIES).includes(orphanPolicy)) {
    addError(errors, "$.orphanPolicy", `orphanPolicy must be '${ORPHAN_POLICIES.PRESERVE}' or '${ORPHAN_POLICIES.DISABLE}'.`, "invalid-orphan-policy");
  }

  if (!Array.isArray(document.users)) {
    addError(errors, "$.users", "users must be an array.", "invalid-users");
    return { valid: false, errors, warnings, manifest: null };
  }
  if (document.users.length > MAX_USERS) {
    addError(errors, "$.users", `users exceeds the ${MAX_USERS}-entry safety limit.`, "too-many-users");
  }

  const keys = new Set();
  const names = new Map();
  const normalizedUsers = [];

  for (const [index, user] of document.users.entries()) {
    const path = `$.users[${index}]`;
    if (!isPlainObject(user)) {
      addError(errors, path, "Each user entry must be an object.", "invalid-user");
      continue;
    }
    rejectUnknownKeys(user, USER_KEYS, path, errors);

    if (typeof user.key !== "string" || !KEY_PATTERN.test(user.key)) {
      addError(errors, `${path}.key`, "key must be a lowercase stable identifier using letters, numbers, dots, underscores, or hyphens.", "invalid-key");
    } else if (keys.has(user.key)) {
      addError(errors, `${path}.key`, `Duplicate managed key '${user.key}'.`, "duplicate-key");
    } else {
      keys.add(user.key);
    }

    if (typeof user.name !== "string" || !user.name.trim()) {
      addError(errors, `${path}.name`, "name is required and must be non-empty.", "invalid-name");
    } else {
      const canonical = user.name.trim().toLocaleLowerCase();
      if (names.has(canonical)) {
        addError(errors, `${path}.name`, `Desired name duplicates ${names.get(canonical)} case-insensitively.`, "duplicate-name");
      } else {
        names.set(canonical, path);
      }
    }

    if (user.enabled !== undefined && typeof user.enabled !== "boolean") {
      addError(errors, `${path}.enabled`, "enabled must be boolean.", "invalid-enabled");
    }
    if (user.role !== undefined) validateRole(user.role, `${path}.role`, errors);
    if (user.color !== undefined && (typeof user.color !== "string" || !COLOR_PATTERN.test(user.color))) {
      addError(errors, `${path}.color`, "color must be a six-digit hexadecimal color such as #4f46e5.", "invalid-color");
    }
    if (user.avatar !== undefined) {
      const validAvatar = user.avatar === null || (
        typeof user.avatar === "string" &&
        user.avatar.trim() &&
        !/^(?:https?:|data:|javascript:|file:)/i.test(user.avatar) &&
        !user.avatar.includes("..")
      );
      if (!validAvatar) {
        addError(errors, `${path}.avatar`, "avatar must be null or a safe relative Foundry data path; external URLs and traversal are rejected.", "invalid-avatar");
      }
    }
    if (user.permissions !== undefined) validatePermissions(user.permissions, `${path}.permissions`, errors, permissionSet);
    if (user.match !== undefined) validateMatch(user.match, `${path}.match`, errors);

    if (user.role === "NONE" && user.enabled !== false) {
      addWarning(warnings, `${path}.role`, "role NONE is equivalent to disabled; prefer enabled: false for clearer intent.", "none-role");
    }

    if (typeof user.key === "string" && typeof user.name === "string" && user.name.trim()) {
      normalizedUsers.push(normalizeUser(user, isPlainObject(defaults) ? defaults : {}));
    }
  }

  const manifest = errors.length === 0
    ? {
        schemaVersion: MANIFEST_SCHEMA_VERSION,
        defaults: {
          enabled: defaults.enabled ?? true,
          role: defaults.role ?? "PLAYER",
          ...(defaults.permissions !== undefined ? { permissions: normalizePermissions(defaults.permissions) } : {}),
        },
        orphanPolicy,
        users: normalizedUsers.sort((left, right) => left.key.localeCompare(right.key)),
      }
    : null;

  return { valid: errors.length === 0, errors, warnings, manifest };
}

export function parseAndValidateManifest(text, options = {}) {
  const document = parseManifestText(text, options);
  return validateManifest(document, options);
}

function stableValue(value) {
  if (Array.isArray(value)) return value.map(stableValue);
  if (isPlainObject(value)) {
    return Object.fromEntries(
      Object.entries(value)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, child]) => [key, stableValue(child)]),
    );
  }
  return value;
}

export function canonicalManifestJson(manifest) {
  return `${JSON.stringify(stableValue(manifest), null, 2)}\n`;
}

export function canonicalManifestYaml(manifest) {
  return `${stringifyYaml(stableValue(manifest))}\n`;
}

export async function digestManifest(manifest) {
  const bytes = new TextEncoder().encode(canonicalManifestJson(manifest));
  if (globalThis.crypto?.subtle) {
    const digest = await globalThis.crypto.subtle.digest("SHA-256", bytes);
    return [...new Uint8Array(digest)].map((value) => value.toString(16).padStart(2, "0")).join("");
  }
  const { createHash } = await import("node:crypto");
  return createHash("sha256").update(bytes).digest("hex");
}

export function createExampleManifest() {
  return {
    schemaVersion: MANIFEST_SCHEMA_VERSION,
    defaults: {
      enabled: true,
      role: "PLAYER",
    },
    orphanPolicy: ORPHAN_POLICIES.PRESERVE,
    users: [
      {
        key: "example-player",
        name: "Example Player",
        enabled: false,
        role: "PLAYER",
        color: "#4f46e5",
      },
    ],
  };
}

export function exportManifestSchema() {
  return {
    $schema: "https://json-schema.org/draft/2020-12/schema",
    $id: `https://github.com/Runyth/foundry-runyth-declarative-user-provisioning/blob/master/schema/manifest.schema.json`,
    title: "Runyth Declarative User Provisioning Manifest",
    type: "object",
    additionalProperties: false,
    required: ["schemaVersion", "users"],
    properties: {
      schemaVersion: { const: MANIFEST_SCHEMA_VERSION },
      orphanPolicy: { enum: Object.values(ORPHAN_POLICIES), default: ORPHAN_POLICIES.PRESERVE },
      defaults: {
        type: "object",
        additionalProperties: false,
        properties: {
          enabled: { type: "boolean", default: true },
          role: { enum: ROLE_NAMES, default: "PLAYER" },
          permissions: {
            type: "object",
            additionalProperties: { type: "boolean" },
            propertyNames: { pattern: PERMISSION_PATTERN.source },
          },
        },
      },
      users: {
        type: "array",
        maxItems: MAX_USERS,
        items: {
          type: "object",
          additionalProperties: false,
          required: ["key", "name"],
          properties: {
            key: { type: "string", pattern: KEY_PATTERN.source },
            name: { type: "string", minLength: 1 },
            enabled: { type: "boolean" },
            role: { enum: ROLE_NAMES },
            color: { type: "string", pattern: COLOR_PATTERN.source },
            avatar: { type: ["string", "null"] },
            permissions: {
              type: "object",
              additionalProperties: { type: "boolean" },
              propertyNames: { pattern: PERMISSION_PATTERN.source },
            },
            match: {
              type: "object",
              additionalProperties: false,
              minProperties: 1,
              properties: {
                id: { type: "string", pattern: USER_ID_PATTERN.source },
                name: { type: "string", minLength: 1 },
              },
            },
          },
        },
      },
    },
  };
}
