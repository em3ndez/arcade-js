// SPDX-License-Identifier: GPL-3.0-only
import { u8 } from "../../../core/int.js";
import {
  loc_86, loc_88, loc_8b, loc_8d,
  loc_a1, loc_a4, loc_a7, loc_a9, loc_ab, loc_ad, loc_af,
  CONFIG_DIP_BYTE, CONFIG_PARALLEL_TABLE, SFX_TIMER_CH2_PRIORITY,
} from "./names.js";
import { readFdBitsTableByte } from "./readFdBitsTableByte.js";
import { drawGridSideBorders } from "./drawGridSideBorders.js";

// ---------------------------------------------------------------------------
// BCD (binary-coded-decimal) arithmetic helpers.
//
// The 6502 has a decimal mode (the D flag): with D set, ADC/SBC treat each byte
// as two decimal digits packed one-per-nibble (0x00..0x99) and produce a decimal
// result with a decimal carry/borrow. This routine's path coordinates are stored
// in that packed-decimal form, so the JS port must reproduce the NMOS 6502's exact
// decimal-correction behaviour rather than using plain binary + or -.
// Only the value and carry-out matter here; the hardware's N/V/Z flags are not read.
// ---------------------------------------------------------------------------

// NMOS decimal add: the accumulator value plus the decimal carry-out (the N/V/Z flags are unused here).
// Low nibble is summed with the incoming carry; if it overflows a decimal digit (>9) it is corrected by
// +6 and the tens digit is carried. The high nibble is then summed and corrected by +0x60 on decimal
// overflow, exactly as the 6502's ADC does with the D flag set.
function bcdAdd(a, v, carryIn) {
  let low = (a & 0x0f) + (v & 0x0f) + carryIn;
  if (low > 9) low = ((low + 6) & 0x0f) + 0x10;
  let sum = (a & 0xf0) + (v & 0xf0) + low;
  if (sum >= 0xa0) sum += 0x60;
  return { value: sum & 0xff, carry: sum >= 0x100 ? 1 : 0 };
}

// NMOS decimal subtract: value BCD-corrected; the borrow-out is taken from the plain binary difference.
// SBC on the 6502 takes carry-in as "no borrow", so (1 - carryIn) is the borrow. The low/high nibbles are
// corrected downward (-6 / -0x60) on a decimal underflow, but the crucial NMOS quirk reproduced here is
// that the carry (no-borrow) flag out is decided by the ordinary BINARY difference, not the decimal one.
function bcdSub(a, v, carryIn) {
  let low = (a & 0x0f) - (v & 0x0f) - (1 - carryIn);
  if (low < 0) low = ((low - 6) & 0x0f) - 0x10;
  let sum = (a & 0xf0) - (v & 0xf0) + low;
  if (sum < 0) sum -= 0x60;
  return { value: sum & 0xff, carry: a - v - (1 - carryIn) >= 0 ? 1 : 0 };
}

/**
 * advancePathAccumulator -- step one segment's BCD position toward its target. ROM 0x2ace.
 *
 * Role in the machine: this is the movement sub-step accumulator the main-loop spine drives each frame.
 * A moving object walks a scripted decimal "path" toward a target coordinate; every tick this routine
 * folds a small delta into a packed-decimal accumulator and, when the accumulator reaches the scripted
 * target, retargets to the next waypoint and bumps the object's path phase. The phase advance is what
 * paces the visible motion from one grid step to the next.
 *
 * While enabled ($86 non-negative) it folds the per-step delta into the low word ($a7/$a9), rolling the
 * companion pair ($a1/$ab) on a decimal carry. Once the accumulator reaches the target ($ad/$af) it
 * advances the target by the indexed table step, bumps the phase index ($a4) and redraws the side borders.
 *
 * Live-out: the indexed accumulator/target/phase cells ($a7/$a9/$a1/$ab/$ad/$af/$a4 at index $88), the
 * ch2 priority SFX timer ($b6), the grid side-borders (via drawGridSideBorders), and $8d holding the
 * caller's index. Grounding: [code] -- read from the routine's own behaviour.
 */
export function advancePathAccumulator(m, a = m.regs.a, x = m.regs.x) {
  const { mem8 } = m;

  // Enable gate: $86 is the master path-enable flag, treated as a signed byte. A negative value (bit 7
  // set) means "path motion suppressed", so the whole accumulator step is skipped this frame.
  // Disabled while the enable byte is negative.
  if (mem8[loc_86] & 0x80) return;
  mem8[loc_8d] = x; // preserve the caller's index

  // Select which path this call operates on. $88 is the active-object/slot selector; every accumulator,
  // target and phase array below is indexed by it, so one shared routine services whichever path is live.
  const i = mem8[loc_88];

  // Fold the per-step delta into the low 16-bit accumulator ($a9:$a7). The low byte takes the caller's
  // A; the high byte takes the fixed step increment held in $8b, plus the decimal carry out of the low
  // byte -- a two-byte BCD add spread across two adjacent zero-page arrays.
  let r = bcdAdd(a, mem8[u8(loc_a7 + i)], 0);
  mem8[u8(loc_a7 + i)] = r.value;
  r = bcdAdd(mem8[u8(loc_a9 + i)], mem8[loc_8b], r.carry);
  mem8[u8(loc_a9 + i)] = r.value;
  if (r.carry) {
    // A decimal carry out of the low word means the accumulator crossed a full unit, so the companion
    // coordinate pair ($ab:$a1) is stepped: $a1 down by 2 (BCD borrow-in set = no borrow) and $ab up by 1.
    // This is how the object's on-screen coordinate ratchets forward each time the fine accumulator wraps.
    // Word rolled over: step the companion pair down by 2 / up by 1.
    mem8[u8(loc_a1 + i)] = bcdSub(mem8[u8(loc_a1 + i)], 0x02, 1).value;
    mem8[u8(loc_ab + i)] = bcdAdd(mem8[u8(loc_ab + i)], 0x01, 0).value;
  }

  // Has the accumulator reached its scripted target? Compare the 16-bit accumulator ($ab:$a9) against the
  // 16-bit target ($af:$ad) as plain binary: form the low-byte "greater-or-equal" (which supplies the
  // borrow) then the high-byte difference. A negative high result means accumulator < target, so there is
  // nothing to retarget yet and the routine simply returns, leaving the folded accumulator in place.
  // Reached target? A binary 16-bit compare of ($ab:$a9) against ($af:$ad).
  const lowGE = mem8[u8(loc_a9 + i)] >= mem8[u8(loc_ad + i)];
  const high = mem8[u8(loc_ab + i)] - mem8[u8(loc_af + i)] - (lowGE ? 0 : 1);
  if (high < 0) return;

  // Target reached: advance the target to the next waypoint by adding a 16-bit table step.
  // The table variant is chosen by DIP bits 5-4 of the config byte ($fd): (byte & 0x30) >> 3 gives a
  // word-aligned index (0/2/4/6) into the high-byte table at $21c0. The low step byte comes from the
  // shared reader readFdBitsTableByte (which decodes the same DIP-selected ROM table).
  // Advance the target by the indexed 16-bit table step; the low table byte comes from the shared
  // reader, the high byte from the adjacent table at the same index.
  const idx = (mem8[CONFIG_DIP_BYTE] & 0x30) >> 3;
  const stepLo = readFdBitsTableByte(m);
  let s = bcdAdd(stepLo, mem8[u8(loc_ad + i)], 0);
  mem8[u8(loc_ad + i)] = s.value;
  s = bcdAdd(mem8[CONFIG_PARALLEL_TABLE + idx], mem8[u8(loc_af + i)], s.carry);
  mem8[u8(loc_af + i)] = s.value;

  // Advance the object's path phase. $a4 (indexed) counts the waypoints walked so far. Phases 0..5 are the
  // normal run: bump the phase, arm the channel-2 priority SFX timer ($b6) to 0x11 so the movement makes a
  // sound, and repaint the two vertical grid borders. Phase == 6 is the terminal waypoint -- nothing more
  // to do. A phase already ABOVE 6 is an out-of-range index that the original ROM never expects; it walks
  // off the end of the table, so the faithful port reproduces the hang: an empty loop that runs until the
  // hardware watchdog resets the board.
  const phase = mem8[u8(loc_a4 + i)];
  if (phase < 0x06) {
    mem8[u8(loc_a4 + i)] = u8(phase + 1);
    mem8[SFX_TIMER_CH2_PRIORITY] = 0x11;
    drawGridSideBorders(m);
  } else if (phase > 0x06) {
    for (;;) { /* index past its ceiling: spins until the watchdog fires */ }
  }
}
