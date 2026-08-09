// SPDX-License-Identifier: GPL-3.0-only
/** loc_1734 — advance one interpolated pen-run and bail unless it reseated to a zero row integer,
 * then two's-complement checksum the guarded code block into the guard cell (0 on a clean image)
 * and step the sequence sub-index. LIVE-OUT: memory only. */

import { loc_0201 } from "./loc_0201.js";
import { advanceSequenceSubStep } from "./advanceSequenceSubStep.js";

const GUARDED_BLOCK = 0x1748;
const GUARDED_LEN = 0x22;
const GUARD_CELL = 0xa817;

export function loc_1734(m) {
  const { regs, mem8 } = m;
  loc_0201(m);
  if (regs.fNZ) return;

  let sum = 0;
  for (let i = 0; i < GUARDED_LEN; i++) sum = (sum - mem8[GUARDED_BLOCK + i]) & 0xff;
  mem8[GUARD_CELL] = sum;
  return advanceSequenceSubStep(m);
}
