// SPDX-License-Identifier: GPL-3.0-only
// Object frame-step state handler: reposition the sprite from its grid cell, then bump the frame
// counter. When the counter reaches the positioned value, deactivate the object, flag its cell and
// enqueue a command word; for a small even gap, nudge the phase by the direction bit; a large or odd
// gap is left alone.
import { positionObjectFromGridCell } from "./positionObjectFromGridCell.js";
import { enqueueCommandWord } from "./enqueueCommandWord.js";
import { FLAG_BITS_BASE } from "./names.js";

// Object-record field offsets (base = obj).
const ACTIVE = 0;    // primary active flag
const FRAME = 3;     // frame counter (also the position field the reposition rewrites)
const PHASE = 5;     // phase value nudged up/down
const DIRECTION = 6; // bit0 picks the nudge direction
const CELL = 7;      // packed grid cell

const GAP_LIMIT = 25; // gaps at or above this are ignored

export function loc_0f07(m, obj = m.regs.ix) {
  const { mem8 } = m;

  const frame = (mem8[obj + FRAME] + 1) & 0xff;
  positionObjectFromGridCell(m, obj);      // rewrites the position fields from the cell
  const positioned = mem8[obj + FRAME];
  mem8[obj + FRAME] = frame;

  const gap = (positioned - frame) & 0xff;
  if (gap === 0) {
    // Counter caught up: deactivate, flag the cell, enqueue the command word (D:E = 0:cell).
    mem8[obj + ACTIVE] = 0;
    const cell = mem8[obj + CELL];
    mem8[FLAG_BITS_BASE + cell] = 1;
    return enqueueCommandWord(m, cell, FLAG_BITS_BASE + cell);
  }

  if (gap >= GAP_LIMIT || (gap & 1)) return; // large or odd gap: no nudge

  if (mem8[obj + DIRECTION] & 0x01) {
    mem8[obj + PHASE]--; // direction bit set: step down
  } else {
    mem8[obj + PHASE]++; // direction bit clear: step up
  }
}
