// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Daniel Braniewski. See the LICENSE file for rights and obligations.
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  canonicalManifestJson,
  canonicalManifestYaml,
  digestManifest,
  parseAndValidateManifest,
  validateManifest,
} from "../scripts/core/manifest.mjs";

const valid = {
  schemaVersion: 1,
  defaults: { enabled: true, role: "PLAYER" },
  orphanPolicy: "preserve",
  users: [{ key: "alpha", name: "Alpha" }],
};

test("JSON and YAML examples validate to the same normalized manifest", async () => {
  const yaml = parseAndValidateManifest(await readFile(new URL("../manifests/users.example.yaml", import.meta.url), "utf8"));
  const json = parseAndValidateManifest(await readFile(new URL("../manifests/users.example.json", import.meta.url), "utf8"));
  assert.equal(yaml.valid, true);
  assert.equal(json.valid, true);
  assert.deepEqual(yaml.manifest, json.manifest);
  assert.equal(await digestManifest(yaml.manifest), await digestManifest(json.manifest));
});

test("canonical serializers are stable", () => {
  const result = validateManifest(valid);
  assert.equal(canonicalManifestJson(result.manifest), canonicalManifestJson(result.manifest));
  assert.equal(canonicalManifestYaml(result.manifest), canonicalManifestYaml(result.manifest));
});

test("unknown fields are rejected", () => {
  const result = validateManifest({ ...valid, unknown: true });
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((entry) => entry.code === "unknown-field"));
});

test("password-like and secret fields are rejected", () => {
  for (const key of ["password", "passwordSalt", "token", "apiKey", "pronouns"]) {
    const result = validateManifest({ ...valid, users: [{ key: "alpha", name: "Alpha", [key]: "forbidden" }] });
    assert.equal(result.valid, false, key);
  }
});

test("duplicate stable keys are rejected", () => {
  const result = validateManifest({ ...valid, users: [{ key: "alpha", name: "Alpha" }, { key: "alpha", name: "Beta" }] });
  assert.ok(result.errors.some((entry) => entry.code === "duplicate-key"));
});

test("case-insensitive duplicate desired names are rejected", () => {
  const result = validateManifest({ ...valid, users: [{ key: "alpha", name: "Alpha" }, { key: "beta", name: "alpha" }] });
  assert.ok(result.errors.some((entry) => entry.code === "duplicate-name"));
});

test("external and traversing avatar paths are rejected", () => {
  for (const avatar of ["https://example.invalid/a.webp", "../secret.webp", "data:image/png;base64,x"]) {
    const result = validateManifest({ ...valid, users: [{ key: "alpha", name: "Alpha", avatar }] });
    assert.ok(result.errors.some((entry) => entry.code === "invalid-avatar"));
  }
});

test("runtime permission allowlist is enforced", () => {
  const result = validateManifest({ ...valid, users: [{ key: "alpha", name: "Alpha", permissions: { UNKNOWN: true } }] }, { permissionKeys: ["PING_CANVAS"] });
  assert.ok(result.errors.some((entry) => entry.code === "unknown-permission"));
});
