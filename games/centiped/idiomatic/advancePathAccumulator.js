// SPDX-License-Identifier: GPL-3.0-only
import { u8 } from "../../../core/int.js";
import {
  loc_86, loc_88, loc_8b, loc_8d,
  loc_a1, loc_a4, loc_a7, loc_a9, loc_ab, loc_ad, loc_af,
  CONFIG_DIP_BYTE, loc_21c0, SFX_TIMER_CH2_PRIORITY,
} from "./names.js";
import { readFdBitsTableByte } from "./readFdBitsTableByte.js";
import { drawGridSideBorders } from "./drawGridSideBorders.js";

// NMOS decimal add: the accumulator value plus the decimal carry-out (the N/V/Z flags are unused here).
function bcdAdd(a, v, carryIn) {
  let low = (a & 0x0f) + (v & 0x0f) + carryIn;
  if (low > 9) low = ((low + 6) & 0x0f) + 0x10;
  let sum = (a & 0xf0) + (v & 0xf0) + low;
  if (sum >= 0xa0) sum += 0x60;
  return { value: sum & 0xff, carry: sum >= 0x100 ? 1 : 0 };
}

// NMOS decimal subtract: value BCD-corrected; the borrow-out is taken from the plain binary difference.
function bcdSub(a, v, carryIn) {
  let low = (a & 0x0f) - (v & 0x0f) - (1 - carryIn);
  if (low < 0) low = ((low - 6) & 0x0f) - 0x10;
  let sum = (a & 0xf0) - (v & 0xf0) + low;
  if (sum < 0) sum -= 0x60;
  return { value: sum & 0xff, carry: a - v - (1 - carryIn) >= 0 ? 1 : 0 };
}

/**
 * advancePathAccumulator -- step one segment's BCD position toward its target. While enabled ($86
 * non-negative) it folds the per-step delta into the low word ($a7/$a9), rolling the companion pair
 * ($a1/$ab) on a decimal carry. Once the accumulator reaches the target ($ad/$af) it advances the
 * target by the indexed table step, bumps the phase index ($a4) and redraws the side borders. The
 * caller's index is preserved via $8d. [code]
 */
export function advancePathAccumulator(m, a = m.regs.a, x = m.regs.x) {
  const { mem8 } = m;

  // Disabled while the enable byte is negative.
  if (mem8[loc_86] & 0x80) return;
  mem8[loc_8d] = x; // preserve the caller's index

  const i = mem8[loc_88];
  let r = bcdAdd(a, mem8[u8(loc_a7 + i)], 0);
  mem8[u8(loc_a7 + i)] = r.value;
  r = bcdAdd(mem8[u8(loc_a9 + i)], mem8[loc_8b], r.carry);
  mem8[u8(loc_a9 + i)] = r.value;
  if (r.carry) {
    // Word rolled over: step the companion pair down by 2 / up by 1.
    mem8[u8(loc_a1 + i)] = bcdSub(mem8[u8(loc_a1 + i)], 0x02, 1).value;
    mem8[u8(loc_ab + i)] = bcdAdd(mem8[u8(loc_ab + i)], 0x01, 0).value;
  }

  // Reached target? A binary 16-bit compare of ($ab:$a9) against ($af:$ad).
  const lowGE = mem8[u8(loc_a9 + i)] >= mem8[u8(loc_ad + i)];
  const high = mem8[u8(loc_ab + i)] - mem8[u8(loc_af + i)] - (lowGE ? 0 : 1);
  if (high < 0) return;

  // Advance the target by the indexed 16-bit table step; the low table byte comes from the shared
  // reader, the high byte from the adjacent table at the same index.
  const idx = (mem8[CONFIG_DIP_BYTE] & 0x30) >> 3;
  const stepLo = readFdBitsTableByte(m);
  let s = bcdAdd(stepLo, mem8[u8(loc_ad + i)], 0);
  mem8[u8(loc_ad + i)] = s.value;
  s = bcdAdd(mem8[loc_21c0 + idx], mem8[u8(loc_af + i)], s.carry);
  mem8[u8(loc_af + i)] = s.value;

  const phase = mem8[u8(loc_a4 + i)];
  if (phase < 0x06) {
    mem8[u8(loc_a4 + i)] = u8(phase + 1);
    mem8[SFX_TIMER_CH2_PRIORITY] = 0x11;
    drawGridSideBorders(m);
  } else if (phase > 0x06) {
    for (;;) { /* index past its ceiling: spins until the watchdog fires */ }
  }
}
