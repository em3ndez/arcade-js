// SPDX-License-Identifier: GPL-3.0-only
/**
 * clearScreenAndAdvanceSubstate — wipe the screen, then step to the next
 * sub-state of the current game state.  ROM 0x07c3.
 *
 * Entry 5 of the game-state-1 (attract) sub-state table at ROM 0x0748, dispatched
 * by handler_073c on GAME_SUBSTATE (0x600A). It is the "blank the screen and move
 * on" step of the attract sequence — two actions, no inputs:
 *
 *   1. CLEAR. Call clearPlayfieldAndSprites (ROM 0x0874) to blank the tilemap
 *      playfield, the two side columns, and the 384-byte sprite shadow buffer,
 *      readying the display for whatever the next sub-state draws.
 *   2. ADVANCE. Increment GAME_SUBSTATE (0x600A) by one (8-bit RMW), so the next
 *      dispatch through the 0x0748 table selects the following sub-state.
 *
 * Reads no register and no input byte; both effects are on fixed memory.
 *
 * Memory-equivalent to the frozen oracle — equivalence-07c3.test.js.
 * GATE:     crafted-entry; reached once in a ~3000-frame attract run (state-1
 *           sub-state 5) as a real dispatch, plus crafted sentinel entries that
 *           sweep GAME_SUBSTATE across its 8-bit wrap (0xFF->0x00) with the clear
 *           regions painted to a sentinel on BOTH sides — pinning both the inc
 *           target and the exact clear footprint. Teeth = double-increment (wrong
 *           sub-state advance) + skip-clear (screen not blanked).
 * LIVE-OUT: memory-only — the cleared tilemap/sprite-buffer bytes and the
 *           incremented GAME_SUBSTATE. No live registers/flags: the `inc (hl)`
 *           Z/S/A it leaves are dead ABI (the rst-0x28 sub-state dispatch returns
 *           up the NMI path, which consumes none of them). SP/PC are not compared
 *           — the idiomatic layer drops the `ret`'s stack/PC bookkeeping.
 * NAMES:    GAME_SUBSTATE (0x600A). The cleared VRAM/sprite-buffer addresses are
 *           owned by clearPlayfieldAndSprites (ROM 0x0874).
 */

import { GAME_SUBSTATE } from "./names.js";
import { clearPlayfieldAndSprites } from "./clearPlayfieldAndSprites.js";

export function clearScreenAndAdvanceSubstate(m) {
  const { mem } = m;

  // 1. Blank the playfield + sprite buffer for the next sub-state's draw.
  clearPlayfieldAndSprites(m);

  // 2. Advance the sub-state index (8-bit wrap, matching `inc (hl)` on 0x600A).
  mem.write8(GAME_SUBSTATE, (mem.read8(GAME_SUBSTATE) + 1) & 0xff);
}
