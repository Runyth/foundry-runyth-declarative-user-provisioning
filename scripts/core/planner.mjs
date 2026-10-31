// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Runyth. See the LICENSE file for rights and obligations.
import { ACTIONS, MANAGED_FLAG, MODULE_ID, ORPHAN_POLICIES } from "./constants.mjs";
import { getRoleMap, getRoleName } from "./roles.mjs";

function stableObject(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return value;
  return Object.fromEntries(Object.entries(value).sort(([left], [right]) => left.localeCompare(right)));
}

function valuesEqual(left, right) {
  return JSON.stringify(stableObject(left)) === JSON.stringify(stableObject(right));
}

function normalizeSnapshotUser(user) {
  return {
    id: user.id ?? user._id,
    name: user.name,
    role: Number(user.role),
    color: user.color ?? null,
    avatar: user.avatar ?? null,
    permissions: stableObject(user.permissions ?? {}),
    managedKey: user.managedKey ?? user.flags?.[MODULE_ID]?.[MANAGED_FLAG]?.key ?? null,
    managed: user.managed ?? user.flags?.[MODULE_ID]?.[MANAGED_FLAG] ?? null,
    active: Boolean(user.active),
    current: Boolean(user.current),
  };
}

function issue(path, message, code, severity = "error") {
  return { path, message, code, severity };
}

function buildDesiredData(entry, roleMap, manifestDigest) {
  const enabled = entry.enabled !== false;
  const data = {
    name: entry.name,
    role: enabled ? roleMap[entry.role] : roleMap.NONE,
    [`flags.${MODULE_ID}.${MANAGED_FLAG}`]: {
      key: entry.key,
      schemaVersion: 1,
      manifestDigest,
      desiredRole: entry.role,
      enabled,
    },
  };
  if (entry.color !== undefined) data.color = entry.color;
  if (entry.avatar !== undefined) data.avatar = entry.avatar;
  if (entry.permissions !== undefined) data.permissions = stableObject(entry.permissions);
  return data;
}

function diffUser(existing, desiredData) {
  const changes = {};
  for (const [field, desired] of Object.entries(desiredData)) {
    if (field.startsWith("flags.")) {
      if (!valuesEqual(existing.managed, desired)) changes[field] = desired;
      continue;
    }
    const current = existing[field];
    if (!valuesEqual(current, desired)) changes[field] = desired;
  }
  return changes;
}

function resolveExplicitMatch(entry, usersById, usersByExactName) {
  if (!entry.match) return { user: null, errors: [] };
  const errors = [];
  const byId = entry.match.id ? usersById.get(entry.match.id) ?? null : null;
  const nameMatches = entry.match.name ? usersByExactName.get(entry.match.name) ?? [] : [];

  if (entry.match.id && !byId) {
    errors.push(issue(`users.${entry.key}.match.id`, `No existing user has id '${entry.match.id}'.`, "match-id-not-found"));
  }
  if (entry.match.name && nameMatches.length === 0) {
    errors.push(issue(`users.${entry.key}.match.name`, `No existing user has exact name '${entry.match.name}'.`, "match-name-not-found"));
  }
  if (nameMatches.length > 1) {
    errors.push(issue(`users.${entry.key}.match.name`, `Exact name '${entry.match.name}' matches more than one existing user.`, "ambiguous-match-name"));
  }

  const byName = nameMatches.length === 1 ? nameMatches[0] : null;
  if (byId && byName && byId.id !== byName.id) {
    errors.push(issue(`users.${entry.key}.match`, "match.id and match.name resolve to different users.", "conflicting-match"));
  }
  return { user: byId ?? byName, errors };
}

function projectedRoleFor(user, actions) {
  const action = actions.find((candidate) => candidate.userId === user.id && [ACTIONS.ADOPT, ACTIONS.UPDATE, ACTIONS.DISABLE_ORPHAN].includes(candidate.type));
  return action?.data?.role ?? user.role;
}

export function buildReconciliationPlan({
  manifest,
  snapshot,
  manifestDigest = "unknown",
  roleMap = getRoleMap(undefined),
  orphanPolicy = manifest.orphanPolicy ?? ORPHAN_POLICIES.PRESERVE,
} = {}) {
  const users = (snapshot?.users ?? snapshot ?? []).map(normalizeSnapshotUser);
  const errors = [];
  const warnings = [];
  const actions = [];
  const matchedIds = new Set();

  const usersById = new Map(users.map((user) => [user.id, user]));
  const usersByExactName = new Map();
  const usersByCanonicalName = new Map();
  const managedByKey = new Map();

  for (const user of users) {
    if (!user.id || !user.name || !Number.isInteger(user.role)) {
      errors.push(issue("snapshot.users", "Snapshot contains an invalid user entry.", "invalid-snapshot-user"));
      continue;
    }
    const exact = usersByExactName.get(user.name) ?? [];
    exact.push(user);
    usersByExactName.set(user.name, exact);

    const canonical = user.name.toLocaleLowerCase();
    const canonicalMatches = usersByCanonicalName.get(canonical) ?? [];
    canonicalMatches.push(user);
    usersByCanonicalName.set(canonical, canonicalMatches);

    if (user.managedKey) {
      const managedMatches = managedByKey.get(user.managedKey) ?? [];
      managedMatches.push(user);
      managedByKey.set(user.managedKey, managedMatches);
    }
  }

  for (const [key, managedUsers] of managedByKey.entries()) {
    if (managedUsers.length > 1) {
      errors.push(issue(`managed.${key}`, `Managed key '${key}' is assigned to multiple existing users.`, "duplicate-managed-key"));
    }
  }

  for (const entry of manifest.users) {
    const path = `users.${entry.key}`;
    const managedMatches = managedByKey.get(entry.key) ?? [];
    const explicit = resolveExplicitMatch(entry, usersById, usersByExactName);
    errors.push(...explicit.errors);
    if (explicit.errors.length > 0) continue;

    let existing = managedMatches.length === 1 ? managedMatches[0] : null;
    let adopting = false;

    if (existing && explicit.user && existing.id !== explicit.user.id) {
      errors.push(issue(`${path}.match`, `Managed key '${entry.key}' already belongs to '${existing.name}', but match points to '${explicit.user.name}'.`, "managed-match-conflict"));
      continue;
    }
    if (!existing && explicit.user) {
      if (explicit.user.managedKey && explicit.user.managedKey !== entry.key) {
        errors.push(issue(`${path}.match`, `User '${explicit.user.name}' is already managed under key '${explicit.user.managedKey}'.`, "already-managed"));
        continue;
      }
      existing = explicit.user;
      adopting = !explicit.user.managedKey;
    }

    if (!existing) {
      const collisions = usersByCanonicalName.get(entry.name.toLocaleLowerCase()) ?? [];
      if (collisions.length > 0) {
        errors.push(issue(`${path}.name`, `Desired name '${entry.name}' collides with an existing unmanaged user. Add an explicit match to adopt it.`, "unmanaged-name-collision"));
        continue;
      }
      actions.push({
        id: `create:${entry.key}`,
        type: ACTIONS.CREATE,
        key: entry.key,
        name: entry.name,
        data: buildDesiredData(entry, roleMap, manifestDigest),
        reasons: ["missing-managed-user"],
      });
      continue;
    }

    if (matchedIds.has(existing.id)) {
      errors.push(issue(path, `Existing user '${existing.name}' is matched by more than one manifest entry.`, "duplicate-user-match"));
      continue;
    }
    matchedIds.add(existing.id);

    const desired = buildDesiredData(entry, roleMap, manifestDigest);
    const changes = diffUser(existing, desired);
    const changedFields = Object.keys(changes);
    const type = adopting ? ACTIONS.ADOPT : changedFields.length > 0 ? ACTIONS.UPDATE : ACTIONS.NOOP;

    if (existing.active && desired.role === roleMap.NONE) {
      warnings.push(issue(path, `Active user '${existing.name}' will be disabled.`, "disable-active-user", "warning"));
    }

    actions.push({
      id: `${type}:${entry.key}`,
      type,
      key: entry.key,
      name: entry.name,
      userId: existing.id,
      currentName: existing.name,
      data: type === ACTIONS.NOOP ? {} : changes,
      reasons: adopting ? ["explicit-adoption"] : changedFields.length > 0 ? ["managed-drift"] : ["already-converged"],
    });
  }

  for (const user of users) {
    if (!user.managedKey || matchedIds.has(user.id)) continue;
    if (orphanPolicy === ORPHAN_POLICIES.DISABLE && user.role !== roleMap.NONE) {
      actions.push({
        id: `disable-orphan:${user.managedKey}`,
        type: ACTIONS.DISABLE_ORPHAN,
        key: user.managedKey,
        name: user.name,
        userId: user.id,
        currentName: user.name,
        data: { role: roleMap.NONE },
        reasons: ["managed-user-absent-from-manifest"],
      });
      if (user.active) warnings.push(issue(`managed.${user.managedKey}`, `Active orphaned user '${user.name}' will be disabled.`, "disable-active-orphan", "warning"));
    } else {
      actions.push({
        id: `preserve:${user.managedKey}`,
        type: ACTIONS.PRESERVE,
        key: user.managedKey,
        name: user.name,
        userId: user.id,
        data: {},
        reasons: ["orphan-policy-preserve"],
      });
    }
  }

  const createActions = actions.filter((action) => action.type === ACTIONS.CREATE);
  const projectedGamemasters = users
    .filter((user) => projectedRoleFor(user, actions) === roleMap.GAMEMASTER)
    .length + createActions.filter((action) => action.data.role === roleMap.GAMEMASTER).length;

  if (projectedGamemasters === 0) {
    errors.push(issue("plan.roles", "Reconciliation would leave the world without a GAMEMASTER user.", "last-gamemaster-lockout"));
  }

  for (const action of actions) {
    if (![ACTIONS.ADOPT, ACTIONS.UPDATE, ACTIONS.DISABLE_ORPHAN].includes(action.type)) continue;
    const existing = usersById.get(action.userId);
    if (existing?.current && action.data.role !== undefined && action.data.role < roleMap.ASSISTANT) {
      errors.push(issue(`actions.${action.id}`, `The current user '${existing.name}' cannot be disabled or downgraded below ASSISTANT by reconciliation.`, "current-user-lockout"));
    }
  }

  const counts = Object.fromEntries(Object.values(ACTIONS).map((action) => [action, 0]));
  for (const action of actions) counts[action.type] = (counts[action.type] ?? 0) + 1;

  return {
    valid: errors.length === 0,
    manifestDigest,
    orphanPolicy,
    generatedAt: new Date().toISOString(),
    roleNames: Object.fromEntries(Object.entries(roleMap).map(([name, value]) => [value, name])),
    actions,
    errors,
    warnings,
    counts,
    summary: {
      existingUsers: users.length,
      manifestUsers: manifest.users.length,
      changes: actions.filter((action) => ![ACTIONS.NOOP, ACTIONS.PRESERVE].includes(action.type)).length,
      errors: errors.length,
      warnings: warnings.length,
    },
  };
}

export function createSnapshotFromFoundry({ users = globalThis.game?.users, currentUserId = globalThis.game?.user?.id } = {}) {
  return {
    schemaVersion: 1,
    exportedAt: new Date().toISOString(),
    users: [...(users ?? [])].map((user) => ({
      id: user.id,
      name: user.name,
      role: user.role,
      roleName: getRoleName(user.role, getRoleMap()),
      color: user.color ?? null,
      avatar: user.avatar ?? null,
      permissions: stableObject(user.permissions ?? {}),
      managedKey: user.getFlag?.(MODULE_ID, MANAGED_FLAG)?.key ?? user.flags?.[MODULE_ID]?.[MANAGED_FLAG]?.key ?? null,
      active: Boolean(user.active),
      current: user.id === currentUserId,
    })),
  };
}
