// SPDX-License-Identifier: GPL-3.0-only
/** startTwoPlayerGame — stock the machine for a game with BOTH players' contexts filled in. The caption
 * sprites are parked, PLAY_ACTIVE and the byte beside it are both raised, and each player's life
 * count is loaded from the settings cell that carries the starting count. The two-player-start arm
 * then runs, two are taken off the packed-decimal count the panel field shows, that field is
 * repainted, and the sequence machine is sent to its last phase. LIVE-OUT: memory only. */

import { u8 } from "../../../core/int.js";
import { hideCaptionSprites } from "./hideCaptionSprites.js";
import { setUpTwoPlayerStartObjectOnce } from "./setUpTwoPlayerStartObjectOnce.js";
import { loc_4afb } from "./loc_4afb.js";
import { loc_172a } from "./loc_172a.js";
import { PLAYER_ONE_LIVES, PLAYER_TWO_LIVES, PLAY_ACTIVE } from "./names.js";

const SECOND_PLAYER_FLAG = 0xad31;
const STARTING_LIVES = 0xa9c1;
const PANEL_COUNT = 0xa986;
const ALL_BITS = 255;
const TWO_CREDITS = 2;

const LOW_DIGIT = 0x0f;
const HIGHEST = 0x99;
const DIGIT_BORROW = 6;
const TENS_BORROW = 0x60;

/** Take two off a packed-decimal byte, with the decimal correction the hardware applies after that
 * subtract, so a byte that was never valid packed decimal still lands where the hardware puts it. */
function stepPackedDecimalDownByTwo(value) {
  const difference = u8(value - TWO_CREDITS);
  let correction = 0;
  if ((value & LOW_DIGIT) < TWO_CREDITS || (difference & LOW_DIGIT) > 9) correction += DIGIT_BORROW;
  if (value < TWO_CREDITS || difference > HIGHEST) correction += TENS_BORROW;
  return u8(difference - correction);
}

export function startTwoPlayerGame(m) {
  const { mem8 } = m;
  hideCaptionSprites(m);

  mem8[PLAY_ACTIVE] = ALL_BITS;
  mem8[SECOND_PLAYER_FLAG] = ALL_BITS;
  mem8[PLAYER_ONE_LIVES] = mem8[STARTING_LIVES];
  mem8[PLAYER_TWO_LIVES] = mem8[STARTING_LIVES];

  setUpTwoPlayerStartObjectOnce(m);

  mem8[PANEL_COUNT] = stepPackedDecimalDownByTwo(mem8[PANEL_COUNT]);

  loc_4afb(m);
  loc_172a(m);
}
