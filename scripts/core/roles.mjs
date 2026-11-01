// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Daniel Braniewski. See the LICENSE file for rights and obligations.
import { ROLE_NAMES } from "./constants.mjs";

export const FALLBACK_ROLE_MAP = Object.freeze({
  NONE: 0,
  PLAYER: 1,
  TRUSTED: 2,
  ASSISTANT: 3,
  GAMEMASTER: 4,
});

export function getRoleMap(runtimeConst = globalThis.CONST) {
  const source = runtimeConst?.USER_ROLES;
  const roleMap = {};
  for (const name of ROLE_NAMES) {
    const value = source?.[name];
    roleMap[name] = Number.isInteger(value) ? value : FALLBACK_ROLE_MAP[name];
  }
  return Object.freeze(roleMap);
}

export function getRoleName(role, roleMap = FALLBACK_ROLE_MAP) {
  return Object.entries(roleMap).find(([, value]) => value === role)?.[0] ?? `UNKNOWN(${role})`;
}

export function getPermissionKeys(runtimeConst = globalThis.CONST) {
  const permissions = runtimeConst?.USER_PERMISSIONS;
  if (!permissions || typeof permissions !== "object") return [];
  return Object.keys(permissions).sort();
}
