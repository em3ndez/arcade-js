// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_062a — one step of the on-screen bonus readout, run as a scheduled task. The payload byte
 * (task slot's second byte, in a register) picks the job: payload 0 pays the readout out to the
 * score; non-zero ticks it down one notch, or — when the readout is 0 and not yet latched — re-seeds
 * it (starting bonus / 10, quotient into the high nibble), stamps its 18-byte tile frame into video
 * RAM, and renders the two digits.
 *
 * LIVE-OUT: memory-only — the readout byte, the score or bottomed-out latch, and the readout's tile
 * frame and digits in video RAM.
 */

import { u8 } from "../../../core/int.js";
import {
  BONUS_DISPLAY,
  BONUS_DISPLAY_TILE_FRAME,
  BONUS_DISPLAY_ZEROED,
  BONUS_READOUT_TILE_BASE,
  BONUS_START,
} from "./names.js";
import { awardRemainingBonusToScore } from "./awardRemainingBonusToScore.js";
import { stepBonusDisplayDown } from "./stepBonusDisplayDown.js";
import { renderBonusDisplay } from "./renderBonusDisplay.js";

const BLOCK_COLUMNS = 6;
const BLOCK_CELLS_PER_COLUMN = 3;
const BLOCK_COLUMN_STRIDE = 0x20;

export function loc_062a(m, taskPayload = m.regs.a) {
  const { mem8 } = m;

  if (taskPayload === 0) {
    awardRemainingBonusToScore(m);
    return;
  }

  const display = mem8[BONUS_DISPLAY];
  if (display !== 0) {
    stepBonusDisplayDown(m, display);
    return;
  }

  if (mem8[BONUS_DISPLAY_ZEROED] !== 0) return;

  // Divide by 10 by repeated subtraction; exits only on remainder==0 (all reachable seeds are even).
  let remainder = mem8[BONUS_START];
  let quotient = 0;
  do {
    quotient = u8(quotient + 1);
    remainder = u8(remainder - 10);
  } while (remainder !== 0);

  // Nibble swap (rotate), not a shift: quotient>15 keeps its own high nibble in the low half.
  mem8[BONUS_DISPLAY] = (quotient << 4) | (quotient >> 4);

  let source = BONUS_DISPLAY_TILE_FRAME;
  let cell = BONUS_READOUT_TILE_BASE;
  for (let column = 0; column < BLOCK_COLUMNS; column++) {
    for (let i = 0; i < BLOCK_CELLS_PER_COLUMN; i++) mem8[cell + i] = mem8[source + i];
    source += BLOCK_CELLS_PER_COLUMN;
    cell += BLOCK_COLUMN_STRIDE;
  }

  renderBonusDisplay(m, mem8[BONUS_DISPLAY]);
}
