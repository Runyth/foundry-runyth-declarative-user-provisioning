// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Runyth. See the LICENSE file for rights and obligations.
import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { resolve } from "node:path";
import test from "node:test";

const root = resolve(import.meta.dirname, "..");

async function filesBelow(directory, suffix) {
  const files = [];
  async function walk(path) {
    for (const entry of await readdir(path, { withFileTypes: true })) {
      const child = resolve(path, entry.name);
      if (entry.isDirectory()) await walk(child);
      else if (entry.name.endsWith(suffix)) files.push(child);
    }
  }
  await walk(resolve(root, directory));
  return files;
}

test("English and German localization keys have exact parity", async () => {
  const en = JSON.parse(await readFile(resolve(root, "lang/en.json"), "utf8"));
  const de = JSON.parse(await readFile(resolve(root, "lang/de.json"), "utf8"));
  assert.deepEqual(Object.keys(en), Object.keys(de));
});

test("production source contains no deprecated module-owned ApplicationV1 classes", async () => {
  const source = (await Promise.all((await filesBelow("scripts", ".mjs")).map((path) => readFile(path, "utf8")))).join("\n");
  for (const prohibited of ["extends Application", "extends FormApplication", "new Dialog(", "mergeObject(", "duplicate("]) {
    assert.equal(source.includes(prohibited), false, prohibited);
  }
  assert.match(source, /HandlebarsApplicationMixin\(ApplicationV2\)/);
});

test("runtime code exposes public API and supported User batch APIs", async () => {
  const main = await readFile(resolve(root, "scripts/main.mjs"), "utf8");
  const reconciler = await readFile(resolve(root, "scripts/core/reconciler.mjs"), "utf8");
  assert.match(main, /module\.api = api/);
  assert.match(reconciler, /createDocuments/);
  assert.match(reconciler, /updateDocuments/);
  assert.equal(reconciler.includes("deleteDocuments"), false);
});

test("CSS selectors remain scoped to module-owned roots", async () => {
  const css = await readFile(resolve(root, "styles/declarative-user-provisioning.css"), "utf8");
  for (const line of css.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed.endsWith("{") || trimmed.startsWith("@")) continue;
    assert.ok(trimmed.startsWith(".dup-") || trimmed.startsWith(".dup-dashboard"), trimmed);
  }
});
