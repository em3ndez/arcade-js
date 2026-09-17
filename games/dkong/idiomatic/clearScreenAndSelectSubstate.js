// SPDX-License-Identifier: GPL-3.0-only
/**
 * clearScreenAndSelectSubstate — wipe the display, then point the in-game
 * sub-state index at a computed target (base + active-player index, 8-bit wrap).
 *
 * LIVE-OUT: memory-only — the tilemap and sprite-buffer bytes, and GAME_SUBSTATE.
 */

import { GAME_SUBSTATE, ACTIVE_PLAYER_INDEX } from "./names.js";
import { clearTilemapAndSprites } from "./clearTilemapAndSprites.js";

const PHASE_GROUP_BASE = 0x12; // base index of the phase group jumped into; sum kept live

export function clearScreenAndSelectSubstate(m) {
  const { mem8 } = m;

  clearTilemapAndSprites(m);

  mem8[GAME_SUBSTATE] = (mem8[ACTIVE_PLAYER_INDEX] + PHASE_GROUP_BASE) & 0xff;
}
