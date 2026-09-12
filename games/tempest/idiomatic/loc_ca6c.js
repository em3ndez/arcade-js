// SPDX-License-Identifier: GPL-3.0-only
import { u8, u16 } from "../../../core/int.js";
import { bcdAddByte, bcdSubByte } from "../../../core/bcd.js";
import { loc_5, loc_29, loc_2a, loc_2b, loc_3d, loc_40, loc_41, loc_42, loc_48, loc_124, loc_156, loc_caf1, loc_caf9 } from "./names.js";
import { loc_ccc3 } from "./loc_ccc3.js";

// Add a three-byte BCD amount (fixed table entry when the slot is low, else the live
// operand triplet) into the score cell trio, then range-check the high byte against a
// threshold; when it qualifies and a per-slot counter is still under six, bump the
// counter, fire a sound, and raise a flag.
export function loc_ca6c(m, x = m.regs.x) {
  const { mem8 } = m;
  if ((mem8[loc_5] & 0x80) === 0) return; // gated off
  const y = mem8[loc_3d] === 0 ? 0 : 3;

  // Bump a per-slot counter when it is still under six, then chime and raise a flag.
  const doAward = () => {
    const sx = mem8[loc_3d];
    const cnt = mem8[u8(loc_48 + sx)];
    if (cnt >= 0x06) return;
    mem8[u8(loc_48 + sx)] = cnt + 1;
    loc_ccc3(m, 0x4f, sx, y); // sound, threading this slot's index and y
    mem8[loc_124] = 0x20;
  };

  let a, carry, zSaved;
  if (x < 0x08) {
    const r0 = bcdAddByte(mem8[u16(loc_caf1 + x)], mem8[u16(loc_40 + y)], 0);
    mem8[u16(loc_40 + y)] = r0.value;
    const r1 = bcdAddByte(mem8[u16(loc_caf9 + x)], mem8[u16(loc_41 + y)], r0.carry);
    mem8[u16(loc_41 + y)] = r1.value;
    a = 0x00;
    carry = r1.carry;
    zSaved = true;
  } else {
    const r0 = bcdAddByte(mem8[loc_29], mem8[u16(loc_40 + y)], 0);
    mem8[u16(loc_40 + y)] = r0.value;
    const r1 = bcdAddByte(mem8[loc_2a], mem8[u16(loc_41 + y)], r0.carry);
    mem8[u16(loc_41 + y)] = r1.value;
    a = mem8[loc_2b];
    carry = r1.carry;
    zSaved = a === 0;
  }

  // Third BCD byte: the value updates the cell, but the branch below and the threaded
  // carry stay as they were before this add.
  const r2 = bcdAddByte(a, mem8[u16(loc_42 + y)], carry ? 1 : 0);
  mem8[u16(loc_42 + y)] = r2.value;
  a = r2.value;

  // Decide whether to run the threshold branch or award directly.
  if (!zSaved) {
    const hv = mem8[loc_156];
    if (hv !== 0) {
      const cmpv = mem8[loc_2b];
      if (hv <= cmpv) return doAward();
      carry = true;
    }
  }

  // Threshold branch.
  if (!carry) return;
  const hi = mem8[loc_156];
  if (hi === 0) return;
  if (hi < 0x03) {
    if (hi !== 0x02) return doAward();
    if ((a & 0x01) === 0) return doAward();
    return;
  }
  // Repeatedly subtract the threshold; land the award on an exact multiple.
  for (;;) {
    const r = bcdSubByte(a, mem8[loc_156], 0);
    a = r.value;
    if (a === 0) return doAward();
    if (!r.carry) continue; // no borrow -> keep subtracting
    return;
  }
}
