// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Daniel Braniewski. See the LICENSE file for rights and obligations.
import assert from "node:assert/strict";
import test from "node:test";
import { ACTIONS, MODULE_ID } from "../scripts/core/constants.mjs";
import { applyReconciliationPlan } from "../scripts/core/reconciler.mjs";

function installMock() {
  const calls = { create: [], update: [] };
  globalThis.game = { user: { isGM: true } };
  globalThis.CONFIG = {
    User: {
      documentClass: {
        async createDocuments(payloads) {
          calls.create.push(payloads);
          return payloads.map((payload, index) => ({ id: `created-${index}`, ...payload }));
        },
        async updateDocuments(payloads) {
          calls.update.push(payloads);
          return payloads.map((payload) => ({ id: payload._id }));
        },
      },
    },
  };
  return calls;
}

test("reconciler creates first and updates second through Foundry batch APIs", async () => {
  const calls = installMock();
  const plan = {
    valid: true,
    counts: {},
    actions: [
      { id: "create:alpha", type: ACTIONS.CREATE, key: "alpha", name: "Alpha", data: { name: "Alpha", role: 1, [`flags.${MODULE_ID}.managed`]: { key: "alpha" } } },
      { id: "update:beta", type: ACTIONS.UPDATE, key: "beta", name: "Beta", userId: "beta-id", data: { role: 2 } },
    ],
  };
  const report = await applyReconciliationPlan(plan, { logger: { info() {}, error() {} } });
  assert.equal(calls.create.length, 1);
  assert.deepEqual(calls.create[0][0].flags[MODULE_ID].managed, { key: "alpha" });
  assert.equal(calls.update[0][0]._id, "beta-id");
  assert.equal(report.entries.length, 2);
});

test("reconciler never invokes a delete API", async () => {
  const calls = installMock();
  globalThis.CONFIG.User.documentClass.deleteDocuments = () => assert.fail("deleteDocuments must not be called");
  await applyReconciliationPlan({ valid: true, counts: {}, actions: [{ id: "noop:a", type: ACTIONS.NOOP, key: "a", name: "A", data: {} }] }, { logger: { info() {}, error() {} } });
  assert.equal(calls.create.length, 0);
  assert.equal(calls.update.length, 0);
});

test("non-Gamemaster reconciliation is rejected", async () => {
  installMock();
  globalThis.game.user.isGM = false;
  await assert.rejects(() => applyReconciliationPlan({ valid: true, actions: [], counts: {} }), /Only a Gamemaster/);
});

test("invalid plan is rejected", async () => {
  installMock();
  await assert.rejects(() => applyReconciliationPlan({ valid: false, actions: [] }), /invalid reconciliation plan/);
});
