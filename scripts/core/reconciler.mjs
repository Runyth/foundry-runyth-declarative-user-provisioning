// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Daniel Braniewski. See the LICENSE file for rights and obligations.
import { ACTIONS, MANAGED_FLAG, MODULE_ID, MODULE_TITLE } from "./constants.mjs";

let activeOperation = null;

function assertGamemaster() {
  if (!globalThis.game?.user?.isGM) throw new Error("Only a Gamemaster may reconcile users.");
}

function getUserClass() {
  const UserClass = globalThis.CONFIG?.User?.documentClass ?? globalThis.foundry?.documents?.User;
  if (!UserClass?.createDocuments || !UserClass?.updateDocuments) {
    throw new Error("Foundry User document batch APIs are unavailable.");
  }
  return UserClass;
}

function sanitizeCreateData(data) {
  const result = {};
  const managedFlagPath = `flags.${MODULE_ID}.${MANAGED_FLAG}`;
  for (const [key, value] of Object.entries(data)) {
    if (key === managedFlagPath) {
      result.flags = {
        ...(result.flags ?? {}),
        [MODULE_ID]: {
          ...(result.flags?.[MODULE_ID] ?? {}),
          [MANAGED_FLAG]: value,
        },
      };
    } else if (["name", "role", "color", "avatar", "permissions"].includes(key)) {
      result[key] = value;
    }
  }
  return result;
}

function sanitizeUpdateData(action) {
  const result = { _id: action.userId };
  for (const [key, value] of Object.entries(action.data ?? {})) {
    if (key === "name" || key === "role" || key === "color" || key === "avatar" || key === "permissions" || key.startsWith("flags.")) {
      result[key] = value;
    }
  }
  return result;
}

function reportEntry(action, status, message = null) {
  return {
    actionId: action.id,
    type: action.type,
    key: action.key,
    userId: action.userId ?? null,
    name: action.name,
    status,
    message,
  };
}

async function runPlan(plan, { dryRun = false, logger = console } = {}) {
  assertGamemaster();
  if (!plan?.valid) throw new Error("Cannot apply an invalid reconciliation plan.");
  if (dryRun) {
    return {
      dryRun: true,
      startedAt: new Date().toISOString(),
      completedAt: new Date().toISOString(),
      entries: plan.actions.map((action) => reportEntry(action, "planned")),
      counts: plan.counts,
    };
  }

  const UserClass = getUserClass();
  const startedAt = new Date().toISOString();
  const entries = [];
  const actionable = plan.actions.filter((action) => ![ACTIONS.NOOP, ACTIONS.PRESERVE].includes(action.type));
  const createActions = actionable.filter((action) => action.type === ACTIONS.CREATE);
  const updateActions = actionable.filter((action) => action.type !== ACTIONS.CREATE);

  try {
    if (createActions.length > 0) {
      const payloads = createActions.map((action) => sanitizeCreateData(action.data));
      const created = await UserClass.createDocuments(payloads, {
        render: false,
        [`${MODULE_ID}Reconcile`]: true,
      });
      for (const [index, action] of createActions.entries()) {
        const user = created[index];
        entries.push({ ...reportEntry(action, "created"), userId: user?.id ?? null });
      }
    }

    if (updateActions.length > 0) {
      const payloads = updateActions.map(sanitizeUpdateData);
      const updated = await UserClass.updateDocuments(payloads, {
        render: false,
        diff: true,
        recursive: true,
        [`${MODULE_ID}Reconcile`]: true,
      });
      const updatedById = new Map(updated.map((user) => [user.id, user]));
      for (const action of updateActions) {
        entries.push(reportEntry(action, updatedById.has(action.userId) ? "updated" : "submitted"));
      }
    }

    for (const action of plan.actions.filter((candidate) => candidate.type === ACTIONS.NOOP)) {
      entries.push(reportEntry(action, "unchanged"));
    }
    for (const action of plan.actions.filter((candidate) => candidate.type === ACTIONS.PRESERVE)) {
      entries.push(reportEntry(action, "preserved"));
    }

    logger.info?.(`${MODULE_TITLE} | Reconciliation completed`, { plan, entries });
    return {
      dryRun: false,
      startedAt,
      completedAt: new Date().toISOString(),
      entries,
      counts: entries.reduce((counts, entry) => {
        counts[entry.status] = (counts[entry.status] ?? 0) + 1;
        return counts;
      }, {}),
    };
  } catch (error) {
    logger.error?.(`${MODULE_TITLE} | Reconciliation failed`, error);
    throw error;
  }
}

export async function applyReconciliationPlan(plan, options = {}) {
  if (activeOperation) throw new Error("A user reconciliation is already running.");
  activeOperation = runPlan(plan, options);
  try {
    return await activeOperation;
  } finally {
    activeOperation = null;
  }
}

export function reconciliationInProgress() {
  return activeOperation !== null;
}

export function isManagedUser(user) {
  return Boolean(user?.getFlag?.(MODULE_ID, MANAGED_FLAG)?.key ?? user?.flags?.[MODULE_ID]?.[MANAGED_FLAG]?.key);
}
