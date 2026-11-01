#!/usr/bin/env node
// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Daniel Braniewski. See the LICENSE file for rights and obligations.
import { readFile, writeFile } from "node:fs/promises";
import { basename, extname, resolve } from "node:path";
import process from "node:process";
import {
  canonicalManifestJson,
  canonicalManifestYaml,
  createExampleManifest,
  digestManifest,
  exportManifestSchema,
  parseAndValidateManifest,
} from "../scripts/core/manifest.mjs";
import { buildReconciliationPlan } from "../scripts/core/planner.mjs";
import { FALLBACK_ROLE_MAP } from "../scripts/core/roles.mjs";

const HELP = `Runyth Declarative User Provisioning manifest CLI 1.0.0

Usage:
  node tools/user-manifest.mjs init <output.{yaml|json}> [--force]
  node tools/user-manifest.mjs validate <manifest>
  node tools/user-manifest.mjs format <manifest> [--output <path>] [--format yaml|json]
  node tools/user-manifest.mjs digest <manifest>
  node tools/user-manifest.mjs plan <manifest> --snapshot <snapshot.json> [--orphan-policy preserve|disable]
  node tools/user-manifest.mjs schema [--output <path>]

Exit codes: 0 success, 1 validation/plan failure, 2 usage or I/O failure.
`;

function parseArgs(argv) {
  const [command, ...rest] = argv;
  const positional = [];
  const options = {};
  for (let index = 0; index < rest.length; index += 1) {
    const value = rest[index];
    if (!value.startsWith("--")) {
      positional.push(value);
      continue;
    }
    const key = value.slice(2);
    if (key === "force") options.force = true;
    else {
      const optionValue = rest[index + 1];
      if (!optionValue || optionValue.startsWith("--")) throw new Error(`Option --${key} requires a value.`);
      options[key] = optionValue;
      index += 1;
    }
  }
  return { command, positional, options };
}

function formatForPath(path, explicit) {
  if (explicit) return explicit;
  return extname(path).toLowerCase() === ".json" ? "json" : "yaml";
}

async function loadManifest(path) {
  const text = await readFile(resolve(path), "utf8");
  const validation = parseAndValidateManifest(text, { source: path });
  return { text, validation };
}

function printIssues(validation) {
  for (const entry of [...validation.errors, ...validation.warnings]) {
    process.stderr.write(`${entry.severity.toUpperCase()} ${entry.code} ${entry.path}: ${entry.message}\n`);
  }
}

async function writeOutput(path, text, force = true) {
  if (!path) {
    process.stdout.write(text);
    return;
  }
  await writeFile(resolve(path), text, { encoding: "utf8", flag: force ? "w" : "wx" });
  process.stdout.write(`Wrote ${path}\n`);
}

async function main() {
  const { command, positional, options } = parseArgs(process.argv.slice(2));
  if (!command || command === "help" || command === "--help" || command === "-h") {
    process.stdout.write(HELP);
    return 0;
  }

  if (command === "init") {
    const output = positional[0];
    if (!output) throw new Error("init requires an output path.");
    const format = formatForPath(output, options.format);
    const manifest = createExampleManifest();
    const text = format === "json" ? canonicalManifestJson(manifest) : canonicalManifestYaml(manifest);
    await writeOutput(output, text, Boolean(options.force));
    return 0;
  }

  if (command === "schema") {
    const text = `${JSON.stringify(exportManifestSchema(), null, 2)}\n`;
    await writeOutput(options.output, text);
    return 0;
  }

  const manifestPath = positional[0];
  if (!manifestPath) throw new Error(`${command} requires a manifest path.`);
  const { validation } = await loadManifest(manifestPath);
  printIssues(validation);

  if (command === "validate") {
    if (!validation.valid) return 1;
    process.stdout.write(`Valid ${basename(manifestPath)}: ${validation.manifest.users.length} user(s).\n`);
    return 0;
  }

  if (!validation.valid) return 1;

  if (command === "format") {
    const format = formatForPath(options.output ?? manifestPath, options.format);
    const text = format === "json" ? canonicalManifestJson(validation.manifest) : canonicalManifestYaml(validation.manifest);
    await writeOutput(options.output, text);
    return 0;
  }

  if (command === "digest") {
    process.stdout.write(`${await digestManifest(validation.manifest)}  ${manifestPath}\n`);
    return 0;
  }

  if (command === "plan") {
    if (!options.snapshot) throw new Error("plan requires --snapshot <snapshot.json>.");
    const snapshot = JSON.parse(await readFile(resolve(options.snapshot), "utf8"));
    const digest = await digestManifest(validation.manifest);
    const plan = buildReconciliationPlan({
      manifest: validation.manifest,
      snapshot,
      manifestDigest: digest,
      roleMap: FALLBACK_ROLE_MAP,
      orphanPolicy: options["orphan-policy"] ?? validation.manifest.orphanPolicy,
    });
    process.stdout.write(`${JSON.stringify(plan, null, 2)}\n`);
    return plan.valid ? 0 : 1;
  }

  throw new Error(`Unknown command '${command}'.\n\n${HELP}`);
}

main().then((code) => {
  process.exitCode = code;
}).catch((error) => {
  process.stderr.write(`Error: ${error.message}\n`);
  process.exitCode = 2;
});
