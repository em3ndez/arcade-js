// SPDX-License-Identifier: GPL-3.0-only
/**
 * configureFlipScreenAndSelectSubstate — the first in-game NMI's start-up step:
 * wipe the display and sound, set the flip-screen latch for the cabinet, and pick
 * the sub-state the game runs next.  ROM 0x0986.
 *
 * Arm 0 of the in-game sub-state table (ROM 0x0702), dispatched by
 * dispatchInGameSubstate (ROM 0x06fe) the first time GAME_STATE(0x6005)==3 with
 * GAME_SUBSTATE(0x600A)==0 — i.e. the frame right after loc_08f8 commits a coin +
 * start and hands control to the in-game state. It does four things, in order:
 *
 *   1. CLEAR. clearTilemapAndSprites (ROM 0x0852) blanks every tilemap cell and
 *      zeroes the sprite shadow buffer; silenceSound (ROM 0x011c) zeroes every
 *      sound output and its work-RAM shadow. A blank slate for the board build.
 *   2. FLIP ON. Turn the flip-screen latch (0x7D82) ON unconditionally here; the
 *      cocktail 2-player arm below is the only path that turns it back off.
 *   3. SELECT SUB-STATE from ACTIVE_PLAYER_INDEX (0x600E), the join value's low byte
 *      (written by loc_08f8: zero for a 1-player start, non-zero for a 2-player start):
 *        - == 0  (1-player start): GAME_SUBSTATE = 1, flip-screen left ON. Return.
 *        - != 0  (2-player start): GAME_SUBSTATE = 3, and the cabinet decides the
 *          flip-screen latch — DIP_UPRIGHT(0x6026) == 1 keeps it ON (upright);
 *          anything else (cocktail) clears it to 0, so player 2 sees the mirror.
 *
 * Reads only the two selector bytes (0x600E join-low, 0x6026 DIP_UPRIGHT); every
 * other effect is on fixed memory / the flip-screen board latch.
 *
 * Memory-equivalent to the frozen oracle — equivalence-0986.test.js.
 * GATE:     crafted-entry; dispatched ONCE in a coin+start run (frame ~152, the
 *           1-player arm) as a real entry, plus crafted arms that force the two
 *           2-player paths (upright / cocktail) by poking 0x600E/0x6026 identically
 *           on both sides. The 0x7D82 flip-screen latch is NOT in the RAM dump, so
 *           the gate compares io.flipScreen too — that is what distinguishes the
 *           cocktail arm (flip OFF) from the upright arm (flip ON). Teeth = wrong
 *           GAME_SUBSTATE, a skipped cocktail flip-clear, and a skipped sound-clear.
 * LIVE-OUT: memory + the 0x7D82 flip-screen latch. Memory: GAME_SUBSTATE(0x600A)
 *           and the two callees' tilemap/sprite/sound-shadow writes. The flip latch
 *           is an io board output (outside the RAM dump), pinned via io.flipScreen.
 *           No live registers/flags — the rst-0x28 sub-state dispatch returns up the
 *           NMI path and consumes none of them; SP/PC are not compared (the
 *           direct-call layer replaces the oracle's `ret` stack/PC bookkeeping with
 *           the JS call stack).
 * NAMES:    GAME_SUBSTATE (0x600A), DIP_UPRIGHT (0x6026), ACTIVE_PLAYER_INDEX (0x600E)
 *           from ram.js. 0x7D82 (flip-screen board latch) is not in ram.js and stays a
 *           local hex constant.
 */

import { GAME_SUBSTATE, DIP_UPRIGHT, ACTIVE_PLAYER_INDEX } from "./ram.js";
import { clearTilemapAndSprites } from "./clearTilemapAndSprites.js"; // ROM 0x0852
import { silenceSound } from "./silenceSound.js"; // ROM 0x011c

// Flip-screen control latch (ls259.6h bit 2) — a board hardware register, not work
// RAM, so it lives outside ram.js as a local constant (as in handler_01c3).
const FLIPSCREEN = 0x7d82;

export function configureFlipScreenAndSelectSubstate(m) {
  const { mem } = m;

  // 1. Blank the whole display, then silence every sound output.
  clearTilemapAndSprites(m); // ROM 0x0852
  silenceSound(m); // ROM 0x011c

  // 2. Flip-screen ON (the default; only the cocktail arm turns it back off).
  mem.write8(FLIPSCREEN, 1);

  // 3. Select the starting sub-state from the join value's low byte (0 = 1-player start).
  if (mem.read8(ACTIVE_PLAYER_INDEX) === 0) {
    // 1-player start: sub-state 1, flip-screen left ON.
    mem.write8(GAME_SUBSTATE, 0x01);
    return;
  }

  // 2-player start: sub-state 3, flip-screen set by the cabinet type.
  if (mem.read8(DIP_UPRIGHT) !== 1) {
    // Cocktail cabinet: clear flip-screen so player 2 sees the mirrored screen.
    mem.write8(FLIPSCREEN, 0);
  }
  mem.write8(GAME_SUBSTATE, 0x03);
}
