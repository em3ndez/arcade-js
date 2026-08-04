// SPDX-License-Identifier: GPL-3.0-only
/**
 * configureFlipScreenAndSelectSubstate — the first in-game frame's start-up step: wipe the display
 * and the sound, set the flip-screen latch for the cabinet, and pick the sub-state the game runs
 * next.
 *
 * It is the sub-state-0 arm of the in-game state, so it runs on the frame right after a coin and
 * start commit and hand control over to that state. Three things happen, in order:
 *
 *   1. CLEAR. Blank every tilemap cell and zero the sprite shadow buffer, then zero every sound
 *      output and its work-RAM shadow. A blank slate for the board build.
 *   2. FLIP ON. Turn the flip-screen latch ON unconditionally; the cocktail two-player arm below
 *      is the only path that turns it back off.
 *   3. SELECT THE SUB-STATE from ACTIVE_PLAYER_INDEX, which the coin-and-start step leaves at zero
 *      for a 1-player start and non-zero for a 2-player one:
 *        - zero (1-player start): sub-state 1, flip-screen left ON, return.
 *        - non-zero (2-player start): sub-state 3, and the cabinet decides the flip-screen latch —
 *          an upright cabinet keeps it ON, while a cocktail one clears it to 0 so player 2 sees
 *          the mirrored screen.
 *
 * It reads only those two selector bytes; every other effect lands on fixed memory or on the
 * flip-screen latch.
 *
 * LIVE-OUT: memory — GAME_SUBSTATE plus the tilemap, sprite and sound-shadow writes of the clear —
 * and the flip-screen latch, which is a board output rather than memory.
 */

import { GAME_SUBSTATE, DIP_UPRIGHT, ACTIVE_PLAYER_INDEX } from "./names.js";
import { clearTilemapAndSprites } from "./clearTilemapAndSprites.js";
import { silenceSound } from "./silenceSound.js";

// The flip-screen control latch — a board hardware register rather than work RAM, so it carries
// no shared name and is a local constant here.
const FLIPSCREEN = 0x7d82;

export function configureFlipScreenAndSelectSubstate(m) {
  const { mem } = m;

  // 1. Blank the whole display, then silence every sound output.
  clearTilemapAndSprites(m);
  silenceSound(m);

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
