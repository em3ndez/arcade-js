// SPDX-License-Identifier: GPL-3.0-only
/** multiplexSpriteSlotsSkipping — scanline-gated position fixup over eight sprite slots. Each slot pairs a Y byte in
 * one sprite bank with the X byte at the matching offset in the other. A slot acts only while its Y
 * byte has bit 7 set and adding the live scanline counter to it carries out of the top; on that
 * trigger the Y byte's bit 7 is cleared, quieting the slot, and the X byte's bit 7 is toggled.
 * LIVE-OUT: the touched sprite bytes, plus the accumulator, C and flags left by the last slot. */

import {
  loc_c000,
  SPRITE_BANK1_SLOT0_Y, SPRITE_BANK0_BASE,
  SPRITE_BANK1_SLOT1_Y, SPRITE_BANK0_SLOT1_X,
  SPRITE_BANK1_SLOT2_Y, SPRITE_BANK0_SLOT2_X,
  SPRITE_BANK1_SLOT19_Y, SPRITE_BANK0_SLOT19_X,
  SPRITE_BANK1_SLOT20_Y, SPRITE_BANK0_SLOT20_X,
  SPRITE_BANK1_SLOT21_Y, SPRITE_BANK0_SLOT21_X,
  SPRITE_BANK1_SLOT22_Y, SPRITE_BANK0_SLOT22_X,
  SPRITE_BANK1_SLOT23_Y, SPRITE_BANK0_SLOT23_X,
} from "./names.js";

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

function serviceSlot(m, yAddr, xAddr) {
  const { regs, mem } = m;
  regs.a = mem.read8(yAddr);
  regs.bit(7, regs.a);
  if (regs.fZ) return;
  regs.c = regs.a;
  regs.a = mem.read8(loc_c000);
  regs.add(regs.c);
  if (regs.fNC) return; // beam not past the trigger line yet
  regs.a = regs.c;
  regs.and(DISARM_MASK);
  mem.write8(yAddr, regs.a);
  regs.a = mem.read8(xAddr);
  regs.add(TOGGLE_X_BIT7);
  mem.write8(xAddr, regs.a);
  if (m.beamPlan) m.beamPlan.push({ y: yAddr, x: xAddr }); // record for the beam-sync render
}

export function multiplexSpriteSlotsSkipping(m) {
  for (const [yAddr, xAddr] of SLOTS) serviceSlot(m, yAddr, xAddr);
  return m.ret();
}
