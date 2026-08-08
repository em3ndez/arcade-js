// SPDX-License-Identifier: GPL-3.0-only
/** startOnePlayerGame — stock the machine for a game with only the FIRST player's context filled in.
 *
 * The caption sprites are parked and PLAY_ACTIVE is raised to all bits. PLAYER_TWO_LIVES and the
 * byte beside PLAY_ACTIVE are both cleared; PLAYER_ONE_LIVES is loaded from the settings cell that
 * carries the starting count. One is then taken off the packed-decimal count the panel field
 * shows, that field is repainted from it, a fixed set of tilemap cells is copied into its keeps,
 * and the sequence machine is sent to its last phase. Nothing read here is written first and nothing
 * written is read back, so the order of the stores carries no meaning. What reads the byte beside
 * PLAY_ACTIVE is not established here.
 * LIVE-OUT: memory only. */

import { u8 } from "../../../core/int.js";
import { hideCaptionSprites } from "./hideCaptionSprites.js";
import { loc_172a } from "./loc_172a.js";
import { loc_4afb } from "./loc_4afb.js";
import { loc_4b30 } from "./loc_4b30.js";
import { PLAYER_ONE_LIVES, PLAYER_TWO_LIVES, PLAY_ACTIVE } from "./names.js";

const SECOND_PLAYER_FLAG = 0xad31;
const STARTING_LIVES = 0xa9c1;
const PANEL_COUNT = 0xa986;
const ALL_BITS = 255;

const LOW_DIGIT = 0x0f;
const HIGHEST = 0x99;
const DIGIT_BORROW = 6;
const TENS_BORROW = 0x60;

/** Take one off a packed-decimal byte, applying the decimal correction exactly as the hardware
 * does after that subtract, so a byte that was never valid packed decimal still lands where the
 * hardware would put it rather than where a tidier rule would. */
function stepPackedDecimalDown(value) {
  const difference = u8(value - 1);
  let correction = 0;
  if ((value & LOW_DIGIT) === 0 || (difference & LOW_DIGIT) > 9) correction += DIGIT_BORROW;
  if (value === 0 || difference > HIGHEST) correction += TENS_BORROW;
  return u8(difference - correction);
}

export function startOnePlayerGame(m) {
  const { mem8 } = m;
  hideCaptionSprites(m);

  mem8[SECOND_PLAYER_FLAG] = 0;
  mem8[PLAYER_TWO_LIVES] = 0;
  mem8[PLAY_ACTIVE] = ALL_BITS;
  mem8[PLAYER_ONE_LIVES] = mem8[STARTING_LIVES];
  mem8[PANEL_COUNT] = stepPackedDecimalDown(mem8[PANEL_COUNT]);

  loc_4afb(m);
  loc_4b30(m);
  loc_172a(m);
}
