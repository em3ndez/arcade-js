// SPDX-License-Identifier: GPL-3.0-only
/** stepShapeAnimation — count one record's step timer down and refresh that record's shape byte from the
 * step the new count selects.
 *
 * The count is not just a delay: it is also the index into a run of shape bytes, so counting down
 * walks the run backwards and reaching zero stops it. Which run is a second byte of the same
 * record, read through a table of run pointers, so a record can be pointed at a different run
 * without disturbing how far along it has got. A timer already at zero is left alone and nothing
 * at all is written, which is what makes the run stop on its last entry rather than wrap.
 * LIVE-OUT: the timer and the shape byte. */

import { fetchTableByte } from "./fetchTableByte.js";
import { fetchTableWord } from "./fetchTableWord.js";
import { loc_3438 } from "./names.js";

const STEP_TIMER = 9;
const RUN_SELECTOR = 10;
const SHAPE_BYTE = 8;

export function stepShapeAnimation(m, record = m.regs.ix) {
  const { mem8, regs } = m;
  const remaining = mem8[record + STEP_TIMER];
  if (remaining === 0) return;

  const step = remaining - 1;
  mem8[record + STEP_TIMER] = step;
  regs.c = step;

  regs.a = mem8[record + RUN_SELECTOR];
  regs.hl = loc_3438;
  fetchTableWord(m);
  regs.exDeHl();

  regs.a = step;
  mem8[record + SHAPE_BYTE] = fetchTableByte(m);
}
