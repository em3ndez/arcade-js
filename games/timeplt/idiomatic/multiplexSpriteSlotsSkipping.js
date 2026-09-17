// SPDX-License-Identifier: GPL-3.0-only
/** multiplexSpriteSlotsSkipping — scanline-gated position fixup over eight sprite slots. Each slot pairs a Y byte in
 * one sprite bank with the X byte at the matching offset in the other. A slot acts only while its Y
 * byte has bit 7 set and adding the live scanline counter to it carries out of the top; on that
 * trigger the Y byte's bit 7 is cleared, quieting the slot, and the X byte's bit 7 is toggled.
 * LIVE-OUT: the touched sprite bytes, plus the accumulator, C and flags left by the last slot. The
 * register live-out is dispatched from the frozen translated layer, so it rides the closing return. */

import {
  SCANLINE_COUNTER,
  SPRITE_BANK1_SLOT0_Y, SPRITE_BANK0_BASE,
  SPRITE_BANK1_SLOT1_Y, SPRITE_BANK0_SLOT1_X,
  SPRITE_BANK1_SLOT2_Y, SPRITE_BANK0_SLOT2_X,
  SPRITE_BANK1_SLOT19_Y, SPRITE_BANK0_SLOT19_X,
  SPRITE_BANK1_SLOT20_Y, SPRITE_BANK0_SLOT20_X,
  SPRITE_BANK1_SLOT21_Y, SPRITE_BANK0_SLOT21_X,
  SPRITE_BANK1_SLOT22_Y, SPRITE_BANK0_SLOT22_X,
  SPRITE_BANK1_SLOT23_Y, SPRITE_BANK0_SLOT23_X,
} from "./names.js";
import { F_C, F_PV, F_F3, F_H, F_F5, F_Z, F_S } from "../../../core/cpu/z80.js";

const DISARM_MASK = 0x7f;
const TOGGLE_X_BIT7 = 0x80;

// [Y byte, X byte] for each of the eight slots this pass covers.
const SLOTS = [
  [SPRITE_BANK1_SLOT0_Y, SPRITE_BANK0_BASE],
  [SPRITE_BANK1_SLOT1_Y, SPRITE_BANK0_SLOT1_X],
  [SPRITE_BANK1_SLOT2_Y, SPRITE_BANK0_SLOT2_X],
  [SPRITE_BANK1_SLOT19_Y, SPRITE_BANK0_SLOT19_X],
  [SPRITE_BANK1_SLOT20_Y, SPRITE_BANK0_SLOT20_X],
  [SPRITE_BANK1_SLOT21_Y, SPRITE_BANK0_SLOT21_X],
  [SPRITE_BANK1_SLOT22_Y, SPRITE_BANK0_SLOT22_X],
  [SPRITE_BANK1_SLOT23_Y, SPRITE_BANK0_SLOT23_X],
];

// Z80 flag reproduction (the last slot's accumulator/C/flags are live-out).
const parity8 = (v) => {
  let p = v ^ (v >> 4);
  p ^= p >> 2;
  p ^= p >> 1;
  return p & 1 ? 0 : F_PV;
};
const sz8 = (v) => (v & 0x80 ? F_S : 0) | (v === 0 ? F_Z : 0) | (v & (F_F3 | F_F5));

// ADD A,v -> [result, flags]
function add8(a, v) {
  const r = a + v;
  const res = r & 0xff;
  const f =
    sz8(res) |
    (r > 0xff ? F_C : 0) |
    (((a ^ v ^ res) & 0x10) ? F_H : 0) |
    ((~(a ^ v) & (a ^ res) & 0x80) ? F_PV : 0);
  return [res, f];
}

// AND v -> [result, flags]
function and8(a, v) {
  const res = a & v & 0xff;
  return [res, sz8(res) | F_H | parity8(res)];
}

// BIT 7,v flags: Z=!bit7, PV=Z, H set, N clear, C preserved, S=bit7, F3/F5 from the operand.
const bit7Flags = (f, set, operand) =>
  (f & F_C) | F_H | (set ? F_S : F_Z | F_PV) | (operand & (F_F3 | F_F5));

// Service one slot, threading the accumulator/C/flags carried between slots.
function serviceSlot(m, yAddr, xAddr, c, f) {
  const { mem8 } = m;
  let a = mem8[yAddr];
  const armed = (a & 0x80) !== 0;
  f = bit7Flags(f, armed, a);
  if (!armed) return [a, c, f]; // bit 7 clear: slot idle
  c = a;
  [a, f] = add8(mem8[SCANLINE_COUNTER], c);
  if ((f & F_C) === 0) return [a, c, f]; // no carry: beam not past the trigger line yet
  [a, f] = and8(c, DISARM_MASK); // clear bit 7, quieting the slot
  mem8[yAddr] = a;
  [a, f] = add8(mem8[xAddr], TOGGLE_X_BIT7); // toggle the X byte's bit 7
  mem8[xAddr] = a;
  if (m.beamPlan) m.beamPlan.push({ y: yAddr, x: xAddr }); // record for the beam-sync render
  return [a, c, f];
}

export function multiplexSpriteSlotsSkipping(m, c = m.regs.c, f = m.regs.f) {
  let a;
  for (const [yAddr, xAddr] of SLOTS) [a, c, f] = serviceSlot(m, yAddr, xAddr, c, f);
  return (m.regs.a = a), (m.regs.c = c), (m.regs.f = f), m.ret();
}
