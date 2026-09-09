// SPDX-License-Identifier: GPL-3.0-only
import { u8, u16 } from "../../../core/int.js";
import { advanceAllSegmentColumns } from "./advanceAllSegmentColumns.js";
import {
  loc_0c00,
  loc_d5,
  PALETTE_COLOR_04,
  loc_1c00,
  loc_c5,
  loc_2003,
  loc_0104,
  loc_bd,
  loc_ba,
  loc_b9,
  loc_1800,
} from "./names.js";

/**
 * accumulateTrackballAndReturnFromIrq — the interrupt tail. Off self-test it advances the $d5 diagnostic
 * counter and ramps the four diag colour cells; under self-test it emits the output latches and folds a
 * table checksum. Then, for the two axes, it folds each raw counter's signed nibble delta into the per-axis
 * accumulator ($b9/$ba,X), acks the interrupt, restores the saved registers and returns. [code]
 *
 * Keeps the spine call (dissolved when that batch lands). Ends by restoring the frame the entry saved.
 */
export function accumulateTrackballAndReturnFromIrq(m) {
  const { mem8 } = m;
  const io = mem8[loc_0c00];

  if (io & 0x20) {
    // Self-test active: run the spine service, mirror $c5,X to the output latch, then fold a table checksum.
    advanceAllSegmentColumns(m);
    for (let x = 2; x >= 0; x--) mem8[u16(loc_1c00 + x)] = mem8[u8(loc_c5 + x)];
    let sum = 0xf4;
    for (let x = 0x0a; x >= 0; x--) sum ^= mem8[u16(loc_2003 + x)];
    sum = u8(sum);
    if (sum !== 0) mem8[u16(loc_0104 + m.regs.s)] = 3; // mismatch marker into the live stack page
  } else {
    let d5 = mem8[loc_d5];
    if ((d5 & 0x80) === 0) {
      d5 = u8(d5 + 1);
      mem8[loc_d5] = d5;
      if (mem8[loc_0c00] & 0x40) { d5 = 0x00; mem8[loc_d5] = d5; } // 32V edge resets the counter
      // Ramp the four diag colour cells from d5<<2, carrying +1 up the run (carry seeded by the shift-out).
      let a = u8(d5 << 2);
      let carry = (d5 >> 6) & 1;
      for (let x = 3; x >= 0; x--) {
        mem8[u16(PALETTE_COLOR_04 + x)] = a;
        const next = a + 1 + carry;
        a = u8(next);
        carry = next > 0xff ? 1 : 0;
      }
    }
  }

  // Per-axis (X = 2 then 0): signed nibble delta of the raw counter, hysteresis-filtered, into $b9,X.
  let a = 0;
  for (let x = 2; x >= 0; x -= 2) {
    const raw = mem8[u16(loc_0c00 + x)];
    a = u8(raw - mem8[u8(loc_bd + x)]); // delta since last sample
    mem8[u8(loc_bd + x)] = raw;
    a = a & 0x0f;
    if (a >= 8) a = a | 0xf0;           // sign-extend the negative nibble
    let y = a;
    if (a !== 0) {
      if ((a ^ mem8[u8(loc_ba + x)]) & 0x80) {          // sign flip vs last committed delta
        if ((y ^ mem8[u16(loc_0c00 + x)]) & 0x80) y = mem8[u8(loc_ba + x)]; // reject a reversal
      }
      mem8[u8(loc_ba + x)] = y;
      a = u8(y + mem8[u8(loc_b9 + x)]);
      mem8[u8(loc_b9 + x)] = a;
    }
  }
  mem8[loc_1800] = a; // interrupt acknowledge

  m.regs.y = m.pull8();
  m.regs.x = m.pull8();
  m.regs.a = m.pull8();
  return m.rti(6);
}
