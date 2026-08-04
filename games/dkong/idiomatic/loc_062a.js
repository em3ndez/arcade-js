// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_062a — task entry 10: one step of the on-screen bonus readout.  ROM 0x062A–0x0669.
 *
 * The main loop's task dispatcher (ROM 0x02E3, still frozen) indexes the handler table at
 * ROM 0x0307 with the task id and hands the task slot's second byte to the handler in a
 * register. The word at 0x0311/0x0312 of that table is `2a 06`, so this is task id 10; the
 * incoming payload is the only thing that picks between the routine's two top-level jobs.
 *
 *   payload 0        — pay the readout out to the score (awardRemainingBonusToScore).
 *   payload non-zero — tick the readout:
 *       BONUS_DISPLAY non-zero            take one notch off it (stepBonusDisplayDown).
 *       BONUS_DISPLAY 0, latch SET        do nothing — the readout has already bottomed out.
 *       BONUS_DISPLAY 0, latch CLEAR      re-seed it (below), then render.
 *
 * THE RE-SEED divides BONUS_START by ten by repeated subtraction and puts the quotient in the
 * HIGH nibble of BONUS_DISPLAY, which is where the packed two-digit readout wants it —
 * BONUS_START is 50 at level 1, so the display byte becomes 0x50 and the field reads 5000
 * (mechanisms.md §6 tabulates the per-level starting bonus against the on-screen value). It
 * then copies an 18-byte tile block from ROM 0x384A into video RAM as six columns of three
 * cells (first cell 0x7465, column stride 0x20 — the same one-column step the field's own two
 * digit cells are apart), re-reads BONUS_DISPLAY and falls through to renderBonusDisplay, which
 * stamps the two digit tiles into the middle cell of two of those columns (0x74C6/0x74E6).
 *
 * THE DIVIDE LOOP HAS NO ITERATION GUARD, and none is added here: it exits only when the
 * running remainder reaches exactly zero, stepping by ten modulo 256, so an ODD BONUS_START
 * would spin forever — in the frozen oracle and in this rewrite alike. No reachable input is
 * odd: BONUS_START's only writer (ROM 0x0F8E, in initBoardState) stores
 * min((10*LEVEL + 40) mod 256, 80), and 10*LEVEL + 40 is even for every LEVEL, wrapped or not
 * — mechanisms.md §6 tabulates that computation including its level-22 wrap to 4, and every
 * entry is even. The gate sweeps all 128 even values and says plainly that it excludes the odd
 * ones; whether an odd BONUS_START is reachable by some other route is left open, because
 * this file has only checked the one writer.
 *
 * The rotate that lifts the quotient into the high nibble is a NIBBLE SWAP, not a shift: a
 * quotient above 15 keeps its own high nibble in the low half. That is not merely theoretical —
 * BONUS_START is [seen] at 0 as well as 50, and a seed of 0 divides to 128, which stores as
 * 0x08. Whether a 0 seed ever coincides with this arm's other two conditions is not checked here.
 *
 * Memory-equivalent to the frozen oracle — equivalence-062a.test.js.
 * GATE:     attract reaches only two of the four arms, so the gate is captures PLUS crafted
 *           entries and says which is which. Its own reachability test measures that: over
 *           9000 frames it sees the tick and re-seed arms only, never the payload-0 payout arm
 *           and never the latch-set arm, and it fails if that ever changes. The tick and
 *           re-seed arms are replayed from real captured dispatches — ALL of them, inline, with
 *           no sampling, and the gate pins the exact counts (15 captures; 39 dispatches over the
 *           longer run, 35 tick and 4 re-seed) so an empty or half-firing capture hook fails
 *           loudly instead of skipping. The other two
 *           arms are crafted — a real attract base with the bytes that select the arm nudged,
 *           identically on both sides. Three sweeps on that base pin the arms individually:
 *           all 128 EVEN BONUS_START values through the re-seed (the odd half is excluded
 *           because both sides spin forever there, NOT because it passes), all 255 non-zero
 *           BONUS_DISPLAY values through the tick arm, all 256 through the payout arm.
 *           Contract is RAM − STACK_SCRATCH (the oracle pushes IX once per block-copy column,
 *           and its payout arm nests further pushes) plus the return value; pc/SP are not
 *           compared. On top of that, 4000 frames of attract with this routine wired live are
 *           asserted frame-identical to the all-oracle baseline over the same contract — which
 *           requires charging the oracle's measured cycle cost back inside the override, since
 *           this rewrite is cycle-free and the ROM's spin counter is a function of T-states.
 *           Teeth: a dropped nibble swap, a dropped latch guard, and a block copy whose column
 *           stride is lost.
 * LIVE-OUT: memory-only. The one caller is the frozen task dispatcher at ROM 0x02E3, which
 *           reaches every handler by `jp (hl)` with 0x02BD (mainLoop) pushed as the return
 *           address; mainLoop's first act on re-entry overwrites the accumulator, and it reads
 *           no flag, so every register and flag this routine leaves is dead. The routine
 *           returns undefined on all four arms, which the gate asserts.
 * NAMES:    BONUS_START (0x62B0), BONUS_DISPLAY (0x638C) and BONUS_DISPLAY_ZEROED (0x63B8)
 *           from names.js. The tile-block source at ROM 0x384A and its video-RAM destinations
 *           (0x7400–0x77FF) are not work RAM, so names.js does not name them and they stay hex.
 *           awardRemainingBonusToScore (0x0691), stepBonusDisplayDown (0x06A8) and
 *           renderBonusDisplay (0x066A) are all idiomatic and direct-called; the latter two
 *           take their input byte in the accumulator, so it is loaded before the call.
 */

import { u8 } from "../../../core/int.js";
import { BONUS_DISPLAY, BONUS_DISPLAY_ZEROED, BONUS_START } from "./names.js";
import { awardRemainingBonusToScore } from "./awardRemainingBonusToScore.js"; // ROM 0x0691
import { stepBonusDisplayDown } from "./stepBonusDisplayDown.js"; // ROM 0x06A8
import { renderBonusDisplay } from "./renderBonusDisplay.js"; // ROM 0x066A — the fallthrough tail

// The tile block that surrounds the bonus readout: 18 bytes of ROM laid into video RAM as six
// columns of three consecutive cells, one screen column apart.
const BLOCK_TILES = 0x384a; // ROM source
const BLOCK_FIRST_CELL = 0x7465; // video RAM destination of the first column
const BLOCK_COLUMNS = 6;
const BLOCK_CELLS_PER_COLUMN = 3;
const BLOCK_COLUMN_STRIDE = 0x20;

/** `taskPayload` is the task slot's second byte, which the dispatcher passes in the accumulator. */
export function loc_062a(m, taskPayload = m.regs.a /* oracle-boundary default: caller 0x02e3 still frozen */) {
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

  // Re-seed: BONUS_START / 10 by repeated subtraction. No guard — see the header.
  let remainder = mem8[BONUS_START];
  let quotient = 0;
  do {
    quotient = u8(quotient + 1);
    remainder = u8(remainder - 10);
  } while (remainder !== 0);

  // The quotient belongs in the high nibble of the packed two-digit byte. This is a rotate,
  // so a quotient above 15 wraps its own high nibble into the low half.
  mem8[BONUS_DISPLAY] = (quotient << 4) | (quotient >> 4);

  // Lay the readout's tile block into video RAM, one column of three cells at a time.
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
