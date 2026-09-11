// SPDX-License-Identifier: GPL-3.0-only
import { u8, u16 } from "../../../core/int.js";
import {
  loc_bf, loc_c0, loc_d0, loc_e0, loc_f0,
  loc_cbcb, loc_cbcc, loc_cbcd, loc_cbce,
  loc_cccb, loc_cccc, loc_cccd, loc_ccce,
  loc_60c0, loc_60c8,
} from "./names.js";

// Advance each of 16 per-slot timers: count down two timers, and when both expire step
// the slot through an animation table (single step, or a walk until a nonzero frame),
// then publish the slot's level to a POKEY register chosen by which half the slot is in.
export function loc_cd0a(m) {
  const { mem8 } = m;
  for (let x = 0x0f; x >= 0; x--) {
    let a = mem8[u8(loc_c0 + x)];
    if (a === 0) continue;                 // slot idle
    if (x === mem8[loc_bf]) continue;      // slot is the reserved one
    const eDec = u8(mem8[u8(loc_e0 + x)] - 1);
    mem8[u8(loc_e0 + x)] = eDec;
    if (eDec !== 0) continue;              // fast timer still running
    const fDec = u8(mem8[u8(loc_f0 + x)] - 1);
    mem8[u8(loc_f0 + x)] = fDec;
    let y;
    if (fDec !== 0) {
      // Fast timer expired, slow timer running: one table step.
      const carry = (a & 0x80) !== 0;
      y = u8(a << 1);
      if (carry) {
        mem8[u8(loc_e0 + x)] = mem8[u16(loc_cccc + y)];
        a = mem8[u16(loc_cccd + y)];
      } else {
        mem8[u8(loc_e0 + x)] = mem8[u16(loc_cbcc + y)];
        a = mem8[u16(loc_cbcd + y)];
      }
      const prevD = mem8[u8(loc_d0 + x)];
      a = u8(a + prevD);
      mem8[u8(loc_d0 + x)] = a;
      // Odd slots keep the prior high nibble of the level byte.
      if ((x & 1) !== 0) {
        const d = mem8[u8(loc_d0 + x)];
        mem8[u8(loc_d0 + x)] = ((((prevD ^ d) & 0xf0) ^ d));
      }
    } else {
      // Both timers expired: walk the table until a nonzero frame lands.
      while (true) {
        mem8[u8(loc_c0 + x)] = u8(mem8[u8(loc_c0 + x)] + 1);
        mem8[u8(loc_c0 + x)] = u8(mem8[u8(loc_c0 + x)] + 1);
        a = mem8[u8(loc_c0 + x)];
        const carry = (a & 0x80) !== 0;
        y = u8(a << 1);
        if (carry) {
          mem8[u8(loc_d0 + x)] = mem8[u16(loc_cccb + y)];
          mem8[u8(loc_f0 + x)] = mem8[u16(loc_ccce + y)];
          a = mem8[u16(loc_cccc + y)];
        } else {
          mem8[u8(loc_d0 + x)] = mem8[u16(loc_cbcb + y)];
          mem8[u8(loc_f0 + x)] = mem8[u16(loc_cbce + y)];
          a = mem8[u16(loc_cbcc + y)];
        }
        mem8[u8(loc_e0 + x)] = a;
        if (a !== 0) break;
        mem8[u8(loc_c0 + x)] = a;
        a = mem8[u8(loc_d0 + x)];
        if (a === 0) break;
        mem8[u8(loc_c0 + x)] = a;
      }
    }
    // Publish this slot's level byte to its POKEY register.
    a = mem8[u8(loc_d0 + x)];
    if (x < 0x08) mem8[u16(loc_60c0 + x)] = a;
    else mem8[u16(loc_60c8 + x)] = a;
  }
}
