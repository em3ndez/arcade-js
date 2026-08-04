// SPDX-License-Identifier: GPL-3.0-only
/**
 * clearScreenAndSelectSubstate — wipe the whole display, then jump the in-game
 * sub-state index to a computed target.
 *
 * One arm of the in-game sub-state table, dispatched on GAME_SUBSTATE. It is a phase
 * hand-off step — blank the previous scene, then re-point the sub-state machine into
 * a later phase group. Two actions, and it reads exactly one input byte:
 *
 *   1. CLEAR. Blank every tilemap cell and zero the 384-byte sprite shadow buffer —
 *      the same full-screen wipe the table's first arm opens with.
 *   2. SELECT. Store GAME_SUBSTATE = ACTIVE_PLAYER_INDEX + 0x12, an 8-bit add.
 *      ACTIVE_PLAYER_INDEX is the active-player index — the low byte of the game-start
 *      join value, 0 for a 1-player start, and the very byte the table's first arm
 *      reads as its start-up selector — and 0x12 is the base index of the phase group
 *      jumped into. The base is NOT folded into a single constant: the target
 *      sub-state is genuinely computed from the player index.
 *
 * Every other effect is on fixed memory; it reads no register.
 *
 * LIVE-OUT: memory-only — the tilemap and sprite-buffer bytes, and GAME_SUBSTATE. No
 * live registers or flags: the sub-state dispatcher this returns to consumes none of
 * them.
 */

import { GAME_SUBSTATE, ACTIVE_PLAYER_INDEX } from "./names.js";
import { clearTilemapAndSprites } from "./clearTilemapAndSprites.js";

// Base index of the phase group this arm jumps into; added to ACTIVE_PLAYER_INDEX to form
// the next sub-state. Kept explicit (not folded) — the sum is computed live.
const PHASE_GROUP_BASE = 0x12;

export function clearScreenAndSelectSubstate(m) {
  const { mem } = m;

  // 1. Blank the whole display (tilemap + sprite shadow buffer) for the next phase.
  clearTilemapAndSprites(m);

  // 2. Select the next sub-state: base + the active-player index, 8-bit wrap.
  mem.write8(GAME_SUBSTATE, (mem.read8(ACTIVE_PLAYER_INDEX) + PHASE_GROUP_BASE) & 0xff);
}
