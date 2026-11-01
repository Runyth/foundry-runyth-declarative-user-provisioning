// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Daniel Braniewski. See the LICENSE file for rights and obligations.
import assert from "node:assert/strict";
import test from "node:test";
import { parseYaml, stringifyYaml } from "../scripts/core/yaml.mjs";

test("strict YAML parser handles manifest mappings and sequence mappings", () => {
  const value = parseYaml(`schemaVersion: 1\nusers:\n  - key: alpha\n    name: Alpha User\n    enabled: true\n`);
  assert.deepEqual(value, { schemaVersion: 1, users: [{ key: "alpha", name: "Alpha User", enabled: true }] });
});

test("YAML comments do not affect quoted hash characters", () => {
  const value = parseYaml('color: "#4f46e5" # comment\n');
  assert.equal(value.color, "#4f46e5");
});

test("YAML parser rejects tabs", () => {
  assert.throws(() => parseYaml("users:\n\t- key: alpha\n"), /tabs are not allowed/);
});

test("YAML parser rejects anchors and aliases", () => {
  assert.throws(() => parseYaml("defaults: &defaults\n  role: PLAYER\n"), /not supported/);
});

test("YAML parser rejects duplicate keys", () => {
  assert.throws(() => parseYaml("schemaVersion: 1\nschemaVersion: 1\n"), /duplicate key/);
});

test("YAML serializer round-trips nested data", () => {
  const source = { schemaVersion: 1, users: [{ key: "alpha", name: "Alpha User", permissions: { PING_CANVAS: true } }] };
  assert.deepEqual(parseYaml(stringifyYaml(source)), source);
});
