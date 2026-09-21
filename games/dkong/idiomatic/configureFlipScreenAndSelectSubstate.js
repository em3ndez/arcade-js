// SPDX-License-Identifier: GPL-3.0-only
/**
 * configureFlipScreenAndSelectSubstate — sub-state-0 arm of the in-game state: clear the display
 * and sound, set the flip-screen latch, and pick the next sub-state. A 1-player start
 * (ACTIVE_PLAYER_INDEX == 0) selects sub-state 1 with flip-screen left ON; a 2-player start selects
 * sub-state 3 and clears flip-screen on a cocktail cabinet so player 2 sees the mirrored screen.
 *
 * LIVE-OUT: memory (GAME_SUBSTATE plus the clear's tilemap/sprite/sound-shadow writes) and the
 * flip-screen latch, a board output rather than memory.
 */

import { GAME_SUBSTATE, DIP_UPRIGHT, ACTIVE_PLAYER_INDEX, FLIPSCREEN } from "./names.js";
import { clearTilemapAndSprites } from "./clearTilemapAndSprites.js";
import { silenceSound } from "./silenceSound.js";

export function configureFlipScreenAndSelectSubstate(m) {
  const { mem8 } = m;

  clearTilemapAndSprites(m);
  silenceSound(m);

  mem8[FLIPSCREEN] = 1;

  if (mem8[ACTIVE_PLAYER_INDEX] === 0) {
    mem8[GAME_SUBSTATE] = 0x01;
    return;
  }

  // Cocktail cabinet: clear flip-screen so player 2 sees the mirrored screen.
  if (mem8[DIP_UPRIGHT] !== 1) {
    mem8[FLIPSCREEN] = 0;
  }
  mem8[GAME_SUBSTATE] = 0x03;
}
