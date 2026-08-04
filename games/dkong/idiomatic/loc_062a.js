// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_062a — one step of the on-screen bonus readout, run as a scheduled task.
 *
 * The task slot's second byte arrives in a register and is the only thing that picks between the
 * routine's two top-level jobs:
 *
 *   payload 0        — pay whatever is left on the readout out to the score.
 *   payload non-zero — tick the readout:
 *       readout non-zero          take one notch off it.
 *       readout 0, latch SET      do nothing — it has already bottomed out.
 *       readout 0, latch CLEAR    re-seed it (below), then render.
 *
 * THE RE-SEED divides the level's starting bonus by ten by repeated subtraction and puts the
 * quotient in the HIGH nibble of the readout byte, which is where the packed two-digit value wants
 * it. It then lays an 18-byte tile block into video RAM as six columns of three cells, one screen
 * column apart — the frame the readout sits in — re-reads the readout and falls through into the
 * two-digit render, which stamps the digits into the middle cell of two of those columns.
 *
 * THE DIVIDE LOOP HAS NO ITERATION GUARD, and none is added here: it exits only when the running
 * remainder hits exactly zero, stepping by ten and wrapping at a byte, so an ODD starting bonus
 * would spin forever. No reachable input is odd — the one routine that writes the starting bonus
 * stores min((10 * level + 40) mod 256, 80), which is even for every level, wrapped or not.
 * Whether some other route could set an odd value is left open; only that one writer was checked.
 *
 * The rotate that lifts the quotient into the high nibble is a NIBBLE SWAP, not a shift, so a
 * quotient above 15 keeps its own high nibble in the low half. That is not merely theoretical: a
 * starting bonus of 0 divides to 128, which stores as 0x08. Whether a 0 seed ever coincides with
 * this arm's other two conditions is not checked here.
 *
 * LIVE-OUT: memory-only, on all four arms — the readout byte, the score or the bottomed-out latch
 * depending on the arm, and the readout's tile frame and digits in video RAM.
 */

import { u8 } from "../../../core/int.js";
import { BONUS_DISPLAY, BONUS_DISPLAY_ZEROED, BONUS_START } from "./names.js";
import { awardRemainingBonusToScore } from "./awardRemainingBonusToScore.js";
import { stepBonusDisplayDown } from "./stepBonusDisplayDown.js";
import { renderBonusDisplay } from "./renderBonusDisplay.js";

// The tile block that frames the bonus readout: 18 bytes laid into video RAM as six columns of
// three consecutive cells, one screen column apart.
const BLOCK_TILES = 0x384a;
const BLOCK_FIRST_CELL = 0x7465; // where the first column lands
const BLOCK_COLUMNS = 6;
const BLOCK_CELLS_PER_COLUMN = 3;
const BLOCK_COLUMN_STRIDE = 0x20;

/** `taskPayload` is the task slot's second byte, which arrives in a register. */
export function loc_062a(m, taskPayload = m.regs.a) {
  const { regs, mem8 } = m;

  // Payload 0 — pay the readout out to the score instead of ticking it.
  if (taskPayload === 0) {
    awardRemainingBonusToScore(m);
    return;
  }

  // There is still bonus on the readout: take one notch off it.
  const display = mem8[BONUS_DISPLAY];
  if (display !== 0) {
    regs.a = display;
    stepBonusDisplayDown(m);
    return;
  }

  // The readout is at zero. Once the bottomed-out latch is set, this task does nothing at all.
  if (mem8[BONUS_DISPLAY_ZEROED] !== 0) return;

  // Re-seed: the starting bonus divided by ten, by repeated subtraction. No guard — see above.
  let remainder = mem8[BONUS_START];
  let quotient = 0;
  do {
    quotient = u8(quotient + 1);
    remainder = u8(remainder - 10);
  } while (remainder !== 0);

  // The quotient belongs in the high nibble of the packed two-digit byte. This is a rotate,
  // so a quotient above 15 wraps its own high nibble into the low half.
  mem8[BONUS_DISPLAY] = (quotient << 4) | (quotient >> 4);

  // Lay the readout's frame into video RAM, one column of three cells at a time.
  let source = BLOCK_TILES;
  let cell = BLOCK_FIRST_CELL;
  for (let column = 0; column < BLOCK_COLUMNS; column++) {
    for (let i = 0; i < BLOCK_CELLS_PER_COLUMN; i++) mem8[cell + i] = mem8[source + i];
    source += BLOCK_CELLS_PER_COLUMN;
    cell += BLOCK_COLUMN_STRIDE;
  }

  // Render the freshly seeded value: the tail reads its digit byte from the accumulator.
  regs.a = mem8[BONUS_DISPLAY];
  renderBonusDisplay(m);
}
