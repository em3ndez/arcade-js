// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_0aee — ring XOR step: fold two cells of the work-RAM ring through the moving cursor.
 * LIVE-OUT: memory + register A (the XOR result).
 */
import { loc_8400 } from "./names.js";

const RING_SIZE = 32;
const WRAP_TO = 31;
const FOLD_OFFSET = 13; // the partner cell sits this far ahead of the cursor
const FOLD_BACK = 31; // folded back under the ring size when it overshoots

export function loc_0aee(m) {
  const { regs, mem8 } = m;

  let cursor = (mem8[loc_8400] - 1) & 0xff;
  if (cursor === 0) cursor = WRAP_TO;
  mem8[loc_8400] = cursor;

  let j = (cursor + FOLD_OFFSET) & 0xff;
  if (j >= RING_SIZE) j -= FOLD_BACK;

  const value = mem8[(loc_8400 + cursor) & 0xffff] ^ mem8[(loc_8400 + j) & 0xffff];
  mem8[(loc_8400 + j) & 0xffff] = value;
  regs.a = value;
}
