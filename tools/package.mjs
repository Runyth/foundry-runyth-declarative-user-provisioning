// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Daniel Braniewski. See the LICENSE file for rights and obligations.
import { createHash } from "node:crypto";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createDeterministicZip } from "./lib/deterministic-zip.mjs";

const root = resolve(import.meta.dirname, "..");
const dist = resolve(root, "dist");
const moduleId = "runyth-declarative-user-provisioning";
const version = JSON.parse(await readFile(resolve(root, "module.json"), "utf8")).version;
const runtimeRoots = ["lang/", "manifests/", "schema/", "scripts/", "styles/", "templates/"];
const runtimeFiles = new Set(["module.json", "README.md", "CHANGELOG.md", "LICENSE"]);
const runtimeFilter = (path) => runtimeFiles.has(path) || runtimeRoots.some((prefix) => path.startsWith(prefix));
const sourceFilter = (path) => !path.startsWith("dist/") && !path.startsWith("node_modules/") && !path.includes("/.git/") && path !== "SHA256SUMS.txt";
const docsFilter = (path) => path.startsWith("docs/") || ["CHANGELOG.md", "README.md", "LICENSE", "SECURITY.md", "CONTRIBUTING.md"].includes(path);

await rm(dist, { recursive: true, force: true });
await mkdir(dist, { recursive: true });
const install = resolve(dist, `${moduleId}-v${version}-mod.zip`);
const source = resolve(dist, `${moduleId}-v${version}-src.zip`);
await createDeterministicZip({ root, output: install, prefix: `${moduleId}/`, filter: runtimeFilter });
await createDeterministicZip({ root, output: source, prefix: `${moduleId}-v${version}-src/`, filter: sourceFilter });

async function sha(path) {
  return createHash("sha256").update(await readFile(path)).digest("hex");
}
const lines = [`${await sha(install)}  ${install.split("/").at(-1)}`, `${await sha(source)}  ${source.split("/").at(-1)}`];
const docs = resolve(dist, `${moduleId}-v${version}-doc.zip`);
await createDeterministicZip({ root, output: docs, prefix: `${moduleId}-v${version}-doc/`, filter: docsFilter });
lines.push(`${await sha(docs)}  ${docs.split("/").at(-1)}`);
await writeFile(resolve(dist, `${moduleId}-v${version}-SHA256SUMS.txt`), `${lines.join("\n")}\n`);
console.log(JSON.stringify({ install, source, docs, checksums: lines }, null, 2));
