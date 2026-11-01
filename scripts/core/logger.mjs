// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Daniel Braniewski. See the LICENSE file for rights and obligations.
import { LOG_LEVELS, MODULE_TITLE, SETTINGS, MODULE_ID } from "./constants.mjs";

const PRIORITY = Object.freeze({ error: 0, warn: 1, info: 2, debug: 3 });

function currentLevel() {
  try {
    return globalThis.game?.settings?.get?.(MODULE_ID, SETTINGS.LOG_LEVEL) ?? LOG_LEVELS.INFO;
  } catch {
    return LOG_LEVELS.INFO;
  }
}

function enabled(level) {
  return PRIORITY[level] <= (PRIORITY[currentLevel()] ?? PRIORITY.info);
}

function prefix(message) {
  return `${MODULE_TITLE} | ${message}`;
}

export const logger = Object.freeze({
  error(message, ...details) {
    if (enabled("error")) console.error(prefix(message), ...details);
  },
  warn(message, ...details) {
    if (enabled("warn")) console.warn(prefix(message), ...details);
  },
  info(message, ...details) {
    if (enabled("info")) console.info(prefix(message), ...details);
  },
  debug(message, ...details) {
    if (enabled("debug")) console.debug(prefix(message), ...details);
  },
});
