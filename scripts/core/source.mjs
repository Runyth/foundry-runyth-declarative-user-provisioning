// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Daniel Braniewski. See the LICENSE file for rights and obligations.
import { MAX_MANIFEST_BYTES, MODULE_ID } from "./constants.mjs";

export function validateManifestPath(path) {
  if (typeof path !== "string" || !path.trim()) throw new Error("Manifest path is empty.");
  const trimmed = path.trim().replaceAll("\\", "/").replace(/^\/+/, "");
  if (/^(?:https?:|data:|javascript:|file:)/i.test(trimmed)) {
    throw new Error("External URLs and non-Foundry protocols are not allowed for manifest loading.");
  }
  if (trimmed.includes("..")) throw new Error("Manifest path traversal is not allowed.");
  if (!/\.(?:json|ya?ml)$/i.test(trimmed)) throw new Error("Manifest path must end in .json, .yaml, or .yml.");
  return trimmed;
}

export function resolveManifestUrl(path, { getRoute = globalThis.foundry?.utils?.getRoute } = {}) {
  const normalized = validateManifestPath(path);
  return typeof getRoute === "function" ? getRoute(`/${normalized}`) : `/${normalized}`;
}

export async function loadManifestText(path, {
  fetchImpl = globalThis.fetch,
  getRoute = globalThis.foundry?.utils?.getRoute,
  signal,
} = {}) {
  if (typeof fetchImpl !== "function") throw new Error("Fetch API is unavailable.");
  const normalizedPath = validateManifestPath(path);
  const url = resolveManifestUrl(normalizedPath, { getRoute });
  const response = await fetchImpl(url, {
    method: "GET",
    cache: "no-store",
    credentials: "same-origin",
    signal,
    headers: { Accept: "application/json, application/yaml, text/yaml, text/plain" },
  });
  if (!response.ok) throw new Error(`Manifest request failed with HTTP ${response.status} ${response.statusText}.`);

  const declaredLength = Number(response.headers?.get?.("content-length") ?? 0);
  if (Number.isFinite(declaredLength) && declaredLength > MAX_MANIFEST_BYTES) {
    throw new Error(`Manifest exceeds the ${MAX_MANIFEST_BYTES}-byte safety limit.`);
  }
  const text = await response.text();
  if (new TextEncoder().encode(text).byteLength > MAX_MANIFEST_BYTES) {
    throw new Error(`Manifest exceeds the ${MAX_MANIFEST_BYTES}-byte safety limit.`);
  }
  return { path: normalizedPath, url, text };
}

export function assertModuleOwnedDefaultPath(path) {
  const normalized = validateManifestPath(path);
  return normalized.startsWith(`modules/${MODULE_ID}/`) ? normalized : null;
}
