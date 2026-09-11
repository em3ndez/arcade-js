// SPDX-License-Identifier: GPL-3.0-only
import {
  loc_32, loc_33, loc_34, loc_56, loc_57, loc_58, loc_5b, loc_5e, loc_5f, loc_60,
  loc_61, loc_62, loc_63, loc_64, loc_66, loc_67, loc_68, loc_69,
  loc_6040, loc_6060, loc_6070, loc_608e, loc_6094, loc_6095, loc_6096,
} from "./names.js";

// Compute clamped signed X/Y deltas into the math coprocessor, wait for each result, then add or
// subtract paired offsets into two 16-bit accumulators with saturating limits.
export function loc_c098(m) {
  const { mem8 } = m;

  // 16-bit difference; a negative result clamps up to +1.
  const deltaLo = mem8[loc_57] - mem8[loc_5f];
  const cfA = deltaLo >= 0 ? 1 : 0;
  mem8[loc_6095] = deltaLo;
  const deltaHi = (0 - mem8[loc_5b] - (1 - cfA)) & 0xff;
  mem8[loc_6096] = deltaHi;
  if (deltaHi & 0x80) {
    mem8[loc_6096] = 0x00;
    mem8[loc_6095] = 0x01;
  }

  // |dx| and its sign.
  const b58 = mem8[loc_58], b60 = mem8[loc_60];
  const dxAbs = (b58 < b60 ? b60 - b58 : b58 - b60) & 0xff;
  const dxSign = b58 < b60 ? 0xff : 0x00;
  mem8[loc_608e] = dxAbs;
  mem8[loc_6094] = dxAbs;
  mem8[loc_33] = dxSign;

  // |dy| and its sign.
  const b56 = mem8[loc_56], b5e = mem8[loc_5e];
  const dyAbs = (b56 < b5e ? b5e - b56 : b56 - b5e) & 0xff;
  const dySign = b56 < b5e ? 0xff : 0x00;
  mem8[loc_32] = dyAbs;
  mem8[loc_34] = dySign;

  while (mem8[loc_6040] & 0x80) {} // wait for the coprocessor

  // First accumulator: fold the dy offset pair in or out.
  mem8[loc_63] = mem8[loc_6060];
  mem8[loc_64] = mem8[loc_6070];
  mem8[loc_608e] = mem8[loc_32];
  mem8[loc_6094] = mem8[loc_32];
  if (mem8[loc_33] & 0x80) {
    const lo = mem8[loc_68] - mem8[loc_63];
    const cf = lo >= 0 ? 1 : 0;
    mem8[loc_63] = lo;
    const A = mem8[loc_69], v = mem8[loc_64], res = (A - v - (1 - cf)) & 0xff;
    if (((A ^ v) & (A ^ res) & 0x80) !== 0) { mem8[loc_63] = 0x00; mem8[loc_64] = 0x80; }
    else mem8[loc_64] = res;
  } else {
    const sumLo = mem8[loc_63] + mem8[loc_68];
    const cf = sumLo > 0xff ? 1 : 0;
    mem8[loc_63] = sumLo;
    const A = mem8[loc_64], v = mem8[loc_69], res = (A + v + cf) & 0xff;
    if ((~(A ^ v) & (A ^ res) & 0x80) !== 0) { mem8[loc_63] = 0xff; mem8[loc_64] = 0x7f; }
    else mem8[loc_64] = res;
  }

  while (mem8[loc_6040] & 0x80) {} // wait for the coprocessor

  // Second accumulator: fold the dx offset pair in or out.
  mem8[loc_61] = mem8[loc_6060];
  mem8[loc_62] = mem8[loc_6070];
  if (mem8[loc_34] & 0x80) {
    const lo = mem8[loc_66] - mem8[loc_61];
    const cf = lo >= 0 ? 1 : 0;
    mem8[loc_61] = lo;
    const A = mem8[loc_67], v = mem8[loc_62], res = (A - v - (1 - cf)) & 0xff;
    if (((A ^ v) & (A ^ res) & 0x80) !== 0) { mem8[loc_61] = 0x00; mem8[loc_62] = 0x80; }
    else mem8[loc_62] = res;
  } else {
    const sumLo = mem8[loc_61] + mem8[loc_66];
    const cf = sumLo > 0xff ? 1 : 0;
    mem8[loc_61] = sumLo;
    const A = mem8[loc_62], v = mem8[loc_67], res = (A + v + cf) & 0xff;
    if ((~(A ^ v) & (A ^ res) & 0x80) !== 0) { mem8[loc_61] = 0xff; mem8[loc_62] = 0x7f; }
    else mem8[loc_62] = res;
  }
}
