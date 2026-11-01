// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Daniel Braniewski. See the LICENSE file for rights and obligations.
import { MODULE_ID } from "../core/constants.mjs";
import { logger } from "../core/logger.mjs";

let renderSettingsHook = null;

function asRoot(html) {
  if (html instanceof HTMLElement) return html;
  if (html?.[0] instanceof HTMLElement) return html[0];
  return null;
}

export function registerLaunchers(openDashboard) {
  if (renderSettingsHook !== null) Hooks.off("renderSettings", renderSettingsHook);
  renderSettingsHook = Hooks.on("renderSettings", (_application, html) => {
    try {
      const root = asRoot(html);
      const target = root?.querySelector("#settings-game");
      if (!target || target.querySelector(`[data-${MODULE_ID}-launcher]`)) return;
      const button = document.createElement("button");
      button.type = "button";
      button.setAttribute(`data-${MODULE_ID}-launcher`, "true");
      button.innerHTML = `<i class="fa-solid fa-users-gear" aria-hidden="true"></i> ${game.i18n.localize("DUP.Launcher.Open")}`;
      button.addEventListener("click", () => openDashboard(), { once: false });
      target.append(button);
    } catch (error) {
      logger.warn("Could not add the Settings launcher.", error);
    }
  });
}
