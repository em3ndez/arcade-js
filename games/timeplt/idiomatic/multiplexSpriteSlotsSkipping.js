// SPDX-License-Identifier: GPL-3.0-only
/** multiplexSpriteSlotsSkipping — scanline-gated position fixup over eight sprite slots. Each slot pairs a Y byte in
 * one sprite bank with the X byte at the matching offset in the other. A slot acts only while its Y
 * byte has bit 7 set and adding the live scanline counter to it carries out of the top; on that
 * trigger the Y byte's bit 7 is cleared, quieting the slot, and the X byte's bit 7 is toggled.
 * LIVE-OUT: the touched sprite bytes, plus the accumulator, C and flags left by the last slot. The
 * register live-out is dispatched from the frozen translated layer, so it rides the closing return,
 * which is a plain return: the stack is left exactly where it was found.
 *
 * ROM 0x0F97-0x1097 (frozen lift translated/loc_0f97.js): eight unrolled blocks, one per scenery
 * sprite. Grounding: [seen] (names.js ROUTINES 0x0f97).
 *
 * Role in the machine: the OPPORTUNISTIC sprite-doubling pass. Time Pilot shows each of its eight
 * scenery-fed hardware sprites (0-2 and 19-23) twice per frame by moving it half the coordinate range
 * once the raster has drawn it at its first position (mechanisms.md, sprite doubling). A sprite's
 * request is bit 7 of its Y byte, set by publishSpriteShadow's copy into the hardware banks. The round
 * engine runs this pass five times at points spread through its service list: a sprite whose line the
 * beam has already passed is traded now, and one whose line has not come is left armed for a later
 * pass. multiplexSpriteSlots is the waiting pass that closes the list.
 *
 * Why it must go by the raster: the trade is due once SCANLINE_COUNTER (0xC000 read side) plus the Y
 * byte carries out of eight bits -- once the counter has reached 256 minus the Y byte, a line that
 * depends on where the sprite sits. Trading earlier would move the sprite before its first appearance
 * is drawn.
 *
 * Parameters: c, f — the C register and flags on entry. The ROM threads A, C and the flags from one
 * block into the next. An idle slot never loads C, and BIT keeps the incoming carry flag, so if no slot
 * is armed the C and carry the pass ends with are the caller's own; they are therefore taken in and
 * handed on. They reach ONLY that register hand-back, never a sprite byte: every armed slot reloads C
 * from its own Y byte and recomputes the carry from its own add before anything is written.
 *
 * Two entries. multiplexSpriteSlotsSkipping is the register-dispatched one (ROUTINES 0x0f97): the
 * frozen layer's callers leave C and the flags in the registers and read A, C and the flags back.
 * sweepSpriteSlotsSkipping is the one an idiomatic caller calls: it carries no register in (a direct
 * caller has no C or flags to hand over -- what the ROM would carry is whatever the previous routine
 * left) and leaves none behind; it does the same sprite work through the same slot code.
 */

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
  // `ld a,(Y) / bit 7,a`: the request bit. BIT sets the flags whether or not the slot is armed.
  let a = mem8[yAddr];
  const armed = (a & 0x80) !== 0;
  f = bit7Flags(f, armed, a);
  if (!armed) return [a, c, f]; // bit 7 clear: slot idle
  // `ld c,a / ld a,(0xC000) / add a,c`: keep the Y byte in C and add the live raster count to it;
  // a carry out of eight bits means the beam has passed this sprite's line.
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

// Walk the eight slots in ROM order, each block taking the A/C/flags the previous one left, and
// return what the last slot leaves.
function sweep(m, c, f) {
  let a;
  for (const [yAddr, xAddr] of SLOTS) [a, c, f] = serviceSlot(m, yAddr, xAddr, c, f);
  return [a, c, f];
}

export function multiplexSpriteSlotsSkipping(m, c = m.regs.c, f = m.regs.f) {
  // Hand the last slot's A, C and flags back, and leave them in the registers for the caller.
  const [a, lastC, lastF] = sweep(m, c, f);
  return [(m.regs.a = a), (m.regs.c = lastC), (m.regs.f = lastF)];
}

// No register is carried in: an idle slot passes the incoming C and flags straight through to the
// hand-back, which a direct caller does not take, so starting them at zero changes no sprite byte.
const NOTHING_CARRIED = 0;

export function sweepSpriteSlotsSkipping(m) {
  sweep(m, NOTHING_CARRIED, NOTHING_CARRIED);
}
