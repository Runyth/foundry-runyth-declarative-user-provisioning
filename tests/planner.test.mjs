// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Runyth. See the LICENSE file for rights and obligations.
import assert from "node:assert/strict";
import test from "node:test";
import { ACTIONS, MODULE_ID } from "../scripts/core/constants.mjs";
import { buildReconciliationPlan } from "../scripts/core/planner.mjs";
import { FALLBACK_ROLE_MAP } from "../scripts/core/roles.mjs";

function manifest(users, orphanPolicy = "preserve") {
  return { schemaVersion: 1, defaults: { enabled: true, role: "PLAYER" }, orphanPolicy, users };
}

function snapshot(users) {
  return { users };
}

test("missing manifest user produces create action", () => {
  const plan = buildReconciliationPlan({ manifest: manifest([{ key: "alpha", name: "Alpha", enabled: true, role: "PLAYER" }]), snapshot: snapshot([{ id: "gm", name: "GM", role: 4, current: true }]), manifestDigest: "abc", roleMap: FALLBACK_ROLE_MAP });
  assert.equal(plan.valid, true);
  assert.equal(plan.actions.find((action) => action.key === "alpha").type, ACTIONS.CREATE);
});

test("managed user is matched by stable flag key and updated", () => {
  const plan = buildReconciliationPlan({
    manifest: manifest([{ key: "alpha", name: "Alpha New", enabled: true, role: "TRUSTED" }]),
    snapshot: snapshot([{ id: "gm", name: "GM", role: 4, current: true }, { id: "a", name: "Alpha Old", role: 1, managedKey: "alpha", managed: { key: "alpha", schemaVersion: 1, manifestDigest: "old", desiredRole: "PLAYER", enabled: true } }]),
    manifestDigest: "new",
    roleMap: FALLBACK_ROLE_MAP,
  });
  const action = plan.actions.find((candidate) => candidate.key === "alpha");
  assert.equal(action.type, ACTIONS.UPDATE);
  assert.equal(action.data.name, "Alpha New");
  assert.equal(action.data.role, 2);
});

test("explicit exact-name match adopts an unmanaged user", () => {
  const plan = buildReconciliationPlan({ manifest: manifest([{ key: "alpha", name: "Alpha", enabled: true, role: "PLAYER", match: { name: "Existing" } }]), snapshot: snapshot([{ id: "gm", name: "GM", role: 4, current: true }, { id: "a", name: "Existing", role: 1 }]), manifestDigest: "abc", roleMap: FALLBACK_ROLE_MAP });
  assert.equal(plan.actions.find((action) => action.key === "alpha").type, ACTIONS.ADOPT);
});

test("unmanaged name collision blocks implicit adoption", () => {
  const plan = buildReconciliationPlan({ manifest: manifest([{ key: "alpha", name: "Existing", enabled: true, role: "PLAYER" }]), snapshot: snapshot([{ id: "gm", name: "GM", role: 4, current: true }, { id: "a", name: "Existing", role: 1 }]), manifestDigest: "abc", roleMap: FALLBACK_ROLE_MAP });
  assert.equal(plan.valid, false);
  assert.ok(plan.errors.some((entry) => entry.code === "unmanaged-name-collision"));
});

test("unresolved explicit match blocks creation", () => {
  const plan = buildReconciliationPlan({ manifest: manifest([{ key: "alpha", name: "Alpha", enabled: true, role: "PLAYER", match: { id: "missing" } }]), snapshot: snapshot([{ id: "gm", name: "GM", role: 4, current: true }]), manifestDigest: "abc", roleMap: FALLBACK_ROLE_MAP });
  assert.equal(plan.valid, false);
  assert.equal(plan.actions.some((action) => action.type === ACTIONS.CREATE), false);
});

test("disabled manifest user receives role NONE without deletion", () => {
  const plan = buildReconciliationPlan({ manifest: manifest([{ key: "alpha", name: "Alpha", enabled: false, role: "PLAYER" }]), snapshot: snapshot([{ id: "gm", name: "GM", role: 4, current: true }, { id: "a", name: "Alpha", role: 1, managedKey: "alpha" }]), manifestDigest: "abc", roleMap: FALLBACK_ROLE_MAP });
  const action = plan.actions.find((candidate) => candidate.key === "alpha");
  assert.equal(action.data.role, 0);
  assert.equal(plan.actions.some((candidate) => candidate.type === "delete"), false);
});

test("orphan preserve policy leaves absent managed users unchanged", () => {
  const plan = buildReconciliationPlan({ manifest: manifest([]), snapshot: snapshot([{ id: "gm", name: "GM", role: 4, current: true }, { id: "a", name: "Alpha", role: 1, managedKey: "alpha" }]), manifestDigest: "abc", roleMap: FALLBACK_ROLE_MAP });
  assert.equal(plan.actions.find((action) => action.key === "alpha").type, ACTIONS.PRESERVE);
});

test("orphan disable policy sets absent managed user to NONE", () => {
  const plan = buildReconciliationPlan({ manifest: manifest([], "disable"), snapshot: snapshot([{ id: "gm", name: "GM", role: 4, current: true }, { id: "a", name: "Alpha", role: 1, managedKey: "alpha" }]), manifestDigest: "abc", roleMap: FALLBACK_ROLE_MAP });
  assert.equal(plan.actions.find((action) => action.key === "alpha").type, ACTIONS.DISABLE_ORPHAN);
});

test("current user cannot be downgraded below ASSISTANT", () => {
  const plan = buildReconciliationPlan({ manifest: manifest([{ key: "gm", name: "GM", enabled: false, role: "GAMEMASTER" }]), snapshot: snapshot([{ id: "gm", name: "GM", role: 4, current: true, managedKey: "gm" }]), manifestDigest: "abc", roleMap: FALLBACK_ROLE_MAP });
  assert.ok(plan.errors.some((entry) => entry.code === "current-user-lockout"));
});

test("plan cannot leave the world without a Gamemaster", () => {
  const plan = buildReconciliationPlan({ manifest: manifest([{ key: "gm", name: "GM", enabled: true, role: "ASSISTANT" }]), snapshot: snapshot([{ id: "gm", name: "GM", role: 4, current: false, managedKey: "gm" }]), manifestDigest: "abc", roleMap: FALLBACK_ROLE_MAP });
  assert.ok(plan.errors.some((entry) => entry.code === "last-gamemaster-lockout"));
});

test("converged managed user is noop", () => {
  const managed = { key: "alpha", schemaVersion: 1, manifestDigest: "abc", desiredRole: "PLAYER", enabled: true };
  const plan = buildReconciliationPlan({ manifest: manifest([{ key: "alpha", name: "Alpha", enabled: true, role: "PLAYER" }]), snapshot: snapshot([{ id: "gm", name: "GM", role: 4, current: true }, { id: "a", name: "Alpha", role: 1, managedKey: "alpha", managed }]), manifestDigest: "abc", roleMap: FALLBACK_ROLE_MAP });
  assert.equal(plan.actions.find((action) => action.key === "alpha").type, ACTIONS.NOOP);
});
