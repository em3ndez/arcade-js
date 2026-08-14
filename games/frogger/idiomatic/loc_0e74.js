// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_0e74 — force the game mode to attract-idle (the credits-present tail of the attract sequencer).
 * LIVE-OUT: memory-only.
 */
import { GAME_MODE } from "./names.js";

const ATTRACT_IDLE = 5;

export function loc_0e74(m) {
  m.mem8[GAME_MODE] = ATTRACT_IDLE;
}
