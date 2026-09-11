// SPDX-License-Identifier: GPL-3.0-only
import { u16 } from "../../../core/int.js";
import {
  loc_0, loc_1, loc_2, loc_4, loc_5, loc_6, loc_16, loc_18, loc_3e,
  loc_4e, loc_50, loc_100, loc_123, loc_40c, loc_40d,
} from "./names.js";

// From a two-bit gate in one flag byte and a >=2 test on a counter, derive a
// step of 0..2 and subtract it from the counter. When the gate is clear, maybe
// seed four intro cells; when the step is nonzero, set two status bits, zero
// three cells, bump a 16-bit tally, and clamp a value to 0x63.
export function loc_c81b(m) {
  const { mem8 } = m;
  const gate = mem8[loc_4e] & 0x60;
  const counterGE2 = mem8[loc_6] >= 2;
  mem8[loc_4e] = 0x00;

  if (gate === 0) {
    if (mem8[loc_50] !== 0 && (mem8[loc_5] & 0x80) === 0) {
      mem8[loc_1] = 0x10;
      mem8[loc_4] = 0x20;
      mem8[loc_0] = 0x0a;
      mem8[loc_2] = 0x14;
      mem8[loc_50] = 0x00;
      mem8[loc_123] = 0x00;
    }
    return;
  }

  let step = 0;
  if (counterGE2) {
    step = 1;
    mem8[loc_6] = (mem8[loc_6] - 1);
    if ((gate & 0x40) !== 0) {
      step = 2;
      mem8[loc_6] = (mem8[loc_6] - 1);
    }
  } else if ((gate & 0x20) !== 0) {
    step = 1;
    mem8[loc_6] = (mem8[loc_6] - 1);
  }

  mem8[loc_3e] = step;
  if (step === 0) return;

  mem8[loc_5] = mem8[loc_5] | 0xc0;
  mem8[loc_16] = 0x00;
  mem8[loc_18] = 0x00;
  mem8[loc_0] = 0x00;

  mem8[loc_3e] = (mem8[loc_3e] - 1);
  let x = mem8[loc_3e];
  if (x !== 0) x = 0x03;

  const lo = (mem8[u16(loc_40c + x)] + 1) & 0xff;
  mem8[u16(loc_40c + x)] = lo;
  if (lo === 0) mem8[u16(loc_40d + x)] = (mem8[u16(loc_40d + x)] + 1);

  let sum = (mem8[loc_100] + mem8[loc_3e] + 1) & 0xff;
  if (sum >= 0x63) sum = 0x63;
  mem8[loc_100] = sum;
}
