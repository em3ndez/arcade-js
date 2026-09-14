// SPDX-License-Identifier: GPL-3.0-only
import { u16 } from "../../../core/int.js";
import { ACTIVE_SLOT_COUNT, STATUS_FLAGS, loc_43, loc_44, loc_45, DRAW_CURSOR_LO, DRAW_CURSOR_HI, loc_9f, TEMPLATE_COPY_LEN, VECTOR_TEMPLATE_BLOCK } from "./names.js";
import { loc_af77 } from "./loc_af77.js";
import { loc_df09 } from "./loc_df09.js";

// Choose a length from flags, aim the copy target at a fixed page, then copy
// that many source bytes down into it. On the negative-flag path also emit a
// packed counter. Restore the low target byte and hand off to the emitter.
export function stageTextLineWithCount(m) {
  const { mem8, mem16 } = m;
  let x = mem8[ACTIVE_SLOT_COUNT];
  if (!(mem8[STATUS_FLAGS] & 0x80)) {
    if ((mem8[loc_43] | mem8[loc_44] | mem8[loc_45]) !== 0) x = 0x01;
  }
  mem8[DRAW_CURSOR_LO] = 0x60;
  mem8[DRAW_CURSOR_HI] = 0x2f;
  let y = mem8[u16(TEMPLATE_COPY_LEN + x)];
  const savedSum = (y + mem8[DRAW_CURSOR_LO] + 1) & 0xff;
  do {
    mem8[u16(mem16[DRAW_CURSOR_LO] + y)] = mem8[u16(VECTOR_TEMPLATE_BLOCK + y)];
    y = (y - 1) & 0xff;
  } while (y !== 0);
  mem8[u16(mem16[DRAW_CURSOR_LO] + y)] = mem8[u16(VECTOR_TEMPLATE_BLOCK + y)];
  if (mem8[STATUS_FLAGS] & 0x80) {
    mem8[DRAW_CURSOR_HI] = 0x2f;
    mem8[DRAW_CURSOR_LO] = 0xa6;
    loc_af77(m, (mem8[loc_9f] + 1) & 0xff);
  }
  mem8[DRAW_CURSOR_LO] = savedSum;
  return loc_df09(m);
}
