// SPDX-License-Identifier: GPL-3.0-only
/**
 * resetStateAndShowSetup — reset/round-restart epilogue: start a fresh attract cycle with no active
 * player, commit the cabinet settings, show the setup screen, then hand off to the reset handler.
 *
 * Reached at the tail of cold boot and at each per-player teardown: it clears the active player and
 * arms the secondary game-state byte, decodes the cabinet DIP switches into the gameplay-parameter
 * block, paints and briefly holds the setup screen, then tail-hands to the reset/entry handler
 * (which re-seats the stack and runs the game loop, never returning). The name stays neutral — one
 * of a family of near-identical reset/entry epilogues.
 */

import { applyDipSwitches } from "./applyDipSwitches.js";
import { showSetupScreen } from "./showSetupScreen.js";
import { GAME_STATE, ACTIVE_PLAYER } from "./names.js";

export function* resetStateAndShowSetup(m) {
  const { mem8 } = m;

  // Fresh attract cycle: no active player, secondary state armed.
  mem8[GAME_STATE] = 0;
  mem8[ACTIVE_PLAYER] = 1;

  applyDipSwitches(m);
  yield* showSetupScreen(m);

  // Hand off to the reset/entry handler and never return; it branches on credits into the demo or
  // the credit hold. m.call of a spine generator returns the generator object, so delegate with yield*.
  return yield* m.call(0x01f9);
}
