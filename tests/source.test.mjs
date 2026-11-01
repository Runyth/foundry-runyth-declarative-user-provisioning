// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Daniel Braniewski. See the LICENSE file for rights and obligations.
import assert from "node:assert/strict";
import test from "node:test";
import { validateManifestPath } from "../scripts/core/source.mjs";

test("relative module and data paths are accepted", () => {
  assert.equal(validateManifestPath("modules/example/users.yaml"), "modules/example/users.yaml");
  assert.equal(validateManifestPath("worlds/example/users.json"), "worlds/example/users.json");
});

test("external URLs are rejected", () => {
  assert.throws(() => validateManifestPath("https://example.invalid/users.yaml"), /External URLs/);
});

test("path traversal is rejected", () => {
  assert.throws(() => validateManifestPath("modules/example/../secret.yaml"), /traversal/);
});

test("unsupported extensions are rejected", () => {
  assert.throws(() => validateManifestPath("modules/example/users.txt"), /\.json, \.yaml, or \.yml/);
});
