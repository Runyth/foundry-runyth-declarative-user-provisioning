// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Runyth. See the LICENSE file for rights and obligations.
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFile, readdir, stat } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const checks = [];

function pass(name) {
  checks.push(name);
  console.log(`PASS ${name}`);
}

async function walk(directory) {
  const files = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = resolve(directory, entry.name);
    if (entry.isDirectory() && entry.name !== "dist" && entry.name !== "node_modules") files.push(...await walk(path));
    else if (entry.isFile()) files.push(path);
  }
  return files;
}

const moduleManifest = JSON.parse(await readFile(resolve(root, "module.json"), "utf8"));
assert.equal(moduleManifest.id, "runyth-declarative-user-provisioning");
assert.equal(moduleManifest.version, "1.1.0");
assert.equal(moduleManifest.compatibility.minimum, "13");
assert.equal(moduleManifest.compatibility.maximum, "13");
pass("module identity and Foundry compatibility");

for (const path of [...moduleManifest.esmodules, ...moduleManifest.styles, ...moduleManifest.languages.map((entry) => entry.path), moduleManifest.license, moduleManifest.readme]) {
  assert.equal((await stat(resolve(root, path))).isFile(), true, path);
}
pass("all manifest paths exist with matching case");

const allFiles = await walk(root);
for (const path of allFiles.filter((path) => path.endsWith(".mjs"))) execFileSync(process.execPath, ["--check", path], { stdio: "pipe" });
pass("JavaScript syntax");

for (const path of allFiles.filter((path) => path.endsWith(".json"))) JSON.parse(await readFile(path, "utf8"));
pass("JSON syntax");

const en = JSON.parse(await readFile(resolve(root, "lang/en.json"), "utf8"));
const de = JSON.parse(await readFile(resolve(root, "lang/de.json"), "utf8"));
assert.deepEqual(Object.keys(en), Object.keys(de));
pass(`English/German localization parity (${Object.keys(en).length} keys)`);

const productionText = (await Promise.all(allFiles.filter((path) => path.includes("/scripts/") && path.endsWith(".mjs")).map((path) => readFile(path, "utf8")))).join("\n");
for (const token of ["extends FormApplication", "extends Application {", "new Dialog(", "mergeObject(", "duplicate(", ".deleteDocuments(", "eval("]) {
  assert.equal(productionText.includes(token), false, token);
}
assert.match(productionText, /HandlebarsApplicationMixin\(ApplicationV2\)/);
pass("ApplicationV2 and prohibited legacy pattern audit");

const template = await readFile(resolve(root, "templates/dashboard.hbs"), "utf8");
for (const match of template.matchAll(/localize\s+"(DUP\.[^"]+)"/g)) assert.ok(en[match[1]], `Missing localization key ${match[1]}`);
pass("template localization references");

const css = await readFile(resolve(root, "styles/runyth-declarative-user-provisioning.css"), "utf8");
assert.equal(/(^|\n)\s*(?:button|input|select|label|\.window-content|:root)\s*[{,]/.test(css), false);
pass("CSS isolation");

execFileSync(process.execPath, [resolve(root, "tools/user-manifest.mjs"), "validate", resolve(root, "manifests/users.example.yaml")], { stdio: "pipe" });
execFileSync(process.execPath, [resolve(root, "tools/user-manifest.mjs"), "validate", resolve(root, "manifests/users.example.json")], { stdio: "pipe" });
pass("CLI example validation");

execFileSync(process.execPath, ["--test", "tests/*.test.mjs"], { cwd: root, shell: true, stdio: "pipe" });
pass("automated test suite");

console.log(`\n${checks.length} quality gates passed.`);
