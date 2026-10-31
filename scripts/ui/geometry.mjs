// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Runyth. See the LICENSE file for rights and obligations.
import { MODULE_ID, SETTINGS } from "../core/constants.mjs";

export const DEFAULT_GEOMETRY = Object.freeze({ width: 980, height: 720, left: null, top: null });

export function clampGeometry(geometry = {}, viewport = globalThis.window) {
  const viewportWidth = Math.max(640, Number(viewport?.innerWidth ?? 1200));
  const viewportHeight = Math.max(480, Number(viewport?.innerHeight ?? 800));
  const width = Math.min(Math.max(Number(geometry.width ?? DEFAULT_GEOMETRY.width), 640), Math.max(640, viewportWidth - 32));
  const height = Math.min(Math.max(Number(geometry.height ?? DEFAULT_GEOMETRY.height), 480), Math.max(480, viewportHeight - 32));
  const maxLeft = Math.max(16, viewportWidth - width - 16);
  const maxTop = Math.max(16, viewportHeight - height - 16);
  const requestedLeft = geometry.left ?? Math.round((viewportWidth - width) / 2);
  const requestedTop = geometry.top ?? Math.round((viewportHeight - height) / 2);
  return {
    width,
    height,
    left: Math.min(Math.max(Number(requestedLeft), 16), maxLeft),
    top: Math.min(Math.max(Number(requestedTop), 16), maxTop),
  };
}

export function loadGeometry() {
  try {
    return clampGeometry(game.settings.get(MODULE_ID, SETTINGS.DASHBOARD_GEOMETRY) ?? {});
  } catch {
    return clampGeometry(DEFAULT_GEOMETRY);
  }
}

export async function saveGeometry(position = {}) {
  const geometry = clampGeometry(position);
  await game.settings.set(MODULE_ID, SETTINGS.DASHBOARD_GEOMETRY, geometry);
  return geometry;
}
