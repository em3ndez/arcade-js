// SPDX-License-Identifier: GPL-3.0-only
import { u16 } from "../../../core/int.js";
import { loc_3e, loc_5, loc_43, loc_44, loc_45, loc_74, loc_75, loc_9f, loc_ce66, loc_cde6 } from "./names.js";
import { loc_af77 } from "./loc_af77.js";
import { loc_df09 } from "./loc_df09.js";

// Choose a length from flags, aim the copy target at a fixed page, then copy
// that many source bytes down into it. On the negative-flag path also emit a
// packed counter. Restore the low target byte and hand off to the emitter.
export function loc_aa13(m) {
  const { mem8, mem16 } = m;
  let x = mem8[loc_3e];
  if (!(mem8[loc_5] & 0x80)) {
    if ((mem8[loc_43] | mem8[loc_44] | mem8[loc_45]) !== 0) x = 0x01;
  }
  mem8[loc_74] = 0x60;
  mem8[loc_75] = 0x2f;
  let y = mem8[u16(loc_ce66 + x)];
  const savedSum = (y + mem8[loc_74] + 1) & 0xff;
  do {
    mem8[u16(mem16[loc_74] + y)] = mem8[u16(loc_cde6 + y)];
    y = (y - 1) & 0xff;
  } while (y !== 0);
  mem8[u16(mem16[loc_74] + y)] = mem8[u16(loc_cde6 + y)];
  if (mem8[loc_5] & 0x80) {
    mem8[loc_75] = 0x2f;
    mem8[loc_74] = 0xa6;
    loc_af77(m, (mem8[loc_9f] + 1) & 0xff);
  }
  mem8[loc_74] = savedSum;
  return loc_df09(m);
}
